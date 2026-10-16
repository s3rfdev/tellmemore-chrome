/**
 * @file src/adapters/telegram/tg-detector.ts
 * @description Detects active Telegram Web chat context (Web A/Z or Web K) and thread/contact info.
 */

import { ChatThread } from '../../core/entities/thread';
import { TG_SELECTORS } from './tg-selectors';

export class TelegramDetector {
  static isTelegramUrl(url: string): boolean {
    return url.includes('web.telegram.org') || url.includes('telegram.org');
  }

  static getActiveThread(): ChatThread | null {
    if (!this.isTelegramUrl(window.location.href)) {
      return null;
    }

    // 1. Try URL hash / path for peer ID (e.g. #@username, #-100123456, #1234567, or query param)
    const hash = window.location.hash || '';
    let rawPeerId = hash.replace(/^#\/?/, '').replace(/^\?p=/, '').replace(/^tgaddr=/, '');

    // 2. Find contact / interlocutor name from headers
    let contactName = 'Собеседник';
    for (const selector of TG_SELECTORS.THREAD_HEADERS) {
      const headerEl = document.querySelector(selector);
      if (headerEl && headerEl.textContent?.trim()) {
        contactName = headerEl.textContent.trim();
        break;
      }
    }

    // 3. Fallback: Check input container data attributes
    if (!rawPeerId) {
      const inputEl = document.querySelector('div[data-peer-id]');
      if (inputEl) {
        rawPeerId = inputEl.getAttribute('data-peer-id') || '';
      }
    }

    // If still no ID, synthesize one from the contact name
    const threadId = rawPeerId
      ? `tg_${rawPeerId.replace(/[^a-zA-Z0-9_@-]/g, '_')}`
      : `tg_${encodeURIComponent(contactName)}`;

    return {
      id: threadId,
      platform: 'telegram',
      title: contactName,
      contact: {
        id: threadId,
        name: contactName,
      },
      lastActiveTimestamp: Date.now(),
    };
  }
}
