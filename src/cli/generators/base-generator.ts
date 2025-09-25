import path from 'node:path';
import fs from 'fs-extra';
import ejs from 'ejs';
import { formatPackageName } from '../utils/project-name';
import {
  DataProviderDefinition,
  DataProviderKey,
  FeatureDefinition,
  FeatureKey,
  FrontendFrameworkDefinition,
  FrontendFrameworkKey,
  Language,
  dataProviderCatalogMap,
  featureCatalogMap,
  frontendFrameworkCatalogMap,
} from './types';

export interface DependencyItem {
  name: string;
  version: string;
}

export interface TemplateDependencies {
  dependencies: DependencyItem[];
  devDependencies: DependencyItem[];
  scripts: Record<string, string>;
}

export interface GenerateProjectOptions {
  projectName: string;
  targetDirectory: string;
  language: Language;
  features: FeatureKey[];
  packageManager: 'npm' | 'pnpm' | 'yarn';
  dataProviders: DataProviderKey[];
  frontendFramework: FrontendFrameworkKey;
  dryRun?: boolean;
}

interface PackageManagerCommands {
  install: string;
  run: string;
  exec: string;
}

export interface TemplateContext {
  projectName: string;
  packageName: string;
  language: Language;
  features: FeatureKey[];
  selectedFeatures: FeatureDefinition[];
  featureSummaries: string[];
  dataProviders: DataProviderKey[];
  selectedDataProviders: DataProviderDefinition[];
  dataProviderSummaries: string[];
  frontendFramework: FrontendFrameworkKey;
  selectedFrontendFramework: FrontendFrameworkDefinition | null;
  frontendAppDirectory: string | null;
  frontendSummary: string | null;
  dependencies: DependencyItem[];
  devDependencies: DependencyItem[];
  scripts: Record<string, string>;
  packageManager: 'npm' | 'pnpm' | 'yarn';
  packageManagerCommands: PackageManagerCommands;
  year: number;
  createdAt: string;
  [key: string]: unknown;
}

export abstract class BaseTemplateGenerator {
  constructor(private readonly templateRoot: string) {}

  async generate(options: GenerateProjectOptions) {
    const {
      targetDirectory,
      features,
      dataProviders,
      projectName,
      language,
      packageManager,
      frontendFramework,
    } = options;

    if (!options.dryRun) {
      await fs.ensureDir(targetDirectory);
    }

    const selectedFeatures = features.map((featureKey) => {
      const feature = featureCatalogMap.get(featureKey);
      if (!feature) {
        throw new Error(`Module inconnu: ${featureKey}`);
      }
      return feature;
    });

    const selectedDataProviders = dataProviders.map((providerKey) => {
      const provider = dataProviderCatalogMap.get(providerKey);
      if (!provider) {
        throw new Error(`Option de persistance inconnue: ${providerKey}`);
      }
      return provider;
    });

    const selectedFrontendDefinition =
      frontendFramework !== 'none' ? frontendFrameworkCatalogMap.get(frontendFramework) : undefined;

    if (frontendFramework !== 'none' && !selectedFrontendDefinition) {
      throw new Error(`Framework front inconnu: ${frontendFramework}`);
    }

    const dependencies = this.buildDependencies(language, features, dataProviders);

    const frontendAppDirectory = selectedFrontendDefinition?.appDirectory ?? null;

    if (selectedFrontendDefinition) {
      const buildFrontendScript = (script: string) => {
        if (packageManager === 'npm') {
          return `npm run ${script} --prefix ${selectedFrontendDefinition.appDirectory}`;
        }
        if (packageManager === 'pnpm') {
          return `pnpm --dir ${selectedFrontendDefinition.appDirectory} ${script}`;
        }
        return `yarn --cwd ${selectedFrontendDefinition.appDirectory} ${script}`;
      };

      if (frontendFramework === 'react-vite') {
        dependencies.scripts['web:dev'] = buildFrontendScript('dev');
        dependencies.scripts['web:build'] = buildFrontendScript('build');
        dependencies.scripts['web:preview'] = buildFrontendScript('preview');
      } else if (frontendFramework === 'nextjs') {
        dependencies.scripts['web:dev'] = buildFrontendScript('dev');
        dependencies.scripts['web:build'] = buildFrontendScript('build');
        dependencies.scripts['web:start'] = buildFrontendScript('start');
      }
    }

    const packageName = formatPackageName(projectName);
    const packageManagerCommands = getPackageManagerCommands(packageManager);

    const context: TemplateContext = {
      projectName,
      packageName,
      language,
      features,
      selectedFeatures,
      featureSummaries: selectedFeatures.map((feature) => feature.summary),
      dataProviders,
      selectedDataProviders,
      dataProviderSummaries: selectedDataProviders.map((provider) => provider.summary),
      frontendFramework,
      selectedFrontendFramework: selectedFrontendDefinition ?? null,
      frontendAppDirectory,
      frontendSummary: selectedFrontendDefinition?.summary ?? null,
      dependencies: dependencies.dependencies,
      devDependencies: dependencies.devDependencies,
      scripts: dependencies.scripts,
      packageManager,
      packageManagerCommands,
      year: new Date().getFullYear(),
      createdAt: new Date().toISOString(),
      ...this.getAdditionalContext(options, dependencies),
    };

    if (!options.dryRun) {
      await this.copyTemplateDirectory(this.getBaseTemplateDir(), targetDirectory, context);

      for (const featureKey of features) {
        const featureDir = this.getFeatureTemplateDir(featureKey);
        if (featureDir) {
          await this.copyTemplateDirectory(featureDir, targetDirectory, context);
        }
      }
    }

    await this.afterGenerate(options, context);
  }

  protected abstract getBaseTemplateDir(): string;
  protected abstract getFeatureTemplateDir(feature: FeatureKey): string | undefined;
  protected abstract buildDependencies(
    language: Language,
    features: FeatureKey[],
    dataProviders: DataProviderKey[]
  ): TemplateDependencies;

  protected getAdditionalContext(
    _options: GenerateProjectOptions,
    _dependencies: TemplateDependencies
  ): Record<string, unknown> {
    return {};
  }

  protected async afterGenerate(_options: GenerateProjectOptions, _context: TemplateContext): Promise<void> {}

  protected async copyTemplateDirectory(templateDir: string, destinationDir: string, context: TemplateContext) {
    const entries = await fs.readdir(templateDir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(templateDir, entry.name);
      const destinationBaseName = entry.name.replace(/\.ejs$/, '');
      const destinationPath = path.join(destinationDir, destinationBaseName);

      if (entry.isDirectory()) {
        await this.copyTemplateDirectory(sourcePath, destinationPath, context);
      } else if (entry.name.endsWith('.ejs')) {
        const rendered = await ejs.renderFile(sourcePath, context, { async: true });
        const transformed = this.transformRenderedFile(destinationPath, rendered);
        if (transformed === null) {
          continue;
        }
        const finalPath = transformed?.fileName
          ? path.join(path.dirname(destinationPath), transformed.fileName)
          : destinationPath;
        await fs.ensureDir(path.dirname(finalPath));
        await fs.writeFile(finalPath, transformed?.content ?? rendered, 'utf8');
      } else {
        await fs.ensureDir(path.dirname(destinationPath));
        await fs.copy(sourcePath, destinationPath);
      }
    }
  }

  protected transformRenderedFile(
    _filePath: string,
    content: string
  ): { content: string; fileName?: string } | undefined | null {
    return { content };
  }
}

function getPackageManagerCommands(packageManager: 'npm' | 'pnpm' | 'yarn'): PackageManagerCommands {
  switch (packageManager) {
    case 'npm':
      return { install: 'npm install', run: 'npm run', exec: 'npx' };
    case 'pnpm':
      return { install: 'pnpm install', run: 'pnpm', exec: 'pnpm dlx' };
    case 'yarn':
    default:
      return { install: 'yarn install', run: 'yarn', exec: 'yarn dlx' };
  }
}

