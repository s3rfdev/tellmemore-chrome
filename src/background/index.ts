/**
 * @file src/background/index.ts
 * @description Entry point for Background Service Worker (Manifest V3).
 */

import { handleBackgroundMessage } from './message-router';
import { ExtensionMessage } from '../infra/messaging/message-types';

console.log('[TellMeMore] Background Service Worker initialized.');

// Configure side panel behavior on installation
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('[TellMeMore] setPanelBehavior error:', err);
    });
  }
});

// Main message listener
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleBackgroundMessage(message, sender).then(sendResponse);
  return true; // Keep message channel open for async response
});
