/**
 * @file src/adapters/facebook/fb-selectors.ts
 * @description Centralized DOM selectors and heuristics for Facebook Messenger.
 * Designed with multiple fallback selectors to ensure resilience against Facebook frontend updates.
 */

export const FB_SELECTORS = {
  // Input fields (Lexical / Draft.js / contenteditable)
  INPUT_BOXES: [
    'div[role="textbox"][contenteditable="true"]',
    'div[data-lexical-editor="true"]',
    'div[aria-label*="Message"][role="textbox"]',
    'div[aria-label*="Сообщение"][role="textbox"]',
    'div[aria-label*="Scrivi un messaggio"][role="textbox"]',
    'div.notranslate._5rpu[contenteditable="true"]',
  ],

  // Actions bar / bottom bar where our button should be mounted
  ACTION_BARS: [
    'div[role="region"][aria-label*="Chat"] form',
    'div[role="main"] form',
    'div[aria-label*="Message actions"]',
    'span[data-lexical-text="true"]',
  ],

  // Chat window / thread containers
  FULL_PAGE_MESSAGES_CONTAINER: [
    'div[role="main"] div[role="grid"]',
    'div[role="main"] [data-scope="messages_table"]',
    'div[aria-label="Messages"][role="grid"]',
    'div[aria-label="Сообщения"][role="grid"]',
  ],

  // Floating dock chat (bottom right of facebook.com)
  DOCK_CHAT_CONTAINERS: [
    'div[role="region"][aria-label*="Chat"]',
    'div[role="region"][aria-label*="Чат"]',
    'div[data-testid="chat_dock_window"]',
  ],

  // Individual message rows
  MESSAGE_ROWS: [
    'div[role="row"]',
    'div[data-scope="messages_table"] > div',
    'div[data-testid="message-container"]',
  ],

  // Message text content
  MESSAGE_TEXT_NODES: [
    'div[dir="auto"]',
    'span[dir="auto"]',
  ],

  // Header / Title for thread name
  THREAD_HEADERS: [
    'div[role="main"] h1',
    'div[role="main"] h2',
    'div[role="region"][aria-label*="Chat"] h2',
    'div[role="region"][aria-label*="Чат"] h2',
    'span[dir="auto"] > strong',
  ],
};
