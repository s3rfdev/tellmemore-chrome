/**
 * @file src/ui/injected/injected-overlay.tsx
 * @description Coordinates the injected AI button, quick menu, voice recording, and progress banner.
 */

import React, { useState, useRef, useEffect } from 'react';
import { AIButton } from './ai-button';
import { QuickMenu } from './quick-menu';
import { StatusBanner } from './status-banner';
import { AudioRecorderService } from '../../services/audio/audio-recorder';
import { IMessengerAdapter } from '../../core/interfaces/messenger-adapter';
import { RAGEngine } from '../../services/rag/rag-engine';
import {
  AnalyzeChatMsg,
  TranscribeAudioMsg,
  MessageResponse,
} from '../../infra/messaging/message-types';
import { ChatAnalysis } from '../../core/interfaces/llm-provider';
import { ChromeStorageSettingsRepository } from '../../services/storage/chat-repository';

export interface InjectedOverlayProps {
  adapter: IMessengerAdapter;
}

export const InjectedOverlay: React.FC<InjectedOverlayProps> = ({ adapter }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerProgress, setBannerProgress] = useState({ current: 0, target: 0, text: '' });

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<AudioRecorderService | null>(null);
  const timerRef = useRef<number | null>(null);

  const settingsRepo = useRef(new ChromeStorageSettingsRepository());

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const showBanner = (current: number, target: number, text: string) => {
    setBannerVisible(true);
    setBannerProgress({ current, target, text });
  };

  const hideBanner = () => {
    setBannerVisible(false);
  };

  // 1. Auto-Reply workflow
  const handleAutoReply = async () => {
    try {
      setIsLoading(true);
      showBanner(0, 50, 'Сбор сообщений чата...');

      const settings = await settingsRepo.current.getSettings();
      const messages = await adapter.crawlMessages(settings.defaultCrawlDepth || 50, (current, target, text) => {
        showBanner(current, target, text);
      });

      showBanner(messages.length, messages.length, 'RAG-индексация и выработка стратегии...');

      const thread = adapter.getThreadInfo();
      const sandwichPrompt = RAGEngine.buildSandwichPrompt({
        persona: settings.persona,
        contact: thread?.contact,
        allMessages: messages,
        activeMessagesCount: 20,
      });

      const response: MessageResponse<ChatAnalysis> = await chrome.runtime.sendMessage<AnalyzeChatMsg>({
        type: 'ANALYZE_CHAT',
        payload: {
          messages,
          persona: settings.persona,
          customQuery: sandwichPrompt,
        },
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to analyze chat');
      }

      const bestReply = response.data.suggestedReplies?.[0]?.text;
      if (bestReply) {
        showBanner(messages.length, messages.length, 'Вставка лучшего ответа...');
        await adapter.insertMessageText(bestReply);
      }

      setTimeout(hideBanner, 2000);
    } catch (err) {
      console.error('[TellMeMore] Error in auto reply:', err);
      showBanner(100, 100, `Ошибка: ${(err as Error).message}`);
      setTimeout(hideBanner, 4000);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Voice Dictation workflow
  const handleVoiceDictate = async () => {
    if (isRecording) {
      // STOP recording
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);

      try {
        setIsLoading(true);
        showBanner(50, 100, 'Транскрибация голоса через Whisper...');

        const result = await recorderRef.current?.stopRecording();
        if (!result) throw new Error('No audio recorded');

        const transcribeResponse: MessageResponse<string> = await chrome.runtime.sendMessage<TranscribeAudioMsg>({
          type: 'TRANSCRIBE_AUDIO',
          payload: {
            audioBase64: result.base64,
            mimeType: result.mimeType,
          },
        });

        if (!transcribeResponse.success || !transcribeResponse.data) {
          throw new Error(transcribeResponse.error || 'Transcription failed');
        }

        const dictatedText = transcribeResponse.data;
        showBanner(75, 100, `Голос: "${dictatedText.slice(0, 30)}..." | Формирование ответа...`);

        // Fetch recent context
        const settings = await settingsRepo.current.getSettings();
        const messages = await adapter.crawlMessages(15);

        // Ask LLM to format the response based on dictated thoughts
        const response: MessageResponse<ChatAnalysis> = await chrome.runtime.sendMessage<AnalyzeChatMsg>({
          type: 'ANALYZE_CHAT',
          payload: {
            messages,
            persona: settings.persona,
            customQuery: `Пользователь надиктовал мысль: "${dictatedText}". Сформулируй идеальный ответ собеседнику, передающий этот смысл в заданном тоне.`,
          },
        });

        const reply = response.data?.suggestedReplies?.[0]?.text || dictatedText;
        await adapter.insertMessageText(reply);

        showBanner(100, 100, 'Ответ вставлен в поле ввода ✓');
        setTimeout(hideBanner, 2000);
      } catch (err) {
        console.error('[TellMeMore] Error in voice dictate:', err);
        showBanner(100, 100, `Ошибка: ${(err as Error).message}`);
        setTimeout(hideBanner, 4000);
      } finally {
        setIsLoading(false);
      }
    } else {
      // START recording
      try {
        if (!recorderRef.current) {
          recorderRef.current = new AudioRecorderService();
        }
        await recorderRef.current.startRecording();
        setIsRecording(true);
        setRecordingSeconds(0);

        timerRef.current = window.setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('[TellMeMore] Microphone permission denied or error:', err);
        showBanner(100, 100, 'Ошибка доступа к микрофону. Разрешите доступ в браузере.');
        setTimeout(hideBanner, 4000);
      }
    }
  };

  // 3. Open Copilot Side Panel
  const handleOpenCopilot = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
  };

  return (
    <>
      <StatusBanner
        visible={bannerVisible}
        current={bannerProgress.current}
        target={bannerProgress.target}
        statusText={bannerProgress.text}
        onClose={hideBanner}
      />

      <div style={{ position: 'relative', display: 'inline-block' }}>
        <AIButton onClick={() => setIsMenuOpen((prev) => !prev)} isLoading={isLoading} />
        <QuickMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          onAutoReply={handleAutoReply}
          onVoiceDictate={handleVoiceDictate}
          onOpenCopilot={handleOpenCopilot}
          isRecording={isRecording}
          recordingSeconds={recordingSeconds}
        />
      </div>
    </>
  );
};
