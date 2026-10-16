/**
 * @file src/services/llm/model-discovery.ts
 * @description Dynamic fetching of available active models from provider APIs.
 */

export class ModelDiscoveryService {
  /**
   * Fetches active models for Google Gemini.
   */
  static async fetchGeminiModels(apiKey: string): Promise<string[]> {
    if (!apiKey) throw new Error('API key is required to fetch Gemini models.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to fetch Gemini models (${response.status}): ${err}`);
    }

    const data = await response.json();
    const models: string[] = [];

    if (Array.isArray(data.models)) {
      for (const m of data.models) {
        if (
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
        ) {
          const cleanName = m.name.replace(/^models\//, '');
          models.push(cleanName);
        }
      }
    }

    // Sort to prioritize latest flash and pro models
    models.sort((a, b) => {
      if (a.includes('3.7') || a.includes('3.5')) return -1;
      if (b.includes('3.7') || b.includes('3.5')) return 1;
      return a.localeCompare(b);
    });

    return models;
  }

  /**
   * Fetches active models for Z-AI (Zhipu AI).
   */
  static async fetchZAIModels(apiKey: string): Promise<string[]> {
    if (!apiKey) throw new Error('API key is required to fetch Z-AI models.');

    const url = 'https://open.bigmodel.cn/api/paas/v4/models';
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to fetch Z-AI models (${response.status}): ${err}`);
    }

    const data = await response.json();
    const models: string[] = [];

    if (Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item.id) {
          models.push(item.id);
        }
      }
    }

    return models;
  }

  /**
   * Fetches models for OpenAI or OpenAI-compatible endpoints.
   */
  static async fetchOpenAIModels(apiKey: string, endpointUrl?: string): Promise<string[]> {
    const baseUrl = endpointUrl
      ? endpointUrl.replace(/\/chat\/completions$/, '/models')
      : 'https://api.openai.com/v1/models';

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(baseUrl, { headers });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to fetch models (${response.status}): ${err}`);
    }

    const data = await response.json();
    const models: string[] = [];

    if (Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item.id) {
          models.push(item.id);
        }
      }
    }

    return models.sort();
  }
}
