/**
 * @file src/adapters/telegram/tg-adapter.ts
 * @description Telegram Web implementation of IMessengerAdapter supporting both Web A/Z and Web K.
 */

import { IMessengerAdapter, CrawlProgressCallback } from '../../core/interfaces/messenger-adapter';
import { ChatMessage } from '../../core/entities/message';
import { ChatThread } from '../../core/entities/thread';
import { TG_SELECTORS } from './tg-selectors';
import { TelegramDetector } from './tg-detector';
import { TelegramCrawler } from './tg-crawler';
import { TelegramInputManager } from './tg-input';

export class TelegramAdapter implements IMessengerAdapter {
  readonly id = 'telegram';
  readonly name = 'Telegram Web';

  isSupported(url: string): boolean {
    return TelegramDetector.isTelegramUrl(url);
  }

  getThreadInfo(): ChatThread | null {
    return TelegramDetector.getActiveThread();
  }

  findInputContainer(): HTMLElement | null {
    for (const selector of TG_SELECTORS.ACTION_BARS) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return el;
    }
    for (const selector of TG_SELECTORS.INPUT_BOXES) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return el.parentElement || el;
    }
    return null;
  }

  findMessagesContainer(): HTMLElement | null {
    return TelegramCrawler.findScrollContainer();
  }

  async crawlMessages(depth: number, onProgress?: CrawlProgressCallback): Promise<ChatMessage[]> {
    const thread = this.getThreadInfo();
    const threadId = thread?.id || 'tg_default_thread';
    return TelegramCrawler.crawl(threadId, depth, onProgress);
  }

  async insertMessageText(text: string): Promise<boolean> {
    for (const selector of TG_SELECTORS.INPUT_BOXES) {
      const inputEl = document.querySelector<HTMLElement>(selector);
      if (inputEl) {
        return TelegramInputManager.insertText(inputEl, text);
      }
    }
    return false;
  }

  observeNewMessages(onNewMessage: (msg: ChatMessage) => void): () => void {
    const container = this.findMessagesContainer();
    if (!container) return () => {};

    const thread = this.getThreadInfo();
    const threadId = thread?.id || 'tg_default';
    const seenIds = new Set<string>();

    try {
      const initial = TelegramCrawler.parseVisibleMessages(threadId);
      initial.forEach((m) => seenIds.add(m.id));
    } catch {
      // Ignore initial parse errors
    }

    const observer = new MutationObserver(() => {
      const currentMessages = TelegramCrawler.parseVisibleMessages(threadId);
      currentMessages.forEach((msg) => {
        if (!seenIds.has(msg.id)) {
          seenIds.add(msg.id);
          onNewMessage(msg);
        }
      });
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }
}
