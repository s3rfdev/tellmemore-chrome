/**
 * @file src/services/llm/gemini-service.ts
 * @description Google Gemini API provider implementation (Gemini 2.5/1.5 Flash/Pro).
 */

import { ILLMProvider, ChatAnalysis, CopilotPromptRequest } from '../../core/interfaces/llm-provider';
import { ChatMessage } from '../../core/entities/message';
import { PersonaGoals, LLMConfig } from '../../core/entities/settings';

export class GeminiService implements ILLMProvider {
  readonly providerId = 'gemini';

  constructor(private config: LLMConfig) {}

  private getEndpointUrl(): string {
    const model = this.config.model || 'gemini-2.5-flash';
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;
  }

  async generateText(request: CopilotPromptRequest): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Gemini API key is not configured. Please set it in TellMeMore extension settings.');
    }

    const contents = request.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
      },
    };

    if (request.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: request.systemPrompt }],
      };
    }

    const response = await fetch(this.getEndpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    const json = await response.json();
    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Empty response received from Gemini.');
    }

    return text;
  }

  async streamText(request: CopilotPromptRequest, onChunk: (chunk: string) => void): Promise<string> {
    const model = this.config.model || 'gemini-3.7-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`;

    const contents = request.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
      },
    };

    if (request.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: request.systemPrompt }],
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        const fallback = await this.generateText(request);
        onChunk(fallback);
        return fallback;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr) {
              try {
                const data = JSON.parse(jsonStr);
                const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (chunk) {
                  fullText += chunk;
                  onChunk(chunk);
                }
              } catch {
                // Ignore parse errors on sse frames
              }
            }
          }
        }
      }

      return fullText || (await this.generateText(request));
    } catch {
      const fallback = await this.generateText(request);
      onChunk(fallback);
      return fallback;
    }
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
  "situationSummary": "Краткая суть того, что сейчас происходит в диалоге (2-3 предложения)",
  "manipulationVerdict": {
    "isManipulative": true/false,
    "tacticsDetected": ["Название манипуляции 1", "Название 2"],
    "riskScore": 75,
    "explanation": "Подробное объяснение, где и как собеседник пытается давить/манипулировать или почему всё чисто"
  },
  "interlocutorAnalysis": "Психологический портрет собеседника в моменте: скрытые мотивы, истинный интерес, страхи или эмоциональное состояние",
  "suggestedReplies": [
    {
      "label": "Прямой и решительный",
      "text": "Текст ответа от первого лица...",
      "strategicGoal": "Зачем отвечать именно так"
    },
    {
      "label": "Дипломатичный",
      "text": "Текст ответа...",
      "strategicGoal": "Зачем отвечать именно так"
    },
    {
      "label": "Уточняющий/Перехват инициативы",
      "text": "Текст ответа...",
      "strategicGoal": "Зачем отвечать именно так"
    }
  ]
}
`;

    const rawResponse = await this.generateText({
      systemPrompt: 'Ты возвращаешь только чистый JSON без лишних преамбул.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    try {
      const cleanJson = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanJson);
    } catch {
      // Fallback structured result if JSON parsing fails
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
            label: 'Сгенерированный ответ',
            text: rawResponse,
            strategicGoal: 'Общий ответ',
          },
        ],
      };
    }
  }
}
