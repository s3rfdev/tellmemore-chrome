/**
 * @file src/adapters/adapter-registry.ts
 * @description Central registry of all supported messenger adapters.
 */

import { IMessengerAdapter } from '../core/interfaces/messenger-adapter';
import { FacebookAdapter } from './facebook/fb-adapter';

export class AdapterRegistry {
  private static adapters: IMessengerAdapter[] = [
    new FacebookAdapter(),
    // Future: new TelegramAdapter(), new WhatsAppAdapter()
  ];

  static registerAdapter(adapter: IMessengerAdapter): void {
    this.adapters.push(adapter);
  }

  static getAdapterForUrl(url: string): IMessengerAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.isSupported(url)) {
        return adapter;
      }
    }
    return null;
  }

  static getAllSupportedAdapters(): IMessengerAdapter[] {
    return [...this.adapters];
  }
}
