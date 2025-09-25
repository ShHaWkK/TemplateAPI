import path from 'node:path';
import fs from 'fs-extra';
import { BaseTemplateGenerator, GenerateProjectOptions, TemplateContext, TemplateDependencies } from './base-generator';
import { DataProviderKey, FeatureKey, Language } from './types';

const templateRoot = path.resolve(__dirname, '../../..', 'templates', 'typescript');

export class TypeScriptTemplateGenerator extends BaseTemplateGenerator {
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
      { name: '@types/cors', version: '^2.8.17' },
      { name: '@types/express', version: '^4.17.21' },
      { name: '@types/express-rate-limit', version: '^5.1.3' },
      { name: '@types/jest', version: '^29.5.12' },
      { name: '@types/node', version: '^20.11.20' },
      { name: '@types/supertest', version: '^2.0.16' },
      { name: '@types/swagger-ui-express', version: '^4.1.3' },
      { name: 'openapi-types', version: '^12.1.3' },
      { name: '@typescript-eslint/eslint-plugin', version: '^6.21.0' },
      { name: '@typescript-eslint/parser', version: '^6.21.0' },
      { name: 'eslint', version: '^8.56.0' },
      { name: 'eslint-config-prettier', version: '^9.1.0' },
      { name: 'jest', version: '^29.7.0' },
      { name: 'prettier', version: '^3.2.5' },
      { name: 'supertest', version: '^7.1.1' },
      { name: 'ts-jest', version: '^29.1.2' },
      { name: 'ts-node', version: '^10.9.2' },
      { name: 'ts-node-dev', version: '^2.0.0' },
      { name: 'typescript', version: '^5.4.2' },
    ];

    if (features.includes('auth')) {
      dependencies.push({ name: 'bcryptjs', version: '^2.4.3' });
      dependencies.push({ name: 'jsonwebtoken', version: '^9.0.2' });
      devDependencies.push({ name: '@types/jsonwebtoken', version: '^9.0.6' });
    }

    for (const provider of dataProviders) {
      if (provider === 'postgresql') {
        dependencies.push({ name: 'pg', version: '^8.11.3' });
        devDependencies.push({ name: '@types/pg', version: '^8.10.6' });
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
      dev: 'ts-node-dev --respawn --transpile-only --ignore-watch node_modules --no-notify src/server.ts',
      build: 'tsc -p tsconfig.json',
      start: 'node dist/server.js',
      test: 'jest --passWithNoTests',
      'test:watch': 'jest --watch',
      lint: 'eslint --ext .ts src tests',
      format: 'prettier --write src tests',
      api: 'ts-node scripts/api-cli.ts',
    };

    if (dataProviders.includes('prisma')) {
      scripts['prisma:generate'] = 'prisma generate';
      scripts['prisma:migrate'] = 'prisma migrate dev';
      scripts['prisma:deploy'] = 'prisma migrate deploy';
      scripts['prisma:studio'] = 'prisma studio';
      scripts['db:migrate'] = 'prisma migrate deploy';
      scripts['db:seed'] = 'ts-node --project tsconfig.json --files prisma/seed.ts';
    }


    return {
      dependencies,
      devDependencies,
      scripts,
    };
  }

  protected getAdditionalContext(options: GenerateProjectOptions, _dependencies: TemplateDependencies) {
    return {
      isTypeScript: true,
      hasAuth: options.features.includes('auth'),
      hasUserCrud: options.features.includes('userCrud'),
      hasClientPortal: options.features.includes('clientPortal'),
      hasAdminPortal: options.features.includes('adminPortal'),
      hasDatabaseProviders: options.dataProviders.some((provider) =>
        ['postgresql', 'mysql', 'sqlite', 'prisma'].includes(provider)
      ),
      hasPrisma: options.dataProviders.includes('prisma'),
      hasObjectStorage: options.dataProviders.includes('s3'),
    };
  }

  protected async afterGenerate(options: GenerateProjectOptions, context: TemplateContext): Promise<void> {
    await super.afterGenerate(options, context);

    if (options.dryRun) {
      return;
    }

    if (!options.dataProviders.includes('prisma')) {
      const prismaDir = path.join(options.targetDirectory, 'prisma');
      const prismaSrcDir = path.join(options.targetDirectory, 'src', 'infrastructure', 'persistence', 'prisma');

      if (await fs.pathExists(prismaDir)) {
        await fs.remove(prismaDir);
      }

      if (await fs.pathExists(prismaSrcDir)) {
        await fs.remove(prismaSrcDir);
      }
    }
  }
}

