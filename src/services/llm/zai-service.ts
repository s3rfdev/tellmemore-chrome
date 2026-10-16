/**
 * @file src/services/llm/zai-service.ts
 * @description Z-AI (Zhipu AI GLM) provider implementation using their OpenAI-compatible endpoint.
 */

import { ILLMProvider, ChatAnalysis, CopilotPromptRequest } from '../../core/interfaces/llm-provider';
import { ChatMessage } from '../../core/entities/message';
import { PersonaGoals, LLMConfig } from '../../core/entities/settings';
import { renderPrompt } from '../../core/prompts/prompt-templates';

export class ZaiService implements ILLMProvider {
  readonly providerId = 'zai';

  constructor(private config: LLMConfig) {}

  private getEndpointUrl(): string {
    return this.config.endpointUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  }

  async generateText(request: CopilotPromptRequest): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Z-AI API key is not configured. Please set it in Settings.');
    }

    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push(...request.messages);

    const model = this.config.model || 'glm-4.5';

    const response = await fetch(this.getEndpointUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Z-AI API Error (${response.status}): ${errorText}`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response received from Z-AI.');
    }

    return content;
  }

  async streamText(request: CopilotPromptRequest, onChunk: (chunk: string) => void): Promise<string> {
    const text = await this.generateText(request);
    onChunk(text);
    return text;
  }

  async analyzeChat(
    messages: ChatMessage[],
    persona: PersonaGoals,
    customQuery?: string,
    promptTemplate?: string
  ): Promise<ChatAnalysis> {
    const conversationTranscript = messages
      .map((m) => `[${m.isOutgoing ? 'ME' : m.senderName || 'THEM'}]: ${m.text}`)
      .join('\n');

    const defaultTemplate = `
[TOP BREAD: УСТАНОВКИ]
Ты — переговорный советник. Защити пользователя от манипуляций и помоги достичь цели.
Пользователь: {{userName}} ({{userRole}}). Цели: {{communicationGoals}}. Тон: {{preferredTone}}.

[НАЧИНКА: ДИАЛОГ]
{{recentMessages}}

{{#if customQuery}}
Вопрос пользователя: "{{customQuery}}"
{{/if}}

[BOTTOM BREAD: ФОРМАТ JSON]
Верни ответ СТРОГО в формате валидного JSON (без markdown-обёртки):
{
  "situationSummary": "Краткая суть ситуации",
  "manipulationVerdict": {
    "isManipulative": true/false,
    "tacticsDetected": ["Манипуляция 1"],
    "riskScore": 60,
    "explanation": "Разбор тактики собеседника"
  },
  "interlocutorAnalysis": "Психологический портрет и скрытые мотивы собеседника",
  "suggestedReplies": [
    {
      "label": "Прямой",
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
`.trim();

    const prompt = renderPrompt(promptTemplate || defaultTemplate, {
      userName: persona.userName,
      userRole: persona.userRole,
      communicationGoals: persona.communicationGoals,
      preferredTone: persona.preferredTone,
      contactName: messages[0]?.senderName || 'Собеседник',
      contactNotes: '',
      contactGoals: '',
      recentMessages: conversationTranscript,
      customQuery,
    });

    const rawResponse = await this.generateText({
      systemPrompt: 'Ты возвращаешь только чистый JSON без markdown блоков.',
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
        interlocutorAnalysis: 'Анализ получен в текстовом формате.',
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
