/**
 * @file src/ui/injected/ai-button.tsx
 * @description Injected AI button with glowing animation and quick-menu trigger.
 */

import React from 'react';

export interface AIButtonProps {
  onClick: () => void;
  isLoading?: boolean;
}

export const AIButton: React.FC<AIButtonProps> = ({ onClick, isLoading = false }) => {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', margin: '0 4px' }}>
      <button
        onClick={onClick}
        type="button"
        title="TellMeMore AI Copilot"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '18px',
          backgroundColor: '#4f46e5',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '12px',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.4)';
        }}
      >
        <span>{isLoading ? '⏳' : '✨'}</span>
        <span>AI</span>
      </button>
    </div>
  );
};
