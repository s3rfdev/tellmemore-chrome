/**
 * @file src/services/storage/idb-schema.ts
 * @description IndexedDB schema and connection management using 'idb'.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ChatMessage } from '../../core/entities/message';
import { ChatThread, ContactProfile } from '../../core/entities/thread';

export interface TellMeMoreDB extends DBSchema {
  messages: {
    key: string;
    value: ChatMessage;
    indexes: {
      'by-thread': string;
      'by-timestamp': number;
    };
  };
  threads: {
    key: string;
    value: ChatThread;
  };
  contacts: {
    key: string;
    value: ContactProfile;
  };
  media_cache: {
    key: string;
    value: {
      hash: string;
      transcription?: string;
      summary?: string;
      updatedAt: number;
    };
  };
}

const DB_NAME = 'tellmemore_db';
const DB_VERSION = 1;

let dbInstance: Promise<IDBPDatabase<TellMeMoreDB>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<TellMeMoreDB>> {
  if (!dbInstance) {
    dbInstance = openDB<TellMeMoreDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-thread', 'threadId');
          msgStore.createIndex('by-timestamp', 'timestamp');
        }

        // Threads store
        if (!db.objectStoreNames.contains('threads')) {
          db.createObjectStore('threads', { keyPath: 'id' });
        }

        // Contacts store
        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'id' });
        }

        // Media cache store
        if (!db.objectStoreNames.contains('media_cache')) {
          db.createObjectStore('media_cache', { keyPath: 'hash' });
        }
      },
    });
  }
  return dbInstance;
}
