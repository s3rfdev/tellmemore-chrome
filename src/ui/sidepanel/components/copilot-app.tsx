/**
 * @file src/ui/sidepanel/components/copilot-app.tsx
 * @description Copilot SidePanel with built-in Settings, Contact Dossier, RAG & Sandwich memory.
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
} from '../../../infra/messaging/message-types';

interface DialogueMessage {
  role: 'user' | 'assistant';
  content: string;
}

const settingsRepo = new ChromeStorageSettingsRepository();
const chatRepo = new IndexedDBChatRepository();

export const CopilotApp: React.FC = () => {
  // Navigation: 'copilot' chat view or 'settings' panel
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
  const [statusMessage, setStatusMessage] = useState<string>('Готов к анализу');
  const [crawlDepth, setCrawlDepth] = useState<number>(50);

  // Per-contact dossier modal toggle
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [contactGoals, setContactGoals] = useState('');
  const [contactNotes, setContactNotes] = useState('');

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

  // Sync active thread on mount & tab switches
  useEffect(() => {
    loadActiveThread();

    // Re-check when active tab changes
    const onTabActivated = () => {
      loadActiveThread();
    };
    chrome.tabs.onActivated?.addListener(onTabActivated);

    return () => {
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

        // Load contact dossier from IndexedDB
        const savedContact = await chatRepo.getThread(currentThread.id);
        if (savedContact?.contact) {
          setContact(savedContact.contact);
          setContactNotes(savedContact.contact.notes || '');
        } else {
          setContact(currentThread.contact);
        }

        // Restore past messages from DB
        const cached = await chatRepo.getMessages(currentThread.id, 100);
        if (cached.length > 0) {
          setMessages(cached);
          setStatusMessage(`В базе: ${cached.length} сообщений`);
        } else {
          setStatusMessage('Чат подключен');
        }
      }
    } catch {
      setStatusMessage('Откройте вкладку с перепиской и обновите её (F5)');
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
    setStatusMessage('Досье на контакт сохранено ✓');
  };

  // 1. Fetch & analyze messages from active chat with RAG & Sandwich Principle
  const handleDeepAnalysis = async (targetDepth?: number) => {
    const depth = targetDepth || crawlDepth;
    try {
      setIsAnalyzing(true);
      setStatusMessage(`RAG: Сбор последних ${depth} сообщений из чата...`);

      const tabId = await getActiveTabId();
      if (!tabId) throw new Error('Активная вкладка не найдена');

      const crawlResp = await sendTabMessageWithFallback<
        { type: string; payload: { depth: number } },
        MessageResponse<ChatMessage[]>
      >(tabId, {
        type: 'REQUEST_CRAWL_MESSAGES',
        payload: { depth },
      });

      if (!crawlResp?.success || !crawlResp.data) {
        throw new Error(crawlResp?.error || 'Не удалось собрать сообщения из чата');
      }

      const fetchedMessages: ChatMessage[] = crawlResp.data;
      setMessages(fetchedMessages);

      setStatusMessage(`RAG-индексация и анализ ${fetchedMessages.length} сообщений...`);

      const settings = await settingsRepo.getSettings();

      // Check if API key is set
      if (!settings.activeLLM.apiKey) {
        setActiveView('settings');
        throw new Error('Укажите API-ключ в настройках.');
      }

      // Build Sandwich Prompt with RAG
      const sandwichPrompt = RAGEngine.buildSandwichPrompt({
        persona: settings.persona,
        contact: {
          ...contact,
          notes: contactNotes,
        },
        allMessages: fetchedMessages,
        activeMessagesCount: 20,
        customQuery: contactGoals ? `Моя главная цель по этому контакту: "${contactGoals}"` : undefined,
      });

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
      setStatusMessage(`Готово: RAG-анализ ${fetchedMessages.length} сообщений завершён`);
    } catch (err) {
      console.error('[CopilotApp] Analysis failed:', err);
      setStatusMessage(`Ошибка: ${(err as Error).message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2. Insert reply directly into chat
  const handleInsertReply = async (text: string) => {
    try {
      const tabId = await getActiveTabId();
      if (!tabId) return;

      await sendTabMessageWithFallback<{ type: string; payload: { text: string } }, MessageResponse>(tabId, {
        type: 'INSERT_DRAFT_TO_CHAT',
        payload: { text },
      });

      setStatusMessage('Текст вставлен в поле ввода чата ✓');
    } catch (err) {
      setStatusMessage(`Не удалось вставить текст: ${(err as Error).message}`);
    }
  };

  // 3. Send custom question to Copilot with RAG context
  const handleSendQuestion = async (customQuestion?: string) => {
    const query = customQuestion || promptText;
    if (!query.trim() || isSendingPrompt) return;

    const newDialogue = [...dialogue, { role: 'user' as const, content: query }];
    setDialogue(newDialogue);
    setPromptText('');
    setIsSendingPrompt(true);

    try {
      const settings = await settingsRepo.getSettings();

      if (!settings.activeLLM.apiKey) {
        setActiveView('settings');
        throw new Error('Пожалуйста, укажите API-ключ в настройках.');
      }

      let contextMessages = messages;

      if (contextMessages.length === 0) {
        const tabId = await getActiveTabId();
        if (tabId) {
          try {
            const resp = await sendTabMessageWithFallback<
              { type: string; payload: { depth: number } },
              MessageResponse<ChatMessage[]>
            >(tabId, {
              type: 'REQUEST_CRAWL_MESSAGES',
              payload: { depth: 25 },
            });
            if (resp?.success && resp.data) {
              contextMessages = resp.data;
              setMessages(contextMessages);
            }
          } catch {
            // Proceed even if active crawl fails
          }
        }
      }

      // Sandwich prompt for dialogue
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
    }
  };

  // 4. Voice input
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
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 text-xs font-sans">
      {/* Top Header & Navigation */}
      <div className="p-2.5 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => setActiveView('copilot')}
              className={`px-2.5 py-1 rounded font-medium transition text-[11px] flex items-center gap-1 ${
                activeView === 'copilot'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>🧠</span>
              <span>Копилот</span>
            </button>

            <button
              onClick={() => setActiveView('settings')}
              className={`px-2.5 py-1 rounded font-medium transition text-[11px] flex items-center gap-1 ${
                activeView === 'settings'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>⚙️</span>
              <span>Настройки</span>
            </button>
          </div>

          {activeView === 'copilot' && thread && (
            <span className="font-medium text-zinc-300 truncate max-w-[110px]" title={thread.title}>
              {thread.title}
            </span>
          )}
        </div>

        {activeView === 'copilot' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsDossierOpen((prev) => !prev)}
              className="px-2 py-1 rounded text-[11px] bg-zinc-800 hover:bg-zinc-700 text-indigo-300 border border-zinc-700 transition"
              title="Открыть досье и цели по этому контакту"
            >
              👤 Досье
            </button>

            <select
              value={crawlDepth}
              onChange={(e) => setCrawlDepth(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-1.5 py-1 text-[11px] focus:outline-none"
            >
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={300}>300</option>
            </select>

            <button
              onClick={() => handleDeepAnalysis()}
              disabled={isAnalyzing}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium flex items-center gap-1 transition text-[11px]"
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
          {/* Status Subheader */}
          <div className="px-3 py-1 bg-zinc-900/40 border-b border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
            <span>{statusMessage}</span>
            {messages.length > 0 && <span>{messages.length} сообщ. в контексте</span>}
          </div>

          {/* Dossier Modal / Drawer */}
          {isDossierOpen && (
            <div className="p-3 bg-zinc-900 border-b border-indigo-900/50 flex flex-col gap-2 shadow-inner">
              <div className="font-semibold text-indigo-300 text-xs">
                Досье и цели по контакту: {thread?.title || 'Собеседник'}
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">
                  Мои конкретные цели по этому человеку:
                </label>
                <input
                  type="text"
                  value={contactGoals}
                  onChange={(e) => setContactGoals(e.target.value)}
                  placeholder="Например: Не уступать в цене, закрыть договор к пятнице"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">
                  Заметки о собеседнике (психотип, триггеры, прошлые манипуляции):
                </label>
                <textarea
                  rows={2}
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  placeholder="Любит затягивать сроки, давит на жалость..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsDossierOpen(false)}
                  className="px-2 py-1 text-zinc-400 hover:text-zinc-200 text-[11px]"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveContactDossier}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium"
                >
                  Сохранить досье
                </button>
              </div>
            </div>
          )}

          {/* Main Area */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {/* Analysis Dashboard Card */}
            {analysis && (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col gap-2.5 shadow-sm">
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

            {/* Dialogue Feed */}
            <div className="flex flex-col gap-2.5 mt-2">
              {dialogue.length === 0 && !analysis && (
                <div className="text-center text-zinc-500 py-8 px-4 flex flex-col items-center gap-2">
                  <span className="text-3xl">🧠</span>
                  <p className="text-xs">
                    Нажмите <strong>«Анализ»</strong> вверху или задайте вопрос Копилоту ниже.
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    Настройки моделей и ключей доступны во вкладке <strong>⚙️ Настройки</strong> вверху.
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

          {/* Bottom Input */}
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
              placeholder="Спросить Копилота (с учётом целей и RAG)..."
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
        </>
      )}
    </div>
  );
};
