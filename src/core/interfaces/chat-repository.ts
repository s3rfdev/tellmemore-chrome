/**
 * @file src/core/interfaces/chat-repository.ts
 * @description Repository interface for storing chat history, media transcription cache, and settings.
 */

import { ChatMessage } from '../entities/message';
import { ChatThread, ContactProfile } from '../entities/thread';
import { UserSettings } from '../entities/settings';

export interface IChatRepository {
  /** Saves or updates messages in local IndexedDB */
  upsertMessages(threadId: string, messages: ChatMessage[]): Promise<void>;

  /** Retrieves the latest N messages for a thread */
  getMessages(threadId: string, limit?: number): Promise<ChatMessage[]>;

  /** Saves thread metadata and contact profile */
  saveThread(thread: ChatThread): Promise<void>;

  /** Gets thread metadata */
  getThread(threadId: string): Promise<ChatThread | null>;

  /** Saves contact notes or profile details */
  saveContactProfile(contact: ContactProfile): Promise<void>;

  /** Gets cached transcription for an audio/voice hash to avoid redundant API calls */
  getCachedTranscription(hash: string): Promise<string | null>;

  /** Stores transcription result for an audio hash */
  setCachedTranscription(hash: string, transcription: string): Promise<void>;

  /** Gets cached summary for an image hash */
  getCachedImageSummary(hash: string): Promise<string | null>;

  /** Stores image summary */
  setCachedImageSummary(hash: string, summary: string): Promise<void>;

  /** Saves dialogue history and analysis for a specific contact / thread */
  saveCopilotSession(
    threadId: string,
    session: {
      dialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
      analysis: any | null;
      goals?: string;
    }
  ): Promise<void>;

  /** Retrieves saved dialogue history and analysis for a specific contact / thread */
  getCopilotSession(threadId: string): Promise<{
    threadId: string;
    dialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
    analysis: any | null;
    goals?: string;
    updatedAt: number;
  } | null>;
}

export interface ISettingsRepository {
  getSettings(): Promise<UserSettings>;
  saveSettings(settings: Partial<UserSettings>): Promise<UserSettings>;
}
