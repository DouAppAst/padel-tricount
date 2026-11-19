import { PGlite } from '@electric-sql/pglite'
let t = Date.now()
const db = new PGlite()
await db.waitReady
console.log('init', Date.now() - t, 'clone' in db)
await db.exec('create table x(a int); insert into x values (1)')
t = Date.now()
const c = await db.clone()
console.log('clone', Date.now() - t, (await c.query('select * from x')).rows)
