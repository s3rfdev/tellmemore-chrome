/**
 * @file src/ui/sidepanel/components/copilot-app.tsx
 * @description Full-featured Copilot SidePanel interface with live context, manipulation analysis, and chat.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChatThread } from '../../../core/entities/thread';
import { ChatMessage } from '../../../core/entities/message';
import { ChatAnalysis } from '../../../core/interfaces/llm-provider';
import { ChromeStorageSettingsRepository } from '../../../services/storage/chat-repository';
import { AudioRecorderService } from '../../../services/audio/audio-recorder';
import {
  AnalyzeChatMsg,
  TranscribeAudioMsg,
  MessageResponse,
} from '../../../infra/messaging/message-types';

interface DialogueMessage {
  role: 'user' | 'assistant';
  content: string;
}

const settingsRepo = new ChromeStorageSettingsRepository();

export const CopilotApp: React.FC = () => {
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [analysis, setAnalysis] = useState<ChatAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Готов к анализу');

  // Copilot dialogue
  const [dialogue, setDialogue] = useState<DialogueMessage[]>([]);
  const [promptText, setPromptText] = useState('');
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<AudioRecorderService | null>(null);

  const dialogueEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll dialogue
  useEffect(() => {
    dialogueEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogue]);

  // Sync with active tab on mount
  useEffect(() => {
    loadActiveThread();
  }, []);

  const getActiveTabId = async (): Promise<number | null> => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id ?? null;
  };

  const loadActiveThread = async () => {
    try {
      const tabId = await getActiveTabId();
      if (!tabId) return;

      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_THREAD' });
      if (response?.success && response.data) {
        setThread(response.data);
      }
    } catch {
      // Content script may not be loaded yet or tab is not supported
    }
  };

  // 1. Fetch & analyze messages from active chat
  const handleDeepAnalysis = async (depth = 50) => {
    try {
      setIsAnalyzing(true);
      setStatusMessage(`Сбор последних ${depth} сообщений из чата...`);

      const tabId = await getActiveTabId();
      if (!tabId) {
        throw new Error('Активная вкладка не найдена');
      }

      // Request content script to crawl messages
      const crawlResp = await chrome.tabs.sendMessage(tabId, {
        type: 'REQUEST_CRAWL_MESSAGES',
        payload: { depth },
      });

      if (!crawlResp?.success || !crawlResp.data) {
        throw new Error(crawlResp?.error || 'Не удалось собрать сообщения из чата');
      }

      const fetchedMessages: ChatMessage[] = crawlResp.data;
      setMessages(fetchedMessages);

      setStatusMessage(`Анализ ${fetchedMessages.length} сообщений через LLM...`);

      const settings = await settingsRepo.getSettings();
      const analysisResp: MessageResponse<ChatAnalysis> = await chrome.runtime.sendMessage<AnalyzeChatMsg>({
        type: 'ANALYZE_CHAT',
        payload: {
          messages: fetchedMessages,
          persona: settings.persona,
        },
      });

      if (!analysisResp.success || !analysisResp.data) {
        throw new Error(analysisResp.error || 'Ошибка анализа LLM');
      }

      setAnalysis(analysisResp.data);
      setStatusMessage(`Готово: проанализировано ${fetchedMessages.length} сообщений`);
    } catch (err) {
      console.error('[CopilotApp] Analysis failed:', err);
      setStatusMessage(`Ошибка: ${(err as Error).message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2. Insert reply directly into Facebook chat
  const handleInsertReply = async (text: string) => {
    try {
      const tabId = await getActiveTabId();
      if (!tabId) return;

      await chrome.tabs.sendMessage(tabId, {
        type: 'INSERT_DRAFT_TO_CHAT',
        payload: { text },
      });

      setStatusMessage('Текст вставлен в поле ввода чата ✓');
    } catch (err) {
      setStatusMessage(`Не удалось вставить текст: ${(err as Error).message}`);
    }
  };

  // 3. Send custom question to Copilot
  const handleSendQuestion = async (customQuestion?: string) => {
    const query = customQuestion || promptText;
    if (!query.trim() || isSendingPrompt) return;

    const newDialogue = [...dialogue, { role: 'user' as const, content: query }];
    setDialogue(newDialogue);
    setPromptText('');
    setIsSendingPrompt(true);

    try {
      const settings = await settingsRepo.getSettings();

      // If we don't have messages yet, attempt a fast crawl
      let contextMessages = messages;
      if (contextMessages.length === 0) {
        const tabId = await getActiveTabId();
        if (tabId) {
          const resp = await chrome.tabs.sendMessage(tabId, {
            type: 'REQUEST_CRAWL_MESSAGES',
            payload: { depth: 25 },
          });
          if (resp?.success && resp.data) {
            contextMessages = resp.data;
            setMessages(contextMessages);
          }
        }
      }

      const response: MessageResponse<ChatAnalysis> = await chrome.runtime.sendMessage<AnalyzeChatMsg>({
        type: 'ANALYZE_CHAT',
        payload: {
          messages: contextMessages,
          persona: settings.persona,
          customQuery: query,
        },
      });

      if (response.success && response.data) {
        const answer =
          response.data.situationSummary +
          '\n\n' +
          response.data.manipulationVerdict.explanation +
          (response.data.suggestedReplies?.[0]
            ? `\n\n💡 Рекомендация:\n${response.data.suggestedReplies[0].text}`
            : '');

        setDialogue([...newDialogue, { role: 'assistant', content: answer }]);
      } else {
        throw new Error(response.error || 'No response');
      }
    } catch (err) {
      setDialogue([
        ...newDialogue,
        { role: 'assistant', content: `Ошибка ответа: ${(err as Error).message}` },
      ]);
    } finally {
      setIsSendingPrompt(false);
    }
  };

  // 4. Voice question
  const handleVoiceToggle = async () => {
    if (isRecording) {
      setIsRecording(false);
      try {
        setStatusMessage('Транскрибация голоса...');
        const result = await recorderRef.current?.stopRecording();
        if (result) {
          const transcribeResp: MessageResponse<string> = await chrome.runtime.sendMessage<TranscribeAudioMsg>({
            type: 'TRANSCRIBE_AUDIO',
            payload: {
              audioBase64: result.base64,
              mimeType: result.mimeType,
            },
          });
          if (transcribeResp.success && transcribeResp.data) {
            setPromptText(transcribeResp.data);
            handleSendQuestion(transcribeResp.data);
          }
        }
      } catch (err) {
        setStatusMessage(`Ошибка аудио: ${(err as Error).message}`);
      }
    } else {
      try {
        if (!recorderRef.current) {
          recorderRef.current = new AudioRecorderService();
        }
        await recorderRef.current.startRecording();
        setIsRecording(true);
        setStatusMessage('Запись вопроса с микрофона...');
      } catch (err) {
        setStatusMessage(`Ошибка микрофона: ${(err as Error).message}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 text-xs">
      {/* Top Header */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-zinc-100">
              {thread?.title || 'Активный чат'}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-900/60 text-indigo-300 font-mono">
              FB
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            {messages.length > 0 ? `В контексте: ${messages.length} сообщений` : statusMessage}
          </div>
        </div>

        <button
          onClick={() => handleDeepAnalysis(50)}
          disabled={isAnalyzing}
          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium flex items-center gap-1 transition"
        >
          <span>{isAnalyzing ? '⏳' : '⚡'}</span>
          <span>{isAnalyzing ? 'Анализ...' : 'Анализ 50 сообщений'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Analysis Dashboard Card (if available) */}
        {analysis && (
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col gap-2.5 shadow-sm">
            {/* Manipulation Risk Pill */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-300">Анализ манипуляций</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  analysis.manipulationVerdict.riskScore > 60
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : analysis.manipulationVerdict.riskScore > 30
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                }`}
              >
                Риск: {analysis.manipulationVerdict.riskScore}%
              </span>
            </div>

            {/* Explanation */}
            <p className="text-zinc-300 leading-relaxed text-[11px]">
              {analysis.manipulationVerdict.explanation}
            </p>

            {/* Tactics Tags */}
            {analysis.manipulationVerdict.tacticsDetected.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {analysis.manipulationVerdict.tacticsDetected.map((tactic, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 bg-zinc-800 text-rose-300 rounded text-[10px]"
                  >
                    ⚠️ {tactic}
                  </span>
                ))}
              </div>
            )}

            {/* Suggested Replies */}
            {analysis.suggestedReplies.length > 0 && (
              <div className="mt-1 flex flex-col gap-2">
                <div className="font-semibold text-zinc-400 text-[11px]">Рекомендуемые ответы:</div>
                {analysis.suggestedReplies.map((reply, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-zinc-950 border border-zinc-800 rounded flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-400 text-[11px]">
                        {reply.label}
                      </span>
                      <button
                        onClick={() => handleInsertReply(reply.text)}
                        className="px-2 py-0.5 bg-zinc-800 hover:bg-indigo-600 text-zinc-200 hover:text-white rounded text-[10px] transition"
                      >
                        Вставить в чат ↵
                      </button>
                    </div>
                    <p className="text-zinc-300 text-[11px] italic">"{reply.text}"</p>
                    <span className="text-[10px] text-zinc-500">🎯 {reply.strategicGoal}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Free-form Dialogue Feed */}
        <div className="flex flex-col gap-2.5 mt-2">
          {dialogue.length === 0 && !analysis && (
            <div className="text-center text-zinc-500 py-8 px-4 flex flex-col items-center gap-2">
              <span className="text-3xl">🧠</span>
              <p className="text-xs">
                Нажмите <strong>«Анализ 50 сообщений»</strong> вверху или задайте любой вопрос по
                текущей переписке ниже.
              </p>
            </div>
          )}

          {dialogue.map((item, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg max-w-[92%] leading-relaxed ${
                item.role === 'user'
                  ? 'self-end bg-indigo-600/30 border border-indigo-500/40 text-indigo-100'
                  : 'self-start bg-zinc-900 border border-zinc-800 text-zinc-200'
              }`}
            >
              <div className="text-[10px] font-semibold text-zinc-400 mb-1">
                {item.role === 'user' ? 'Вы' : 'TellMeMore Copilot'}
              </div>
              <div className="whitespace-pre-wrap">{item.content}</div>
            </div>
          ))}
          <div ref={dialogueEndRef} />
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="p-2.5 border-t border-zinc-800 bg-zinc-900/60 flex items-center gap-2">
        <button
          onClick={handleVoiceToggle}
          type="button"
          className={`p-2 rounded-lg border transition ${
            isRecording
              ? 'bg-rose-950 border-rose-600 text-rose-400 animate-pulse'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
          }`}
          title={isRecording ? 'Остановить запись' : 'Задать вопрос голосом'}
        >
          {isRecording ? '🔴' : '🎙️'}
        </button>

        <input
          type="text"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendQuestion();
            }
          }}
          placeholder="Спросить Копилота о переписке..."
          disabled={isSendingPrompt}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
        />

        <button
          onClick={() => handleSendQuestion()}
          disabled={!promptText.trim() || isSendingPrompt}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-lg transition"
        >
          {isSendingPrompt ? '...' : '→'}
        </button>
      </div>
    </div>
  );
};
