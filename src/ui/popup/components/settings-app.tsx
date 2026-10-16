/**
 * @file src/ui/popup/components/settings-app.tsx
 * @description Settings UI with dynamic model fetching, Z-AI & Deepgram support, and custom prompt templates.
 */

import React, { useState, useEffect } from 'react';
import { UserSettings, DEFAULT_USER_SETTINGS, LLMProviderType, STTProviderType } from '../../../core/entities/settings';
import { ChromeStorageSettingsRepository } from '../../../services/storage/chat-repository';
import { DEFAULT_PROMPT_TEMPLATES, PromptTemplateConfig } from '../../../core/prompts/prompt-templates';
import { FetchModelsMsg, MessageResponse } from '../../../infra/messaging/message-types';

const settingsRepo = new ChromeStorageSettingsRepository();

interface ExtendedUserSettings extends UserSettings {
  promptTemplates?: PromptTemplateConfig;
  availableModels?: string[];
}

export const SettingsApp: React.FC = () => {
  const [settings, setSettings] = useState<ExtendedUserSettings>({
    ...DEFAULT_USER_SETTINGS,
    promptTemplates: DEFAULT_PROMPT_TEMPLATES,
    availableModels: [],
  });

  const [activeTab, setActiveTab] = useState<'ai' | 'persona' | 'prompts' | 'general'>('ai');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelsList, setModelsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsRepo.getSettings().then(async (loaded) => {
      const ext = loaded as ExtendedUserSettings;
      setSettings({
        ...ext,
        promptTemplates: ext.promptTemplates || DEFAULT_PROMPT_TEMPLATES,
      });

      // If key is set, auto-fetch models
      if (ext.activeLLM.apiKey) {
        fetchModels(ext.activeLLM.provider, ext.activeLLM.apiKey, ext.activeLLM.endpointUrl);
      }
      setLoading(false);
    });
  }, []);

  const fetchModels = async (provider: string, apiKey: string, endpointUrl?: string) => {
    if (!apiKey) return;
    try {
      setIsFetchingModels(true);
      const resp: MessageResponse<string[]> = await chrome.runtime.sendMessage<FetchModelsMsg>({
        type: 'FETCH_AVAILABLE_MODELS',
        payload: { provider, apiKey, endpointUrl },
      });

      if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
        setModelsList(resp.data);
      }
    } catch (e) {
      console.warn('[TellMeMore] Failed to auto-fetch models:', e);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleManualFetchModels = () => {
    fetchModels(settings.activeLLM.provider, settings.activeLLM.apiKey, settings.activeLLM.endpointUrl);
  };

  const handleSave = async () => {
    try {
      await settingsRepo.saveSettings(settings);
      setSaveStatus('Настройки успешно сохранены ✓');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(`Ошибка: ${(err as Error).message}`);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-zinc-400">Загрузка настроек...</div>;
  }

  return (
    <div className="w-full flex flex-col gap-3 font-sans text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-indigo-500/20">
            ✨
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-tight text-white">TellMeMore Copilot</h1>
            <p className="text-[11px] text-zinc-400">Универсальный переговорный AI-ассистент</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-[11px]">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-1 font-medium rounded transition ${
            activeTab === 'ai' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          AI & STT
        </button>
        <button
          onClick={() => setActiveTab('persona')}
          className={`flex-1 py-1 font-medium rounded transition ${
            activeTab === 'persona' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Персона
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex-1 py-1 font-medium rounded transition ${
            activeTab === 'prompts' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Промпты
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-1 font-medium rounded transition ${
            activeTab === 'general' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Параметры
        </button>
      </div>

      {/* Tab: AI Providers */}
      {activeTab === 'ai' && (
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Основная нейросеть (LLM)</label>
            <select
              value={settings.activeLLM.provider}
              onChange={(e) => {
                const prov = e.target.value as LLMProviderType;
                let defaultModel = 'gemini-3.7-flash';
                if (prov === 'zai') defaultModel = 'glm-4.5';
                if (prov === 'openai') defaultModel = 'gpt-4o-mini';
                if (prov === 'xai') defaultModel = 'grok-beta';

                setSettings({
                  ...settings,
                  activeLLM: {
                    ...settings.activeLLM,
                    provider: prov,
                    model: defaultModel,
                  },
                });
                setModelsList([]);
              }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="gemini">Google Gemini (Gemini 3.5 / 3.7 / 2.5 Flash)</option>
              <option value="zai">Z-AI (Zhipu GLM-4.5 / GLM-5)</option>
              <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
              <option value="xai">xAI (Grok)</option>
              <option value="custom_openai">Custom OpenAI-compatible (DeepSeek, Ollama)</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">API-ключ LLM</label>
            <input
              type="password"
              value={settings.activeLLM.apiKey}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  activeLLM: { ...settings.activeLLM, apiKey: e.target.value },
                })
              }
              placeholder="Вставьте ваш API-ключ..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-zinc-300 font-medium">Активная модель</label>
              <button
                type="button"
                onClick={handleManualFetchModels}
                disabled={isFetchingModels || !settings.activeLLM.apiKey}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50 underline"
              >
                {isFetchingModels ? 'Загрузка...' : '⚡ Загрузить список моделей с сервера'}
              </button>
            </div>

            {modelsList.length > 0 ? (
              <select
                value={settings.activeLLM.model}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    activeLLM: { ...settings.activeLLM, model: e.target.value },
                  })
                }
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                {modelsList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={settings.activeLLM.model}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    activeLLM: { ...settings.activeLLM, model: e.target.value },
                  })
                }
                placeholder="gemini-3.7-flash, gemini-3.5-flash, glm-4.5"
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
              />
            )}
          </div>

          <hr className="border-zinc-800 my-1" />

          {/* STT Section */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Сервис транскрибации речи (STT)</label>
            <select
              value={settings.activeSTT.provider}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  activeSTT: {
                    ...settings.activeSTT,
                    provider: e.target.value as STTProviderType,
                    model:
                      e.target.value === 'deepgram'
                        ? 'nova-2'
                        : e.target.value === 'groq_whisper'
                        ? 'whisper-large-v3-turbo'
                        : 'whisper-1',
                  },
                })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="deepgram">Deepgram Nova-2 (Сверхбыстрый, высокая точность)</option>
              <option value="groq_whisper">Groq Whisper (Turbo)</option>
              <option value="openai_whisper">OpenAI Whisper</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">API-ключ транскрибации</label>
            <input
              type="password"
              value={settings.activeSTT.apiKey}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  activeSTT: { ...settings.activeSTT, apiKey: e.target.value },
                })
              }
              placeholder="API-ключ Deepgram или Whisper..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
            />
          </div>
        </div>
      )}

      {/* Tab: Persona & Global Goals */}
      {activeTab === 'persona' && (
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Ваше имя / псевдоним</label>
            <input
              type="text"
              value={settings.persona.userName}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  persona: { ...settings.persona, userName: e.target.value },
                })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Ваша роль / позиция</label>
            <input
              type="text"
              value={settings.persona.userRole}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  persona: { ...settings.persona, userRole: e.target.value },
                })
              }
              placeholder="Руководитель, переговорщик, основатель"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Глобальные цели в переговорах</label>
            <textarea
              rows={2}
              value={settings.persona.communicationGoals}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  persona: { ...settings.persona, communicationGoals: e.target.value },
                })
              }
              placeholder="Защита границ, выявление скрытых мотивов, закрытие сделок"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none text-[11px]"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Предпочитаемый тон ответов</label>
            <input
              type="text"
              value={settings.persona.preferredTone}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  persona: { ...settings.persona, preferredTone: e.target.value },
                })
              }
              placeholder="Дипломатичный, спокойный, решительный, лаконичный"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Tab: Prompt Templates */}
      {activeTab === 'prompts' && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] text-zinc-400">
            Все промпты полностью настраиваемы. Доступные переменные:
            <code className="text-indigo-300"> {'{{userName}}'}, {'{{contactGoals}}'}, {'{{ragMemory}}'}, {'{{recentMessages}}'}</code>
          </p>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Шаблон анализа (Сэндвич-структура)</label>
            <textarea
              rows={6}
              value={settings.promptTemplates?.analysisPromptTemplate || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  promptTemplates: {
                    ...(settings.promptTemplates || DEFAULT_PROMPT_TEMPLATES),
                    analysisPromptTemplate: e.target.value,
                  },
                })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono text-[10px] resize-y"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setSettings({
                ...settings,
                promptTemplates: DEFAULT_PROMPT_TEMPLATES,
              })
            }
            className="text-[10px] text-zinc-400 hover:text-zinc-200 underline text-left"
          >
            Сбросить промпты к системным значениям по умолчанию
          </button>
        </div>
      )}

      {/* Tab: General Parameters */}
      {activeTab === 'general' && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Лимит сообщений для RAG-анализа по умолчанию
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="20"
                max="300"
                step="10"
                value={settings.defaultCrawlDepth}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultCrawlDepth: Number(e.target.value),
                  })
                }
                className="flex-1 accent-indigo-600"
              />
              <span className="font-semibold text-indigo-400 w-16 text-right">
                {settings.defaultCrawlDepth} шт.
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              При сборе свыше 30 сообщений включается автоматический RAG: активные сообщения идут в прямой контекст, а более ранние — в семантическую выборку.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
        {saveStatus ? (
          <span className="text-[11px] text-emerald-400 font-medium">{saveStatus}</span>
        ) : (
          <span className="text-[10px] text-zinc-500">Ключи хранятся только локально в браузере</span>
        )}
        <button
          onClick={handleSave}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
};
