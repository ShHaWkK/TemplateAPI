import inquirer from 'inquirer';
import path from 'node:path';
import {
  DataProviderKey,
  FeatureKey,
  Language,
  dataProviderCatalog,
  dataProviderCatalogMap,
  featureCatalog,
  featureCatalogMap,
  resolveFeatureDependencies,
} from '../generators/types';

export interface PromptAnswers {
  targetDirectory: string;
  projectName: string;
  language: Language;
  features: FeatureKey[];
  packageManager: 'npm' | 'pnpm' | 'yarn';
  dataProviders: DataProviderKey[];
}

export interface PromptOptions {
  targetDirectory?: string;
  projectName?: string;
  language?: Language;
  features?: FeatureKey[];
  packageManager?: 'npm' | 'pnpm' | 'yarn';
  dataProviders?: DataProviderKey[];
}

export async function promptForMissingOptions(options: PromptOptions): Promise<PromptAnswers> {
  const questions: inquirer.QuestionCollection[] = [];

  if (!options.targetDirectory) {
    questions.push({
      type: 'input',
      name: 'targetDirectory',
      message: 'Dans quel dossier souhaitez-vous générer le template ? (il sera créé si besoin)',
      default: './mon-api',
      filter: (input: string) => input.trim() || './mon-api',
      validate: (input: string) => {
        const value = input.trim();
        if (!value) {
          return 'Indiquez un chemin de dossier valide.';
        }
        if (value === '.' || value === './' || value === './.' || value === '..') {
          return 'Choisissez un dossier dédié (évitez d\'écraser le projet courant).';
        }
        return true;
      },
    });
  }

  if (!options.projectName) {
    questions.push({
      type: 'input',
      name: 'projectName',
      message: 'Nom du projet :',
      default: (answers: inquirer.Answers) => {
        const targetDirectory = (options.targetDirectory ?? answers.targetDirectory ?? '').toString();
        if (!targetDirectory) {
          return 'mon-api';
        }
        const resolved = path.resolve(targetDirectory.trim());
        return path.basename(resolved);
      },
      validate: (input: string) => (input.trim().length > 0 ? true : 'Le nom du projet est obligatoire.'),
    });
  }

  if (!options.language) {
    questions.push({
      type: 'list',
      name: 'language',
      message: 'Choisissez un langage :',
      default: 'typescript',
      choices: [
        { name: 'TypeScript (recommandé)', value: 'typescript' },
        { name: 'JavaScript (ESM)', value: 'javascript' },
      ],
    });
  }

  if (!options.features) {
    questions.push({
      type: 'checkbox',
      name: 'features',
      message: 'Sélectionnez les modules à inclure :',
      choices: featureCatalog.map((feature) => ({
        name: `${feature.name} — ${feature.description}`,
        value: feature.key,
      })),
      default: ['auth'],
      validate: (selected: FeatureKey[]) =>
        selected.length > 0 ? true : 'Sélectionnez au moins un module pour démarrer.',
    });
  }

  if (!options.packageManager) {
    questions.push({
      type: 'list',
      name: 'packageManager',
      message: 'Quel gestionnaire de packages souhaitez-vous utiliser ?',
      default: 'npm',
      choices: [
        { name: 'npm', value: 'npm' },
        { name: 'pnpm', value: 'pnpm' },
        { name: 'yarn', value: 'yarn' },
      ],
    });
  }

  if (!options.dataProviders) {
    questions.push({
      type: 'checkbox',
      name: 'dataProviders',
      message: 'Préparez-vous une base de données ou un stockage objet ? (plusieurs choix possibles)',
      choices: dataProviderCatalog.map((provider) => ({
        name: `${provider.name} — ${provider.description}`,
        value: provider.key,
      })),
      default: [],
    });
  }

  const answers = await inquirer.prompt(questions);

  const targetDirectory = options.targetDirectory ?? answers.targetDirectory ?? options.projectName ?? answers.projectName;
  const projectName = options.projectName ?? answers.projectName;
  const language = options.language ?? answers.language;
  const rawFeatures: FeatureKey[] = options.features ?? answers.features;
  const resolvedFeatures = resolveFeatureDependencies(rawFeatures);
  const packageManager = options.packageManager ?? answers.packageManager;
  const dataProviders: DataProviderKey[] = Array.from(
    new Set((options.dataProviders ?? answers.dataProviders ?? []) as DataProviderKey[])
  );

  const missingDependencies = resolvedFeatures.filter((featureKey) =>
    featureCatalogMap.get(featureKey)?.dependencies?.some((dependency) => !resolvedFeatures.includes(dependency))
  );

  if (missingDependencies.length > 0) {
    throw new Error(`Impossible de résoudre les dépendances des modules : ${missingDependencies.join(', ')}`);
  }

  const unknownProviders = dataProviders.filter((provider) => !dataProviderCatalogMap.has(provider));
  if (unknownProviders.length > 0) {
    throw new Error(`Options de persistance inconnues : ${unknownProviders.join(', ')}`);
  }

  return {
    targetDirectory,
    projectName,
    language,
    features: resolvedFeatures,
    packageManager,
    dataProviders,
  };
}
