/**
 * @file src/core/interfaces/messenger-adapter.ts
 * @description The universal interface for any web messenger adapter (Facebook, Telegram, WhatsApp).
 */

import { ChatMessage } from '../entities/message';
import { ChatThread } from '../entities/thread';

export type CrawlProgressCallback = (current: number, target: number, statusText: string) => void;

export interface IMessengerAdapter {
  /** Unique platform ID (e.g. 'facebook', 'telegram') */
  readonly id: string;
  /** Human readable name (e.g. 'Facebook Messenger') */
  readonly name: string;

  /** Checks if the current page URL or DOM corresponds to this messenger */
  isSupported(url: string): boolean;

  /** Extracts current thread and contact metadata from the page */
  getThreadInfo(): ChatThread | null;

  /** Locates the chat input container where our AI button should be injected */
  findInputContainer(): HTMLElement | null;

  /** Locates the active scrollable chat container that holds messages */
  findMessagesContainer(): HTMLElement | null;

  /**
   * Crawls chat messages from DOM up to the requested depth.
   * Performs smooth incremental scrolling if more messages are needed,
   * restoring scroll position when done.
   */
  crawlMessages(depth: number, onProgress?: CrawlProgressCallback): Promise<ChatMessage[]>;

  /** Safely inserts a text draft into the messenger's rich text editor (Lexical/Draft.js/contenteditable) */
  insertMessageText(text: string): Promise<boolean>;

  /** Attaches a MutationObserver to capture incoming/outgoing messages in real time */
  observeNewMessages(onNewMessage: (msg: ChatMessage) => void): () => void;
}
