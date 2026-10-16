/**
 * @file src/background/message-router.ts
 * @description Routes messages in Background Service Worker to appropriate services (LLM, STT, Settings).
 */

import { ExtensionMessage, MessageResponse } from '../infra/messaging/message-types';
import { ChromeStorageSettingsRepository } from '../services/storage/chat-repository';
import { LLMFactory } from '../services/llm/llm-factory';
import { STTFactory } from '../services/stt/stt-factory';

const settingsRepo = new ChromeStorageSettingsRepository();

export async function handleBackgroundMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  try {
    switch (message.type) {
      case 'GET_SETTINGS': {
        const settings = await settingsRepo.getSettings();
        return { success: true, data: settings };
      }

      case 'SAVE_SETTINGS': {
        const updated = await settingsRepo.saveSettings(message.payload);
        return { success: true, data: updated };
      }

      case 'ANALYZE_CHAT': {
        const settings = await settingsRepo.getSettings();
        const llm = LLMFactory.create(settings.activeLLM);
        const analysis = await llm.analyzeChat(
          message.payload.messages,
          message.payload.persona,
          message.payload.customQuery
        );
        return { success: true, data: analysis };
      }

      case 'TRANSCRIBE_AUDIO': {
        const settings = await settingsRepo.getSettings();
        const stt = STTFactory.create(settings.activeSTT);

        // Convert base64 to Blob
        const byteCharacters = atob(message.payload.audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const audioBlob = new Blob([byteArray], { type: message.payload.mimeType || 'audio/webm' });

        const transcription = await stt.transcribeAudio(audioBlob, message.payload.language);
        return { success: true, data: transcription };
      }

      case 'OPEN_SIDEPANEL': {
        if (chrome.sidePanel && sender.tab?.id) {
          // Open the side panel on the active tab
          await chrome.sidePanel.open({ tabId: sender.tab.id });
          return { success: true };
        } else if (chrome.sidePanel && sender.tab?.windowId) {
          await chrome.sidePanel.open({ windowId: sender.tab.windowId });
          return { success: true };
        }
        return { success: false, error: 'Side panel API not supported or no active tab' };
      }

      default:
        return { success: false, error: 'Unhandled message type' };
    }
  } catch (err) {
    console.error('[TellMeMore Background] Error routing message:', err);
    return { success: false, error: (err as Error).message };
  }
}
