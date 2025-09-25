export type Language = 'typescript' | 'javascript';

export type FeatureKey = 'auth' | 'userCrud' | 'clientPortal' | 'adminPortal';

export type DataProviderKey = 'postgresql' | 'mysql' | 'sqlite' | 'prisma' | 's3';

export interface FeatureDefinition {
  key: FeatureKey;
  name: string;
  description: string;
  summary: string;
  dependencies?: FeatureKey[];
}

export type DataProviderKind = 'database' | 'orm' | 'storage';

export interface DataProviderDefinition {
  key: DataProviderKey;
  name: string;
  description: string;
  summary: string;
  kind: DataProviderKind;
  defaultStatus: 'ok' | 'warning' | 'critical' | 'skipped';
  statusDescription: string;
}

export type FrontendFrameworkKey = 'none' | 'react-vite' | 'nextjs';

export interface FrontendFrameworkDefinition {
  key: Exclude<FrontendFrameworkKey, 'none'>;
  name: string;
  description: string;
  summary: string;
  appDirectory: string;
  envFileName: string;
}

export const featureCatalog: FeatureDefinition[] = [
  {
    key: 'auth',
    name: 'Authentification JWT',
    description:
      "Inscrit et authentifie des utilisateurs avec des tokens d'accès et de refresh.",
    summary:
      "Authentification JWT avec rotation de refresh token, hashage bcrypt et middleware de protection.",
  },
  {
    key: 'userCrud',
    name: 'Gestion CRUD des utilisateurs',
    description:
      'Expose des routes sécurisées pour administrer le cycle de vie des utilisateurs (listing, création, mise à jour, suppression).',
    summary:
      "CRUD complet des utilisateurs avec validation, découpage en cas d'usage et repository en mémoire.",
    dependencies: ['auth'],
  },
  {
    key: 'clientPortal',
    name: 'Espace client',
    description:
      'Ajoute un espace client dédié avec routes protégées et autorisations basées sur le rôle.',
    summary: "Espace client prêt à l'emploi avec contrôleurs dédiés et contrôle de rôle.",
    dependencies: ['auth'],
  },
  {
    key: 'adminPortal',
    name: 'Espace administrateur',
    description:
      "Ajoute un espace d'administration séparé pour gérer la plateforme avec contrôle d'accès renforcé.",
    summary: "Espace administrateur sécurisé avec endpoints dédiés et vérification stricte du rôle.",
    dependencies: ['auth'],
  },
];

export const featureCatalogMap = new Map(featureCatalog.map((feature) => [feature.key, feature]));

export const dataProviderCatalog: DataProviderDefinition[] = [
  {
    key: 'postgresql',
    name: 'PostgreSQL',
    description: "Base de données relationnelle robuste et extensible, idéale pour les API critiques.",
    summary: "Prêt pour PostgreSQL : variables d'environnement et dépendances du client `pg`.",
    kind: 'database',
    defaultStatus: 'warning',
    statusDescription: 'Client PostgreSQL installé. Configurez DATABASE_URL pour activer la connexion.',
  },
  {
    key: 'mysql',
    name: 'MySQL',
    description: "Base relationnelle populaire avec un vaste écosystème d'outils et d'hébergements.",
    summary: 'Support MySQL prêt avec le driver `mysql2`.',
    kind: 'database',
    defaultStatus: 'warning',
    statusDescription: 'Client MySQL installé. Définissez MYSQL_DSN pour connecter votre instance.',
  },
  {
    key: 'sqlite',
    name: 'SQLite',
    description: 'Base relationnelle légère stockée sur le disque, parfaite pour les tests ou prototypes.',
    summary: 'Driver SQLite prêt à être câblé dans vos adapters.',
    kind: 'database',
    defaultStatus: 'warning',
    statusDescription: "Bibliothèque SQLite installée. Fournissez le chemin du fichier SQLITEDB pour l'utiliser.",
  },
  {
    key: 'prisma',
    name: 'Prisma ORM',
    description: "ORM moderne permettant de modéliser votre schéma, générer un client type-safe et piloter PostgreSQL.",
    summary: "Prisma + adapter PostgreSQL pré-câblés (repositories concrets, migrations et seed).",
    kind: 'orm',
    defaultStatus: 'warning',
    statusDescription:
      "Prisma installé. Définissez DATABASE_URL (ex : postgresql://postgres:postgres@localhost:5432/app?schema=public) puis exécutez les migrations.",
  },
  {
    key: 's3',
    name: 'Stockage objet S3',
    description: 'Intégration prête avec AWS S3 (compatible MinIO) pour gérer vos fichiers.',
    summary: "Client AWS S3 disponible. Configurez les identifiants pour activer l'adapter.",
    kind: 'storage',
    defaultStatus: 'warning',
    statusDescription:
      'Client S3 en attente de configuration (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).',
  },
];

export const dataProviderCatalogMap = new Map(dataProviderCatalog.map((provider) => [provider.key, provider]));

export const frontendFrameworkCatalog: FrontendFrameworkDefinition[] = [
  {
    key: 'react-vite',
    name: 'React + Vite (TypeScript)',
    description: "Application Vite React/TS rapide avec fetch des endpoints de l'API.",
    summary: 'React/Vite préconfiguré pour consommer `/status` et les flux auth.',
    appDirectory: 'apps/web',
    envFileName: '.env.example',
  },
  {
    key: 'nextjs',
    name: 'Next.js 14 (App Router)',
    description: "Application Next.js TypeScript avec page Dashboard consommant l'API côté serveur.",
    summary: 'Next.js (app router) prêt à interroger `/status` via `NEXT_PUBLIC_API_URL`.',
    appDirectory: 'apps/web',
    envFileName: '.env.local.example',
  },
];

export const frontendFrameworkCatalogMap = new Map(
  frontendFrameworkCatalog.map((framework) => [framework.key, framework])
);

export function isFrontendFrameworkKey(value: string): value is FrontendFrameworkKey {
  return value === 'none' || frontendFrameworkCatalogMap.has(value as Exclude<FrontendFrameworkKey, 'none'>);
}

export function resolveFeatureDependencies(selected: FeatureKey[]): FeatureKey[] {
  const resolved = new Set<FeatureKey>();

  function visit(featureKey: FeatureKey) {
    if (resolved.has(featureKey)) {
      return;
    }

    const feature = featureCatalogMap.get(featureKey);
    if (!feature) {
      throw new Error(`Unknown feature: ${featureKey}`);
    }

    feature.dependencies?.forEach(visit);
    resolved.add(featureKey);
  }

  selected.forEach(visit);

  return Array.from(resolved);
}
