/**
 * @file src/ui/injected/quick-menu.tsx
 * @description Quick action popover menu mounted alongside the AI button.
 */

import React from 'react';

export interface QuickMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAutoReply: () => void;
  onVoiceDictate: () => void;
  onOpenCopilot: () => void;
  isRecording?: boolean;
  recordingSeconds?: number;
}

export const QuickMenu: React.FC<QuickMenuProps> = ({
  isOpen,
  onClose,
  onAutoReply,
  onVoiceDictate,
  onOpenCopilot,
  isRecording = false,
  recordingSeconds = 0,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '48px',
        right: '0',
        zIndex: 999998,
        backgroundColor: '#18181b',
        color: '#f4f4f5',
        borderRadius: '14px',
        padding: '8px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        border: '1px solid #3f3f46',
        width: '270px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          fontWeight: 600,
          color: '#a1a1aa',
          borderBottom: '1px solid #27272a',
          marginBottom: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>TellMeMore Copilot</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '13px' }}
        >
          ✕
        </button>
      </div>

      {/* Action 1: Auto-reply */}
      <button
        onClick={() => {
          onClose();
          onAutoReply();
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: 'transparent',
          color: '#f4f4f5',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#27272a')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ fontSize: '18px' }}>⚡</span>
        <div>
          <div style={{ fontWeight: 600 }}>Автоответ (Анализ)</div>
          <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Оценка чата и варианты ответа</div>
        </div>
      </button>

      {/* Action 2: Voice Dictate */}
      <button
        onClick={onVoiceDictate}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: isRecording ? '#450a0a' : 'transparent',
          color: isRecording ? '#f87171' : '#f4f4f5',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!isRecording) e.currentTarget.style.backgroundColor = '#27272a';
        }}
        onMouseLeave={(e) => {
          if (!isRecording) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span style={{ fontSize: '18px' }}>{isRecording ? '🔴' : '🎙️'}</span>
        <div>
          <div style={{ fontWeight: 600 }}>
            {isRecording ? `Запись... (${recordingSeconds}с) [Клик чтобы остановить]` : 'Надиктовать мысль'}
          </div>
          <div style={{ fontSize: '11px', color: isRecording ? '#fca5a5' : '#a1a1aa' }}>
            {isRecording ? 'Транскрибируем и сформулируем ответ' : 'Превратить голос в идеальный текст'}
          </div>
        </div>
      </button>

      {/* Action 3: Open Copilot Side Panel */}
      <button
        onClick={() => {
          onClose();
          onOpenCopilot();
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: 'transparent',
          color: '#f4f4f5',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#27272a')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ fontSize: '18px' }}>🧠</span>
        <div>
          <div style={{ fontWeight: 600 }}>Открыть Копилот</div>
          <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Диалог и RAG-стратегия в боковой панели</div>
        </div>
      </button>

      {/* Action 4: Settings */}
      <button
        onClick={() => {
          onClose();
          onOpenCopilot();
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: 'transparent',
          color: '#a5b4fc',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.15s',
          borderTop: '1px solid #27272a',
          marginTop: '4px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#27272a')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ fontSize: '18px' }}>⚙️</span>
        <div>
          <div style={{ fontWeight: 600 }}>Настройки (Ключи & Модели)</div>
          <div style={{ fontSize: '11px', color: '#818cf8' }}>Выбор LLM, Gemini 3.7, Z-AI, промпты</div>
        </div>
      </button>
    </div>
  );
};
