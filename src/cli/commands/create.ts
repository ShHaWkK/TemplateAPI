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

export async function runCreateCommand(directoryArg: string | undefined, options: CreateCommandOptions) {
  const answers = await promptForMissingOptions(options);

  const targetDirectoryName = directoryArg ?? answers.projectName;
  const targetDirectory = path.resolve(process.cwd(), targetDirectoryName);

  ensureSafeProjectDirectory(targetDirectory);

  const generator = getGeneratorForLanguage(answers.language as Language);

  await generator.generate({
    projectName: answers.projectName,
    targetDirectory,
    language: answers.language,
    features: answers.features,
    packageManager: answers.packageManager,
    dryRun: options.dryRun ?? false,
  });

  const relativePath = path.relative(process.cwd(), targetDirectory) || '.';

  const instructions = `\n${chalk.bold('Prochaines étapes :')}\n` +
    `  ${chalk.cyan(`cd ${relativePath}`)}\n` +
    `  ${chalk.cyan(`${answers.packageManager} install`)}\n` +
    `  ${chalk.cyan(`${answers.packageManager} run dev`)}\n`;

  console.log('\n' + chalk.green('✅ Template API généré avec succès !'));
  console.log(instructions);
}
