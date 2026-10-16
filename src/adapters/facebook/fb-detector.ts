/**
 * @file src/adapters/facebook/fb-detector.ts
 * @description Detects active Facebook chat context (full page or bottom-right dock) and thread info.
 */

import { ChatThread } from '../../core/entities/thread';
import { FB_SELECTORS } from './fb-selectors';

export class FacebookDetector {
  static isFacebookUrl(url: string): boolean {
    return url.includes('facebook.com') || url.includes('messenger.com');
  }

  static getActiveThread(): ChatThread | null {
    // 1. Try URL-based ID (e.g. /messages/t/1000123456789 or /messages/e2ee/t/...)
    const urlMatch = window.location.pathname.match(/\/messages(?:\/e2ee)?\/t\/([a-zA-Z0-9._-]+)/);
    let threadId = urlMatch ? urlMatch[1] : '';

    // 2. Find contact/title name
    let contactName = 'Собеседник';
    for (const selector of FB_SELECTORS.THREAD_HEADERS) {
      const headerEl = document.querySelector(selector);
      if (headerEl && headerEl.textContent?.trim()) {
        contactName = headerEl.textContent.trim();
        break;
      }
    }

    // 3. Fallback for dock chat if not in URL
    if (!threadId) {
      const dockChat = document.querySelector('div[role="region"][aria-label*="Chat"], div[role="region"][aria-label*="Чат"]');
      if (dockChat) {
        const ariaLabel = dockChat.getAttribute('aria-label') || '';
        contactName = ariaLabel.replace(/Chat with|Чат с|Chat/gi, '').trim() || contactName;
        threadId = `dock_${encodeURIComponent(contactName)}`;
      }
    }

    if (!threadId) {
      // General fallback if inside messenger
      if (this.isFacebookUrl(window.location.href)) {
        threadId = `fb_general_${encodeURIComponent(contactName)}`;
      } else {
        return null;
      }
    }

    return {
      id: threadId,
      platform: 'facebook',
      title: contactName,
      contact: {
        id: threadId,
        name: contactName,
      },
      lastActiveTimestamp: Date.now(),
    };
  }
}
