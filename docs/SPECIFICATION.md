# Padel Tricount - Specification d'implementation (v2)

> **Revision v2** - relecture technique de la v1.
> Les changements par rapport a la v1 sont resumes en section 0. Les decisions ont ete validees le 2026-11-16 (section 21).

### Contraintes du projet

- **Cout zero** : uniquement des offres gratuites (GitHub Pages sur repo public, Supabase Free). Aucun service payant, aucun service d'envoi d'email.
- **Accessible de partout** : reseau Renault (via le proxy d'entreprise) et reseaux prives. Verifie le 2026-11-16 : `github.io`, `github.com` et `*.supabase.co` passent par le proxy Renault ; les deux services sont publics sur Internet.
- Repository : `https://github.com/DouAppAst/padel-tricount` (public, cree).

---

## 0. Changements par rapport a la v1

| #   | Section | Changement                                                                                                                                         | Raison                                                                                                                                                                                                     |
| --- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 5       | **Formule de solde corrigee** : `+ remboursements_emis - remboursements_recus`                                                                     | La v1 avait le signe inverse : un remboursement aurait _aggrave_ la dette au lieu de la solder.                                                                                                            |
| 2   | 3, 14   | `DouAppAst` est un **compte utilisateur GitHub**, pas une organisation. Le repository doit etre **public** (GitHub Pages gratuit).                 | Verifie sur GitHub. Pages sur repo prive = plan payant.                                                                                                                                                    |
| 3   | 3, 12   | Routing via **`HashRouter`** (`/#/parties`).                                                                                                       | GitHub Pages ne gere pas le fallback SPA : un refresh sur `/padel-tricount/parties` renvoie un 404.                                                                                                        |
| 4   | 7, 10   | Enregistrement d'une partie via une **fonction Postgres (RPC) transactionnelle**.                                                                  | Le client Supabase JS ne fait pas de transaction multi-tables : une partie pourrait etre creee sans ses `game_entries`.                                                                                    |
| 5   | 7, 9    | Ajout de `participants.auth_user_id` pour lier un compte a un participant.                                                                         | Necessaire pour `Mon solde`, les roles admin et les policies RLS. La v1 ne permettait pas de savoir "qui est l'utilisateur courant".                                                                       |
| 6   | 9       | Authentification : **Supabase Auth email + mot de passe, sans aucun email envoye** (confirmation desactivee) + validation du compte par un admin.  | L'option "code de groupe" n'est pas realisable proprement avec RLS seul. Le service d'email integre de Supabase n'envoie qu'aux membres de l'equipe Supabase : un OTP par email exigerait un SMTP externe. |
| 7   | 7       | Suppression **logique** (`deleted_at`) des parties et remboursements + champs `updated_by`.                                                        | Donnees financieres partagees : il faut pouvoir tracer et annuler une erreur.                                                                                                                              |
| 8   | 7       | Contraintes de base explicites (unicite joueur/partie, `from != to`, `amount > 0`, coherence `FREE = 0`).                                          | La v1 ne mentionnait que `amount_cents >= 0`.                                                                                                                                                              |
| 9   | 4, 13   | Regle explicite pour la **modification d'une ancienne partie**.                                                                                    | La v1 testait le cas sans definir le comportement attendu.                                                                                                                                                 |
| 10  | 6       | L'algorithme glouton **reduit** le nombre de transactions mais ne garantit pas le minimum absolu (probleme NP-difficile). Tri deterministe ajoute. | Eviter une promesse fausse et des suggestions qui "sautent" d'un affichage a l'autre.                                                                                                                      |
| 11  | 7, 16   | Ajout de la **reprise de l'existant** (soldes du fichier Excel).                                                                                   | Sans cela, l'application demarre avec des soldes faux.                                                                                                                                                     |
| 12  | 3, 15   | Contraintes Supabase gratuit : **mise en pause apres 7 jours d'inactivite**, pas de sauvegarde PITR ; region **UE**.                               | Risque operationnel reel pour un usage hebdomadaire.                                                                                                                                                       |
| 13  | 11      | `NavigationRail` n'existe pas dans MUI -> `Drawer`. `DatePicker` MUI remplace par `<input type="date">` natif.                                     | Exactitude technique ; le picker natif est meilleur sur mobile et evite une dependance.                                                                                                                    |
| 14  | 12, 14  | Outillage precise : Vitest, oxlint, Prettier, Supabase CLI, types generes, version Node figee. Cle Supabase "publishable".                         | Rendre le plan directement executable.                                                                                                                                                                     |

---

## 1. Contexte

Nous jouons regulierement au padel entre collegues au **Toulouse Padel Club**.

Deux modes de paiement coexistent :

- **Ticket CSE : 5,50 EUR par personne**.
- **Tarif classique : 13 EUR par personne**, utilise notamment lorsqu'il n'y a plus de tickets CSE.

Une personne peut avancer le paiement d'une ou plusieurs places pour les autres. L'objectif est donc de disposer d'une petite application de groupe, proche de l'usage de Tricount, qui calcule automatiquement **qui doit combien a qui**.

Le projet doit remplacer le fichier Excel initial par une application Web plus simple a saisir sur ordinateur ou telephone, facile a bookmarker et partagee par toute l'equipe.

---

## 2. Objectifs

Construire une application Web permettant de :

1. gerer les participants du groupe ;
2. enregistrer rapidement une partie de padel ;
3. enregistrer, pour chaque joueur, qui a paye sa place et selon quel tarif ;
4. calculer automatiquement les soldes individuels ;
5. calculer et simplifier les dettes entre participants ;
6. consulter l'historique des parties ;
7. enregistrer les remboursements entre participants ;
8. modifier ou corriger une partie en cas d'erreur ;
9. disposer d'une administration minimale pour les participants et les tarifs ;
10. reprendre les soldes existants du fichier Excel.

Le MVP ne doit pas chercher a reproduire toutes les fonctions de Tricount.

Langue de l'interface : **francais**. Devise unique : **EUR**, formatee avec `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`.

---

## 3. Architecture

### Frontend

- **React** + **TypeScript** (mode `strict`)
- **Vite**
- **Material UI (MUI)**
- **React Router** en mode **`HashRouter`** (voir ci-dessous)
- Responsive, mobile-first

### Hebergement

**GitHub Pages** depuis un repository du **compte utilisateur** GitHub `DouAppAst` :

- compte : `DouAppAst` (compte utilisateur, pas une organisation)
- repository : `padel-tricount` - **public** (GitHub Pages n'est gratuit que sur repo public)
- URL cible : `https://douappast.github.io/padel-tricount/`
- source Pages : **GitHub Actions** (pas de branche `gh-pages`)

Deploiement automatique via GitHub Actions a chaque push sur `main`.

**Routing** : GitHub Pages ne sait pas renvoyer `index.html` pour une route inconnue. Avec `BrowserRouter`, un rafraichissement sur `/padel-tricount/parties` donnerait un 404. On utilise donc `HashRouter` (`https://douappast.github.io/padel-tricount/#/parties`) : simple, robuste, aucune astuce `404.html`.

### Backend / stockage

**Supabase** (offre gratuite) pour :

- PostgreSQL ;
- API (PostgREST + fonctions RPC) ;
- authentification (Supabase Auth) ;
- Row Level Security (RLS).

Points d'attention offre gratuite :

- **Region UE** (ex. `eu-west-3` Paris) : les noms et emails des collegues sont des donnees personnelles (RGPD).
- **Mise en pause apres 7 jours sans activite.** Les donnees sont conservees mais l'application ne repond plus. Le workflow de sauvegarde (section 14.3), execute tous les 3 jours, sert aussi de keep-alive. Le reveil d'un projet en pause est manuel depuis le dashboard Supabase.
- **Aucune sauvegarde restaurable sur l'offre gratuite.** Strategie de sauvegarde en section 14.3.

GitHub Pages ne contient que l'application statique. Aucune donnee metier (parties, participants, soldes, remboursements) n'est stockee dans le repository Git.

Architecture logique :

```text
GitHub Pages (statique, public)
└── React / TypeScript / Vite  (HashRouter)
        |  cle publishable + session utilisateur (JWT)
        v
Supabase (UE)
├── Auth (email + mot de passe, aucun email envoye)
├── tables : participants, link_requests, games, game_entries, settlements, settings
├── RPC    : save_game, save_settlement, request_link, approve_link, ...
└── RLS    : sur toutes les tables
```

---

## 4. Regles metier

### Tarifs par defaut

```text
CSE_TICKET = 550  centimes (5,50 EUR)
REGULAR    = 1300 centimes (13,00 EUR)
FREE       = 0
CUSTOM     = montant saisi
```

Les tarifs sont configurables (table `settings`).

**Le montant effectivement applique est enregistre dans chaque `game_entries.amount_cents`.** Les tarifs configures ne servent que de valeurs par defaut a la saisie.

Exemple : si le tarif CSE passe de 5,50 EUR a 6 EUR, les anciennes parties conservent 5,50 EUR.

### Partie

Une partie contient plusieurs participants, generalement quatre (minimum 1, pas de maximum strict - on peut etre 5 avec rotation).

Pour chaque joueur, enregistrer independamment :

- le joueur ;
- le mode de paiement ;
- le prix applique ;
- la personne ayant effectivement paye la place (peut etre un participant **qui ne joue pas** ce jour-la).

Un joueur n'apparait **qu'une fois** par partie. Les parties mixtes (CSE + classique) sont autorisees.

### Modification d'une partie existante

- Les lignes non modifiees conservent leur `amount_cents` historique.
- Si l'utilisateur change le mode de paiement d'une ligne, le montant est pre-rempli avec le **tarif actuel** du nouveau mode, et reste modifiable.
- Ajouter un joueur a une ancienne partie pre-remplit avec le tarif actuel.
- Un changement global de tarif ne modifie **jamais** les parties deja enregistrees.

### Exemple

| Joueur | Mode           |     Cout | Paye par |
| ------ | -------------- | -------: | -------- |
| Alice  | Ticket CSE     | 5,50 EUR | Alice    |
| Bruno  | Ticket CSE     | 5,50 EUR | Alice    |
| Chloe  | Ticket CSE     | 5,50 EUR | Alice    |
| David  | Prix classique |   13 EUR | David    |

Resultat :

- Bruno doit 5,50 EUR a Alice ;
- Chloe doit 5,50 EUR a Alice ;
- David ne doit rien ;
- Alice doit recevoir 11 EUR.

---

## 5. Calcul des soldes

Pour chaque participant :

```text
solde = total_paye - total_consomme + remboursements_emis - remboursements_recus
```

avec :

- `total_paye` = somme des `amount_cents` des lignes ou il est `paid_by_participant_id` ;
- `total_consomme` = somme des `amount_cents` des lignes ou il est `player_id` ;
- `remboursements_emis` = somme des settlements ou il est `from_participant_id` (il a rendu de l'argent) ;
- `remboursements_recus` = somme des settlements ou il est `to_participant_id` (il a recu de l'argent).

Seules les parties et remboursements non supprimes (`deleted_at IS NULL`) sont pris en compte.

Interpretation :

- `solde > 0` : la personne doit recevoir de l'argent ;
- `solde < 0` : la personne doit payer ;
- `solde = 0` : equilibre.

Invariant : **la somme de tous les soldes vaut toujours 0.**

Verification sur l'exemple : Bruno a un solde de -550. Il rembourse 550 a Alice (settlement Bruno -> Alice) :

```text
Bruno : -550 + 550 (emis)  = 0
Alice    : +1100 - 550 (recu) = +550   (reste du par Chloe)
```

> La v1 indiquait `+ remboursements_recus - remboursements_emis`, ce qui aurait donne Bruno a -1100 apres avoir rembourse.

**Tous les montants sont stockes et calcules en centimes entiers** (`integer` en base, `number` entier cote TS). Aucune operation `float` sur des euros. Conversion en euros uniquement a l'affichage et a la saisie.

```text
5,50 EUR -> 550
13 EUR   -> 1300
```

Le calcul se fait cote client (volume tres faible : quelques centaines de lignes), dans des fonctions pures du dossier `domain/`.

---

## 6. Simplification des dettes

L'application affiche une liste **reduite** de transactions permettant de remettre tous les soldes a zero.

Exemple :

```text
Alice doit 5,50 EUR a Bruno
Bruno doit 11 EUR a Alice
=> Bruno doit 5,50 EUR a Alice
```

### Algorithme (glouton)

1. calculer le solde net de chaque participant ;
2. crediteurs (`balance > 0`) et debiteurs (`balance < 0`) ;
3. trier par montant absolu decroissant, **puis par nom** (tri deterministe : les suggestions ne doivent pas changer d'un affichage a l'autre) ;
4. associer le plus gros debiteur au plus gros crediteur ;
5. transaction = minimum des deux montants restants ;
6. recommencer jusqu'a ce que tous les soldes soient nuls.

Propriete garantie : au plus `n - 1` transactions pour `n` participants non equilibres. Le minimum absolu n'est pas garanti (probleme NP-difficile), ce qui est sans importance a cette echelle.

Fonction pure et testee :

```ts
simplifyDebts(balances: Map<ParticipantId, Cents>): SettlementSuggestion[]
```

---

## 7. Modele de donnees

Conventions : cles `uuid` (`gen_random_uuid()`), horodatages `timestamptz default now()`, montants en `integer` centimes. Schema versionne via **migrations Supabase CLI** (`supabase/migrations/`).

### `participants`

- `id uuid pk`
- `display_name text not null` - unique (insensible a la casse) parmi les actifs
- `auth_user_id uuid null unique references auth.users` - lien avec le compte de connexion
- `active boolean not null default true`
- `is_admin boolean not null default false`
- `created_at`, `updated_at`

Pas de suppression physique d'un participant present dans l'historique : `active = false`. Un participant inactif n'apparait plus dans la saisie mais reste visible dans l'historique et les soldes (tant que son solde n'est pas nul).

### `games`

- `id uuid pk`
- `played_at date not null`
- `location text not null` (defaut : `settings.default_location`)
- `comment text null`
- `created_by uuid null references participants`
- `updated_by uuid null references participants`
- `created_at`, `updated_at`
- `deleted_at timestamptz null` - suppression logique

### `game_entries`

- `id uuid pk`
- `game_id uuid not null references games on delete cascade`
- `player_id uuid not null references participants`
- `paid_by_participant_id uuid not null references participants`
- `payment_type text not null check (payment_type in ('CSE_TICKET','REGULAR','FREE','CUSTOM'))`
- `amount_cents integer not null check (amount_cents >= 0)`
- `created_at`

Contraintes :

```sql
unique (game_id, player_id)
check (payment_type <> 'FREE' or amount_cents = 0)
```

### `settlements`

Remboursements reels effectues, ou ajustements de reprise.

- `id uuid pk`
- `from_participant_id uuid not null references participants` - celui qui donne l'argent
- `to_participant_id uuid not null references participants` - celui qui le recoit
- `amount_cents integer not null check (amount_cents > 0)`
- `kind text not null default 'REFUND' check (kind in ('REFUND','OPENING'))`
- `settled_at date not null`
- `comment text null`
- `created_by`, `updated_by uuid null references participants`
- `created_at`, `updated_at`
- `deleted_at timestamptz null`

Contrainte : `check (from_participant_id <> to_participant_id)`.

### `settings`

Une **ligne unique** avec colonnes typees (plus simple a valider qu'un cle/valeur) :

```text
id                     = 1 (check id = 1)
cse_ticket_price_cents = 550
regular_price_cents    = 1300
default_location       = 'Toulouse Padel Club'
```

### Fonctions RPC (Postgres `security definer`, `set search_path = ''`)

Les ecritures de parties et de remboursements passent **uniquement** par ces fonctions : aucun droit d'ecriture direct sur `games`, `game_entries`, `settlements`. Chaque fonction verifie l'appartenance (`NOT_MEMBER`) ou le role admin (`NOT_ADMIN`) et s'execute dans une seule transaction.

- `save_game(p_game_id, p_played_at, p_location, p_comment, p_entries jsonb) returns uuid` - cree (`p_game_id` null) ou remplace une partie et toutes ses lignes (delete + insert des `game_entries`) ; renseigne `created_by` / `updated_by`.
- `set_game_deleted(p_game_id, p_deleted)` - suppression logique / restauration.
- `save_settlement(...)` / `set_settlement_deleted(...)` - `kind = 'OPENING'` reserve aux admins.
- `get_my_status()`, `linkable_participants()` - accessibles aux comptes non lies (ecran "Qui es-tu ?").
- Helpers RLS dans le schema `private`, non expose par l'API : `current_participant_id()`, `is_member()`, `is_admin()`.
- Trigger : un utilisateur de l'application ne peut pas retirer le dernier admin (`LAST_ADMIN`).
- Droits : `revoke all` puis `grant` minimal au role `authenticated` ; aucun droit pour `anon`.

### Reprise de l'existant (Excel)

Plutot que de ressaisir tout l'historique, on importe la **liste simplifiee des dettes** calculee a partir de l'Excel a la date de bascule.

Une dette d'ouverture "X doit N a Y" est enregistree comme un settlement `kind = 'OPENING'` **de Y vers X** (Y "avance" N a X : Y passe a +N, X a -N, conformement a la formule de la section 5). L'UI de saisie masque ce sens inverse : l'admin saisit simplement "X doit N a Y".

Decision : seuls les soldes d'ouverture sont repris, pas l'historique des parties. Les vraies donnees seront saisies plus tard par l'admin, ce qui servira aussi a tester l'ecran de saisie.

### `link_requests`

Demandes de liaison compte -> participant, validees par un admin.

- `id uuid pk`
- `auth_user_id uuid not null references auth.users on delete cascade`
- `participant_id uuid not null references participants`
- `status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED'))`
- `created_at`, `decided_at timestamptz null`, `decided_by uuid null references participants`

Contrainte : une seule demande `PENDING` par `auth_user_id` (index unique partiel).

RPC :

- `request_link(participant_id uuid)` - cree la demande pour `auth.uid()`.
- `approve_link(request_id uuid)` / `reject_link(request_id uuid)` - admin ; `approve_link` renseigne `participants.auth_user_id` (remplace un ancien lien eventuel, utile apres une reinscription).

Amorcage du premier admin : une requete SQL documentee dans le README, lancee une fois depuis le SQL Editor Supabase.

---

## 8. Ecrans

### 8.0 Connexion / premier acces

1. Ecran de connexion : email + mot de passe, avec un onglet **Creer un compte** (email perso + mot de passe de 8 caracteres minimum). Aucun email n'est envoye.
2. Si le compte n'est lie a aucun participant : ecran "Qui es-tu ?" proposant les participants actifs non encore lies -> `request_link`. Ecran d'attente "Demande envoyee, un admin doit la valider".
3. Les admins voient un badge sur l'onglet Admin quand des demandes sont en attente.
4. Session persistante (pas de reconnexion a chaque visite) ; bouton de deconnexion dans le menu.

### 8.1 Accueil / Dashboard

Afficher :

- bouton principal **Nouvelle partie** ;
- solde de l'utilisateur courant ;
- liste simplifiee des dettes qui le concernent, puis celles du groupe ;
- dernieres parties ;
- action **Enregistrer un remboursement**.

```text
Tu dois 11,00 EUR a Bruno.
Chloe te doit 5,50 EUR.
```

Desktop : dashboard en cartes. Mobile : bouton `Nouvelle partie` tres visible (FAB), puis soldes et historique.

### 8.2 Nouvelle partie

Objectif UX : saisie typique **en moins de 30 secondes**.

Pre-remplissage :

- date : aujourd'hui ;
- lieu : `settings.default_location` ;
- joueurs : ceux de la **derniere partie** (le groupe est souvent le meme) ;
- `Paye par` de chaque ligne : le joueur lui-meme.

Workflow :

1. selectionner les joueurs parmi les participants actifs (chips) ;
2. **actions de groupe** en tete de formulaire : "Tout en ticket CSE", "Tout en tarif classique", "Tout paye par [X]" ;
3. ajuster ligne par ligne si besoin : mode (Ticket CSE / Classique / Offert / Montant perso) et `Paye par` ;
4. recapitulatif ;
5. confirmer.

Recapitulatif :

```text
Total : 29,50 EUR
Alice a paye 3 tickets CSE : 16,50 EUR.
Bruno doit 5,50 EUR a Alice.
Chloe doit 5,50 EUR a Alice.
```

Validations : au moins un joueur, montant perso >= 0, date non vide.

### 8.3 Soldes

**Mon solde** :

```text
Tu dois payer :     5,50 EUR
Tu dois recevoir : 11,00 EUR
Solde net :        +5,50 EUR
```

puis les transactions suggerees qui le concernent.

**Groupe** : pour chaque participant - paye, consomme, remboursements emis/recus, solde net.

### 8.4 Historique

Parties de la plus recente a la plus ancienne (pagination ou chargement progressif au-dela de ~50).

Chaque ligne : date, lieu, participants, total, modes de paiement.

Vue detail : toutes les `game_entries`, auteur et date de derniere modification.

Actions (tout participant lie, voir section 10) : modifier ; supprimer apres confirmation (suppression logique, avec "Annuler" dans la Snackbar).

L'historique des remboursements est accessible depuis la meme page (onglet) ou la page Soldes.

### 8.5 Remboursement

Formulaire rapide : qui paie, qui recoit, montant, date (aujourd'hui), commentaire optionnel.

Sur chaque dette suggeree (`Bruno doit 5,50 EUR a Alice`) : action **Marquer comme rembourse**, qui pre-remplit le formulaire.

### 8.6 Administration (admins uniquement)

- ajouter / renommer un participant ;
- activer / desactiver un participant ;
- lier / delier un compte a un participant ;
- gerer les administrateurs ;
- modifier les tarifs et le lieu par defaut ;
- saisir les soldes d'ouverture (reprise Excel) ;
- export JSON/CSV de sauvegarde (phase 6, section 14.3).

Desactivation preferee a la suppression des qu'un participant apparait dans l'historique.

---

## 9. Authentification

### Pourquoi pas un "code de groupe" (option A de la v1)

Avec une application statique et la cle publique Supabase, RLS ne peut verifier un mot de passe partage qu'en ajoutant une Edge Function qui emet des jetons, ou via un compte Supabase unique partage. Dans les deux cas, on perd l'identification de l'utilisateur (`Mon solde`, admin, tracabilite) et le gain de simplicite est faible.

### Pourquoi pas un code OTP par email

Le service d'email integre de Supabase **n'envoie qu'aux adresses membres de l'equipe Supabase** du projet (et environ 2 emails/heure). Envoyer des codes aux emails perso des collegues exigerait un SMTP externe (ex. Gmail dedie), ce qui ajoute de la configuration et un point de panne.

### Decision : Supabase Auth, email + mot de passe, aucun email envoye

- `signUp` / `signInWithPassword` avec l'**email perso** de chaque collegue.
- Supabase > Authentication > Sign In / Providers > Email : **"Confirm email" desactive** (aucun email envoye), longueur minimale du mot de passe : 8.
- N'importe qui peut creer un compte, mais un compte **ne voit aucune donnee** tant qu'un admin n'a pas valide sa liaison a un participant (RLS + `link_requests`).
- Chaque compte est lie a un participant via `participants.auth_user_id`.
- **Mot de passe oublie** (pas d'email de reinitialisation) : l'admin supprime le compte dans Supabase > Authentication > Users ; le collegue se reinscrit et redemande la liaison. L'historique est intact car il est rattache au participant, pas au compte.
- Evolution possible sans changement de donnees : OTP par email via un SMTP gratuit.

---

## 10. Securite et autorisations

- Aucune cle `service_role` / secret dans le frontend ni dans le repository.
- Seules `VITE_SUPABASE_URL` et la cle **publishable** (anciennement "anon") sont exposees au navigateur.
- **RLS active sur toutes les tables**, aucun acces au role `anon`.
- Fonctions `security definer` : `set search_path = ''` et noms qualifies.
- Validation des montants en base (contraintes section 7), pas seulement dans React.
- Aucune donnee personnelle ou financiere dans le repository (les tests utilisent des noms fictifs).

Matrice d'autorisations (MVP, groupe de confiance) :

| Table                   | Lecture                                                                                              | Creation / modification / suppression logique          |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `participants`          | participant lie ; compte non lie : liste des participants actifs non lies (via RPC, noms uniquement) | admin                                                  |
| `link_requests`         | sa propre demande ; admin : toutes                                                                   | creation de sa propre demande (RPC) ; decision : admin |
| `games`, `game_entries` | participant lie                                                                                      | participant lie (via RPC)                              |
| `settlements`           | participant lie                                                                                      | participant lie ; `kind = 'OPENING'` : admin           |
| `settings`              | participant lie                                                                                      | admin                                                  |

"Participant lie" = `auth.uid()` correspond a un `participants.auth_user_id` actif.

Concurrence : "dernier enregistrement gagnant" accepte pour le MVP (risque faible).

---

## 11. UX / UI

Outil pratique entre collegues, pas un logiciel comptable.

- interface claire, mobile-first, agreable sur desktop ;
- minimum de clics ; formulations humaines plutot que tableaux ;
- couleurs : vert = a recevoir, orange/rouge = a payer, neutre = equilibre (toujours doublees d'un texte ou signe, pas uniquement la couleur) ;
- confirmation avant toute action destructive ;
- composants accessibles, zones tactiles >= 44 px ;
- etats de chargement et d'erreur reseau visibles (le premier appel peut etre lent si le projet Supabase sortait de veille).

Composants MUI : `AppBar`, `BottomNavigation` (mobile), `Drawer` permanent (desktop), `Card`, `Dialog`, `Snackbar`, `Autocomplete`, `ToggleButtonGroup`, `Chip`, `Fab`.
Dates : `<input type="date">` natif via `TextField type="date"` (meilleur selecteur sur mobile, pas de dependance `@mui/x-date-pickers`).

Navigation :

```text
Accueil | Parties | Soldes | Admin (admins uniquement)
```

Le bouton `+ Nouvelle partie` reste accessible depuis toutes les pages.

---

## 12. Structure de projet

```text
padel-tricount/
├── .github/workflows/
│   ├── ci.yml                 # lint + typecheck + tests sur PR
│   ├── deploy-pages.yml       # build + deploy sur push main
│   └── backup.yml             # pg_dump chiffre tous les 3 jours (+ keep-alive)
├── src/
│   ├── app/                   # App.tsx, router.tsx (HashRouter), theme.ts, AuthGate.tsx
│   ├── components/            # composants UI partages
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── games/
│   │   ├── balances/
│   │   ├── settlements/
│   │   └── admin/
│   ├── domain/                # TS pur, sans React ni Supabase
│   │   ├── models.ts
│   │   ├── money.ts           # parse/format EUR <-> centimes
│   │   ├── balances.ts        # computeBalances(...)
│   │   └── debtSimplification.ts
│   ├── data/
│   │   ├── supabaseClient.ts
│   │   ├── errors.ts          # codes d'erreur metier renvoyes par la base
│   │   └── repositories/
│   └── main.tsx
├── supabase/
│   ├── migrations/            # appliquees via le SQL Editor (voir README)
│   └── tests/                 # tests du schema avec PGlite
├── .env.example               # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
├── .nvmrc                     # Node LTS
├── README.md
├── package.json
└── vite.config.ts             # base: '/padel-tricount/'
```

Tests unitaires co-localises (`*.test.ts`) avec **Vitest**. Lint : **oxlint** (defaut du template Vite) + **Prettier**.
Gestion de l'etat serveur : **TanStack Query** (cache, rechargement, etats loading/erreur).

La logique de calcul ne doit jamais etre dans les composants React.

---

## 13. Tests prioritaires

### Argent (`money.ts`)

- parse `"5,50"`, `"5.50"`, `"13"`, `"13,5"` -> 550 / 550 / 1300 / 1350 ; rejet des valeurs invalides et negatives ;
- format 550 -> `5,50 €`.

### Soldes (`balances.ts`)

- partie ou une seule personne avance tout ;
- chacun paie sa place -> tous a 0 ;
- participant ayant a la fois avance et consomme ;
- payeur qui ne joue pas ;
- **un remboursement ramene le debiteur et le crediteur vers 0** (test de non-regression du signe) ;
- settlement `OPENING` ;
- elements `deleted_at` ignores ;
- invariant : somme des soldes = 0.

### Simplification des dettes

```text
A = +550, B = -550           => B -> A : 550
A = +1100, B = -550, C = -550 => B -> A : 550 ; C -> A : 550
tous a 0                      => []
```

- resultat deterministe (meme entree, meme ordre) ;
- appliquer les suggestions ramene tous les soldes a 0 ;
- au plus n-1 transactions ;
- test par proprietes sur soldes aleatoires (optionnel : `fast-check`).

### Parties

- quatre tickets CSE ; quatre classiques ; partie mixte ; montant perso ; offert ;
- modification d'une ancienne partie apres changement de tarif : les lignes non modifiees gardent leur montant, une ligne dont le mode change prend le tarif actuel.

### Base

- tests du schema avec **PGlite** (PostgreSQL dans Node, sans Docker), lances par `npm test` : aucun droit pour `anon`, un compte non lie ne lit rien, parcours de liaison, RPC transactionnelles, contraintes, RLS admin, dernier admin.

### E2E (phase 6)

- Playwright : connexion mockee, saisie d'une partie, verification du solde.

---

## 14. Deploiement

### Frontend (GitHub Pages)

- `vite.config.ts` : `base: '/padel-tricount/'`.
- Repository > Settings > Pages > Source : **GitHub Actions**.
- Workflow `deploy-pages.yml` avec les actions officielles :
  1. `actions/checkout`
  2. `actions/setup-node` (version de `.nvmrc`, cache npm)
  3. `npm ci`
  4. `npm run lint && npm run typecheck && npm test`
  5. `npm run build`
  6. `actions/configure-pages` + `actions/upload-pages-artifact` (`dist`)
  7. `actions/deploy-pages`
- `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` : **Actions variables** du repository (valeurs publiques par nature) ; en local, `.env.local` (dans `.gitignore`).
- Supabase Auth > URL Configuration : Site URL `https://douappast.github.io/padel-tricount/` (et `http://localhost:5173` en URL de redirection pour le developpement).

### Base (Supabase)

- Tests : PGlite via `npm test` (pas de Docker necessaire).
- Production : migrations appliquees manuellement dans le SQL Editor Supabase, dans l'ordre des fichiers (procedure et creation du premier admin dans le README).

### 14.3 Persistance et sauvegardes (decision 2026-11-19 : A + B)

Persistance :

- Les donnees metier (participants, parties, lignes, remboursements, tarifs, demandes de liaison) vivent **uniquement** dans PostgreSQL Supabase (disque persistant, region UE). Elles survivent aux redemarrages et maintenances, gerees par Supabase.
- Les **soldes et dettes ne sont jamais stockes** : ils sont recalcules a chaque affichage depuis les parties et remboursements (`src/domain`). Aucune desynchronisation possible.
- GitHub Pages ne sert que des fichiers statiques ; le navigateur ne garde que la session et un cache TanStack Query.
- Suppression logique (`deleted_at`) : une suppression via l'application est toujours recuperable.

**A - Export manuel (ecran Admin)**

- Bouton "Exporter" : telecharge un fichier **JSON** complet (toutes les tables, y compris les elements supprimes logiquement) et un **CSV** des parties lisible dans Excel.
- Genere cote navigateur avec les droits de lecture de l'admin ; aucune infrastructure supplementaire.

**B - Sauvegarde automatique chiffree (`.github/workflows/backup.yml`)**

- Declenchement : `schedule` tous les 3 jours (sert aussi de keep-alive) + `workflow_dispatch`.
- `pg_dump` (client PostgreSQL de meme version majeure que le serveur, installe depuis le depot PGDG) via l'URL du **Session pooler** Supabase (les runners GitHub n'ont pas d'IPv6, la connexion directe Supabase est IPv6 uniquement).
- Schemas sauvegardes : `public` et `auth` (comptes et liens `auth_user_id`).
- Chiffrement symetrique `gpg --symmetric --cipher-algo AES256` avant upload ; le dump en clair n'est jamais conserve.
- Stockage : artifact du run (`actions/upload-artifact`), retention **90 jours**. Les artifacts d'un repo public sont telechargeables par les utilisateurs connectes, d'ou le chiffrement obligatoire.
- Secrets du repository (Settings > Secrets and variables > Actions > **Secrets**) :
  - `SUPABASE_DB_URL` : chaine de connexion du Session pooler (contient le mot de passe de la base) ;
  - `BACKUP_PASSPHRASE` : phrase de passe de chiffrement, **a conserver aussi hors de GitHub** (gestionnaire de mots de passe), sinon les sauvegardes sont inutilisables.
- Limite GitHub : les workflows planifies d'un repo public sont **desactives apres 60 jours sans activite sur le repo** (GitHub previent par email). Il suffit de les reactiver dans l'onglet Actions.
- Restauration documentee dans le README : telecharger l'artifact, `gpg --decrypt`, puis `psql` vers un projet Supabase (nouveau ou existant).

Bonnes pratiques du compte Supabase : email durable controle par l'equipe, double authentification, un deuxieme membre admin dans l'organisation Supabase.

---

## 15. PWA - evolution

Une fois le MVP stable : manifest + service worker (`vite-plugin-pwa`) pour l'ajout a l'ecran d'accueil. Attention au cache : prevoir une mise a jour automatique pour ne pas servir une ancienne version. Secondaire par rapport a la fiabilite des calculs.

---

## 16. Ordre d'implementation

### Phase 0 - Decisions et comptes

- ~~valider les decisions~~ (fait le 2026-11-16) ;
- ~~creer le repository public `DouAppAst/padel-tricount`~~ (fait) ;
- activer GitHub Pages (Settings > Pages > Source : GitHub Actions) ;
- creer le projet Supabase Free (region UE), desactiver "Confirm email", renseigner la Site URL.

### Phase 1 - Fondation

- React + TypeScript + Vite, oxlint, Prettier, Vitest ;
- MUI, theme, HashRouter, squelette de navigation ;
- workflows CI + deploiement Pages (page "Hello" deployee des cette phase).

### Phase 2 - Logique metier (sans dependance)

- `money.ts`, `balances.ts`, `debtSimplification.ts` + tests unitaires complets.

### Phase 3 - Base de donnees

- migrations : tables, contraintes, `settings`, fonctions RPC, RLS ;
- tests du schema (PGlite) ; types des lignes declares dans les repositories ;
- repositories frontend.

### Phase 4 - MVP UI

1. connexion + liaison compte/participant ;
2. administration minimale des participants ;
3. nouvelle partie ;
4. historique (detail, modification, suppression) ;
5. soldes ;
6. remboursements.

### Phase 5 - Administration et reprise

- tarifs, lieu par defaut, admins ;
- saisie des soldes d'ouverture ; **bascule depuis l'Excel**.

### Phase 6 - Finition

- responsive, feedback, erreurs reseau, loading states ;
- export JSON/CSV (Admin) ; workflow de sauvegarde chiffree + keep-alive (section 14.3) ;
- tests E2E ; PWA eventuelle.

---

## 17. Definition du MVP termine

- plusieurs collegues se connectent sur la meme URL et voient les memes donnees ;
- un utilisateur non autorise ne voit aucune donnee ;
- une partie peut etre saisie depuis un telephone en moins de 30 secondes ;
- plusieurs modes de paiement coexistent dans une partie ; une personne peut avancer plusieurs places ;
- les soldes sont recalcules automatiquement et leur somme vaut 0 ;
- les dettes sont simplifiees ; un remboursement peut etre enregistre et solde la dette ;
- l'historique reste coherent apres modification des tarifs ;
- les soldes de l'Excel ont ete repris ;
- aucune cle privee n'est exposee ;
- un rafraichissement de page sur n'importe quel ecran fonctionne.

---

## 18. Hors scope initial

- paiement bancaire integre (un lien Lydia/Wero/IBAN dans le profil peut etre envisage plus tard) ;
- notifications push ;
- reservation de terrain ;
- synchronisation CSE ;
- statistiques sportives, classement ;
- invitations complexes, multi-groupes, back-office separe ;
- gestion multi-devises.

---

## 19. Consigne pour l'agent de codage

> Implemente ce projet progressivement en suivant cette specification v2, phase par phase, en proposant un plan de fichiers et de commits avant chaque phase. Separe UI, acces aux donnees et logique metier (`src/domain` en TypeScript pur). Les montants sont des centimes entiers. Respecte la formule de solde de la section 5 (`+ emis - recus`). Ecris les tests unitaires des soldes et de la simplification des dettes avant les ecrans qui les consomment. Configure Supabase avec des migrations versionnees, des contraintes en base, des fonctions RPC transactionnelles pour l'enregistrement des parties et la RLS sur toutes les tables. Utilise `HashRouter` et `base: '/padel-tricount/'` pour GitHub Pages. Aucune cle privee ou service-role dans le bundle ni dans le repository.

---

## 20. Decisions a conserver

- GitHub Pages (repo public `DouAppAst/padel-tricount`) = frontend uniquement ; Supabase (UE) = donnees.
- Montants en centimes ; chaque ligne conserve son montant historique.
- `solde = paye - consomme + emis - recus` ; somme des soldes = 0.
- Enregistrement d'une partie = une transaction (RPC).
- Suppression logique pour parties et remboursements ; desactivation pour participants.
- Soldes jamais stockes, toujours recalcules ; sauvegardes : export manuel + pg_dump chiffre automatique.
- Authentification Supabase email + mot de passe, sans email envoye ; chaque compte lie a un participant apres validation admin.
- Cout zero : offres gratuites uniquement.
- Logique de dette testable independamment de React.
- Rapidite de saisie avant richesse fonctionnelle ; mobile des le MVP.

---

## 21. Decisions validees (2026-11-16)

| #   | Question                               | Decision                                                                                           |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Authentification                       | Supabase Auth, email + mot de passe, aucun email envoye (l'OTP email aurait exige un SMTP externe) |
| 2   | Email pro ou perso des collegues       | Perso                                                                                              |
| 3   | Liaison compte -> participant          | Validation par un admin (`link_requests`)                                                          |
| 4   | Reprise Excel                          | Soldes d'ouverture uniquement ; vraies donnees saisies plus tard par l'admin                       |
| 5   | Qui peut modifier/supprimer une partie | Tout participant lie (avec tracabilite + suppression logique)                                      |
| 6   | Gestion de l'etat serveur              | TanStack Query                                                                                     |
