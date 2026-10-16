/**
 * @file src/core/i18n/translations.ts
 * @description Internationalization dictionary for TellMeMore Chrome extension (Russian & English).
 */

export type LanguageCode = 'ru' | 'en';

export const TRANSLATIONS = {
  ru: {
    appTitle: 'TellMeMore Copilot',
    appSubtitle: 'AI-копилот и ассистент по переговорам',
    aiTab: 'Провайдеры AI',
    personaTab: 'Персона и Цели',
    promptsTab: 'Шаблоны промптов',
    generalTab: 'Параметры',
    activeLLM: 'Основная нейросеть (LLM)',
    model: 'Модель',
    fetchModels: 'Обновить список моделей',
    fetchingModels: 'Загрузка моделей...',
    apiKey: 'API-ключ',
    sttProvider: 'Сервис транскрибации (STT)',
    saveSettings: 'Сохранить настройки',
    settingsSaved: 'Настройки успешно сохранены ✓',
    contactGoalsTitle: 'Цели по этому собеседнику',
    contactNotesTitle: 'Заметки о собеседнике',
    analysisDepth: 'Глубина сбора сообщений',
    analyzeDepthButton: 'Анализ {depth} сообщений',
    analyzing: 'Идёт анализ...',
    insertToChat: 'Вставить в чат ↵',
    voiceDictate: 'Надиктовать мысль',
    askCopilotPlaceholder: 'Спросить Копилота о переписке...',
    manipulationRisk: 'Риск манипуляций',
    suggestedReplies: 'Рекомендуемые варианты ответа',
    crawlingMessages: 'Сбор сообщений чата ({current} / {target})...',
    transcribingAudio: 'Транскрибация аудио...',
    analyzingImages: 'Сжатие и анализ изображений...',
  },
  en: {
    appTitle: 'TellMeMore Copilot',
    appSubtitle: 'AI Copilot & Negotiation Assistant',
    aiTab: 'AI Providers',
    personaTab: 'Persona & Goals',
    promptsTab: 'Prompt Templates',
    generalTab: 'Parameters',
    activeLLM: 'Primary LLM',
    model: 'Model',
    fetchModels: 'Fetch Models',
    fetchingModels: 'Fetching models...',
    apiKey: 'API Key',
    sttProvider: 'Transcription Service (STT)',
    saveSettings: 'Save Settings',
    settingsSaved: 'Settings saved successfully ✓',
    contactGoalsTitle: 'Goals for this Contact',
    contactNotesTitle: 'Contact Notes & Bio',
    analysisDepth: 'Message Crawl Depth',
    analyzeDepthButton: 'Analyze {depth} messages',
    analyzing: 'Analyzing...',
    insertToChat: 'Insert to Chat ↵',
    voiceDictate: 'Dictate Thought',
    askCopilotPlaceholder: 'Ask Copilot about the chat...',
    manipulationRisk: 'Manipulation Risk',
    suggestedReplies: 'Recommended Replies',
    crawlingMessages: 'Crawling messages ({current} / {target})...',
    transcribingAudio: 'Transcribing audio...',
    analyzingImages: 'Compressing and analyzing images...',
  },
};

export function t(key: keyof typeof TRANSLATIONS['ru'], lang: LanguageCode = 'ru', params?: Record<string, string | number>): string {
  let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['ru'][key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return text;
}
