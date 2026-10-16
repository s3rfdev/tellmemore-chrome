/**
 * @file src/services/stt/stt-factory.ts
 * @description Factory to produce the active speech-to-text service.
 */

import { ISTTProvider } from '../../core/interfaces/stt-provider';
import { STTConfig } from '../../core/entities/settings';
import { GroqWhisperService } from './groq-whisper-service';

export class STTFactory {
  static create(config: STTConfig): ISTTProvider {
    return new GroqWhisperService(config);
  }
}
