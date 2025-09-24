import path from 'node:path';
import { spawn } from 'node:child_process';
import fs from 'fs-extra';
import chalk from 'chalk';
import inquirer from 'inquirer';
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
  command: 'install' | 'dev' | 'apiStatus' | 'test'
) {
  if (packageManager === 'npm') {
    if (command === 'install') {
      return 'npm install';
    }
    if (command === 'dev') {
      return 'npm run dev';
    }
    if (command === 'test') {
      return 'npm test';
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
    if (command === 'test') {
      return 'pnpm test';
    }
    return 'pnpm api --status';
  }

  if (command === 'install') {
    return 'yarn install';
  }
  if (command === 'dev') {
    return 'yarn dev';
  }
  if (command === 'test') {
    return 'yarn test';
  }
  return 'yarn api --status';
}

async function runShellCommand(command: string, cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: 'inherit',
    });

    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`La commande "${command}" s'est terminée avec le code ${code}.`));
      }
    });
  });
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
    `  ${chalk.cyan(getPackageManagerCommand(answers.packageManager, 'test'))} (optionnel)\n` +
    `  ${chalk.cyan(getPackageManagerCommand(answers.packageManager, 'dev'))}\n` +
    `  ${chalk.cyan(getPackageManagerCommand(answers.packageManager, 'apiStatus'))} (optionnel)`;

  console.log('\n' + chalk.green('[OK] Template API généré avec succès !'));
  console.log(instructions);

  if (options.dryRun) {
    return;
  }

  const { shouldRunTests } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldRunTests',
      message: 'Souhaitez-vous installer les dépendances et lancer la suite de tests maintenant ?',
      default: true,
    },
  ]);

  if (!shouldRunTests) {
    return;
  }

  const installCommand = getPackageManagerCommand(answers.packageManager, 'install');
  const testCommand = getPackageManagerCommand(answers.packageManager, 'test');

  try {
    console.log('\n' + chalk.cyan(`Installation des dépendances (${installCommand})...`));
    await runShellCommand(installCommand, targetDirectory);

    console.log('\n' + chalk.cyan(`Exécution des tests (${testCommand})...`));
    await runShellCommand(testCommand, targetDirectory);

    console.log('\n' + chalk.green('[OK] Tests exécutés avec succès.'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('\n' + chalk.red(`[ERREUR] Les tests n'ont pas pu être exécutés automatiquement : ${message}`));
    console.error(chalk.yellow('Vous pouvez relancer manuellement les commandes indiquées dans les etapes ci-dessus une fois pret.'));
  }
}

