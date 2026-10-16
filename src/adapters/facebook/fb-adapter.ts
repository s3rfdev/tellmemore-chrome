/**
 * @file src/adapters/facebook/fb-adapter.ts
 * @description Facebook Messenger implementation of IMessengerAdapter.
 */

import { IMessengerAdapter, CrawlProgressCallback } from '../../core/interfaces/messenger-adapter';
import { ChatMessage } from '../../core/entities/message';
import { ChatThread } from '../../core/entities/thread';
import { FB_SELECTORS } from './fb-selectors';
import { FacebookDetector } from './fb-detector';
import { FacebookCrawler } from './fb-crawler';
import { FacebookInputManager } from './fb-input';

export class FacebookAdapter implements IMessengerAdapter {
  readonly id = 'facebook';
  readonly name = 'Facebook Messenger';

  isSupported(url: string): boolean {
    return FacebookDetector.isFacebookUrl(url);
  }

  getThreadInfo(): ChatThread | null {
    return FacebookDetector.getActiveThread();
  }

  findInputContainer(): HTMLElement | null {
    for (const selector of FB_SELECTORS.INPUT_BOXES) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        // Find immediate form or action bar parent
        return el.closest('form') || el.parentElement || el;
      }
    }
    return null;
  }

  findMessagesContainer(): HTMLElement | null {
    return FacebookCrawler.findScrollContainer();
  }

  async crawlMessages(depth: number, onProgress?: CrawlProgressCallback): Promise<ChatMessage[]> {
    const thread = this.getThreadInfo();
    const threadId = thread?.id || 'fb_default_thread';
    return FacebookCrawler.crawl(threadId, depth, onProgress);
  }

  async insertMessageText(text: string): Promise<boolean> {
    for (const selector of FB_SELECTORS.INPUT_BOXES) {
      const inputEl = document.querySelector<HTMLElement>(selector);
      if (inputEl) {
        return FacebookInputManager.insertText(inputEl, text);
      }
    }
    return false;
  }

  observeNewMessages(onNewMessage: (msg: ChatMessage) => void): () => void {
    const container = this.findMessagesContainer();
    if (!container) return () => {};

    const thread = this.getThreadInfo();
    const threadId = thread?.id || 'fb_default';
    const seenIds = new Set<string>();

    // Prepopulate seenIds with existing visible messages so they aren't fired as "new"
    try {
      const initial = FacebookCrawler.parseVisibleMessages(threadId);
      initial.forEach((m) => seenIds.add(m.id));
    } catch {
      // Ignore initial parse errors
    }

    const observer = new MutationObserver(() => {
      const currentMessages = FacebookCrawler.parseVisibleMessages(threadId);
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
