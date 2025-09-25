#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { runCreateCommand } from './commands/create';
import {
  DataProviderKey,
  FeatureKey,
  FrontendFrameworkKey,
  Language,
  dataProviderCatalog,
  featureCatalog,
  frontendFrameworkCatalog,
  isFrontendFrameworkKey,
} from './generators/types';

const BANNER_ASCII = String.raw`
  |__   __|                     | |       | |            /\    |  __ \|_   _|
     | |  ___  _ __ ___   _ __  | |  __ _ | |_  ___     /  \   | |__) | | |  
     | | / _ \| '_ \ _ \ | '_ \ | | / _\` || __|/ _ \   / /\ \  |  ___/  | |  
     | ||  __/| | | | | || |_) || || (_| || |_|  __/  / ____ \ | |     _| |_ 
     |_| \___||_| |_| |_|| .__/ |_| \__,_| \__|\___| /_/    \_\|_|    |_____|
                         | |                                                 
                         |_|                                
`;
function printBanner(): void {
  console.log(chalk.cyan(BANNER_ASCII));
}

function getPackageVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJson = fs.readJsonSync(packageJsonPath);
    return packageJson.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function parseListOption(input?: string): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const normalized = input
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return normalized;
}

function parseFeaturesOption(input?: string): FeatureKey[] | undefined {
  const values = parseListOption(input);
  return values ? (values as FeatureKey[]) : undefined;
}

function parseDataProvidersOption(input?: string): DataProviderKey[] | undefined {
  const values = parseListOption(input);
  return values ? (values as DataProviderKey[]) : undefined;
}

function isLanguage(value: string): value is Language {
  return value === 'typescript' || value === 'javascript';
}

async function main() {
  const program = new Command();
  const version = getPackageVersion();
  printBanner();

  program
    .name('create-template-api')
    .description("Générateur d'API hexagonale modulaire sans base de données.")
    .version(version);

  program
    .argument('[directory]', 'Répertoire cible (sera créé s\'il n\'existe pas).')
    .option('-n, --name <name>', 'Nom du projet. (par défaut : nom du dossier)')
    .option('-l, --language <language>', 'Langage cible (typescript|javascript)')
    .option('-f, --features <features>', 'Modules à activer (séparés par des virgules).')
    .option(
      '-d, --data-providers <providers>',
      'Options de persistance à préparer (séparées par des virgules).'
    )
    .option('-p, --package-manager <manager>', 'Gestionnaire de packages (npm|pnpm|yarn).')
    .option('--frontend <framework>', 'Front-end à générer (none|react-vite|nextjs).')
    .option('--dry-run', 'Affiche les actions sans écrire les fichiers.')
    .action(async (directory: string | undefined, commandOptions: Record<string, unknown>) => {
      const languageOption = typeof commandOptions.language === 'string' ? commandOptions.language : undefined;
      const featuresOption = typeof commandOptions.features === 'string' ? commandOptions.features : undefined;
      const packageManagerOption = typeof commandOptions.packageManager === 'string' ? commandOptions.packageManager : undefined;
      const dataProvidersOption =
        typeof commandOptions.dataProviders === 'string' ? (commandOptions.dataProviders as string) : undefined;
      const frontendOption = typeof commandOptions.frontend === 'string' ? commandOptions.frontend : undefined;
      const dryRun = Boolean(commandOptions.dryRun);

      if (languageOption && !isLanguage(languageOption)) {
        throw new Error(
          `Langage inconnu : ${languageOption}. Valeurs possibles : ${['typescript', 'javascript'].join(', ')}`
        );
      }

      const selectedFeatures = parseFeaturesOption(featuresOption);
      if (selectedFeatures) {
        const availableKeys = new Set(featureCatalog.map((feature) => feature.key));
        const unknownFeatures = selectedFeatures.filter((feature) => !availableKeys.has(feature));
        if (unknownFeatures.length > 0) {
          throw new Error(
            `Modules inconnus : ${unknownFeatures.join(', ')}. Modules disponibles : ${featureCatalog
              .map((feature) => feature.key)
              .join(', ')}`
          );
        }
      }

      const selectedDataProviders = parseDataProvidersOption(dataProvidersOption);
      if (selectedDataProviders) {
        const availableProviderKeys = new Set(dataProviderCatalog.map((provider) => provider.key));
        const unknownProviders = selectedDataProviders.filter((provider) => !availableProviderKeys.has(provider));
        if (unknownProviders.length > 0) {
          throw new Error(
            `Options de persistance inconnues : ${unknownProviders.join(', ')}. Options disponibles : ${dataProviderCatalog
              .map((provider) => provider.key)
              .join(', ')}`
          );
        }
      }

      if (frontendOption && !isFrontendFrameworkKey(frontendOption)) {
        throw new Error(
          `Framework front inconnu : ${frontendOption}. Valeurs possibles : none, ${frontendFrameworkCatalog
            .map((framework) => framework.key)
            .join(', ')}`
        );
      }

      await runCreateCommand(directory, {
        projectName: typeof commandOptions.name === 'string' ? commandOptions.name : undefined,
        language: languageOption as Language | undefined,
        features: selectedFeatures,
        packageManager: packageManagerOption as 'npm' | 'pnpm' | 'yarn' | undefined,
        dataProviders: selectedDataProviders,
        frontendFramework: frontendOption as FrontendFrameworkKey | undefined,
        dryRun,
      });
    });

  program.parseAsync(process.argv).catch((error) => {
    console.error('\n' + chalk.red(`\u274c ${error.message}`));
    process.exit(1);
  });
}

main();



