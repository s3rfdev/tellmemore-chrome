/**
 * @file src/services/rag/rag-engine.ts
 * @description In-browser RAG engine for indexing long chat history (e.g. 300 messages) and building Sandwich prompts.
 */

import { ChatMessage } from '../../core/entities/message';
import { ContactProfile } from '../../core/entities/thread';
import { PersonaGoals } from '../../core/entities/settings';
import { renderPrompt, DEFAULT_PROMPT_TEMPLATES } from '../../core/prompts/prompt-templates';

export interface RAGChunk {
  id: string;
  threadId: string;
  startIndex: number;
  endIndex: number;
  text: string;
  keywords: string[];
}

export class RAGEngine {
  /**
   * Tokenizes and extracts keywords from text.
   */
  static extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  /**
   * Chunks a large message array (e.g. 100-300 messages) into searchable segments.
   */
  static chunkMessages(threadId: string, messages: ChatMessage[], chunkSize = 6): RAGChunk[] {
    const chunks: RAGChunk[] = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      const slice = messages.slice(i, i + chunkSize);
      const text = slice
        .map((m) => `[${m.isOutgoing ? 'ME' : m.senderName || 'THEM'}]: ${m.text}`)
        .join('\n');

      const keywords = this.extractKeywords(text);

      chunks.push({
        id: `chunk_${threadId}_${i}`,
        threadId,
        startIndex: i,
        endIndex: i + slice.length,
        text,
        keywords,
      });
    }

    return chunks;
  }

  /**
   * Retrieves the most relevant past chunks for a given search query or active conversation.
   */
  static retrieveRelevantChunks(chunks: RAGChunk[], query: string, topK = 3): RAGChunk[] {
    if (!query.trim() || chunks.length === 0) {
      return chunks.slice(0, topK);
    }

    const queryKeywords = new Set(this.extractKeywords(query));

    const scored = chunks.map((chunk) => {
      let score = 0;
      for (const kw of chunk.keywords) {
        if (queryKeywords.has(kw)) {
          score += 1;
        }
      }
      return { chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((s) => s.chunk);
  }

  /**
   * Constructs a full Sandwich Prompt combining Top Bread, RAG Filling, and Bottom Bread.
   */
  static buildSandwichPrompt(params: {
    persona: PersonaGoals;
    contact?: ContactProfile;
    allMessages: ChatMessage[];
    activeMessagesCount: number;
    customQuery?: string;
    language?: string;
    template?: string;
  }): string {
    const {
      persona,
      contact,
      allMessages,
      activeMessagesCount,
      customQuery,
      language = 'ru',
      template = DEFAULT_PROMPT_TEMPLATES.analysisPromptTemplate,
    } = params;

    // Split messages into historical (for RAG) and immediate active
    const activeMessages = allMessages.slice(-activeMessagesCount);
    const historicalMessages = allMessages.slice(0, -activeMessagesCount);

    let ragMemory = '';
    if (historicalMessages.length > 0) {
      const chunks = this.chunkMessages(contact?.id || 'thread', historicalMessages, 6);
      const queryContext = customQuery || activeMessages.map((m) => m.text).join(' ');
      const relevantChunks = this.retrieveRelevantChunks(chunks, queryContext, 3);
      ragMemory = relevantChunks.map((c) => c.text).join('\n---\n');
    }

    const recentTranscript = activeMessages
      .map((m) => `[${m.isOutgoing ? 'ME' : m.senderName || 'THEM'}]: ${m.text}`)
      .join('\n');

    return renderPrompt(template, {
      userName: persona.userName,
      userRole: persona.userRole,
      communicationGoals: persona.communicationGoals,
      preferredTone: persona.preferredTone,
      contactName: contact?.name || 'Собеседник',
      contactNotes: contact?.notes || 'Заметок пока нет.',
      contactGoals: contact?.notes || persona.communicationGoals,
      ragMemory,
      recentMessages: recentTranscript,
      customQuery,
      language,
    });
  }
}
