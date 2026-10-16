/**
 * @file src/adapters/telegram/tg-crawler.ts
 * @description Extracts messages from Telegram Web DOM (Web A/Z and Web K) and handles smooth incremental scrolling.
 */

import { ChatMessage, MediaAttachment } from '../../core/entities/message';
import { CrawlProgressCallback } from '../../core/interfaces/messenger-adapter';
import { TG_SELECTORS } from './tg-selectors';

export class TelegramCrawler {
  /**
   * Finds the scrollable container holding the chat messages in Telegram Web.
   */
  static findScrollContainer(): HTMLElement | null {
    for (const selector of TG_SELECTORS.MESSAGES_CONTAINERS) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
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
    return null;
  }

  /**
   * Parses visible messages in the active Telegram Web DOM.
   */
  static parseVisibleMessages(threadId: string): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const rows = document.querySelectorAll(TG_SELECTORS.MESSAGE_ROWS.join(', '));

    let index = 0;
    rows.forEach((row) => {
      // Find text content
      let text = '';
      const textNodes = row.querySelectorAll(TG_SELECTORS.MESSAGE_TEXT_NODES.join(', '));
      textNodes.forEach((node) => {
        const content = node.textContent?.trim();
        if (content && !text.includes(content)) {
          text = text ? `${text}\n${content}` : content;
        }
      });

      // Find attachments (photos, voice)
      const attachments: MediaAttachment[] = [];
      const images = row.querySelectorAll('img');
      images.forEach((img) => {
        const src = img.src;
        // Ignore emojis and tiny avatar icons
        if (src && !src.includes('emoji') && img.width > 60 && img.height > 60) {
          attachments.push({
            id: `tg_img_${attachments.length}`,
            type: 'image',
            url: src,
          });
        }
      });

      const audio = row.querySelector('audio');
      if (audio?.src) {
        attachments.push({
          id: `tg_voice_${attachments.length}`,
          type: 'voice',
          url: audio.src,
        });
      }

      // If no text and no attachments, skip this element
      if (!text && attachments.length === 0) {
        return;
      }

      // Outgoing check for Telegram Web:
      // Web A: has class 'own' or 'is-own'
      // Web K: has class 'is-out'
      const isOutgoing =
        row.classList.contains('own') ||
        row.classList.contains('is-own') ||
        row.classList.contains('is-out') ||
        row.hasAttribute('data-is-outgoing') ||
        Boolean(row.querySelector('.message-status.is-read, .message-status.is-sent, .status-icon'));

      const senderName = isOutgoing ? 'Я' : 'Собеседник';
      const rowId =
        row.getAttribute('data-message-id') ||
        row.getAttribute('data-mid') ||
        row.getAttribute('id') ||
        `tg_msg_${threadId}_${index}_${text.slice(0, 15).replace(/\s+/g, '_')}`;

      messages.push({
        id: rowId,
        threadId,
        senderName,
        isOutgoing,
        text,
        timestamp: Date.now() - (rows.length - index) * 60000,
        attachments,
      });

      index++;
    });

    return messages;
  }

  /**
   * Crawls up to `depth` messages, scrolling up if necessary and restoring original scroll position.
   * Bound by strict time cap to prevent any UI freezing.
   */
  static async crawl(
    threadId: string,
    depth: number,
    onProgress?: CrawlProgressCallback
  ): Promise<ChatMessage[]> {
    const startTime = Date.now();
    const MAX_CRAWL_DURATION_MS = 3500;
    console.log(`[TellMeMore:TGCrawler] 🚀 Starting Telegram crawl. Thread: "${threadId}", depth: ${depth}`);

    const scrollContainer = this.findScrollContainer();
    const messageMap = new Map<string, ChatMessage>();

    // Initial capture
    const initialBatch = this.parseVisibleMessages(threadId);
    initialBatch.forEach((m) => messageMap.set(m.id, m));
    console.log(`[TellMeMore:TGCrawler] 📦 Initial visible batch: ${initialBatch.length} messages`);

    onProgress?.(messageMap.size, depth, `Найдено ${messageMap.size} сообщений...`);

    if (!scrollContainer || messageMap.size >= depth) {
      const res = Array.from(messageMap.values()).slice(-depth);
      console.log(`[TellMeMore:TGCrawler] ✅ Crawl finished immediately (${res.length} msgs)`);
      return res;
    }

    const initialScrollTop = scrollContainer.scrollTop;
    const initialScrollHeight = scrollContainer.scrollHeight;

    let previousHeight = initialScrollHeight;
    let attemptsWithoutNewMessages = 0;
    const maxAttempts = 10;

    try {
      for (let attempt = 0; attempt < maxAttempts && messageMap.size < depth; attempt++) {
        if (Date.now() - startTime > MAX_CRAWL_DURATION_MS) {
          console.log(`[TellMeMore:TGCrawler] ⏱️ Reached time cap (${MAX_CRAWL_DURATION_MS}ms). Ending scroll.`);
          break;
        }

        onProgress?.(
          messageMap.size,
          depth,
          `Загрузка более ранних сообщений (${messageMap.size} / ${depth})...`
        );

        // Scroll to top of Telegram message list
        scrollContainer.scrollTop = 0;
        await new Promise((resolve) => setTimeout(resolve, 300));

        const batch = this.parseVisibleMessages(threadId);
        const prevSize = messageMap.size;
        batch.forEach((m) => messageMap.set(m.id, m));

        const newScrollHeight = scrollContainer.scrollHeight;
        if (messageMap.size === prevSize && newScrollHeight === previousHeight) {
          attemptsWithoutNewMessages++;
          if (attemptsWithoutNewMessages >= 2) {
            console.log(`[TellMeMore:TGCrawler] 🏁 Reached top of Telegram history.`);
            break;
          }
        } else {
          attemptsWithoutNewMessages = 0;
        }
        previousHeight = newScrollHeight;
      }
    } catch (crawlErr) {
      console.warn('[TellMeMore:TGCrawler] ⚠️ Scroll warning:', crawlErr);
    } finally {
      try {
        scrollContainer.scrollTop = initialScrollTop + (scrollContainer.scrollHeight - initialScrollHeight);
      } catch {
        // Ignore
      }
    }

    const finalMessages = Array.from(messageMap.values()).slice(-depth);
    console.log(
      `[TellMeMore:TGCrawler] ✅ Crawl complete in ${Date.now() - startTime}ms. Extracted ${finalMessages.length} messages.`
    );
    onProgress?.(finalMessages.length, depth, `Сбор завершён: ${finalMessages.length} сообщений`);

    return finalMessages;
  }
}
