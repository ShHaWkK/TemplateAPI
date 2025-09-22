export type Language = 'typescript' | 'javascript';

export type FeatureKey =
  | 'auth'
  | 'userCrud'
  | 'clientPortal'
  | 'adminPortal';

export interface FeatureDefinition {
  key: FeatureKey;
  name: string;
  description: string;
  summary: string;
  dependencies?: FeatureKey[];
}

export const featureCatalog: FeatureDefinition[] = [
  {
    key: 'auth',
    name: 'Authentification JWT',
    description:
      "Inscrit et authentifie des utilisateurs avec des tokens d'accès et de refresh.",
    summary:
      'Authentification JWT avec rotation de refresh token, hashage bcrypt et middleware de protection.',
  },
  {
    key: 'userCrud',
    name: 'Gestion CRUD des utilisateurs',
    description:
      'Expose des routes sécurisées pour administrer le cycle de vie des utilisateurs (listing, création, mise à jour, suppression).',
    summary:
      'CRUD complet des utilisateurs avec validation, découpage en cas d\'usage et repository en mémoire.',
    dependencies: ['auth'],
  },
  {
    key: 'clientPortal',
    name: 'Espace client',
    description:
      'Ajoute un espace client dédié avec routes protégées et autorisations basées sur le rôle.',
    summary: 'Espace client prêt à l\'emploi avec contrôleurs dédiés et contrôle de rôle.',
    dependencies: ['auth'],
  },
  {
    key: 'adminPortal',
    name: 'Espace administrateur',
    description:
      'Ajoute un espace d\'administration séparé pour gérer la plateforme avec contrôle d\'accès renforcé.',
    summary: 'Espace administrateur sécurisé avec endpoints dédiés et vérification stricte du rôle.',
    dependencies: ['auth'],
  },
];

export const featureCatalogMap = new Map(featureCatalog.map((feature) => [feature.key, feature]));

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
