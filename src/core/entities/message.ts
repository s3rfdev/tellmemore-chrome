/**
 * @file src/core/entities/message.ts
 * @description Core entity representing chat messages and media attachments.
 */

export type MediaType = 'image' | 'audio' | 'voice' | 'video' | 'file';

export interface MediaAttachment {
  id: string;
  type: MediaType;
  url?: string;
  /** Hash for caching (sha256 or signature) */
  hash?: string;
  /** Transcribed text for audio/voice messages */
  transcription?: string;
  /** Compact AI-generated summary for images */
  summary?: string;
  mimeType?: string;
}

export interface ChatMessage {
  /** Unique ID of message inside messenger (e.g. mid.$... in FB) */
  id: string;
  /** Chat / thread identifier */
  threadId: string;
  /** Display name of the sender */
  senderName: string;
  /** Whether the message was sent by the current user */
  isOutgoing: boolean;
  /** Text content of the message */
  text: string;
  /** Timestamp in ISO format or unix timestamp */
  timestamp?: number;
  /** Media attachments (images, voice notes, audio) */
  attachments?: MediaAttachment[];
}
