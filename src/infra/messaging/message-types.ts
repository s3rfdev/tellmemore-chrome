/**
 * @file src/infra/messaging/message-types.ts
 * @description Strongly-typed message protocol for Chrome extension communication.
 */

import { ChatMessage } from '../../core/entities/message';
import { UserSettings, PersonaGoals } from '../../core/entities/settings';

export type ExtensionMessageType =
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'ANALYZE_CHAT'
  | 'TRANSCRIBE_AUDIO'
  | 'GET_CURRENT_THREAD'
  | 'REQUEST_CRAWL_MESSAGES'
  | 'CRAWL_PROGRESS_NOTIFICATION'
  | 'INSERT_DRAFT_TO_CHAT'
  | 'OPEN_SIDEPANEL'
  | 'FETCH_AVAILABLE_MODELS'
  | 'GET_CONTACT_PROFILE'
  | 'SAVE_CONTACT_PROFILE'
  | 'NEW_CHAT_MESSAGE_DETECTED';

export interface BaseMessage<T extends ExtensionMessageType, P> {
  type: T;
  payload: P;
}

export type GetSettingsMsg = BaseMessage<'GET_SETTINGS', void>;
export type SaveSettingsMsg = BaseMessage<'SAVE_SETTINGS', Partial<UserSettings>>;

export interface AnalyzeChatPayload {
  messages: ChatMessage[];
  persona: PersonaGoals;
  customQuery?: string;
}
export type AnalyzeChatMsg = BaseMessage<'ANALYZE_CHAT', AnalyzeChatPayload>;

export interface TranscribeAudioPayload {
  audioBase64: string;
  mimeType: string;
  language?: string;
}
export type TranscribeAudioMsg = BaseMessage<'TRANSCRIBE_AUDIO', TranscribeAudioPayload>;

export type GetCurrentThreadMsg = BaseMessage<'GET_CURRENT_THREAD', void>;

export interface RequestCrawlMessagesPayload {
  depth: number;
}
export type RequestCrawlMessagesMsg = BaseMessage<'REQUEST_CRAWL_MESSAGES', RequestCrawlMessagesPayload>;

export interface CrawlProgressPayload {
  current: number;
  target: number;
  statusText: string;
}
export type CrawlProgressMsg = BaseMessage<'CRAWL_PROGRESS_NOTIFICATION', CrawlProgressPayload>;

export interface InsertDraftPayload {
  text: string;
}
export type InsertDraftMsg = BaseMessage<'INSERT_DRAFT_TO_CHAT', InsertDraftPayload>;

export type OpenSidePanelMsg = BaseMessage<'OPEN_SIDEPANEL', void>;

export interface FetchModelsPayload {
  provider: string;
  apiKey: string;
  endpointUrl?: string;
}
export type FetchModelsMsg = BaseMessage<'FETCH_AVAILABLE_MODELS', FetchModelsPayload>;

export interface GetContactProfilePayload {
  contactId: string;
}
export type GetContactProfileMsg = BaseMessage<'GET_CONTACT_PROFILE', GetContactProfilePayload>;

export interface SaveContactProfilePayload {
  contactId: string;
  name: string;
  notes?: string;
  goals?: string;
  customCrawlDepth?: number;
}
export type SaveContactProfileMsg = BaseMessage<'SAVE_CONTACT_PROFILE', SaveContactProfilePayload>;

export type NewChatMessageMsg = BaseMessage<'NEW_CHAT_MESSAGE_DETECTED', ChatMessage>;

export type ExtensionMessage =
  | GetSettingsMsg
  | SaveSettingsMsg
  | AnalyzeChatMsg
  | TranscribeAudioMsg
  | GetCurrentThreadMsg
  | RequestCrawlMessagesMsg
  | CrawlProgressMsg
  | InsertDraftMsg
  | OpenSidePanelMsg
  | FetchModelsMsg
  | GetContactProfileMsg
  | SaveContactProfileMsg
  | NewChatMessageMsg;

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
