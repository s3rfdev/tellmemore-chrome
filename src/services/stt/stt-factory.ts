/**
 * @file src/services/stt/stt-factory.ts
 * @description Factory to produce the active speech-to-text service.
 */

import { ISTTProvider } from '../../core/interfaces/stt-provider';
import { STTConfig } from '../../core/entities/settings';
import { GroqWhisperService } from './groq-whisper-service';
import { DeepgramService } from './deepgram-service';

export class STTFactory {
  static create(config: STTConfig): ISTTProvider {
    if (config.provider === 'deepgram') {
      return new DeepgramService(config);
    }
    return new GroqWhisperService(config);
  }
}
