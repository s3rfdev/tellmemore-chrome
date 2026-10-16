/**
 * @file src/services/llm/openai-service.ts
 * @description Provider for OpenAI, xAI (Grok), DeepSeek, Ollama, and any OpenAI-compatible endpoints.
 */

import { ILLMProvider, ChatAnalysis, CopilotPromptRequest } from '../../core/interfaces/llm-provider';
import { ChatMessage } from '../../core/entities/message';
import { PersonaGoals, LLMConfig } from '../../core/entities/settings';

export class OpenAIService implements ILLMProvider {
  readonly providerId: string;

  constructor(private config: LLMConfig) {
    this.providerId = config.provider;
  }

  private getEndpointUrl(): string {
    if (this.config.endpointUrl && this.config.endpointUrl.trim() !== '') {
      return this.config.endpointUrl;
    }
    if (this.config.provider === 'xai') {
      return 'https://api.x.ai/v1/chat/completions';
    }
    return 'https://api.openai.com/v1/chat/completions';
  }

  async generateText(request: CopilotPromptRequest): Promise<string> {
    if (!this.config.apiKey && this.config.provider !== 'custom_openai') {
      throw new Error(`API key for ${this.config.provider} is not configured.`);
    }

    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push(...request.messages);

    const model = this.config.model || (this.config.provider === 'xai' ? 'grok-beta' : 'gpt-4o-mini');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(this.getEndpointUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API Error (${response.status}): ${errorText}`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response received from LLM.');
    }

    return content;
  }

  async streamText(request: CopilotPromptRequest, onChunk: (chunk: string) => void): Promise<string> {
    const text = await this.generateText(request);
    onChunk(text);
    return text;
  }

  async analyzeChat(messages: ChatMessage[], persona: PersonaGoals, customQuery?: string): Promise<ChatAnalysis> {
    const conversationTranscript = messages
      .map((m) => `[${m.isOutgoing ? 'ME' : m.senderName || 'THEM'}]: ${m.text}`)
      .join('\n');

    const prompt = `
Ты — элитный переговорный стратег и психологический советник.
Твоя задача — провести глубокий анализ диалога с собеседником для пользователя, защитить его от манипуляций и подготовить стратегический ход.

ДАННЫЕ О ПОЛЬЗОВАТЕЛЕ:
- Имя/Роль: ${persona.userName} (${persona.userRole})
- Цели в общении: ${persona.communicationGoals}
- Желаемый тон: ${persona.preferredTone}
${persona.customInstructions ? `- Особые инструкции: ${persona.customInstructions}` : ''}

${customQuery ? `ДОПОЛНИТЕЛЬНЫЙ ВОПРОС ПОЛЬЗОВАТЕЛЯ: "${customQuery}"\n` : ''}

ДИАЛОГ (последние ${messages.length} сообщений):
${conversationTranscript}

Сформируй ответ СТРОГО в формате валидного JSON со следующей структурой (без markdown-обёртки \`\`\`json):
{
  "situationSummary": "Краткая суть ситуации",
  "manipulationVerdict": {
    "isManipulative": true/false,
    "tacticsDetected": ["Манипуляция 1"],
    "riskScore": 60,
    "explanation": "Подробный разбор тактики собеседника"
  },
  "interlocutorAnalysis": "Психологический анализ собеседника и его скрытые мотивы",
  "suggestedReplies": [
    {
      "label": "Прямой и решительный",
      "text": "Текст ответа...",
      "strategicGoal": "Цель этого ответа"
    },
    {
      "label": "Дипломатичный",
      "text": "Текст ответа...",
      "strategicGoal": "Цель этого ответа"
    }
  ]
}
`;

    const rawResponse = await this.generateText({
      systemPrompt: 'Ты возвращаешь только чистый JSON без оформления.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    try {
      const cleanJson = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanJson);
    } catch {
      return {
        situationSummary: rawResponse.slice(0, 300),
        manipulationVerdict: {
          isManipulative: false,
          tacticsDetected: [],
          riskScore: 0,
          explanation: rawResponse,
        },
        interlocutorAnalysis: 'Анализ получен в текстовом виде.',
        suggestedReplies: [
          {
            label: 'Вариант ответа',
            text: rawResponse,
            strategicGoal: 'Общий ответ',
          },
        ],
      };
    }
  }
}
