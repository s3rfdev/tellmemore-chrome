/**
 * @file src/services/stt/deepgram-service.ts
 * @description Deepgram Nova-2 / Nova-3 speech-to-text service implementation.
 */

import { ISTTProvider } from '../../core/interfaces/stt-provider';
import { STTConfig } from '../../core/entities/settings';

export class DeepgramService implements ISTTProvider {
  readonly providerId = 'deepgram';

  constructor(private config: STTConfig) {}

  private getEndpointUrl(language?: string): string {
    const model = this.config.model || 'nova-2';
    const langParam = language ? `&language=${language}` : '&detect_language=true';
    return `https://api.deepgram.com/v1/listen?model=${model}&smart_format=true&punctuate=true${langParam}`;
  }

  async transcribeAudio(audioBlob: Blob, language?: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Deepgram API key is not configured. Please set it in Settings.');
    }

    const response = await fetch(this.getEndpointUrl(language), {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.config.apiKey}`,
        'Content-Type': audioBlob.type || 'audio/webm',
      },
      body: audioBlob,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepgram STT Error (${response.status}): ${errorText}`);
    }

    const json = await response.json();
    const transcript = json.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    return transcript || '';
  }
}
