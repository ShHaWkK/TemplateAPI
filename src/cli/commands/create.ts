import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { promptForMissingOptions, PromptOptions } from '../prompts/prompts';
import { Language } from '../generators/types';
import { getGeneratorForLanguage } from '../generators/registry';

export interface CreateCommandOptions extends PromptOptions {
  dryRun?: boolean;
}

function ensureSafeProjectDirectory(targetDir: string) {
  if (!fs.existsSync(targetDir)) {
    return;
  }

  const stats = fs.statSync(targetDir);
  if (!stats.isDirectory()) {
    throw new Error(`${targetDir} existe déjà et n'est pas un dossier.`);
  }

  const files = fs.readdirSync(targetDir);
  if (files.length > 0) {
    throw new Error(`Le dossier ${targetDir} n'est pas vide. Choisissez un dossier vide ou un nouveau nom.`);
  }
}

function getPackageManagerCommand(
  packageManager: 'npm' | 'pnpm' | 'yarn',
  command: 'install' | 'dev' | 'apiStatus'
) {
  if (packageManager === 'npm') {
    if (command === 'install') {
      return 'npm install';
    }
    if (command === 'dev') {
      return 'npm run dev';
    }
    return 'npm run api -- --status';
  }

  if (packageManager === 'pnpm') {
    if (command === 'install') {
      return 'pnpm install';
    }
    if (command === 'dev') {
      return 'pnpm dev';
    }
    return 'pnpm api --status';
  }

  if (command === 'install') {
    return 'yarn install';
  }
  if (command === 'dev') {
    return 'yarn dev';
  }
  return 'yarn api --status';
}

export async function runCreateCommand(directoryArg: string | undefined, options: CreateCommandOptions) {
  const answers = await promptForMissingOptions({ ...options, targetDirectory: directoryArg ?? options.targetDirectory });

  const targetDirectory = path.resolve(process.cwd(), answers.targetDirectory);

  ensureSafeProjectDirectory(targetDirectory);

  const generator = getGeneratorForLanguage(answers.language as Language);

  await generator.generate({
    projectName: answers.projectName,
    targetDirectory,
    language: answers.language,
    features: answers.features,
    packageManager: answers.packageManager,
    dataProviders: answers.dataProviders,
    dryRun: options.dryRun ?? false,
  });

  const relativePath = path.relative(process.cwd(), targetDirectory) || '.';

  const instructions = `\n${chalk.bold('Prochaines étapes :')}\n` +
    `  ${chalk.cyan(`cd ${relativePath}`)}\n` +
    `  ${chalk.cyan(getPackageManagerCommand(answers.packageManager, 'install'))}\n` +
    `  ${chalk.cyan(getPackageManagerCommand(answers.packageManager, 'dev'))}\n` +
    `  ${chalk.cyan(getPackageManagerCommand(answers.packageManager, 'apiStatus'))} (optionnel)`;

  console.log('\n' + chalk.green('✅ Template API généré avec succès !'));
  console.log(instructions);
}
