/**
 * @file src/core/interfaces/stt-provider.ts
 * @description Speech-to-Text provider interface (Whisper, Gladia, etc.)
 */

export interface ISTTProvider {
  readonly providerId: string;

  /**
   * Transcribes an audio Blob (wav, webm, mp3, ogg) into text.
   * @param audioBlob The recorded or intercepted audio data
   * @param language Optional target language code (e.g. 'ru', 'en')
   */
  transcribeAudio(audioBlob: Blob, language?: string): Promise<string>;
}
