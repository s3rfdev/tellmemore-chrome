/**
 * @file src/services/media/media-enricher.ts
 * @description Enriches chat messages with cached image summaries and voice transcriptions.
 * Ensures images and audio are analyzed strictly ONCE and stored permanently in IndexedDB.
 */

import { ChatMessage } from '../../core/entities/message';
import { IChatRepository } from '../../core/interfaces/chat-repository';
import { ImageProcessor } from './image-processor';

export class MediaEnricherService {
  private imageProcessor: ImageProcessor;

  constructor(private chatRepo: IChatRepository) {
    this.imageProcessor = new ImageProcessor(chatRepo);
  }

  /**
   * Hashes an audio URL to use as a persistent cache key.
   */
  private hashAudioUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `audio_hash_${Math.abs(hash)}`;
  }

  /**
   * Enriches messages before sending them to the LLM or RAG pipeline:
   * - Images: converted to [Фото: "Описание содержимого"] (compressed & cached)
   * - Voice: converted to [Голосовое: "Транскрибированный текст"] (transcribed & cached)
   * - Video/Files: converted to metadata tags (NEVER sent as binary blobs)
   */
  async enrichMessages(
    messages: ChatMessage[],
    visionDescribeCallback?: (base64: string, mime: string) => Promise<string>,
    audioTranscribeCallback?: (audioUrl: string) => Promise<string>
  ): Promise<ChatMessage[]> {
    const enrichedList: ChatMessage[] = [];

    for (const msg of messages) {
      let enrichedText = msg.text || '';

      if (msg.attachments && msg.attachments.length > 0) {
        for (const attachment of msg.attachments) {
          // 1. Image handling
          if (attachment.type === 'image' && attachment.url) {
            const hash = this.imageProcessor.hashImageUrl(attachment.url);
            let summary = await this.chatRepo.getCachedImageSummary(hash);

            if (!summary && visionDescribeCallback) {
              try {
                summary = await this.imageProcessor.getOrSummarizeImage(
                  attachment.url,
                  visionDescribeCallback
                );
              } catch (e) {
                console.warn('[TellMeMore] Failed to summarize image:', e);
                summary = '[Изображение в чате]';
              }
            }

            if (summary) {
              enrichedText += `\n[Фото: "${summary}"]`;
            }
          }

          // 2. Voice / Audio handling
          else if ((attachment.type === 'voice' || attachment.type === 'audio') && attachment.url) {
            const hash = this.hashAudioUrl(attachment.url);
            let transcription = await this.chatRepo.getCachedTranscription(hash);

            if (!transcription && audioTranscribeCallback) {
              try {
                transcription = await audioTranscribeCallback(attachment.url);
                if (transcription) {
                  await this.chatRepo.setCachedTranscription(hash, transcription);
                }
              } catch (e) {
                console.warn('[TellMeMore] Failed to transcribe voice:', e);
                transcription = '[Голосовое сообщение]';
              }
            }

            if (transcription) {
              enrichedText += `\n[Голосовое сообщение: "${transcription}"]`;
            }
          }

          // 3. Video / Large binary files (Strict Safety Rule: NEVER send raw video to LLM)
          else if (attachment.type === 'video') {
            enrichedText += `\n[Видеосообщение от ${msg.isOutgoing ? 'меня' : msg.senderName}]`;
          } else if (attachment.type === 'file') {
            enrichedText += `\n[Прикреплённый файл/документ]`;
          }
        }
      }

      enrichedList.push({
        ...msg,
        text: enrichedText.trim(),
      });
    }

    return enrichedList;
  }
}
