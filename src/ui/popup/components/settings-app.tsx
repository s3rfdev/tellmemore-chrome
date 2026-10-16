/**
 * @file src/ui/popup/components/settings-app.tsx
 * @description Settings UI with dynamic model fetching, Z-AI & Deepgram, custom prompts, and 6-language auto-localization.
 */

import React, { useState, useEffect } from 'react';
import {
  UserSettings,
  DEFAULT_USER_SETTINGS,
  DEFAULT_UI_SETTINGS,
  LLMProviderType,
  STTProviderType,
  FontSizePreset,
  FontWeightPreset,
  ColorThemePreset,
} from '../../../core/entities/settings';
import { ChromeStorageSettingsRepository } from '../../../services/storage/chat-repository';
import { DEFAULT_PROMPT_TEMPLATES, PromptTemplateConfig } from '../../../core/prompts/prompt-templates';
import { FetchModelsMsg, MessageResponse } from '../../../infra/messaging/message-types';
import {
  LanguageCode,
  SUPPORTED_LANGUAGES,
  detectSystemLanguage,
  t,
} from '../../../core/i18n/translations';

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

  const [activeTab, setActiveTab] = useState<'ai' | 'persona' | 'prompts' | 'ui' | 'general'>('ai');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelsList, setModelsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Compute active language: auto-detect system language or use manual preference
  const currentLang: LanguageCode =
    settings.language === 'auto' ? detectSystemLanguage() : (settings.language as LanguageCode);

  useEffect(() => {
    settingsRepo.getSettings().then(async (loaded) => {
      const ext = loaded as ExtendedUserSettings;
      setSettings({
        ...ext,
        language: ext.language || 'auto',
        promptTemplates: ext.promptTemplates || DEFAULT_PROMPT_TEMPLATES,
        ui: ext.ui || DEFAULT_UI_SETTINGS,
      });

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
      setSaveStatus(t('settingsSaved', currentLang));
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(`Ошибка: ${(err as Error).message}`);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-zinc-400">Loading...</div>;
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
            <h1 className="font-semibold text-sm leading-tight text-white">{t('appTitle', currentLang)}</h1>
            <p className="text-[11px] text-zinc-400">{t('appSubtitle', currentLang)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-[11px] gap-0.5">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-1 font-medium rounded transition ${
            activeTab === 'ai' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t('aiTab', currentLang)}
        </button>
        <button
          onClick={() => setActiveTab('persona')}
          className={`flex-1 py-1 font-medium rounded transition ${
            activeTab === 'persona' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t('personaTab', currentLang)}
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex-1 py-1 font-medium rounded transition ${
            activeTab === 'prompts' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t('promptsTab', currentLang)}
        </button>
        <button
          onClick={() => setActiveTab('ui')}
          className={`flex-1 py-1 font-medium rounded transition ${
            activeTab === 'ui' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t('uiTab', currentLang)}
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-1 font-medium rounded transition ${
            activeTab === 'general' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t('generalTab', currentLang)}
        </button>
      </div>

      {/* Tab: AI Providers */}
      {activeTab === 'ai' && (
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">{t('primaryLLM', currentLang)}</label>
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
              <option value="gemini">Google Gemini (Gemini 3.7 / 3.5 / 2.5 Flash)</option>
              <option value="zai">Z-AI (Zhipu GLM-4.5 / GLM-5)</option>
              <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
              <option value="xai">xAI (Grok)</option>
              <option value="custom_openai">Custom OpenAI-compatible (DeepSeek, Ollama)</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">{t('llmApiKey', currentLang)}</label>
            <input
              type="password"
              value={settings.activeLLM.apiKey}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  activeLLM: { ...settings.activeLLM, apiKey: e.target.value },
                })
              }
              placeholder="API Key..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-zinc-300 font-medium">{t('activeModel', currentLang)}</label>
              <button
                type="button"
                onClick={handleManualFetchModels}
                disabled={isFetchingModels || !settings.activeLLM.apiKey}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50 underline"
              >
                {isFetchingModels ? '...' : t('fetchModelsBtn', currentLang)}
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
            <label className="block text-zinc-300 font-medium mb-1">{t('sttService', currentLang)}</label>
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
              <option value="deepgram">Deepgram Nova-2 (Fast & Accurate)</option>
              <option value="groq_whisper">Groq Whisper (Turbo)</option>
              <option value="openai_whisper">OpenAI Whisper</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">{t('sttApiKey', currentLang)}</label>
            <input
              type="password"
              value={settings.activeSTT.apiKey}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  activeSTT: { ...settings.activeSTT, apiKey: e.target.value },
                })
              }
              placeholder="API Key..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
            />
          </div>
        </div>
      )}

      {/* Tab: Persona & Global Goals */}
      {activeTab === 'persona' && (
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">{t('userNameLabel', currentLang)}</label>
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
            <label className="block text-zinc-300 font-medium mb-1">{t('userRoleLabel', currentLang)}</label>
            <input
              type="text"
              value={settings.persona.userRole}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  persona: { ...settings.persona, userRole: e.target.value },
                })
              }
              placeholder={t('userRolePlaceholder', currentLang)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">{t('globalGoalsLabel', currentLang)}</label>
            <textarea
              rows={2}
              value={settings.persona.communicationGoals}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  persona: { ...settings.persona, communicationGoals: e.target.value },
                })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none text-[11px]"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">{t('toneLabel', currentLang)}</label>
            <input
              type="text"
              value={settings.persona.preferredTone}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  persona: { ...settings.persona, preferredTone: e.target.value },
                })
              }
              placeholder={t('tonePlaceholder', currentLang)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Tab: Prompt Templates */}
      {activeTab === 'prompts' && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] text-zinc-400">
            Variables:
            <code className="text-indigo-300"> {'{{userName}}'}, {'{{contactGoals}}'}, {'{{ragMemory}}'}, {'{{recentMessages}}'}, {'{{language}}'}</code>
          </p>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Sandwich Analysis Prompt Template</label>
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
            Reset prompts to defaults
          </button>
        </div>
      )}

      {/* Tab: UI & Appearance */}
      {activeTab === 'ui' && (
        <div className="flex flex-col gap-3">
          {/* Font Size Preset */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">
              {t('fontSizeLabel', currentLang)}
            </label>
            <div className="grid grid-cols-4 gap-1 bg-zinc-900 p-1 rounded border border-zinc-800 text-[11px]">
              {(['compact', 'normal', 'large', 'huge'] as FontSizePreset[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      ui: { ...(settings.ui || DEFAULT_UI_SETTINGS), fontSize: size },
                    })
                  }
                  className={`py-1 rounded font-medium transition ${
                    (settings.ui?.fontSize || 'normal') === size
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {size === 'compact' && '11px'}
                  {size === 'normal' && '12px'}
                  {size === 'large' && '13.5px'}
                  {size === 'huge' && '15px'}
                </button>
              ))}
            </div>
          </div>

          {/* Font Weight Preset */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">
              {t('fontWeightLabel', currentLang)}
            </label>
            <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-1 rounded border border-zinc-800 text-[11px]">
              {(['normal', 'medium', 'semibold'] as FontWeightPreset[]).map((weight) => (
                <button
                  key={weight}
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      ui: { ...(settings.ui || DEFAULT_UI_SETTINGS), fontWeight: weight },
                    })
                  }
                  className={`py-1 rounded font-medium transition ${
                    (settings.ui?.fontWeight || 'normal') === weight
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={{
                    fontWeight: weight === 'semibold' ? 600 : weight === 'medium' ? 500 : 400,
                  }}
                >
                  {weight === 'normal' && 'Regular (400)'}
                  {weight === 'medium' && 'Medium (500)'}
                  {weight === 'semibold' && 'SemiBold (600)'}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Palette Presets */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">
              {t('themePresetLabel', currentLang)}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'indigo', name: 'Indigo', hex: '#6366f1' },
                { id: 'emerald', name: 'Emerald', hex: '#10b981' },
                { id: 'amber', name: 'Amber', hex: '#f59e0b' },
                { id: 'rose', name: 'Rose', hex: '#f43f5e' },
                { id: 'cyan', name: 'Cyan', hex: '#06b6d4' },
                { id: 'minimal_mono', name: 'Mono', hex: '#71717a' },
                { id: 'custom', name: 'Custom', hex: settings.ui?.customAccentColor || '#8b5cf6' },
              ].map((theme) => {
                const isSelected = (settings.ui?.colorPreset || 'indigo') === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        ui: {
                          ...(settings.ui || DEFAULT_UI_SETTINGS),
                          colorPreset: theme.id as ColorThemePreset,
                          customAccentColor: theme.id !== 'custom' ? theme.hex : (settings.ui?.customAccentColor || '#6366f1'),
                        },
                      })
                    }
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded border transition text-[11px] ${
                      isSelected
                        ? 'border-indigo-400 bg-zinc-800 text-white shadow-sm'
                        : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: theme.hex }}
                    />
                    <span className="truncate">{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Accent & Text Color Pickers */}
          <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-zinc-300 font-medium text-[11px]">
                {t('customAccentColor', currentLang)}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.ui?.customAccentColor || '#6366f1'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ui: {
                        ...(settings.ui || DEFAULT_UI_SETTINGS),
                        colorPreset: 'custom',
                        customAccentColor: e.target.value,
                      },
                    })
                  }
                  className="w-7 h-7 rounded border border-zinc-700 bg-transparent cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={settings.ui?.customAccentColor || '#6366f1'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ui: {
                        ...(settings.ui || DEFAULT_UI_SETTINGS),
                        colorPreset: 'custom',
                        customAccentColor: e.target.value,
                      },
                    })
                  }
                  className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono text-zinc-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/60">
              <label className="text-zinc-300 font-medium text-[11px]">
                {t('customTextColor', currentLang)}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.ui?.customTextColor || '#f4f4f5'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ui: {
                        ...(settings.ui || DEFAULT_UI_SETTINGS),
                        customTextColor: e.target.value,
                      },
                    })
                  }
                  className="w-7 h-7 rounded border border-zinc-700 bg-transparent cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={settings.ui?.customTextColor || '#f4f4f5'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ui: {
                        ...(settings.ui || DEFAULT_UI_SETTINGS),
                        customTextColor: e.target.value,
                      },
                    })
                  }
                  className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono text-zinc-200"
                />
              </div>
            </div>
          </div>

          {/* Ultra Minimalist Mode Toggle */}
          <div className="flex items-start gap-2.5 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
            <input
              type="checkbox"
              id="ultraMinimalToggle"
              checked={settings.ui?.isUltraMinimal || false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ui: {
                    ...(settings.ui || DEFAULT_UI_SETTINGS),
                    isUltraMinimal: e.target.checked,
                  },
                })
              }
              className="mt-0.5 rounded accent-indigo-600 cursor-pointer"
            />
            <label htmlFor="ultraMinimalToggle" className="cursor-pointer">
              <span className="block text-zinc-200 font-medium text-[11px]">
                {t('ultraMinimalLabel', currentLang)}
              </span>
              <span className="block text-[10px] text-zinc-400 mt-0.5">
                {t('ultraMinimalDesc', currentLang)}
              </span>
            </label>
          </div>

          {/* Live Preview Box */}
          <div className="mt-0.5 p-2.5 rounded-lg border border-zinc-800 bg-zinc-950 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
              {t('previewLabel', currentLang)}
            </span>
            <div
              className="p-2 rounded border transition-all"
              style={{
                backgroundColor: `${settings.ui?.customAccentColor || '#6366f1'}20`,
                borderColor: `${settings.ui?.customAccentColor || '#6366f1'}60`,
                color: settings.ui?.customTextColor || '#f4f4f5',
                fontSize:
                  settings.ui?.fontSize === 'compact'
                    ? '11px'
                    : settings.ui?.fontSize === 'large'
                    ? '13.5px'
                    : settings.ui?.fontSize === 'huge'
                    ? '15px'
                    : '12px',
                fontWeight:
                  settings.ui?.fontWeight === 'semibold'
                    ? 600
                    : settings.ui?.fontWeight === 'medium'
                    ? 500
                    : 400,
              }}
            >
              ✨ TellMeMore Copilot: Minimalist AI assistant preview.
            </div>
          </div>
        </div>
      )}

      {/* Tab: General Parameters & Language Selection */}
      {activeTab === 'general' && (
        <div className="flex flex-col gap-3">
          {/* Language Selector */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1">{t('languageLabel', currentLang)}</label>
            <select
              value={settings.language || 'auto'}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  language: e.target.value as 'auto' | LanguageCode,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="auto">
                🌐 {t('autoLang', currentLang)} ({SUPPORTED_LANGUAGES.find((l) => l.code === detectSystemLanguage())?.nativeName || 'English'})
              </option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-zinc-500 mt-1">
              Автоматически определяет язык системы (Windows, macOS) или переключается на выбранный язык.
            </p>
          </div>

          <hr className="border-zinc-800 my-1" />

          {/* Crawl depth */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              {t('crawlLimitLabel', currentLang)}
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
                {settings.defaultCrawlDepth}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
        {saveStatus ? (
          <span className="text-[11px] text-emerald-400 font-medium">{saveStatus}</span>
        ) : (
          <span className="text-[10px] text-zinc-500">Local secure storage</span>
        )}
        <button
          onClick={handleSave}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
        >
          {t('save', currentLang)}
        </button>
      </div>
    </div>
  );
};
