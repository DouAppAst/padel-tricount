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
