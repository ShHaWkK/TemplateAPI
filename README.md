# TemplateAPI

Générateur CLI pour créer rapidement une API Node.js structurée autour d'une architecture hexagonale, avec TypeScript ou JavaScript et des modules activables selon le projet.

## Fonctionnalités

- génération TypeScript ou JavaScript ;
- architecture hexagonale prête à étendre ;
- authentification et gestion des utilisateurs en modules optionnels ;
- portails client et administration optionnels ;
- configuration, validation, journalisation et observabilité ;
- modèles Docker, Jest, ESLint, Prettier et documentation API ;
- support npm, pnpm et yarn ;
- mode `--dry-run` pour inspecter une génération sans écrire de fichiers.

## Installation

Pour travailler directement depuis le dépôt :

```bash
git clone https://github.com/ShHaWkK/TemplateAPI.git
cd TemplateAPI
npm install
npm test
npm run build
```

Après publication npm, le package sera utilisable avec :

```bash
npx create-shhawk-api my-api
```

Le binaire historique `create-template-api` reste également exposé pour compatibilité.

## Utilisation

Mode interactif :

```bash
npm run dev
```

Ou après compilation :

```bash
node dist/cli/index.js
```

Exemple non interactif :

```bash
node dist/cli/index.js my-api \
  --language typescript \
  --features auth,userCrud,clientPortal,adminPortal \
  --package-manager npm
```

## Options

| Option | Description |
| --- | --- |
| `--language` | `typescript` par défaut, ou `javascript`. |
| `--features` | Modules séparés par des virgules : `auth`, `userCrud`, `clientPortal`, `adminPortal`. |
| `--package-manager` | `npm`, `pnpm` ou `yarn`. |
| `--dry-run` | Simule la génération sans écrire de fichiers. |

Les dépendances entre fonctionnalités sont résolues automatiquement. Par exemple, `userCrud` active les prérequis nécessaires à l'authentification.

## Projet généré

Selon les options sélectionnées, le générateur peut produire :

- couches domaine, application, infrastructure et interface HTTP ;
- authentification JWT et gestion des refresh tokens ;
- contrôle d'accès et rôles ;
- persistance en mémoire ou adaptateurs Prisma selon le template ;
- endpoints de santé et de statut ;
- OpenAPI/Swagger et collection Insomnia ;
- tests d'intégration ;
- Dockerfile et Docker Compose ;
- configuration ESLint, Prettier et Jest.

## Développement

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Lance le CLI via ts-node. |
| `npm test` | Vérifie le typage TypeScript. |
| `npm run build` | Compile le CLI dans `dist/`. |
| `npm pack --dry-run` | Vérifie le contenu qui serait publié sur npm. |

La CI valide actuellement Node.js 18, 20 et 22.

## Contribution

Les contributions sont bienvenues. Consultez [CONTRIBUTING.md](CONTRIBUTING.md) avant d'ouvrir une pull request et [SECURITY.md](SECURITY.md) pour signaler un problème de sécurité.

## Licence

MIT — voir [LICENSE](LICENSE).
