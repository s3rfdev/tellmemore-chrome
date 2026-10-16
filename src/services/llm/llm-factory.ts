/**
 * @file src/services/llm/llm-factory.ts
 * @description Factory to instantiate the active ILLMProvider based on UserSettings.
 */

import { ILLMProvider } from '../../core/interfaces/llm-provider';
import { LLMConfig } from '../../core/entities/settings';
import { GeminiService } from './gemini-service';
import { OpenAIService } from './openai-service';
import { ZaiService } from './zai-service';

export class LLMFactory {
  static create(config: LLMConfig): ILLMProvider {
    switch (config.provider) {
      case 'gemini':
        return new GeminiService(config);
      case 'zai':
        return new ZaiService(config);
      case 'openai':
      case 'xai':
      case 'custom_openai':
      case 'groq':
        return new OpenAIService(config);
      default:
        return new GeminiService(config);
    }
  }
}
