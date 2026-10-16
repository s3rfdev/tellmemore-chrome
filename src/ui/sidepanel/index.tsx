/**
 * @file src/ui/sidepanel/index.tsx
 * @description React mount for SidePanel Copilot window.
 */

import { createRoot } from 'react-dom/client';
import { CopilotApp } from './components/copilot-app';
import './sidepanel.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<CopilotApp />);
}
