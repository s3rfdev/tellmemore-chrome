/**
 * @file src/content/index.ts
 * @description Main content script entry point. Runs on messenger pages, detects adapter, mounts UI.
 */

import { AdapterRegistry } from '../adapters/adapter-registry';
import { ShadowRootManager } from './shadow-root-manager';
import { IndexedDBChatRepository } from '../services/storage/chat-repository';
import { ExtensionMessage, MessageResponse } from '../infra/messaging/message-types';

const chatRepo = new IndexedDBChatRepository();

function initialize() {
  const adapter = AdapterRegistry.getAdapterForUrl(window.location.href);
  if (!adapter) {
    return;
  }

  console.log(`[TellMeMore] Initialized adapter for: ${adapter.name}`);

  // Continuously ensure the AI button is mounted near the chat input (Facebook is dynamic SPA)
  const checkAndMount = () => {
    const inputContainer = adapter.findInputContainer();
    if (inputContainer) {
      ShadowRootManager.mount(adapter, inputContainer);
    }
  };

  // Run initial check and set interval for SPA navigation
  checkAndMount();
  setInterval(checkAndMount, 1500);

  // Real-time message listener: auto-save incoming/outgoing messages to IndexedDB
  adapter.observeNewMessages(async (newMessage) => {
    const thread = adapter.getThreadInfo();
    if (thread) {
      await chatRepo.upsertMessages(thread.id, [newMessage]);
    }
  });

  // Message listener for requests coming from Side Panel or Background
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    (async () => {
      try {
        switch (message.type) {
          case 'GET_CURRENT_THREAD': {
            const thread = adapter.getThreadInfo();
            sendResponse({ success: true, data: thread } as MessageResponse);
            break;
          }

          case 'REQUEST_CRAWL_MESSAGES': {
            const depth = message.payload.depth || 50;
            const messages = await adapter.crawlMessages(depth);
            const thread = adapter.getThreadInfo();
            if (thread) {
              await chatRepo.upsertMessages(thread.id, messages);
            }
            sendResponse({ success: true, data: messages } as MessageResponse);
            break;
          }

          case 'INSERT_DRAFT_TO_CHAT': {
            const success = await adapter.insertMessageText(message.payload.text);
            sendResponse({ success, data: success } as MessageResponse);
            break;
          }

          default:
            sendResponse({ success: false, error: 'Unknown message type in content script' });
            break;
        }
      } catch (err) {
        console.error('[TellMeMore Content] Error handling message:', err);
        sendResponse({ success: false, error: (err as Error).message } as MessageResponse);
      }
    })();

    return true; // Keep channel open for async response
  });
}

// Start when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
