/**
 * @file src/core/entities/thread.ts
 * @description Entities representing a chat conversation thread and contact profile.
 */

export interface ContactProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  notes?: string;
  personalityTraits?: string[];
  manipulationPatternsDetected?: string[];
}

export interface ChatThread {
  id: string;
  platform: 'facebook' | 'telegram' | 'whatsapp' | 'unknown';
  title: string;
  contact: ContactProfile;
  lastActiveTimestamp?: number;
  messageCount?: number;
}
