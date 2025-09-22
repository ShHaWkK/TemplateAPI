import { JavaScriptTemplateGenerator } from './javascript-generator';
import { BaseTemplateGenerator } from './base-generator';
import { Language } from './types';
import { TypeScriptTemplateGenerator } from './typescript-generator';

const generators: Record<Language, BaseTemplateGenerator> = {
  javascript: new JavaScriptTemplateGenerator(),
  typescript: new TypeScriptTemplateGenerator(),
};

export function getGeneratorForLanguage(language: Language): BaseTemplateGenerator {
  const generator = generators[language];
  if (!generator) {
    throw new Error(`Aucun générateur disponible pour le langage ${language}`);
  }
  return generator;
}
