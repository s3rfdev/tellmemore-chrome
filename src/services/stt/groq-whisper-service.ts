/**
 * @file src/services/stt/groq-whisper-service.ts
 * @description Ultra-fast speech-to-text service using Groq Whisper or OpenAI Whisper API.
 */

import { ISTTProvider } from '../../core/interfaces/stt-provider';
import { STTConfig } from '../../core/entities/settings';

export class GroqWhisperService implements ISTTProvider {
  readonly providerId = 'groq_whisper';

  constructor(private config: STTConfig) {}

  private getEndpointUrl(): string {
    if (this.config.endpointUrl && this.config.endpointUrl.trim() !== '') {
      return this.config.endpointUrl;
    }
    if (this.config.provider === 'openai_whisper') {
      return 'https://api.openai.com/v1/audio/transcriptions';
    }
    return 'https://api.groq.com/openai/v1/audio/transcriptions';
  }

  async transcribeAudio(audioBlob: Blob, language?: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error(`API key for STT provider (${this.config.provider}) is missing. Please configure it in Settings.`);
    }

    const formData = new FormData();
    // Groq/OpenAI expects a file with an audio extension
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', this.config.model || 'whisper-large-v3-turbo');

    if (language) {
      formData.append('language', language);
    }

    const response = await fetch(this.getEndpointUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`STT Transcription Error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return result.text || '';
  }
}
