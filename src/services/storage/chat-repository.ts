/**
 * @file src/services/storage/chat-repository.ts
 * @description Implementation of IChatRepository using IndexedDB and ISettingsRepository using chrome.storage.
 */

import { IChatRepository, ISettingsRepository } from '../../core/interfaces/chat-repository';
import { ChatMessage } from '../../core/entities/message';
import { ChatThread, ContactProfile } from '../../core/entities/thread';
import { UserSettings, DEFAULT_USER_SETTINGS } from '../../core/entities/settings';
import { getDatabase } from './idb-schema';

export class IndexedDBChatRepository implements IChatRepository {
  async upsertMessages(threadId: string, messages: ChatMessage[]): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction('messages', 'readwrite');
    for (const msg of messages) {
      await tx.store.put({
        ...msg,
        threadId,
      });
    }
    await tx.done;
  }

  async getMessages(threadId: string, limit = 100): Promise<ChatMessage[]> {
    const db = await getDatabase();
    const tx = db.transaction('messages', 'readonly');
    const index = tx.store.index('by-thread');
    const allMessages = await index.getAll(threadId);

    // Sort chronologically ascending
    allMessages.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    if (allMessages.length > limit) {
      return allMessages.slice(-limit);
    }
    return allMessages;
  }

  async saveThread(thread: ChatThread): Promise<void> {
    const db = await getDatabase();
    await db.put('threads', thread);
  }

  async getThread(threadId: string): Promise<ChatThread | null> {
    const db = await getDatabase();
    const thread = await db.get('threads', threadId);
    return thread ?? null;
  }

  async saveContactProfile(contact: ContactProfile): Promise<void> {
    const db = await getDatabase();
    await db.put('contacts', contact);
  }

  async getCachedTranscription(hash: string): Promise<string | null> {
    const db = await getDatabase();
    const record = await db.get('media_cache', hash);
    return record?.transcription ?? null;
  }

  async setCachedTranscription(hash: string, transcription: string): Promise<void> {
    const db = await getDatabase();
    const existing = await db.get('media_cache', hash);
    await db.put('media_cache', {
      hash,
      summary: existing?.summary,
      transcription,
      updatedAt: Date.now(),
    });
  }

  async getCachedImageSummary(hash: string): Promise<string | null> {
    const db = await getDatabase();
    const record = await db.get('media_cache', hash);
    return record?.summary ?? null;
  }

  async setCachedImageSummary(hash: string, summary: string): Promise<void> {
    const db = await getDatabase();
    const existing = await db.get('media_cache', hash);
    await db.put('media_cache', {
      hash,
      transcription: existing?.transcription,
      summary,
      updatedAt: Date.now(),
    });
  }
}

export class ChromeStorageSettingsRepository implements ISettingsRepository {
  private static readonly SETTINGS_KEY = 'tellmemore_user_settings';

  async getSettings(): Promise<UserSettings> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(ChromeStorageSettingsRepository.SETTINGS_KEY);
      return result[ChromeStorageSettingsRepository.SETTINGS_KEY] ?? DEFAULT_USER_SETTINGS;
    }
    // Fallback for development/testing
    const local = localStorage.getItem(ChromeStorageSettingsRepository.SETTINGS_KEY);
    return local ? JSON.parse(local) : DEFAULT_USER_SETTINGS;
  }

  async saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getSettings();
    const updated: UserSettings = {
      ...current,
      ...settings,
      activeLLM: { ...current.activeLLM, ...(settings.activeLLM ?? {}) },
      activeSTT: { ...current.activeSTT, ...(settings.activeSTT ?? {}) },
      persona: { ...current.persona, ...(settings.persona ?? {}) },
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [ChromeStorageSettingsRepository.SETTINGS_KEY]: updated });
    } else {
      localStorage.setItem(ChromeStorageSettingsRepository.SETTINGS_KEY, JSON.stringify(updated));
    }
    return updated;
  }
}
