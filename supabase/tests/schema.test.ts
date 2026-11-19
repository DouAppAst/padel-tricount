import { PGlite, type PGliteInterface, type Transaction } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// Minimal stand-in for what Supabase provides: roles, auth.users, auth.uid(),
// and the platform default privileges that expose new public objects to the API roles.
// Granting everything by default here proves the migration revokes what it must.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations')

const U = {
  admin: '00000000-0000-4000-8000-0000000000a1',
  alice: '00000000-0000-4000-8000-0000000000a2',
  bob: '00000000-0000-4000-8000-0000000000a3',
  stranger: '00000000-0000-4000-8000-0000000000a4',
}
const P = {
  admin: '00000000-0000-4000-8000-0000000000b1',
  alice: '00000000-0000-4000-8000-0000000000b2',
  bob: '00000000-0000-4000-8000-0000000000b3',
  chloe: '00000000-0000-4000-8000-0000000000b4',
}

const SEED = `
  insert into auth.users (id, email) values
    ('${U.admin}', 'admin@example.com'), ('${U.alice}', 'alice@example.com'),
    ('${U.bob}', 'bob@example.com'), ('${U.stranger}', 'stranger@example.com');
  insert into public.participants (id, display_name, auth_user_id, is_admin) values
    ('${P.admin}', 'Admin', '${U.admin}', true),
    ('${P.alice}', 'Alice', '${U.alice}', false),
    ('${P.bob}', 'Bob', '${U.bob}', false),
    ('${P.chloe}', 'Chloe', null, false);
`

let template: PGlite
let db: PGliteInterface

beforeAll(async () => {
  template = new PGlite()
  await template.exec(SUPABASE_STUB)
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await template.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  await template.exec(SEED)
}, 60_000)

afterAll(async () => {
  await template.close()
})

beforeEach(async () => {
  db = await template.clone()
})

afterEach(async () => {
  await db.close()
})

type Who = keyof typeof U | 'anon'

/** Runs `fn` as an API user, like PostgREST does: role switch + JWT claims, in one transaction. */
function as<T>(who: Who, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (who === 'anon') {
      await tx.exec('set local role anon')
    } else {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: U[who], role: 'authenticated' }),
      ])
      await tx.exec('set local role authenticated')
    }
    return fn(tx)
  })
}

const rows = async <T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []) =>
  as(who, async (tx) => (await tx.query<T>(sql, params)).rows)

const one = async <T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []) =>
  (await rows<T>(who, sql, params))[0]

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(`select count(*)::int as n from ${sql}`)).rows[0].n)

const entry = (player: string, paidBy: string, type = 'CSE_TICKET', amount = 550) => ({
  player_id: player,
  paid_by_participant_id: paidBy,
  payment_type: type,
  amount_cents: amount,
})

const saveGame = (who: Who, entries: unknown, gameId: string | null = null) =>
  one<{ id: string }>(who, `select public.save_game($1, '2026-11-19', null, null, $2) as id`, [
    gameId,
    JSON.stringify(entries),
  ]).then((r) => r.id)

const TABLES = ['participants', 'settings', 'games', 'game_entries', 'settlements', 'link_requests']

describe('anonymous visitors', () => {
  it.each(TABLES)('cannot read %s', async (table) => {
    await expect(rows('anon', `select * from public.${table}`)).rejects.toThrow(/permission denied/)
  })

  it('cannot call any RPC', async () => {
    await expect(rows('anon', 'select public.get_my_status()')).rejects.toThrow(/permission denied/)
    await expect(
      rows('anon', `select public.save_game(null, current_date, null, null, '[]')`),
    ).rejects.toThrow(/permission denied/)
  })

  it('cannot reach the private helpers', async () => {
    await expect(rows('anon', 'select private.is_admin()')).rejects.toThrow(/permission denied/)
  })
})

describe('authenticated user not linked to a participant', () => {
  it.each(TABLES.filter((t) => t !== 'link_requests'))('sees no row in %s', async (table) => {
    expect(await rows('stranger', `select * from public.${table}`)).toEqual([])
  })

  it('cannot write games or settlements', async () => {
    await expect(saveGame('stranger', [entry(P.alice, P.alice)])).rejects.toThrow('NOT_MEMBER')
    await expect(
      rows('stranger', `select public.save_settlement(null, $1, $2, 550, null, null)`, [
        P.alice,
        P.bob,
      ]),
    ).rejects.toThrow('NOT_MEMBER')
  })

  it('goes through the link request flow', async () => {
    const status = await one<{ s: unknown }>('stranger', 'select public.get_my_status() as s')
    expect(status.s).toEqual({ participant: null, last_request: null })

    expect(await rows('stranger', 'select * from public.linkable_participants()')).toEqual([
      { id: P.chloe, display_name: 'Chloe' },
    ])

    const { id: requestId } = await one<{ id: string }>(
      'stranger',
      'select public.request_link($1) as id',
      [P.chloe],
    )
    const pending = await one<{ s: { last_request: { status: string; display_name: string } } }>(
      'stranger',
      'select public.get_my_status() as s',
    )
    expect(pending.s.last_request).toMatchObject({ status: 'PENDING', display_name: 'Chloe' })

    await expect(rows('alice', 'select public.approve_link($1)', [requestId])).rejects.toThrow(
      'NOT_ADMIN',
    )
    await rows('admin', 'select public.approve_link($1)', [requestId])

    const linked = await one<{ s: { participant: { id: string } } }>(
      'stranger',
      'select public.get_my_status() as s',
    )
    expect(linked.s.participant).toMatchObject({ id: P.chloe, is_admin: false })
    expect(await rows('stranger', 'select * from public.participants')).toHaveLength(4)
  })

  it('cannot request an already linked participant', async () => {
    await expect(rows('stranger', 'select public.request_link($1)', [P.alice])).rejects.toThrow(
      'PARTICIPANT_UNAVAILABLE',
    )
  })

  it('a linked user cannot request another participant', async () => {
    await expect(rows('alice', 'select public.request_link($1)', [P.chloe])).rejects.toThrow(
      'ALREADY_LINKED',
    )
  })

  it('a new request replaces the pending one; a rejection is visible', async () => {
    await rows('stranger', 'select public.request_link($1)', [P.chloe])
    await db.exec(`insert into public.participants (display_name) values ('David')`)
    const david = (
      await db.query<{ id: string }>(`select id from participants where display_name = 'David'`)
    ).rows[0].id
    const { id } = await one<{ id: string }>('stranger', 'select public.request_link($1) as id', [
      david,
    ])
    expect(await count(`link_requests where status = 'PENDING'`)).toBe(1)

    await rows('admin', 'select public.reject_link($1)', [id])
    const status = await one<{ s: { participant: null; last_request: { status: string } } }>(
      'stranger',
      'select public.get_my_status() as s',
    )
    expect(status.s.participant).toBeNull()
    expect(status.s.last_request.status).toBe('REJECTED')
  })

  it('only sees its own link requests, admins see all', async () => {
    await rows('stranger', 'select public.request_link($1)', [P.chloe])
    expect(await rows('stranger', 'select * from public.link_requests')).toHaveLength(1)
    expect(await rows('alice', 'select * from public.link_requests')).toHaveLength(0)
    expect(await rows('admin', 'select * from public.link_requests')).toHaveLength(1)
  })
})

describe('games', () => {
  it('a member records a game with all its entries', async () => {
    const id = await saveGame('alice', [
      entry(P.alice, P.alice),
      entry(P.bob, P.alice),
      entry(P.admin, P.admin, 'REGULAR', 1300),
    ])
    const game = await one<{ location: string; created_by: string }>(
      'bob',
      'select location, created_by from public.games where id = $1',
      [id],
    )
    expect(game).toEqual({ location: 'Toulouse Padel Club', created_by: P.alice })
    expect(
      await rows('bob', 'select * from public.game_entries where game_id = $1', [id]),
    ).toHaveLength(3)
  })

  it('editing replaces every entry atomically', async () => {
    const id = await saveGame('alice', [entry(P.alice, P.alice), entry(P.bob, P.alice)])
    await saveGame('bob', [entry(P.bob, P.bob, 'REGULAR', 1300)], id)
    expect(await rows('alice', 'select player_id, amount_cents from public.game_entries')).toEqual([
      { player_id: P.bob, amount_cents: 1300 },
    ])
    expect((await one('alice', 'select updated_by from public.games')).updated_by).toBe(P.bob)
  })

  it('an invalid entry rolls back the whole game', async () => {
    await expect(
      saveGame('alice', [entry(P.alice, P.alice), entry(P.bob, P.alice, 'FREE', 550)]),
    ).rejects.toThrow(/check constraint/)
    await expect(
      saveGame('alice', [entry(P.alice, P.alice), entry(P.alice, P.bob)]),
    ).rejects.toThrow(/duplicate key/)
    await expect(saveGame('alice', [entry(P.alice, P.alice, 'CUSTOM', -1)])).rejects.toThrow(
      /check constraint/,
    )
    await expect(saveGame('alice', [])).rejects.toThrow('NO_PLAYER')
    expect(await count('games')).toBe(0)
    expect(await count('game_entries')).toBe(0)
  })

  it('a failed edit keeps the previous entries', async () => {
    const id = await saveGame('alice', [entry(P.alice, P.alice)])
    await expect(saveGame('alice', [entry(P.bob, P.bob, 'FREE', 100)], id)).rejects.toThrow()
    expect(await count(`game_entries where player_id = '${P.alice}'`)).toBe(1)
  })

  it('cannot be written directly, bypassing the RPC', async () => {
    await expect(
      rows('alice', `insert into public.games (played_at, location) values (current_date, 'x')`),
    ).rejects.toThrow(/permission denied/)
    await expect(rows('admin', 'delete from public.game_entries')).rejects.toThrow(
      /permission denied/,
    )
  })

  it('soft delete and restore', async () => {
    const id = await saveGame('alice', [entry(P.alice, P.alice)])
    await rows('bob', 'select public.set_game_deleted($1, true)', [id])
    expect((await one('alice', 'select deleted_at from public.games')).deleted_at).not.toBeNull()
    await expect(saveGame('alice', [entry(P.alice, P.alice)], id)).rejects.toThrow('GAME_NOT_FOUND')
    await expect(rows('bob', 'select public.set_game_deleted($1, true)', [id])).rejects.toThrow(
      'GAME_NOT_FOUND',
    )
    await rows('bob', 'select public.set_game_deleted($1, false)', [id])
    expect((await one('alice', 'select deleted_at from public.games')).deleted_at).toBeNull()
  })

  it('a participant used in a game cannot be physically deleted', async () => {
    await saveGame('alice', [entry(P.bob, P.alice)])
    await expect(
      rows('admin', 'delete from public.participants where id = $1', [P.bob]),
    ).rejects.toThrow(/foreign key/)
  })
})

describe('settlements', () => {
  const save = (who: Who, from: string, to: string, amount: number, kind = 'REFUND') =>
    one<{ id: string }>(
      who,
      `select public.save_settlement(null, $1, $2, $3, null, null, $4) as id`,
      [from, to, amount, kind],
    ).then((r) => r.id)

  it('a member records a refund', async () => {
    await save('bob', P.bob, P.alice, 550)
    expect(
      await rows('alice', 'select kind, amount_cents, created_by from public.settlements'),
    ).toEqual([{ kind: 'REFUND', amount_cents: 550, created_by: P.bob }])
  })

  it('rejects invalid refunds', async () => {
    await expect(save('bob', P.bob, P.bob, 550)).rejects.toThrow(/check constraint/)
    await expect(save('bob', P.bob, P.alice, 0)).rejects.toThrow(/check constraint/)
  })

  it('opening balances are admin-only', async () => {
    await expect(save('alice', P.alice, P.bob, 1000, 'OPENING')).rejects.toThrow('NOT_ADMIN')
    const id = await save('admin', P.alice, P.bob, 1000, 'OPENING')
    await expect(
      rows('alice', 'select public.set_settlement_deleted($1, true)', [id]),
    ).rejects.toThrow('NOT_ADMIN')
    await rows('admin', 'select public.set_settlement_deleted($1, true)', [id])
  })

  it('an edit cannot turn a refund into an opening balance', async () => {
    const id = await save('bob', P.bob, P.alice, 550)
    await expect(
      rows('admin', `select public.save_settlement($1, $2, $3, 600, null, null, 'OPENING')`, [
        id,
        P.bob,
        P.alice,
      ]),
    ).rejects.toThrow('SETTLEMENT_NOT_FOUND')
  })
})

describe('participants and settings administration', () => {
  it('members cannot create participants or change settings', async () => {
    await expect(
      rows('alice', `insert into public.participants (display_name) values ('Eve')`),
    ).rejects.toThrow(/row-level security/)
    await rows('alice', 'update public.settings set cse_ticket_price_cents = 1')
    expect(
      (await one('alice', 'select cse_ticket_price_cents from public.settings'))
        .cse_ticket_price_cents,
    ).toBe(550)
  })

  it('admins manage participants and settings', async () => {
    await rows('admin', `insert into public.participants (display_name) values ('Eve')`)
    await rows('admin', 'update public.settings set cse_ticket_price_cents = 600')
    expect(
      (await one('alice', 'select cse_ticket_price_cents from public.settings'))
        .cse_ticket_price_cents,
    ).toBe(600)
    await expect(
      rows('admin', 'update public.settings set regular_price_cents = -1'),
    ).rejects.toThrow(/check constraint/)
  })

  it('rejects duplicate active names, case-insensitively', async () => {
    await expect(
      rows('admin', `insert into public.participants (display_name) values ('alice')`),
    ).rejects.toThrow(/duplicate key/)
  })

  it('a member cannot promote themself', async () => {
    await rows('alice', 'update public.participants set is_admin = true where id = $1', [P.alice])
    expect(await count('participants where is_admin')).toBe(1)
  })

  it('the last admin cannot be removed from the app', async () => {
    await expect(
      rows('admin', 'update public.participants set is_admin = false where id = $1', [P.admin]),
    ).rejects.toThrow('LAST_ADMIN')
    await rows('admin', 'update public.participants set is_admin = true where id = $1', [P.alice])
    await rows('admin', 'update public.participants set is_admin = false where id = $1', [P.admin])
    expect(await count('participants where is_admin')).toBe(1)
  })

  it('a deactivated participant loses access', async () => {
    await rows('admin', 'update public.participants set active = false where id = $1', [P.bob])
    expect(await rows('bob', 'select * from public.games')).toEqual([])
    await expect(saveGame('bob', [entry(P.bob, P.bob)])).rejects.toThrow('NOT_MEMBER')
  })

  it('deleting a login account unlinks the participant and keeps the history', async () => {
    await saveGame('bob', [entry(P.bob, P.bob)])
    await db.exec(`delete from auth.users where id = '${U.bob}'`)
    const bob = (
      await db.query<{ auth_user_id: string | null }>(
        `select auth_user_id from participants where id = '${P.bob}'`,
      )
    ).rows[0]
    expect(bob.auth_user_id).toBeNull()
    expect(await count('game_entries')).toBe(1)
  })
})
