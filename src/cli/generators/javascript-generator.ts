import path from 'node:path';
import fs from 'fs-extra';
import ts from 'typescript';
import { BaseTemplateGenerator, GenerateProjectOptions, TemplateDependencies, TemplateContext } from './base-generator';
import { DataProviderKey, FeatureKey, Language } from './types';

const templateRoot = path.resolve(__dirname, '../../..', 'templates', 'javascript');

export class JavaScriptTemplateGenerator extends BaseTemplateGenerator {
  constructor() {
    super(templateRoot);
  }

  protected getBaseTemplateDir(): string {
    return path.join(templateRoot, 'base');
  }

  protected getFeatureTemplateDir(feature: FeatureKey): string | undefined {
    const featurePath = path.join(templateRoot, 'features', feature);
    return fs.existsSync(featurePath) ? featurePath : undefined;
  }

  protected buildDependencies(
    _language: Language,
    features: FeatureKey[],
    dataProviders: DataProviderKey[]
  ): TemplateDependencies {
    const dependencies = [
      { name: 'cors', version: '^2.8.5' },
      { name: 'dotenv', version: '^16.4.1' },
      { name: 'express', version: '^4.18.2' },
      { name: 'express-rate-limit', version: '^6.11.2' },
      { name: 'helmet', version: '^7.0.0' },
      { name: 'pino', version: '^8.16.1' },
      { name: 'pino-http', version: '^9.0.1' },
      { name: 'pino-pretty', version: '^10.3.1' },
      { name: 'swagger-ui-express', version: '^5.0.0' },
      { name: 'zod', version: '^3.22.4' },
    ];

    const devDependencies = [
      { name: 'eslint', version: '^8.56.0' },
      { name: 'eslint-config-prettier', version: '^9.1.0' },
      { name: 'jest', version: '^29.7.0' },
      { name: 'nodemon', version: '^3.0.3' },
      { name: 'prettier', version: '^3.2.5' },
      { name: 'supertest', version: '^7.1.1' },
    ];

    if (features.includes('auth')) {
      dependencies.push({ name: 'bcryptjs', version: '^2.4.3' });
      dependencies.push({ name: 'jsonwebtoken', version: '^9.0.2' });
    }

    for (const provider of dataProviders) {
      if (provider === 'postgresql') {
        dependencies.push({ name: 'pg', version: '^8.11.3' });
      }

      if (provider === 'mysql') {
        dependencies.push({ name: 'mysql2', version: '^3.9.7' });
      }

      if (provider === 'sqlite') {
        dependencies.push({ name: 'better-sqlite3', version: '^9.4.5' });
      }

      if (provider === 'prisma') {
        dependencies.push({ name: '@prisma/client', version: '^5.10.2' });
        devDependencies.push({ name: 'prisma', version: '^5.10.2' });
      }

      if (provider === 's3') {
        dependencies.push({ name: '@aws-sdk/client-s3', version: '^3.550.0' });
      }
    }

    const scripts: Record<string, string> = {
      dev: 'nodemon src/server.js',
      start: 'node src/server.js',
      build: 'echo No build step required',
      test: 'jest --passWithNoTests',
      'test:watch': 'jest --watch',
      lint: 'eslint src tests',
      format: 'prettier --write src tests',
      api: 'node scripts/api-cli.js',
    };

    if (dataProviders.includes('prisma')) {
      scripts['prisma:generate'] = 'prisma generate';
      scripts['prisma:migrate'] = 'prisma migrate dev';
      scripts['prisma:studio'] = 'prisma studio';
    }

    return {
      dependencies,
      devDependencies,
      scripts,
    };
  }

  protected getAdditionalContext(options: GenerateProjectOptions, _dependencies: TemplateDependencies) {
    return {
      isTypeScript: false,
      hasAuth: options.features.includes('auth'),
      hasUserCrud: options.features.includes('userCrud'),
      hasClientPortal: options.features.includes('clientPortal'),
      hasAdminPortal: options.features.includes('adminPortal'),
      hasDatabaseProviders: options.dataProviders.some((provider) => provider === 'postgresql' || provider === 'mysql' || provider === 'sqlite'),
      hasPrisma: options.dataProviders.includes('prisma'),
      hasObjectStorage: options.dataProviders.includes('s3'),
    };
  }

  protected transformRenderedFile(filePath: string, content: string) {
    if (filePath.endsWith('.d.ts')) {
      return null;
    }

    if (filePath.endsWith('.ts')) {
      const transpiled = ts.transpileModule(content, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2021,
          esModuleInterop: true,
        },
      });

      const fileName = path.basename(filePath).replace(/\.ts$/, '.js');
      return { content: transpiled.outputText, fileName };
    }

    return super.transformRenderedFile(filePath, content);
  }

  protected async afterGenerate(options: GenerateProjectOptions, context: TemplateContext): Promise<void> {
    if (options.dryRun) {
      return;
    }

    const typescriptRoot = path.resolve(__dirname, '../../..', 'templates', 'typescript');
    const baseSrc = path.join(typescriptRoot, 'base', 'src');
    const baseTests = path.join(typescriptRoot, 'base', 'tests');
    const baseDocs = path.join(typescriptRoot, 'base', 'docs');
    const baseScripts = path.join(typescriptRoot, 'base', 'scripts');

    await this.copyTemplateDirectory(baseSrc, path.join(options.targetDirectory, 'src'), context);
    await this.copyTemplateDirectory(baseTests, path.join(options.targetDirectory, 'tests'), context);
    await this.copyTemplateDirectory(baseDocs, path.join(options.targetDirectory, 'docs'), context);
    if (fs.existsSync(baseScripts)) {
      await this.copyTemplateDirectory(baseScripts, path.join(options.targetDirectory, 'scripts'), context);
    }

    for (const feature of options.features) {
      const featureDir = path.join(typescriptRoot, 'features', feature);
      if (fs.existsSync(featureDir)) {
        await this.copyTemplateDirectory(featureDir, options.targetDirectory, context);
      }
    }
  }
}
