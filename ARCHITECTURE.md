# TellMeMore Chrome Extension — Архитектура и База Знаний

Единый реестр архитектуры, слоёв, файлов и функций проекта TellMeMore.

---

## 1. Архитектурные принципы (SOLID & Clean Architecture)

1. **Single Responsibility (SRP):** Каждый модуль решает одну конкретную задачу (краулинг DOM, транскрибация, вызов LLM, рендеринг баннера).
2. **Open/Closed (OCP):** Добавление нового мессенджера (Telegram, WhatsApp) происходит через реализацию интерфейса `IMessengerAdapter` без правки ядра.
3. **Liskov Substitution (LSP):** Любой мессенджер-адаптер взаимозаменяем в `AdapterRegistry`.
4. **Interface Segregation (ISP):** Узкие интерфейсы: `IMessengerAdapter`, `ILLMProvider`, `ISTTProvider`, `IChatRepository`.
5. **Dependency Inversion (DIP):** UI и бизнес-логика зависят от абстракций (интерфейсов), а не от конкретных реализаций API или селекторов Facebook.
6. **Shadow DOM Encapsulation:** Любой инжектируемый UI изолирован от глобальных стилей страницы мессенджера.
7. **CORS Isolation:** Все запросы к внешним API (Gemini, OpenAI, Groq) выполняются строго через Background Service Worker.

---

## 2. Структура директорий

```
tellmemore_chrome/
├── ARCHITECTURE.md                  # Данная База Знаний (реестр файлов и функций)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── manifest.json                    # Chrome Extension Manifest V3
│
├── src/
│   ├── core/                        # Слой Domain / Абстракции (не зависит от внешних библиотек)
│   │   ├── entities/                # Доменные сущности (типы данных)
│   │   │   ├── message.ts           # ChatMessage, MessageAuthor, MediaAttachment
│   │   │   ├── settings.ts          # UserSettings, LLMConfig, STTConfig, PersonaGoals
│   │   │   └── thread.ts            # ChatThread, ContactProfile
│   │   └── interfaces/              # Контракты (интерфейсы)
│   │       ├── messenger-adapter.ts # IMessengerAdapter
│   │       ├── llm-provider.ts      # ILLMProvider, LLMResponse, StreamHandler
│   │       ├── stt-provider.ts      # ISTTProvider, AudioTranscribeRequest
│   │       └── chat-repository.ts   # IChatRepository, IMediaCacheRepository
│   │
│   ├── adapters/                    # Слой адаптеров конкретных мессенджеров
│   │   ├── adapter-registry.ts      # Регистратор и автодетектор активного мессенджера
│   │   └── facebook/                # Адаптер для Facebook Messenger
│   │       ├── fb-selectors.ts      # Селекторы DOM (с версионированием и fallback)
│   │       ├── fb-detector.ts       # Определение страницы/дока чата
│   │       ├── fb-crawler.ts        # Инкрементальный сборщик сообщений и скроллер
│   │       ├── fb-input.ts          # Безопасный инжектор текста (Lexical/Draft.js)
│   │       └── fb-adapter.ts        # Реализация IMessengerAdapter
│   │
│   ├── services/                    # Сервисный слой (реализация бизнес-логики и внешних API)
│   │   ├── llm/                     # Интеграции с нейросетями
│   │   │   ├── gemini-service.ts    # Google Gemini API (Flash/Pro)
│   │   │   ├── openai-service.ts    # OpenAI-совместимый API (OpenAI, Grok, DeepSeek, Ollama)
│   │   │   └── llm-factory.ts       # Фабрика провайдеров
│   │   ├── stt/                     # Сервисы транскрибации речи
│   │   │   ├── groq-whisper-service.ts # Быстрый Whisper через Groq API
│   │   │   └── stt-factory.ts       # Фабрика транскрибаторов
│   │   ├── storage/                 # Локальная база данных
│   │   │   ├── idb-schema.ts        # Схема IndexedDB (таблицы: messages, threads, cache)
│   │   │   └── chat-repository.ts   # Реализация IChatRepository
│   │   └── audio/                   # Запись звука
│   │       └── audio-recorder.ts    # Запись с микрофона через MediaRecorder API
│   │
│   ├── background/                  # Background Service Worker
│   │   ├── index.ts                 # Главная точка входа воркера
│   │   └── message-router.ts        # Маршрутизатор сообщений (Content <-> Worker <-> SidePanel)
│   │
│   ├── content/                     # Content Scripts (выполняются на страницах мессенджеров)
│   │   ├── index.ts                 # Точка входа контент-скрипта
│   │   └── shadow-root-manager.ts   # Менеджер изолированных контейнеров Shadow DOM
│   │
│   └── ui/                          # Пользовательский интерфейс (React + Tailwind)
│       ├── injected/                # UI, монтируемый в чат Facebook
│       │   ├── ai-button.tsx        # Кнопка ✨ AI у поля ввода
│       │   ├── quick-menu.tsx       # Выпадающее меню быстрых действий
│       │   └── status-banner.tsx    # Баннер прогресса («Загрузка 50 сообщений...»)
│       ├── sidepanel/               # Полноценная боковая панель Копилота
│       │   ├── sidepanel.html
│       │   ├── index.tsx
│       │   ├── components/
│       │   │   ├── copilot-header.tsx
│       │   │   ├── chat-feed.tsx
│       │   │   ├── prompt-input.tsx
│       │   │   └── persona-card.tsx
│       │   └── sidepanel.css
│       └── popup/                   # Всплывающее окно настроек расширения
│           ├── popup.html
│           ├── index.tsx
│           ├── components/
│           │   ├── api-keys-form.tsx
│           │   ├── model-picker.tsx
│           │   └── persona-goals-form.tsx
│           └── popup.css
```

---

## 3. Реестр компонентов и функций

*(Пополняется при добавлении каждого модуля)*

### `src/core/entities/message.ts`
* `ChatMessage`: Сущность сообщения (`id`, `threadId`, `senderName`, `text`, `timestamp`, `isOutgoing`, `attachments[]`).
* `MediaAttachment`: Прикреплённый медиафайл (`id`, `type`: `'image' | 'audio' | 'voice'`, `url`, `transcription?`, `summary?`).

### `src/core/entities/settings.ts`
* `UserSettings`: Конфигурация расширения (`activeLLM`, `activeSTT`, `persona`, `defaultCrawlDepth`).
* `PersonaGoals`: Данные о пользователе и целях общения (`userName`, `userRole`, `communicationGoals`, `preferredTone`, `customInstructions`).
* `DEFAULT_USER_SETTINGS`: Значения по умолчанию.

### `src/core/interfaces/messenger-adapter.ts`
* `IMessengerAdapter`:
  * `isSupported(url: string): boolean`
  * `getThreadInfo(): ChatThread | null`
  * `findInputContainer(): HTMLElement | null`
  * `findMessagesContainer(): HTMLElement | null`
  * `crawlMessages(depth: number, onProgress?: CrawlProgressCallback): Promise<ChatMessage[]>`
  * `insertMessageText(text: string): Promise<boolean>`
  * `observeNewMessages(onNewMessage: (msg: ChatMessage) => void): () => void`

### `src/core/interfaces/llm-provider.ts`
* `ILLMProvider`: `generateText()`, `streamText()`, `analyzeChat()`.
* `ChatAnalysis`: Результат анализа (`situationSummary`, `manipulationVerdict`, `interlocutorAnalysis`, `suggestedReplies[]`).

### `src/core/interfaces/stt-provider.ts`
* `ISTTProvider`: `transcribeAudio(audioBlob, language)`.

### `src/core/interfaces/chat-repository.ts`
* `IChatRepository`: `upsertMessages()`, `getMessages()`, `saveThread()`, `getThread()`, `getCachedTranscription()`, `setCachedTranscription()`.
* `ISettingsRepository`: `getSettings()`, `saveSettings()`.

### `src/infra/messaging/message-types.ts`
* Протокол сообщений: `GET_SETTINGS`, `SAVE_SETTINGS`, `ANALYZE_CHAT`, `TRANSCRIBE_AUDIO`, `GET_CURRENT_THREAD`, `REQUEST_CRAWL_MESSAGES`, `INSERT_DRAFT_TO_CHAT`, `OPEN_SIDEPANEL`.

### `src/services/storage/idb-schema.ts` & `chat-repository.ts`
* `IndexedDBChatRepository`: Локальная база сообщений, тредов, контактов и кэша медиа.
* `ChromeStorageSettingsRepository`: Сохранение настроек в `chrome.storage.local`.

### `src/services/llm/`
* `GeminiService`: Прямой вызов Google Gemini API с валидацией structured JSON.
* `OpenAIService`: Универсальный клиент для OpenAI, xAI (Grok), DeepSeek и локальных моделей.
* `LLMFactory`: Фабрика активного провайдера.

### `src/services/stt/`
* `GroqWhisperService`: Транскрибация речи через Groq Whisper / OpenAI Whisper.
* `STTFactory`: Фабрика провайдеров транскрибации.

### `src/services/audio/audio-recorder.ts`
* `AudioRecorderService`: Запись звука с микрофона пользователя через `MediaRecorder`.

### `src/adapters/facebook/`
* `fb-selectors.ts`: Отказоустойчивые селекторы Facebook (инпуты, контейнеры, строки сообщений, заголовки).
* `fb-detector.ts`: Определение страницы (`facebook.com`, `messenger.com`, док-чат), извлечение ID треда и имени контакта.
* `fb-crawler.ts`: Сбор сообщений из DOM, определение исходящих/входящих, плавный скролл с обратным восстановлением позиции.
* `fb-input.ts`: Безопасная вставка текста в React / Lexical / Draft.js редактор через `InputEvent` и `document.execCommand`.
* `fb-adapter.ts`: Реализация `IMessengerAdapter` для Facebook.

### `src/content/`
* `shadow-root-manager.ts`: Монтирование React-компонентов в изолированный Shadow Root.
* `index.ts`: Точка входа контент-скрипта, автодетектор адаптера, отслеживание появления новых сообщений в реальном времени.

### `src/background/`
* `message-router.ts`: Обработка запросов к LLM/STT без CORS, управление Side Panel.
* `index.ts`: Точка входа сервис-воркера.

### `src/ui/injected/`
* `status-banner.tsx`: Плавающий баннер прогресса («Загрузка 50 сообщений...»).
* `ai-button.tsx`: Кнопка ✨ AI у инпута.
* `quick-menu.tsx`: Всплывающее меню быстрых действий (Автоответ, Надиктовать мысль, Открыть Копилот).
* `injected-overlay.tsx`: Главный контейнер инжектируемого интерфейса.

### `src/ui/popup/`
* `settings-app.tsx`: Окно настроек (API ключи Gemini/OpenAI/Groq, персона, цели, глубина сбора).

### `src/ui/sidepanel/`
* `copilot-app.tsx`: Боковая панель Chrome Side Panel с карточкой анализа манипуляций, рекомендациями ответов с кнопкой «Вставить в чат» и свободным диалогом с AI (текстом и голосом).
