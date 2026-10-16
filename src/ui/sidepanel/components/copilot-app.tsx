/**
 * @file src/ui/sidepanel/components/copilot-app.tsx
 * @description Senior Minimalist Copilot SidePanel with Live Ingestion, Thinking Pipeline, and Dossier.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChatThread, ContactProfile } from '../../../core/entities/thread';
import { ChatMessage } from '../../../core/entities/message';
import { ChatAnalysis } from '../../../core/interfaces/llm-provider';
import { ChromeStorageSettingsRepository, IndexedDBChatRepository } from '../../../services/storage/chat-repository';
import { AudioRecorderService } from '../../../services/audio/audio-recorder';
import { RAGEngine } from '../../../services/rag/rag-engine';
import { sendTabMessageWithFallback } from '../../../infra/messaging/tab-messenger';
import { SettingsApp } from '../../popup/components/settings-app';
import {
  AnalyzeChatMsg,
  TranscribeAudioMsg,
  MessageResponse,
  ExtensionMessage,
} from '../../../infra/messaging/message-types';

interface DialogueMessage {
  role: 'user' | 'assistant';
  content: string;
}

const settingsRepo = new ChromeStorageSettingsRepository();
const chatRepo = new IndexedDBChatRepository();

export const CopilotApp: React.FC = () => {
  const [activeView, setActiveView] = useState<'copilot' | 'settings'>('copilot');

  const [thread, setThread] = useState<ChatThread | null>(null);
  const [contact, setContact] = useState<ContactProfile>({
    id: '',
    name: 'Собеседник',
    notes: '',
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [analysis, setAnalysis] = useState<ChatAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Чат готов');
  const [crawlDepth, setCrawlDepth] = useState<number>(30);
  const [newMessagesCounter, setNewMessagesCounter] = useState<number>(0);

  // Per-contact dossier modal toggle
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [contactGoals, setContactGoals] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  // Copilot dialogue
  const [dialogue, setDialogue] = useState<DialogueMessage[]>([]);
  const [promptText, setPromptText] = useState('');
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);

  // Microphone
  const [isRecording, setIsRecording] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const recorderRef = useRef<AudioRecorderService | null>(null);

  const dialogueEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    dialogueEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogue, thinkingPhase]);

  // Sync active thread and real-time live message listener
  useEffect(() => {
    loadActiveThread();

    // Listen for real-time messages detected in the active chat
    const messageListener = (msg: ExtensionMessage) => {
      if (msg.type === 'NEW_CHAT_MESSAGE_DETECTED') {
        const incoming = msg.payload;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          setNewMessagesCounter((c) => c + 1);
          return [...prev, incoming];
        });
        setStatusMessage('Новое сообщение в чате синхронизировано ✓');
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    const onTabActivated = () => {
      loadActiveThread();
    };
    chrome.tabs.onActivated?.addListener(onTabActivated);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.tabs.onActivated?.removeListener(onTabActivated);
    };
  }, []);

  const getActiveTabId = async (): Promise<number | null> => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id ?? null;
  };

  const loadActiveThread = async () => {
    try {
      const tabId = await getActiveTabId();
      if (!tabId) return;

      const response = await sendTabMessageWithFallback<{ type: string }, MessageResponse<ChatThread>>(
        tabId,
        { type: 'GET_CURRENT_THREAD' }
      );

      if (response?.success && response.data) {
        const currentThread: ChatThread = response.data;
        setThread(currentThread);

        const savedContact = await chatRepo.getThread(currentThread.id);
        if (savedContact?.contact) {
          setContact(savedContact.contact);
          setContactNotes(savedContact.contact.notes || '');
        } else {
          setContact(currentThread.contact);
        }

        const cached = await chatRepo.getMessages(currentThread.id, 100);
        if (cached.length > 0) {
          setMessages(cached);
          setStatusMessage(`В памяти: ${cached.length} сообщений`);
        }
      }
    } catch {
      setStatusMessage('Откройте вкладку с чатом');
    }
  };

  const handleSaveContactDossier = async () => {
    if (!thread) return;
    const updatedContact: ContactProfile = {
      ...contact,
      notes: contactNotes,
    };
    setContact(updatedContact);
    await chatRepo.saveContactProfile(updatedContact);
    setIsDossierOpen(false);
    setStatusMessage('Досье сохранено ✓');
  };

  // 1. Fetch & analyze messages from active chat with RAG & Sandwich Principle
  const handleDeepAnalysis = async (targetDepth?: number) => {
    const depth = targetDepth || crawlDepth;
    try {
      setIsAnalyzing(true);
      setThinkingPhase('🔍 Чтение истории диалога...');

      const tabId = await getActiveTabId();
      if (!tabId) throw new Error('Вкладка не найдена');

      const crawlResp = await sendTabMessageWithFallback<
        { type: string; payload: { depth: number } },
        MessageResponse<ChatMessage[]>
      >(tabId, {
        type: 'REQUEST_CRAWL_MESSAGES',
        payload: { depth },
      });

      if (!crawlResp?.success || !crawlResp.data) {
        throw new Error(crawlResp?.error || 'Не удалось прочитать сообщения');
      }

      const fetchedMessages: ChatMessage[] = crawlResp.data;
      setMessages(fetchedMessages);
      setNewMessagesCounter(0);

      setThinkingPhase('🧠 RAG-анализ манипуляций и скрытых мотивов...');

      const settings = await settingsRepo.getSettings();
      if (!settings.activeLLM.apiKey) {
        setActiveView('settings');
        throw new Error('Пожалуйста, укажите API-ключ в настройках.');
      }

      const sandwichPrompt = RAGEngine.buildSandwichPrompt({
        persona: settings.persona,
        contact: {
          ...contact,
          notes: contactNotes,
        },
        allMessages: fetchedMessages,
        activeMessagesCount: 20,
        customQuery: contactGoals ? `Моя цель по этому человеку: "${contactGoals}"` : undefined,
      });

      setThinkingPhase(`✍️ Формирование стратегического ответа (${settings.activeLLM.model})...`);

      const analysisResp: MessageResponse<ChatAnalysis> = await chrome.runtime.sendMessage<AnalyzeChatMsg>({
        type: 'ANALYZE_CHAT',
        payload: {
          messages: fetchedMessages,
          persona: settings.persona,
          customQuery: sandwichPrompt,
        },
      });

      if (!analysisResp.success || !analysisResp.data) {
        throw new Error(analysisResp.error || 'Ошибка анализа LLM');
      }

      setAnalysis(analysisResp.data);
      setStatusMessage(`Анализ ${fetchedMessages.length} сообщений завершён ✓`);
    } catch (err) {
      console.error('[CopilotApp] Analysis failed:', err);
      setStatusMessage(`Ошибка: ${(err as Error).message}`);
    } finally {
      setIsAnalyzing(false);
      setThinkingPhase(null);
    }
  };

  const handleInsertReply = async (text: string) => {
    try {
      const tabId = await getActiveTabId();
      if (!tabId) return;

      await sendTabMessageWithFallback<{ type: string; payload: { text: string } }, MessageResponse>(tabId, {
        type: 'INSERT_DRAFT_TO_CHAT',
        payload: { text },
      });

      setStatusMessage('Ответ вставлен в поле ввода ✓');
    } catch (err) {
      setStatusMessage(`Ошибка вставки: ${(err as Error).message}`);
    }
  };

  // 2. Custom prompt to Copilot
  const handleSendQuestion = async (customQuestion?: string) => {
    const query = customQuestion || promptText;
    if (!query.trim() || isSendingPrompt) return;

    const newDialogue = [...dialogue, { role: 'user' as const, content: query }];
    setDialogue(newDialogue);
    setPromptText('');
    setIsSendingPrompt(true);
    setThinkingPhase('🧠 Подготовка ответа с учётом контекста переписки...');

    try {
      const settings = await settingsRepo.getSettings();

      if (!settings.activeLLM.apiKey) {
        setActiveView('settings');
        throw new Error('Укажите API-ключ в настройках.');
      }

      // Delta-sync: pull any fresh messages from DOM
      let contextMessages = messages;
      const tabId = await getActiveTabId();
      if (tabId) {
        try {
          const resp = await sendTabMessageWithFallback<
            { type: string; payload: { depth: number } },
            MessageResponse<ChatMessage[]>
          >(tabId, {
            type: 'REQUEST_CRAWL_MESSAGES',
            payload: { depth: 15 },
          });
          if (resp?.success && resp.data) {
            contextMessages = resp.data;
            setMessages(contextMessages);
            setNewMessagesCounter(0);
          }
        } catch {
          // Continue with in-memory messages
        }
      }

      setThinkingPhase(`⚡ Анализ через ${settings.activeLLM.model}...`);

      const sandwichQuery = RAGEngine.buildSandwichPrompt({
        persona: settings.persona,
        contact: { ...contact, notes: contactNotes },
        allMessages: contextMessages,
        activeMessagesCount: 15,
        customQuery: query,
      });

      const response: MessageResponse<ChatAnalysis> = await chrome.runtime.sendMessage<AnalyzeChatMsg>({
        type: 'ANALYZE_CHAT',
        payload: {
          messages: contextMessages,
          persona: settings.persona,
          customQuery: sandwichQuery,
        },
      });

      if (response.success && response.data) {
        const answer =
          response.data.situationSummary +
          (response.data.manipulationVerdict.explanation
            ? `\n\n🔍 Разбор: ${response.data.manipulationVerdict.explanation}`
            : '') +
          (response.data.suggestedReplies?.[0]
            ? `\n\n💡 Рекомендуемый ход:\n"${response.data.suggestedReplies[0].text}"`
            : '');

        setDialogue([...newDialogue, { role: 'assistant', content: answer }]);
      } else {
        throw new Error(response.error || 'No response');
      }
    } catch (err) {
      setDialogue([
        ...newDialogue,
        { role: 'assistant', content: `Ошибка: ${(err as Error).message}` },
      ]);
    } finally {
      setIsSendingPrompt(false);
      setThinkingPhase(null);
    }
  };

  // 3. Microphone toggle
  const handleVoiceToggle = async () => {
    setMicNotice(null);
    if (isRecording) {
      setIsRecording(false);
      try {
        setThinkingPhase('🎙️ Транскрибация голоса...');
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
      } finally {
        setThinkingPhase(null);
      }
    } else {
      try {
        if (!recorderRef.current) {
          recorderRef.current = new AudioRecorderService();
        }
        await recorderRef.current.startRecording();
        setIsRecording(true);
        setStatusMessage('Запись голоса... кликните ещё раз для отправки');
      } catch (err) {
        console.warn('[CopilotApp] Mic access error:', err);
        setMicNotice('Разрешите доступ к микрофону в настройках браузера (значок замка в адресной строке).');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 text-xs font-sans select-none">
      {/* Sleek Minimalist Top Header */}
      <div className="h-11 px-3 border-b border-zinc-800/80 bg-zinc-900/90 flex items-center justify-between">
        {/* Left: Minimal Settings Icon or Back Button */}
        <div className="flex items-center gap-2">
          {activeView === 'settings' ? (
            <button
              onClick={() => setActiveView('copilot')}
              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-1 text-[11px]"
              title="Назад к чату"
            >
              <span>←</span>
              <span className="font-medium">Назад</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveView('settings')}
              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition"
              title="Настройки AI, провайдеров и моделей"
            >
              <span className="text-sm">⚙️</span>
            </button>
          )}

          {/* Center: Contact Name & Dossier Icon */}
          {activeView === 'copilot' && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-zinc-200 truncate max-w-[120px]" title={thread?.title}>
                {thread?.title || 'Собеседник'}
              </span>

              <button
                onClick={() => setIsDossierOpen((prev) => !prev)}
                className={`p-1 rounded hover:bg-zinc-800 transition ${
                  contactNotes || contactGoals ? 'text-indigo-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Досье и цели по собеседнику"
              >
                <span className="text-xs">📋</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: RAG Depth Pill & Action Button */}
        {activeView === 'copilot' && (
          <div className="flex items-center gap-1.5">
            <select
              value={crawlDepth}
              onChange={(e) => setCrawlDepth(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-1.5 py-1 text-[11px] focus:outline-none hover:border-zinc-700 cursor-pointer"
              title="Количество сообщений для RAG-анализа"
            >
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={300}>300</option>
            </select>

            <button
              onClick={() => handleDeepAnalysis()}
              disabled={isAnalyzing}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium flex items-center gap-1 transition text-[11px] shadow-sm shadow-indigo-600/30"
            >
              <span>{isAnalyzing ? '⏳' : '⚡'}</span>
              <span>{isAnalyzing ? 'Анализ...' : 'Анализ'}</span>
            </button>
          </div>
        )}
      </div>

      {/* VIEW: SETTINGS */}
      {activeView === 'settings' && (
        <div className="flex-1 overflow-y-auto p-3">
          <SettingsApp />
        </div>
      )}

      {/* VIEW: COPILOT CHAT */}
      {activeView === 'copilot' && (
        <>
          {/* Status Sub-bar */}
          <div className="px-3 py-1 bg-zinc-900/40 border-b border-zinc-800/40 flex items-center justify-between text-[10px] text-zinc-400">
            <div className="flex items-center gap-1.5 truncate">
              {thinkingPhase ? (
                <span className="text-indigo-400 font-medium flex items-center gap-1 animate-pulse">
                  <span>●</span>
                  <span>{thinkingPhase}</span>
                </span>
              ) : (
                <span>{statusMessage}</span>
              )}
            </div>

            {newMessagesCounter > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-[9px] animate-pulse">
                +{newMessagesCounter} нов.
              </span>
            )}
          </div>

          {/* Microphone Warning Banner */}
          {micNotice && (
            <div className="px-3 py-1.5 bg-amber-950/80 border-b border-amber-800/60 text-amber-200 text-[10px] flex items-center justify-between">
              <span>⚠️ {micNotice}</span>
              <button
                onClick={() => setMicNotice(null)}
                className="text-amber-400 hover:text-white ml-2 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Dossier Drawer */}
          {isDossierOpen && (
            <div className="p-3 bg-zinc-900 border-b border-indigo-950 flex flex-col gap-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-300 text-xs">
                  📋 Досье: {thread?.title || 'Собеседник'}
                </span>
                <button
                  onClick={() => setIsDossierOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">
                  Моя цель по этому человеку:
                </label>
                <input
                  type="text"
                  value={contactGoals}
                  onChange={(e) => setContactGoals(e.target.value)}
                  placeholder="Не давать скидку, закрыть сделку к пятнице..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">
                  Заметки о характере и манипуляциях:
                </label>
                <textarea
                  rows={2}
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  placeholder="Давит на жалость, затягивает время..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={handleSaveContactDossier}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium"
                >
                  Сохранить
                </button>
              </div>
            </div>
          )}

          {/* Main Area */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {/* Analysis Card */}
            {analysis && (
              <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-lg flex flex-col gap-2 shadow-sm">
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

                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  {analysis.manipulationVerdict.explanation}
                </p>

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

                {analysis.suggestedReplies.length > 0 && (
                  <div className="mt-1 flex flex-col gap-2">
                    <div className="font-semibold text-zinc-400 text-[11px]">Рекомендуемые ответы:</div>
                    {analysis.suggestedReplies.map((reply, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-zinc-950 border border-zinc-800/80 rounded flex flex-col gap-1"
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

            {/* Dialogue Feed */}
            <div className="flex flex-col gap-2.5 mt-2">
              {dialogue.length === 0 && !analysis && (
                <div className="text-center text-zinc-500 py-8 px-4 flex flex-col items-center gap-2">
                  <span className="text-3xl">🧠</span>
                  <p className="text-xs">
                    Нажмите <strong>«⚡ Анализ»</strong> вверху или задайте любой вопрос Копилоту ниже.
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

              {/* Live Thinking Status in Chat */}
              {thinkingPhase && (
                <div className="self-start p-2.5 bg-zinc-900/60 border border-zinc-800/60 rounded-lg text-indigo-300 text-xs flex items-center gap-2 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>{thinkingPhase}</span>
                </div>
              )}

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
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-xs"
            />

            <button
              onClick={() => handleSendQuestion()}
              disabled={!promptText.trim() || isSendingPrompt}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-lg transition"
            >
              {isSendingPrompt ? '...' : '→'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
