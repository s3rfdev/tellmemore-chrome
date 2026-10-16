/**
 * @file src/ui/popup/components/settings-app.tsx
 * @description Settings UI for TellMeMore extension (API keys, LLM/STT providers, persona & goals).
 */

import React, { useState, useEffect } from 'react';
import { UserSettings, DEFAULT_USER_SETTINGS, LLMProviderType, STTProviderType } from '../../../core/entities/settings';
import { ChromeStorageSettingsRepository } from '../../../services/storage/chat-repository';

const settingsRepo = new ChromeStorageSettingsRepository();

export const SettingsApp: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [activeTab, setActiveTab] = useState<'ai' | 'persona' | 'general'>('ai');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsRepo.getSettings().then((loaded) => {
      setSettings(loaded);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    try {
      await settingsRepo.saveSettings(settings);
      setSaveStatus('Настройки успешно сохранены ✓');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(`Ошибка сохранения: ${(err as Error).message}`);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-zinc-400">Загрузка настроек...</div>;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-indigo-500/20">
            ✨
          </div>
          <div>
            <h1 className="font-semibold text-base leading-tight">TellMeMore</h1>
            <p className="text-xs text-zinc-400">AI Copilot & Negotiation Assistant</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-1.5 font-medium rounded-md transition ${
            activeTab === 'ai' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Провайдеры AI
        </button>
        <button
          onClick={() => setActiveTab('persona')}
          className={`flex-1 py-1.5 font-medium rounded-md transition ${
            activeTab === 'persona' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Персона и Цели
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-1.5 font-medium rounded-md transition ${
            activeTab === 'general' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Параметры
        </button>
      </div>

      {/* Tab: AI Providers */}
      {activeTab === 'ai' && (
        <div className="flex flex-col gap-3 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Основная LLM нейросеть</label>
            <select
              value={settings.activeLLM.provider}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  activeLLM: {
                    ...settings.activeLLM,
                    provider: e.target.value as LLMProviderType,
                    model:
                      e.target.value === 'gemini'
                        ? 'gemini-2.5-flash'
                        : e.target.value === 'xai'
                        ? 'grok-beta'
                        : 'gpt-4o-mini',
                  },
                })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="gemini">Google Gemini (Рекомендуется)</option>
              <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
              <option value="xai">xAI (Grok)</option>
              <option value="custom_openai">Custom OpenAI-compatible (DeepSeek / Ollama)</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Модель</label>
            <input
              type="text"
              value={settings.activeLLM.model}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  activeLLM: { ...settings.activeLLM, model: e.target.value },
                })
              }
              placeholder="gemini-2.5-flash, gpt-4o-mini, grok-beta"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
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
              placeholder="AIzaSy... / sk-..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {settings.activeLLM.provider === 'custom_openai' && (
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Custom Endpoint URL</label>
              <input
                type="text"
                value={settings.activeLLM.endpointUrl || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    activeLLM: { ...settings.activeLLM, endpointUrl: e.target.value },
                  })
                }
                placeholder="https://api.deepseek.com/v1/chat/completions"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          )}

          <hr className="border-zinc-800 my-1" />

          {/* STT / Transcription Provider */}
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
                    model: e.target.value === 'groq_whisper' ? 'whisper-large-v3-turbo' : 'whisper-1',
                  },
                })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="groq_whisper">Groq Whisper (Сверхбыстрый ~300мс)</option>
              <option value="openai_whisper">OpenAI Whisper</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">API-ключ STT (Groq / OpenAI)</label>
            <input
              type="password"
              value={settings.activeSTT.apiKey}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  activeSTT: { ...settings.activeSTT, apiKey: e.target.value },
                })
              }
              placeholder="gsk_... или sk-..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>
      )}

      {/* Tab: Persona & Goals */}
      {activeTab === 'persona' && (
        <div className="flex flex-col gap-3 text-xs">
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
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
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
              placeholder="Руководитель проектов, Переговорщик, Фрилансер"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Главные цели в переговорах</label>
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
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
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
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Дополнительные инструкции для LLM</label>
            <textarea
              rows={2}
              value={settings.persona.customInstructions || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  persona: { ...settings.persona, customInstructions: e.target.value },
                })
              }
              placeholder="Не использовать канцеляризмы, отвечать короткими абзацами..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* Tab: General Parameters */}
      {activeTab === 'general' && (
        <div className="flex flex-col gap-3 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Глубина сбора сообщений по умолчанию
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={settings.defaultCrawlDepth}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultCrawlDepth: Number(e.target.value),
                  })
                }
                className="flex-1 accent-indigo-600"
              />
              <span className="font-semibold text-indigo-400 w-12 text-right">
                {settings.defaultCrawlDepth} шт.
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Сколько последних сообщений краулер анализирует для оценки манипуляций и выработки ответов.
            </p>
          </div>
        </div>
      )}

      {/* Save Button & Feedback */}
      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
        {saveStatus ? (
          <span className="text-xs text-emerald-400 font-medium">{saveStatus}</span>
        ) : (
          <span className="text-xs text-zinc-500">Автосохранение при клике</span>
        )}
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
        >
          Сохранить настройки
        </button>
      </div>
    </div>
  );
};
