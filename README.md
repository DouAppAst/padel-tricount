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

## Sauvegardes

Les données vivent uniquement dans Supabase (offre gratuite, sans sauvegarde restaurable). Deux protections :

- **Export manuel** : écran Admin > _Sauvegarde_ : JSON complet (toutes les tables) et fichiers CSV lisibles dans Excel.
- **Sauvegarde automatique** : [.github/workflows/backup.yml](.github/workflows/backup.yml), tous les 3 jours. Le même workflow « réveille » Supabase, dont les projets gratuits se mettent en pause après 7 jours sans activité.

### Mettre en place la sauvegarde automatique (une fois)

1. Supabase > bouton **Connect** (en haut) > **Direct** (Connection string), méthode **Session pooler** (port 5432, serveur `…pooler.supabase.com`) : copier l'URI `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres` et remplacer `[YOUR-PASSWORD]` par le mot de passe de la base (**uniquement des lettres et des chiffres** : sinon le réinitialiser dans Database > Settings > Reset database password). La connexion directe ne fonctionne pas depuis GitHub (IPv6 uniquement).
2. Choisir une **phrase de passe de chiffrement** longue et la ranger dans un gestionnaire de mots de passe : **sans elle, les sauvegardes sont illisibles**.
3. GitHub > Settings > Secrets and variables > Actions > onglet **Secrets** > _New repository secret_ :
   - `SUPABASE_DB_URL` : l'URI de l'étape 1 ;
   - `BACKUP_PASSPHRASE` : la phrase de l'étape 2.
4. Onglet **Actions** > _Backup and keep-alive_ > **Run workflow**, puis vérifier que le run est vert et qu'un fichier `padel-tricount-AAAA-MM-JJ` apparaît dans ses _Artifacts_.

Chaque sauvegarde est conservée 90 jours. GitHub désactive les workflows planifiés après 60 jours sans commit sur le dépôt (il prévient par email) : il suffit alors de les réactiver dans l'onglet Actions.

### Restaurer une sauvegarde

1. Télécharger l'artifact du run voulu (onglet Actions) et le dézipper : on obtient `padel-tricount-AAAA-MM-JJ.tar.gz.gpg`.
2. Déchiffrer (macOS avec Homebrew : `brew install gnupg libpq` ; avec MacPorts : `sudo port install gnupg2 postgresql17` puis `sudo port select --set postgresql postgresql17`, en prenant la version majeure affichée par le run de sauvegarde) :

   ```bash
   gpg --decrypt padel-tricount-AAAA-MM-JJ.tar.gz.gpg | tar xzf -
   ```

   On obtient `app.sql` (schémas `public` et `private` : tables, données, fonctions, règles d'accès) et `auth.sql` (comptes de connexion).

3. Dans un **nouveau** projet Supabase (même configuration que la section _Déploiement_), avec l'URI _Session pooler_ du nouveau projet :

   ```bash
   psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f auth.sql
   psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f app.sql
   ```

4. Mettre à jour les variables GitHub `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` avec le nouveau projet et relancer le déploiement.

## Installer l'application sur un téléphone

- **iPhone (Safari)** : bouton Partager > _Sur l'écran d'accueil_.
- **Android (Chrome)** : menu ⋮ > _Ajouter à l'écran d'accueil_ / _Installer l'application_.

L'application s'ouvre alors en plein écran avec son icône. Il n'y a pas de mode hors ligne (volontairement : on évite qu'un téléphone affiche une ancienne version ou d'anciens soldes).
