/**
 * @file src/content/index.ts
 * @description Main content script entry point. Runs on messenger pages, detects adapter, mounts UI,
 * monitors real-time thread changes and incoming/outgoing chat messages.
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

  let currentThreadId: string | null = null;
  let currentThreadTitle: string | null = null;
  let unobserveMessages: (() => void) | null = null;

  // Continuously ensure the AI button is mounted near the chat input (Facebook is dynamic SPA)
  const checkAndMount = () => {
    const inputContainer = adapter.findInputContainer();
    if (inputContainer) {
      ShadowRootManager.mount(adapter, inputContainer);
    }
  };

  // Rebinds the live message observer whenever the active thread changes
  const bindMessageObserver = () => {
    if (unobserveMessages) {
      unobserveMessages();
      unobserveMessages = null;
    }

    unobserveMessages = adapter.observeNewMessages(async (newMessage) => {
      const thread = adapter.getThreadInfo();
      if (thread) {
        await chatRepo.upsertMessages(thread.id, [newMessage]);
        chrome.runtime.sendMessage({
          type: 'NEW_CHAT_MESSAGE_DETECTED',
          payload: newMessage,
        }).catch(() => {
          // Ignore if side panel is not open
        });
      }
    });
  };

  // Detects if the user navigated to a different conversation in the SPA
  const checkThreadChange = () => {
    const thread = adapter.getThreadInfo();
    if (!thread) return;

    if (thread.id !== currentThreadId || thread.title !== currentThreadTitle) {
      currentThreadId = thread.id;
      currentThreadTitle = thread.title;

      console.log(`[TellMeMore] Detected active conversation: ${thread.title} (${thread.id})`);
      bindMessageObserver();

      chrome.runtime.sendMessage({
        type: 'ACTIVE_THREAD_CHANGED',
        payload: thread,
      }).catch(() => {
        // Ignore if side panel is not open
      });
    }
  };

  // Initial mount and thread check
  checkAndMount();
  checkThreadChange();

  // Periodic check for DOM updates and SPA navigation
  setInterval(() => {
    checkAndMount();
    checkThreadChange();
  }, 1000);

  // Hook into browser history navigation (popstate & pushState/replaceState)
  window.addEventListener('popstate', () => {
    setTimeout(checkThreadChange, 250);
  });

  const origPushState = history.pushState;
  history.pushState = function (...args) {
    origPushState.apply(this, args);
    setTimeout(checkThreadChange, 250);
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args);
    setTimeout(checkThreadChange, 250);
  };

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
