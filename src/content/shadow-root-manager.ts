/**
 * @file src/content/shadow-root-manager.ts
 * @description Injects UI into third-party messenger DOM inside an isolated Shadow DOM.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { InjectedOverlay } from '../ui/injected/injected-overlay';
import { IMessengerAdapter } from '../core/interfaces/messenger-adapter';

export class ShadowRootManager {
  private static hostElement: HTMLElement | null = null;
  private static shadowRoot: ShadowRoot | null = null;
  private static reactRoot: Root | null = null;

  static mount(adapter: IMessengerAdapter, targetContainer: HTMLElement): void {
    // If already mounted inside this container, avoid duplicate
    if (this.hostElement && targetContainer.contains(this.hostElement)) {
      return;
    }

    this.unmount();

    this.hostElement = document.createElement('div');
    this.hostElement.id = 'tellmemore-shadow-host';
    this.hostElement.style.display = 'inline-flex';
    this.hostElement.style.alignItems = 'center';
    this.hostElement.style.zIndex = '999990';

    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    // Container for React
    const appContainer = document.createElement('div');
    appContainer.id = 'tellmemore-app-container';
    this.shadowRoot.appendChild(appContainer);

    this.reactRoot = createRoot(appContainer);
    this.reactRoot.render(React.createElement(InjectedOverlay, { adapter }));

    // Append to target container
    targetContainer.appendChild(this.hostElement);
  }

  static unmount(): void {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
    if (this.hostElement && this.hostElement.parentElement) {
      this.hostElement.parentElement.removeChild(this.hostElement);
      this.hostElement = null;
    }
    this.shadowRoot = null;
  }
}
