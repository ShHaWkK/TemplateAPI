/**
 * Système de configuration dynamique pour le template API
 * Permet la personnalisation via template.config.js
 */

import path from 'node:path';
import fs from 'fs-extra';

export interface HookContext {
  projectName: string;
  targetDirectory: string;
  language: string;
  features: string[];
  [key: string]: unknown;
}

export type HookFunction = (context: HookContext) => Promise<void> | void;

export interface TemplateHooks {
  preGenerate?: HookFunction;
  postGenerate?: HookFunction;
  preFeatureGenerate?: (feature: string, context: HookContext) => Promise<void> | void;
  postFeatureGenerate?: (feature: string, context: HookContext) => Promise<void> | void;
}

export interface FeatureFlagConfig {
  name: string;
  description: string;
  defaultValue: boolean;
  environments?: Record<string, boolean>;
}

export interface TemplateConfig {
  name?: string;
  description?: string;
  extends?: string;
  features?: {
    include?: string[];
    exclude?: string[];
    custom?: Array<{
      name: string;
      description: string;
      dependencies?: string[];
    }>;
  };
  featureFlags?: FeatureFlagConfig[];
  hooks?: TemplateHooks;
  templates?: {
    override?: Record<string, string>;
    custom?: Record<string, string>;
  };
  variables?: Record<string, unknown>;
}

const DEFAULT_CONFIG: TemplateConfig = {
  name: 'template-api-project',
  description: 'API generated with create-template-api',
};

export async function loadTemplateConfig(configPath?: string): Promise<TemplateConfig> {
  const searchPaths = configPath
    ? [configPath]
    : [
        'template.config.js',
        'template.config.ts',
        '.templateapirc.js',
        '.templateapirc',
      ];

  for (const searchPath of searchPaths) {
    const fullPath = path.resolve(process.cwd(), searchPath);
    if (await fs.pathExists(fullPath)) {
      // Clear require cache for hot reload in dev
      delete require.cache[require.resolve(fullPath)];
      const config = require(fullPath) as TemplateConfig;
      return mergeConfig(DEFAULT_CONFIG, config);
    }
  }

  return { ...DEFAULT_CONFIG };
}

function mergeConfig(base: TemplateConfig, override: TemplateConfig): TemplateConfig {
  return {
    ...base,
    ...override,
    features: {
      ...base.features,
      ...override.features,
    },
    hooks: {
      ...base.hooks,
      ...override.hooks,
    },
    templates: {
      override: {
        ...base.templates?.override,
        ...override.templates?.override,
      },
      custom: {
        ...base.templates?.custom,
        ...override.templates?.custom,
      },
    },
    variables: {
      ...base.variables,
      ...override.variables,
    },
  };
}

export type GenerationHookName = 'preGenerate' | 'postGenerate';
export type FeatureGenerationHookName = 'preFeatureGenerate' | 'postFeatureGenerate';

export async function executeHook(
  hookName: GenerationHookName,
  hooks: TemplateHooks | undefined,
  context: HookContext
): Promise<void> {
  const hook = hooks?.[hookName];
  if (hook) {
    await hook(context);
  }
}

export async function executeFeatureHook(
  hookName: FeatureGenerationHookName,
  hooks: TemplateHooks | undefined,
  feature: string,
  context: HookContext
): Promise<void> {
  const hook = hooks?.[hookName];
  if (hook) {
    await hook(feature, context);
  }
}

export function resolveFeatureFlags(
  flags: FeatureFlagConfig[],
  environment: string = process.env.NODE_ENV || 'development'
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const flag of flags) {
    const envValue = process.env[`FEATURE_${flag.name.toUpperCase()}`];
    if (envValue !== undefined) {
      result[flag.name] = envValue === 'true' || envValue === '1';
    } else if (flag.environments?.[environment] !== undefined) {
      result[flag.name] = flag.environments[environment];
    } else {
      result[flag.name] = flag.defaultValue;
    }
  }

  return result;
}
