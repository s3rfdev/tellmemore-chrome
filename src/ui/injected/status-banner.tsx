/**
 * @file src/ui/injected/status-banner.tsx
 * @description Floating status banner informing user about message crawling and AI analysis.
 */

import React from 'react';

export interface StatusBannerProps {
  visible: boolean;
  current: number;
  target: number;
  statusText: string;
  onClose?: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  visible,
  current,
  target,
  statusText,
  onClose,
}) => {
  if (!visible) return null;

  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        backgroundColor: '#1e1b4b',
        color: '#ffffff',
        padding: '12px 20px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
        border: '1px solid #4338ca',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        minWidth: '320px',
        maxWidth: '480px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '13px',
      }}
    >
      {/* Animated Pulsing Ring */}
      <div
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: '#818cf8',
          boxShadow: '0 0 10px #818cf8',
          flexShrink: 0,
          animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 600 }}>
          <span>TellMeMore Copilot</span>
          <span style={{ color: '#a5b4fc' }}>{percent}%</span>
        </div>
        <div style={{ color: '#c7d2fe', fontSize: '12px', marginBottom: '6px' }}>{statusText}</div>
        {/* Progress bar */}
        <div
          style={{
            height: '4px',
            backgroundColor: '#312e81',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percent}%`,
              backgroundColor: '#6366f1',
              transition: 'width 0.2s ease-in-out',
            }}
          />
        </div>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#a5b4fc',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '14px',
          }}
          title="Скрыть"
        >
          ✕
        </button>
      )}
    </div>
  );
};
