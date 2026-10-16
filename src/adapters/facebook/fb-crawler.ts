/**
 * @file src/adapters/facebook/fb-crawler.ts
 * @description Extracts messages from Facebook Messenger DOM and handles smooth incremental scrolling.
 */

import { ChatMessage, MediaAttachment } from '../../core/entities/message';
import { CrawlProgressCallback } from '../../core/interfaces/messenger-adapter';
import { FB_SELECTORS } from './fb-selectors';

export class FacebookCrawler {
  /**
   * Finds the active scrollable container holding the chat messages.
   */
  static findScrollContainer(): HTMLElement | null {
    for (const selector of FB_SELECTORS.FULL_PAGE_MESSAGES_CONTAINER) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        // Often the parent or the element itself is the scroll container
        let current: HTMLElement | null = el;
        while (current && current !== document.body) {
          const style = window.getComputedStyle(current);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return current;
          }
          current = current.parentElement;
        }
        return el;
      }
    }

    // Try dock chat container
    for (const selector of FB_SELECTORS.DOCK_CHAT_CONTAINERS) {
      const dock = document.querySelector<HTMLElement>(selector);
      if (dock) {
        const scrollable = dock.querySelector<HTMLElement>('[role="grid"], [data-scope="messages_table"]');
        if (scrollable) return scrollable;
      }
    }

    return null;
  }

  /**
   * Parses visible messages in the DOM.
   */
  static parseVisibleMessages(threadId: string): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const rows = document.querySelectorAll(FB_SELECTORS.MESSAGE_ROWS.join(', '));

    let index = 0;
    rows.forEach((row) => {
      // Find text
      let text = '';
      const textNodes = row.querySelectorAll(FB_SELECTORS.MESSAGE_TEXT_NODES.join(', '));
      textNodes.forEach((node) => {
        const content = node.textContent?.trim();
        if (content && !text.includes(content)) {
          text = text ? `${text}\n${content}` : content;
        }
      });

      // Find attachments (images, voice)
      const attachments: MediaAttachment[] = [];
      const images = row.querySelectorAll('img');
      images.forEach((img) => {
        const src = img.src;
        // Exclude emojis and small icons (avatars)
        if (src && !src.includes('emoji') && img.width > 50 && img.height > 50) {
          attachments.push({
            id: `img_${attachments.length}`,
            type: 'image',
            url: src,
          });
        }
      });

      const audio = row.querySelector('audio');
      if (audio?.src) {
        attachments.push({
          id: `audio_${attachments.length}`,
          type: 'voice',
          url: audio.src,
        });
      }

      // If neither text nor attachments, skip this row
      if (!text && attachments.length === 0) {
        return;
      }

      // Determine outgoing vs incoming:
      // In Facebook, outgoing messages are aligned to the right (flex-end / dir="ltr" with specific style)
      // or lack an avatar on the left
      const rowStyle = window.getComputedStyle(row);
      const isOutgoing =
        rowStyle.justifyContent === 'flex-end' ||
        row.innerHTML.includes('align-items: flex-end') ||
        Boolean(row.querySelector('[data-testid="outgoing_message"]'));

      const senderName = isOutgoing ? 'Я' : 'Собеседник';
      const id = row.getAttribute('id') || `fb_msg_${threadId}_${index}_${text.slice(0, 15).replace(/\s+/g, '_')}`;

      messages.push({
        id,
        threadId,
        senderName,
        isOutgoing,
        text,
        timestamp: Date.now() - (rows.length - index) * 60000, // Approximate chronological order
        attachments,
      });

      index++;
    });

    return messages;
  }

  /**
   * Crawls up to `depth` messages, scrolling up if necessary and restoring original scroll position.
   */
  static async crawl(
    threadId: string,
    depth: number,
    onProgress?: CrawlProgressCallback
  ): Promise<ChatMessage[]> {
    const scrollContainer = this.findScrollContainer();
    const messageMap = new Map<string, ChatMessage>();

    // Initial capture
    const initialBatch = this.parseVisibleMessages(threadId);
    initialBatch.forEach((m) => messageMap.set(m.id, m));

    onProgress?.(messageMap.size, depth, `Найдено ${messageMap.size} сообщений...`);

    if (!scrollContainer || messageMap.size >= depth) {
      return Array.from(messageMap.values()).slice(-depth);
    }

    // Save initial scroll state to restore later
    const initialScrollTop = scrollContainer.scrollTop;
    const initialScrollHeight = scrollContainer.scrollHeight;

    let previousHeight = initialScrollHeight;
    let attemptsWithoutNewMessages = 0;
    const maxAttempts = 15;

    for (let attempt = 0; attempt < maxAttempts && messageMap.size < depth; attempt++) {
      onProgress?.(
        messageMap.size,
        depth,
        `Загрузка более ранних сообщений (${messageMap.size} / ${depth})...`
      );

      // Scroll smoothly to the top of container to trigger loading of previous messages
      scrollContainer.scrollTop = 0;

      // Wait for Facebook to fetch and render
      await new Promise((resolve) => setTimeout(resolve, 350));

      const batch = this.parseVisibleMessages(threadId);
      const prevSize = messageMap.size;
      batch.forEach((m) => messageMap.set(m.id, m));

      const newScrollHeight = scrollContainer.scrollHeight;
      if (messageMap.size === prevSize && newScrollHeight === previousHeight) {
        attemptsWithoutNewMessages++;
        if (attemptsWithoutNewMessages >= 3) {
          // Reached the very top of history
          break;
        }
      } else {
        attemptsWithoutNewMessages = 0;
      }
      previousHeight = newScrollHeight;
    }

    // Restore scroll position so user sees what they were looking at
    scrollContainer.scrollTop = initialScrollTop + (scrollContainer.scrollHeight - initialScrollHeight);

    onProgress?.(messageMap.size, depth, `Сбор завершён: ${messageMap.size} сообщений`);

    return Array.from(messageMap.values()).slice(-depth);
  }
}
