/**
 * @file src/ui/popup/index.tsx
 * @description React mount for Popup Settings window.
 */

import { createRoot } from 'react-dom/client';
import { SettingsApp } from './components/settings-app';
import './popup.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<SettingsApp />);
}
