/**
 * @file src/adapters/adapter-registry.ts
 * @description Central registry of all supported messenger adapters.
 */

import { IMessengerAdapter } from '../core/interfaces/messenger-adapter';
import { FacebookAdapter } from './facebook/fb-adapter';
import { TelegramAdapter } from './telegram/tg-adapter';

export class AdapterRegistry {
  private static adapters: IMessengerAdapter[] = [
    new FacebookAdapter(),
    new TelegramAdapter(),
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
