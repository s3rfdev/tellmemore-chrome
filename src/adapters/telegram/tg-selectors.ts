/**
 * @file src/adapters/telegram/tg-selectors.ts
 * @description Centralized DOM selectors and heuristics for Telegram Web (both Web A/Z and Web K).
 */

export const TG_SELECTORS = {
  // Input fields (contenteditable div)
  INPUT_BOXES: [
    'div#editable-message-text[contenteditable="true"]',
    'div.input-message-input[contenteditable="true"]',
    'div.composer-text[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-peer-id]',
    'div[contenteditable="true"].form-control',
  ],

  // Actions bar / Composer footer container where our AI button should be injected
  ACTION_BARS: [
    'div.middle-column-footer',
    'div.chat-input-main',
    'div.Composer',
    'div.input-message-container',
    'div.chat-input',
    'div.composer-wrapper',
  ],

  // Chat window / scrollable message containers
  MESSAGES_CONTAINERS: [
    'div.MessageList',
    'div.messages-container',
    'div.messages-layout',
    'div.bubbles-inner',
    'div.bubbles-date-group',
    'div.chat-list',
  ],

  // Individual message rows
  MESSAGE_ROWS: [
    'div.Message',
    'div.message-list-item',
    'div.bubble',
    'div[data-message-id]',
    'div[data-mid]',
  ],

  // Message text nodes
  MESSAGE_TEXT_NODES: [
    'div.text-content',
    'div.message-content',
    'div.message',
    'span.translatable-message',
    'div.body',
  ],

  // Header / Title for active conversation name
  THREAD_HEADERS: [
    'div.chat-info .peer-title',
    'div.top .user-title',
    'div.ChatInfo .title',
    'div.chat-info-name',
    'div.chat-title',
    'span.peer-title',
    'div.sidebar-header .user-title',
    'div.chat-info h3',
    'div.MiddleHeader .title',
  ],
};
