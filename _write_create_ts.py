from pathlib import Path

content = """import path from 'node:path';
import { spawn } from 'node:child_process';
import fs from 'fs-extra';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { promptForMissingOptions, PromptOptions } from '../prompts/prompts';
import { FrontendFrameworkKey, Language, frontendFrameworkCatalogMap } from '../generators/types';
import { getGeneratorForLanguage } from '../generators/registry';

export interface CreateCommandOptions extends PromptOptions {
  dryRun?: boolean;
}

interface FrontendScaffoldResult {
  framework: Exclude<FrontendFrameworkKey, 'none'>;
  directory: string;
}

function ensureSafeProjectDirectory(targetDir: string) {
  if (!fs.existsSync(targetDir)) {
    return;
  }

  const stats = fs.statSync(targetDir);
  if (!stats.isDirectory()) {
    throw new Error(`${targetDir} existe déjé et n'est pas un dossier.`);
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

function getPackageManagerRunCommand(packageManager: 'npm' | 'pnpm' | 'yarn', script: string) {
  if (packageManager === 'npm') {
    return `npm run ${script}`;
  }
  if (packageManager === 'pnpm') {
    return `pnpm ${script}`;
  }
  return `yarn ${script}`;
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function escapeBackticks(value: string): string {
  return value.replace(/`/g, '\\`');
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

async function scaffoldFrontend(options: {
  framework: FrontendFrameworkKey;
  packageManager: 'npm' | 'pnpm' | 'yarn';
  targetDirectory: string;
  projectName: string;
  dryRun: boolean;
}): Promise<FrontendScaffoldResult | null> {
  const { framework, packageManager, targetDirectory, projectName, dryRun } = options;

  if (framework === 'none') {
    return null;
  }

  const definition = frontendFrameworkCatalogMap.get(framework);
  if (!definition) {
    throw new Error(`Framework front inconnu: ${framework}`);
  }

  const frontendDir = path.join(targetDirectory, definition.appDirectory);
  const relativeForDisplay = path.relative(process.cwd(), frontendDir) || definition.appDirectory;

  if (dryRun) {
    console.log(
      chalk.yellow(
        `[dry-run] Front ${definition.name} généré dans ${toPosixPath(relativeForDisplay)} (aucune commande exécutée).`
      )
    );
    return { framework, directory: frontendDir };
  }

  if (await fs.pathExists(frontendDir)) {
    throw new Error(
      `Le dossier ${toPosixPath(relativeForDisplay)} existe déjé. Supprimez-le ou choisissez un autre emplacement pour le front.`
    );
  }

  await fs.ensureDir(path.dirname(frontendDir));

  console.log('\n' + chalk.cyan(`[Front] Génération ${definition.name}...`));

  if (framework === 'react-vite') {
    await scaffoldReactVite(frontendDir, targetDirectory, packageManager, projectName, definition.envFileName);
  } else if (framework === 'nextjs') {
    await scaffoldNextJs(frontendDir, targetDirectory, packageManager, projectName, definition.envFileName);
  } else {
    throw new Error(`Framework front non supporté: ${framework}`);
  }

  console.log(chalk.green(`[OK] Front ${definition.name} prét dans ${toPosixPath(relativeForDisplay)}.`));

  return { framework, directory: frontendDir };
}

async function scaffoldReactVite(
  frontendDir: string,
  targetDirectory: string,
  packageManager: 'npm' | 'pnpm' | 'yarn',
  projectName: string,
  envFileName: string
) {
  const relativeDir = toPosixPath(path.relative(targetDirectory, frontendDir) || '.');
  const scaffoldCommand = `npx --yes create-vite@latest ${relativeDir} -- --template react-ts`;

  console.log(chalk.gray(`> ${scaffoldCommand}`));
  await runShellCommand(scaffoldCommand, targetDirectory);

  console.log(chalk.gray(`> ${getPackageManagerCommand(packageManager, 'install')}`));
  await runShellCommand(getPackageManagerCommand(packageManager, 'install'), frontendDir);

  await customizeReactVite(frontendDir, projectName, envFileName);
}

async function customizeReactVite(frontendDir: string, projectName: string, envFileName: string) {
  const safeProjectName = escapeBackticks(projectName);

  await fs.ensureDir(path.join(frontendDir, 'src', 'lib'));
  await fs.remove(path.join(frontendDir, 'src', 'assets')).catch(() => undefined);

  await fs.writeFile(path.join(frontendDir, envFileName), 'VITE_API_URL=http://localhost:3333\n');

  const apiLines = [
    "const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3333').replace(/\\/$/, '');",
    '',
    'export interface StatusSnapshot {',
    "  status?: string;",
    "  features?: Array<{ key?: string; name?: string; summary?: string }>;",
    "  dependencies?: Array<{ name?: string; status?: string; details?: string }>;",
    "  dataProviders?: Array<{ key?: string; status?: string; details?: string }>;",
    '}',
    '',
    'export async function fetchStatus(signal?: AbortSignal): Promise<StatusSnapshot> {',
    "  const response = await fetch(API_BASE_URL + '/status', { signal });",
    '',
    '  if (!response.ok) {',
    "    throw new Error(\"Impossible de contacter l'API (statut \" + response.status + \")\");",
    '  }',
    '',
    '  return (await response.json()) as StatusSnapshot;',
    '}',
  ];
  await fs.writeFile(path.join(frontendDir, 'src', 'lib', 'api.ts'), apiLines.join('\n') + '\n');

  const appLines = [
    "import { useEffect, useState } from 'react';",
    "import './App.css';",
    "import { fetchStatus, type StatusSnapshot } from './lib/api';",
    '',
    'export default function App() {',
    '  const [status, setStatus] = useState<StatusSnapshot | null>(null);',
    '  const [error, setError] = useState<string | null>(null);',
    '  const [loading, setLoading] = useState(true);',
    '',
    '  useEffect(() => {',
    '    fetchStatus()',
    '      .then((snapshot) => setStatus(snapshot))',
    '      .catch((err) => setError((err as Error).message))',
    '      .finally(() => setLoading(false));',
    '  }, []);',
    '',
    '  return (',
    '    <main className="layout">',
    f"      <h1>{safeProjectName} é Console API</h1>",
    "      <p>Cette interface interroge <code>GET /status</code> de l'API générée.</p>",
    '      <div className="panel">',
    '        {loading ? <p>Chargementé</p> : null}',
    '        {error ? <p className="error">{error}</p> : null}',
    '        {!loading && !error ? (',
    '          <pre>{JSON.stringify(status, null, 2)}</pre>',
    '        ) : null}',
    '      </div>',
    '    </main>',
    '  );',
    '}',
  ];
  await fs.writeFile(path.join(frontendDir, 'src', 'App.tsx'), appLines.join('\n') + '\n');

  const cssLines = [
    '.layout {',
    '  min-height: 100vh;',
    '  padding: 2.5rem clamp(1.5rem, 4vw, 4rem);',
    '  background: #0f172a;',
    '  color: #e2e8f0;',
    '  display: flex;',
    '  flex-direction: column;',
    '  gap: 1.5rem;',
    "  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    '}',
    '',
    '.panel {',
    '  background: rgba(15, 23, 42, 0.75);',
    '  border: 1px solid rgba(148, 163, 184, 0.25);',
    '  border-radius: 1rem;',
    '  padding: 1.25rem;',
    '  overflow: auto;',
    '}',
    '',
    '.panel pre {',
    '  margin: 0;',
    '  font-size: 0.9rem;',
    '}',
    '',
    '.error {',
    '  color: #f87171;',
    '}',
    '',
    'code {',
    '  background: rgba(148, 163, 184, 0.25);',
    '  padding: 0.1rem 0.4rem;',
    '  border-radius: 0.4rem;',
    '}',
  ];
  await fs.writeFile(path.join(frontendDir, 'src', 'App.css'), cssLines.join('\n') + '\n');
}

async function scaffoldNextJs(
  frontendDir: string,
  targetDirectory: string,
  packageManager: 'npm' | 'pnpm' | 'yarn',
  projectName: string,
  envFileName: string
) {
  const relativeDir = toPosixPath(path.relative(targetDirectory, frontendDir) || '.');
  const packageFlag = packageManager === 'pnpm' ? '--use-pnpm' : packageManager === 'yarn' ? '--use-yarn' : '--use-npm';
  const scaffoldCommand = `npx --yes create-next-app@latest ${relativeDir} --ts --app --src-dir --eslint --no-tailwind --import-alias "@/*" ${packageFlag} --skip-install --no-git`;

  console.log(chalk.gray(`> ${scaffoldCommand}`));
  await runShellCommand(scaffoldCommand, targetDirectory);

  console.log(chalk.gray(`> ${getPackageManagerCommand(packageManager, 'install')}`));
  await runShellCommand(getPackageManagerCommand(packageManager, 'install'), frontendDir);

  await customizeNextJs(frontendDir, projectName, envFileName);
}

async function customizeNextJs(frontendDir: string, projectName: string, envFileName: string) {
  const safeProjectName = escapeBackticks(projectName);
  const appDir = path.join(frontendDir, 'src', 'app');

  await fs.ensureDir(path.join(frontendDir, 'src', 'lib'));

  await fs.writeFile(path.join(frontendDir, envFileName), 'NEXT_PUBLIC_API_URL=http://localhost:3333\n');

  const apiLines = [
    "const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace(/\\/$/, '');",
    '',
    'export interface StatusSnapshot {',
    "  status?: string;",
    "  features?: Array<{ key?: string; name?: string; summary?: string }>;",
    "  dependencies?: Array<{ name?: string; status?: string; details?: string }>;",
    "  dataProviders?: Array<{ key?: string; status?: string; details?: string }>;",
    '}',
    '',
    'export async function fetchStatus(): Promise<StatusSnapshot> {',
    "  const response = await fetch(API_BASE_URL + '/status', { cache: 'no-store' });",
    '',
    '  if (!response.ok) {',
    "    throw new Error(\"Impossible de contacter l'API (statut \" + response.status + \")\");",
    '  }',
    '',
    '  return (await response.json()) as StatusSnapshot;',
    '}',
  ];
  await fs.writeFile(path.join(frontendDir, 'src', 'lib', 'api.ts'), apiLines.join('\n') + '\n');

  const layoutLines = [
    "import type { Metadata } from 'next';",
    "import './globals.css';",
    '',
    'export const metadata: Metadata = {',
    f"  title: '{safeProjectName} é Console API',",
    "  description: \"Interface front générée avec create-template-api pour consommer l'API.\",",
    '};',
    '',
    'export default function RootLayout({ children }: { children: React.ReactNode }) {',
    '  return (',
    '    <html lang="fr">',
    '      <body>{children}</body>',
    '    </html>',
    '  );',
    '}',
  ];
  await fs.writeFile(path.join(appDir, 'layout.tsx'), layoutLines.join('\n') + '\n');

  const pageLines = [
    "import { fetchStatus } from '../lib/api';",
    '',
    'export default async function Home() {',
    '  const status = await fetchStatus();',
    '',
    '  return (',
    '    <main className="layout">',
    f"      <h1>{safeProjectName} é Console API</h1>",
    "      <p>Cette page interroge <code>GET /status</code> du backend cété serveur.</p>",
    '      <pre>{JSON.stringify(status, null, 2)}</pre>',
    '    </main>',
    '  );',
    '}',
  ];
  await fs.writeFile(path.join(appDir, 'page.tsx'), pageLines.join('\n') + '\n');

  const cssLines = [
    ':root {',
    '  color-scheme: dark;',
    '  background-color: #0f172a;',
    '  color: #e2e8f0;',
    "  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    '}',
    '',
    'body {',
    '  margin: 0;',
    '}',
    '',
    '.layout {',
    '  min-height: 100vh;',
    '  padding: 2.5rem clamp(1.5rem, 4vw, 4rem);',
    '  display: flex;',
    '  flex-direction: column;',
    '  gap: 1.5rem;',
    '}',
    '',
    '.layout pre {',
    '  margin: 0;',
    '  background: rgba(15, 23, 42, 0.75);',
    '  border: 1px solid rgba(148, 163, 184, 0.25);',
    '  border-radius: 1rem;',
    '  padding: 1.25rem;',
    '  overflow: auto;',
    '}',
    '',
    '.layout code {',
    '  background: rgba(148, 163, 184, 0.25);',
    '  padding: 0.1rem 0.4rem;',
    '  border-radius: 0.4rem;',
    '}',
  ];
  await fs.writeFile(path.join(appDir, 'globals.css'), cssLines.join('\n') + '\n');
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
    frontendFramework: answers.frontendFramework,
    dryRun: options.dryRun ?? false,
  });

  const frontendResult = await scaffoldFrontend({
    framework: answers.frontendFramework,
    packageManager: answers.packageManager,
    targetDirectory,
    projectName: answers.projectName,
    dryRun: options.dryRun ?? false,
  });

  const relativePath = path.relative(process.cwd(), targetDirectory) || '.';

  let instructions = (
    f"\n{chalk.bold('Prochaines étapes :')}\n"
    + f"  {chalk.cyan(f'cd {relativePath}')}\n"
    + f"  {chalk.cyan(getPackageManagerCommand(answers.packageManager, 'install'))}\n"
    + f"  {chalk.cyan(getPackageManagerCommand(answers.packageManager, 'test'))} (optionnel)\n"
    + f"  {chalk.cyan(getPackageManagerCommand(answers.packageManager, 'dev'))}\n"
    + f"  {chalk.cyan(getPackageManagerCommand(answers.packageManager, 'apiStatus'))} (optionnel)"
  );

  if (frontendResult) {
    const definition = frontendFrameworkCatalogMap.get(frontendResult.framework)!;
    const frontendPathFromRoot = (
      relativePath == '.'
      and definition.appDirectory
      or toPosixPath(path.join(relativePath, definition.appDirectory))
    );

    instructions += (
      f"\n{chalk.bold('Interface :')}\n"
      + f"  {chalk.cyan(f'cd {frontendPathFromRoot}')} (optionnel)\n"
      + f"  {chalk.cyan(getPackageManagerRunCommand(answers.packageManager, 'web:dev'))} (serveur front)\n"
      + f"  {chalk.cyan(getPackageManagerRunCommand(answers.packageManager, 'web:build'))} (build front)"
    );
  }

  console.log('\n' + chalk.green('[OK] Template API généré avec succés !'));
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
    console.log('\n' + chalk.cyan(f"Installation des dépendances ({installCommand})..."));
    await runShellCommand(installCommand, targetDirectory);

    console.log('\n' + chalk.cyan(f"Exécution des tests ({testCommand})..."));
    await runShellCommand(testCommand, targetDirectory);

    console.log('\n' + chalk.green('[OK] Tests exécutés avec succés.'));
  } catch (error) {
    const message = error instanceof Error ? error.message : str(error);
    console.error('\n' + chalk.red(f"[ERREUR] Les tests n'ont pas pu étre exécutés automatiquement : {message}"));
    console.error(
      chalk.yellow(
        'Vous pouvez relancer manuellement les commandes indiquées dans les étapes ci-dessus une fois prét.'
      )
    );
  }
}
"""

Path('src/cli/commands/create.ts').write_text(content, encoding='utf-8')
