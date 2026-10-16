/**
 * @file src/core/entities/settings.ts
 * @description Settings entities, LLM/STT configurations, and user persona/goals.
 */

export type LLMProviderType = 'gemini' | 'openai' | 'groq' | 'xai' | 'custom_openai';

export type STTProviderType = 'groq_whisper' | 'openai_whisper' | 'custom_stt';

export interface PersonaGoals {
  /** Name or alias of the user */
  userName: string;
  /** Role/context, e.g. "CEO / Tech Lead / Freelancer / Negotiator" */
  userRole: string;
  /** Primary goals in communication, e.g. "Close deals, prevent manipulation, maintain professional tone" */
  communicationGoals: string;
  /** Preferred tone of response, e.g. "Diplomatic, assertive, concise, warm" */
  preferredTone: string;
  /** Additional custom system instructions */
  customInstructions?: string;
}

export interface LLMConfig {
  provider: LLMProviderType;
  apiKey: string;
  model: string;
  endpointUrl?: string; // For custom OpenAI-compatible
  temperature?: number;
  maxTokens?: number;
}

export interface STTConfig {
  provider: STTProviderType;
  apiKey: string;
  model: string;
  endpointUrl?: string;
}

export interface UserSettings {
  activeLLM: LLMConfig;
  activeSTT: STTConfig;
  persona: PersonaGoals;
  /** Default depth of message crawling for analysis (e.g. 50 messages) */
  defaultCrawlDepth: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  activeLLM: {
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-flash',
    temperature: 0.7,
  },
  activeSTT: {
    provider: 'groq_whisper',
    apiKey: '',
    model: 'whisper-large-v3-turbo',
  },
  persona: {
    userName: 'User',
    userRole: 'Negotiator / Professional',
    communicationGoals: 'Detect manipulative tactics, maintain strategic initiative, craft concise winning replies',
    preferredTone: 'Diplomatic, calm, and assertive',
    customInstructions: '',
  },
  defaultCrawlDepth: 50,
};
