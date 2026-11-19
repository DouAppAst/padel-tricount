# Padel Tricount

Application web pour suivre qui a payé quelles places de padel pour qui, et qui doit combien à qui.

- Application : https://douappast.github.io/padel-tricount/
- Spécification : [docs/SPECIFICATION.md](docs/SPECIFICATION.md)

Stack : React + TypeScript + Vite + Material UI, hébergée gratuitement sur GitHub Pages. Les données sont dans Supabase (offre gratuite) et **jamais dans ce dépôt**.

## Développement

Prérequis : Node.js (version dans [.nvmrc](.nvmrc)).

```bash
npm install
cp .env.example .env.local   # puis renseigner l'URL et la clé publishable Supabase
npm run dev                  # http://localhost:5173/padel-tricount/
```

| Commande            | Rôle                             |
| ------------------- | -------------------------------- |
| `npm run dev`       | serveur de développement         |
| `npm test`          | tests unitaires (Vitest)         |
| `npm run lint`      | lint (oxlint)                    |
| `npm run typecheck` | vérification TypeScript          |
| `npm run format`    | formatage (Prettier)             |
| `npm run build`     | build de production dans `dist/` |

## Déploiement

Chaque push sur `main` lance les vérifications puis publie sur GitHub Pages (`.github/workflows/deploy-pages.yml`).

Configuration à faire une fois dans GitHub :

1. **Settings > Pages > Build and deployment > Source : GitHub Actions**.
2. **Settings > Secrets and variables > Actions > Variables** : `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` (valeurs publiques par nature).

Ne jamais ajouter de clé `service_role` / secrète, ni dans le code ni dans les variables du build.

## Base de données (Supabase)

Le schéma est versionné dans [supabase/migrations](supabase/migrations) et testé localement avec [PGlite](https://pglite.dev) (`supabase/tests`, lancé par `npm test`, sans Docker).

Modèle de sécurité :

- RLS activée sur toutes les tables ; le rôle `anon` n'a aucun droit.
- Un compte connecté ne voit **rien** tant qu'un admin n'a pas validé sa liaison à un participant.
- Parties et remboursements ne s'écrivent que via des fonctions (`save_game`, `save_settlement`…) transactionnelles qui vérifient les droits.
- Participants et tarifs : modifiables par les admins uniquement.

### Appliquer une migration

Dans le dashboard Supabase > **SQL Editor** > _New query_ : coller le contenu du fichier de migration, puis **Run**. Appliquer les fichiers dans l'ordre de leur nom, une seule fois chacun.

### Créer le premier admin (une seule fois)

1. Supabase > **Authentication > Users > Add user > Create new user** : email + mot de passe, cocher _Auto Confirm User_.
2. SQL Editor :

   ```sql
   insert into public.participants (display_name, is_admin, auth_user_id)
   select 'Prénom', true, id from auth.users where email = 'ton.email@example.com';
   ```

Ensuite, l'admin ajoute les autres participants depuis l'application ; chaque collègue crée son compte et demande à être lié à son nom.

### Mot de passe oublié

Aucun email n'est envoyé par l'application. L'admin supprime le compte dans **Authentication > Users** ; le participant est automatiquement délié (son historique est conservé). Le collègue recrée un compte et redemande la liaison.

Pour le **dernier admin** (personne pour valider sa liaison) : après suppression et recréation du compte dans le dashboard, le relier dans le SQL Editor :

```sql
update public.participants set auth_user_id = (select id from auth.users where email = 'ton.email@example.com')
where display_name = 'Prénom';
```
