/**
 * @file src/core/interfaces/llm-provider.ts
 * @description Contract for LLM providers (Gemini, OpenAI, Grok, Ollama).
 */

import { ChatMessage } from '../entities/message';
import { PersonaGoals } from '../entities/settings';

export interface ChatAnalysis {
  /** High-level summary of the situation */
  situationSummary: string;
  /** Manipulation detection verdict */
  manipulationVerdict: {
    isManipulative: boolean;
    tacticsDetected: string[];
    riskScore: number; // 0 to 100
    explanation: string;
  };
  /** Interlocutor's hidden intent or emotional state */
  interlocutorAnalysis: string;
  /** Suggested tactical replies (e.g. assertive, diplomatic, clarifying) */
  suggestedReplies: Array<{
    label: string;
    text: string;
    strategicGoal: string;
  }>;
}

export interface CopilotPromptRequest {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
}

export interface ILLMProvider {
  readonly providerId: string;

  /** Generates a complete text response */
  generateText(request: CopilotPromptRequest): Promise<string>;

  /** Streams response chunks as they arrive */
  streamText(request: CopilotPromptRequest, onChunk: (chunk: string) => void): Promise<string>;

  /** Performs structured analysis of a chat thread */
  analyzeChat(messages: ChatMessage[], persona: PersonaGoals, customQuery?: string): Promise<ChatAnalysis>;
}
