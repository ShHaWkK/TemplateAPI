/**
 * Plugin System for Template API Generator
 * Allows extending functionality with custom plugins
 */

import path from 'node:path';
import fs from 'fs-extra';
import { FeatureDefinition, FeatureKey, DataProviderDefinition, DataProviderKey } from './types';

export interface PluginContext {
  projectName: string;
  targetDirectory: string;
  language: string;
  features: string[];
  dataProviders: string[];
  frontendFramework: string;
  packageManager: string;
}

export interface PluginGeneratorOptions {
  context: PluginContext;
  templateDir: string;
  outputDir: string;
}

export interface PluginFileTemplate {
  source: string;
  destination: string;
  transform?: (content: string, context: PluginContext) => string;
}

export interface PluginDependency {
  name: string;
  version: string;
  dev?: boolean;
}

export interface PluginScript {
  name: string;
  command: string;
}

export interface PluginEnvironmentVariable {
  name: string;
  description: string;
  required?: boolean;
  default?: string;
}

export interface PluginTemplateAPI {
  addFile(template: PluginFileTemplate): void;
  addDependency(dep: PluginDependency): void;
  addScript(script: PluginScript): void;
  addEnvironmentVariable(env: PluginEnvironmentVariable): void;
  registerFeature(feature: FeatureDefinition): void;
  registerDataProvider(provider: DataProviderDefinition): void;
  addHook(hookName: string, handler: (context: PluginContext) => Promise<void> | void): void;
}

export interface TemplatePlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  
  // Plugin initialization
  initialize?(api: PluginTemplateAPI, options: Record<string, unknown>): Promise<void> | void;
  
  // Hooks
  beforeGenerate?(context: PluginContext): Promise<void> | void;
  afterGenerate?(context: PluginContext): Promise<void> | void;
  beforeFeatureGenerate?(feature: string, context: PluginContext): Promise<void> | void;
  afterFeatureGenerate?(feature: string, context: PluginContext): Promise<void> | void;
}

export class PluginManager {
  private plugins: Map<string, TemplatePlugin> = new Map();
  private hooks: Map<string, Array<(context: PluginContext) => Promise<void> | void>> = new Map();
  private customFeatures: Map<string, FeatureDefinition> = new Map();
  private customDataProviders: Map<string, DataProviderDefinition> = new Map();
  
  private api: PluginTemplateAPI;

  constructor() {
    this.api = this.createPluginAPI();
  }

  private createPluginAPI(): PluginTemplateAPI {
    const fileTemplates: PluginFileTemplate[] = [];
    const dependencies: PluginDependency[] = [];
    const scripts: PluginScript[] = [];
    const environmentVariables: PluginEnvironmentVariable[] = [];

    return {
      addFile: (template) => fileTemplates.push(template),
      addDependency: (dep) => dependencies.push(dep),
      addScript: (script) => scripts.push(script),
      addEnvironmentVariable: (env) => environmentVariables.push(env),
      registerFeature: (feature) => {
        this.customFeatures.set(feature.key, feature);
      },
      registerDataProvider: (provider) => {
        this.customDataProviders.set(provider.key, provider);
      },
      addHook: (hookName, handler) => {
        if (!this.hooks.has(hookName)) {
          this.hooks.set(hookName, []);
        }
        this.hooks.get(hookName)!.push(handler);
      },
    };
  }

  async loadPlugin(pluginPath: string): Promise<void> {
    const resolvedPath = path.resolve(pluginPath);
    
    if (!await fs.pathExists(resolvedPath)) {
      throw new Error(`Plugin not found: ${resolvedPath}`);
    }

    // Clear require cache for hot reload
    delete require.cache[require.resolve(resolvedPath)];
    
    const pluginModule = require(resolvedPath) as { default?: TemplatePlugin; plugin?: TemplatePlugin } | TemplatePlugin;
    const plugin: TemplatePlugin | undefined = 
      (pluginModule as { default?: TemplatePlugin }).default || 
      (pluginModule as { plugin?: TemplatePlugin }).plugin || 
      (pluginModule as TemplatePlugin);

    if (!plugin || !plugin.name) {
      throw new Error(`Invalid plugin format: ${resolvedPath}`);
    }

    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already loaded: ${plugin.name}`);
    }

    this.plugins.set(plugin.name, plugin);

    // Initialize plugin if initialize method exists
    if (plugin.initialize) {
      await plugin.initialize(this.api, {});
    }
  }

  async loadPluginsFromDirectory(directory: string): Promise<void> {
    if (!await fs.pathExists(directory)) {
      return;
    }

    const entries = await fs.readdir(directory);
    const pluginFiles = entries.filter(entry => 
      entry.endsWith('.js') || entry.endsWith('.ts')
    );

    for (const file of pluginFiles) {
      await this.loadPlugin(path.join(directory, file));
    }
  }

  async executeHook(hookName: string, context: PluginContext): Promise<void> {
    // Execute registered hooks
    const hooks = this.hooks.get(hookName);
    if (hooks) {
      for (const hook of hooks) {
        await hook(context);
      }
    }

    // Execute plugin methods
    for (const plugin of this.plugins.values()) {
      const methodName = hookName as keyof TemplatePlugin;
      const method = plugin[methodName];
      if (typeof method === 'function') {
        await (method as (context: PluginContext) => Promise<void> | void).call(plugin, context);
      }
    }
  }

  getCustomFeatures(): FeatureDefinition[] {
    return Array.from(this.customFeatures.values());
  }

  getCustomDataProviders(): DataProviderDefinition[] {
    return Array.from(this.customDataProviders.values());
  }

  getLoadedPlugins(): TemplatePlugin[] {
    return Array.from(this.plugins.values());
  }
}

export const pluginManager = new PluginManager();
