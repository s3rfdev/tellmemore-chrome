/**
 * @file src/infra/messaging/tab-messenger.ts
 * @description Safe communication with content scripts with automatic injection fallback.
 * Solves: "Could not establish connection. Receiving end does not exist."
 */

export async function sendTabMessageWithFallback<T, R>(tabId: number, message: T): Promise<R> {
  // Check tab URL first
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Расширение работает только на веб-страницах мессенджеров (Facebook / Messenger). Откройте вкладку с чатом.');
    }
  } catch (e) {
    if ((e as Error).message.includes('Расширение работает')) throw e;
  }

  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err: unknown) {
    const errMsg = (err as Error)?.message || '';
    if (
      errMsg.includes('Receiving end does not exist') ||
      errMsg.includes('Could not establish connection')
    ) {
      console.log('[TellMeMore] Content script not active on tab, attempting programmatic injection...');

      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js'],
        });

        // Small delay for content script DOM listener setup
        await new Promise((res) => setTimeout(res, 200));

        // Retry sending the message
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (injectErr) {
        console.warn('[TellMeMore] Programmatic injection error:', injectErr);
        throw new Error(
          'TellMeMore не подключен к этой странице. Пожалуйста, перейдите на вкладку Facebook и обновите её (нажмите F5 или Cmd+R).'
        );
      }
    }

    throw err;
  }
}
