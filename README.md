# create-template-api

**create-template-api** est un générateur interactif de bases d'API Node.js prêtes pour la production.
Il permet de sélectionner dynamiquement le langage (TypeScript ou JavaScript) ainsi que les modules
fonctionnels (authentification JWT, gestion d'utilisateurs, espaces client / admin, etc.) sans
aucune dépendance à une base de données.

## ✨ Points clés

- Architecture hexagonale complète : `domain`, `application`, `infrastructure`, `interface`.
- Sécurité HTTP (Helmet, CORS, rate limiting) et logging structuré (Pino) préconfigurés.
- Validation des entrées avec Zod et gestion centralisée des erreurs.
- Authentification JWT avec refresh token rotatif, hashage bcrypt et rôles (admin / client).
- Documentation OpenAPI + collection Insomnia générées automatiquement.
- Tests prêts à l'emploi (Jest + Supertest) avec dépôts en mémoire.
- Dockerfile, docker-compose et scripts npm pour un onboarding immédiat.

## 🚀 Utilisation

```bash
# installer les dépendances du générateur
npm install

# lancer le générateur (interactif)
npm run dev
# ou après build
npm run build
node dist/cli/index.js
```

### Exécution directe

```bash
# générer une API TypeScript avec authentification et gestion utilisateurs
node dist/cli/index.js my-api \
  --language typescript \
  --features auth,userCrud,clientPortal,adminPortal \
  --package-manager npm
```

## 🧭 Options disponibles

| Option | Description |
|--------|-------------|
| `--language` | `typescript` (par défaut) ou `javascript`. |
| `--features` | Modules à inclure séparés par des virgules : `auth`, `userCrud`, `clientPortal`, `adminPortal`. Les dépendances sont résolues automatiquement (ex: `userCrud` active `auth`). |
| `--package-manager` | `npm`, `pnpm` ou `yarn`. Détermine les scripts affichés dans le README généré. |
| `--dry-run` | Simule la génération sans écrire de fichiers. |

## 📦 Sortie générée

Le projet créé contient :

- un dossier `src/` structuré par couches hexagonales,
- des tests (`tests/`) et utilitaires prêts à l'emploi,
- la documentation (`docs/insomnia`, `src/interface/http/docs/openapi`),
- des fichiers de configuration (ESLint, Prettier, Jest, Docker).

La version JavaScript est générée à partir des mêmes sources TypeScript et convertie automatiquement.

## 🛠 Développement

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Lance le CLI en TypeScript (ts-node). |
| `npm run build` | Compile le CLI vers `dist/`. |
| `npm test` | Vérifie la compilation TypeScript sans émettre de fichiers. |

## 📄 Licence

Ce projet est sous licence MIT.
