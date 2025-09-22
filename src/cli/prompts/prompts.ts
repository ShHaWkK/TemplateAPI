import inquirer from 'inquirer';
import {
  FeatureKey,
  Language,
  featureCatalog,
  featureCatalogMap,
  resolveFeatureDependencies,
} from '../generators/types';

export interface PromptAnswers {
  projectName: string;
  language: Language;
  features: FeatureKey[];
  packageManager: 'npm' | 'pnpm' | 'yarn';
}

export interface PromptOptions {
  projectName?: string;
  language?: Language;
  features?: FeatureKey[];
  packageManager?: 'npm' | 'pnpm' | 'yarn';
}

export async function promptForMissingOptions(options: PromptOptions): Promise<PromptAnswers> {
  const questions: inquirer.QuestionCollection[] = [];

  if (!options.projectName) {
    questions.push({
      type: 'input',
      name: 'projectName',
      message: 'Nom du projet :',
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

  const answers = await inquirer.prompt(questions);

  const projectName = options.projectName ?? answers.projectName;
  const language = options.language ?? answers.language;
  const rawFeatures: FeatureKey[] = options.features ?? answers.features;
  const resolvedFeatures = resolveFeatureDependencies(rawFeatures);
  const packageManager = options.packageManager ?? answers.packageManager;

  const missingDependencies = resolvedFeatures.filter((featureKey) =>
    featureCatalogMap.get(featureKey)?.dependencies?.some((dependency) => !resolvedFeatures.includes(dependency))
  );

  if (missingDependencies.length > 0) {
    throw new Error(`Impossible de résoudre les dépendances des modules : ${missingDependencies.join(', ')}`);
  }

  return {
    projectName,
    language,
    features: resolvedFeatures,
    packageManager,
  };
}
