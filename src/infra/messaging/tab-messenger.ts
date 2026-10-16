/**
 * @file src/infra/messaging/tab-messenger.ts
 * @description Safe communication with content scripts with automatic injection fallback and strict timeouts.
 * Prevents UI freezes when content script hangs or page does not respond.
 */

function sendRawMessageWithTimeout<T, R>(tabId: number, message: T, timeoutMs = 8000): Promise<R> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(
          new Error(
            `[TellMeMore:Timeout] Вкладка #${tabId} не ответила за ${timeoutMs / 1000} сек. Обновите страницу Facebook (F5).`
          )
        );
      }
    }, timeoutMs);

    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);

        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          reject(new Error(lastErr.message || 'Ошибка связи с вкладкой'));
        } else {
          resolve(response as R);
        }
      });
    } catch (sendErr) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(sendErr);
      }
    }
  });
}

export async function sendTabMessageWithFallback<T, R>(
  tabId: number,
  message: T,
  timeoutMs = 8000
): Promise<R> {
  console.log(`[TellMeMore:TabMessenger] 📤 Sending message to tab #${tabId}:`, (message as any)?.type || message);

  // Check tab URL first
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Расширение работает только на веб-страницах мессенджеров (Telegram / Facebook). Откройте вкладку с чатом.');
    }
  } catch (e) {
    if ((e as Error).message.includes('Расширение работает')) throw e;
  }

  try {
    const response = await sendRawMessageWithTimeout<T, R>(tabId, message, timeoutMs);
    console.log(`[TellMeMore:TabMessenger] 📥 Received response from tab #${tabId}:`, response);
    return response;
  } catch (err: unknown) {
    const errMsg = (err as Error)?.message || '';
    if (
      errMsg.includes('Receiving end does not exist') ||
      errMsg.includes('Could not establish connection')
    ) {
      console.log('[TellMeMore:TabMessenger] 💉 Content script not active on tab, injecting content.js...');

      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js'],
        });

        // Small delay for content script DOM listener setup
        await new Promise((res) => setTimeout(res, 250));

        // Retry sending the message with timeout
        console.log(`[TellMeMore:TabMessenger] 🔁 Retrying message to tab #${tabId} after injection...`);
        const retryResp = await sendRawMessageWithTimeout<T, R>(tabId, message, timeoutMs);
        console.log(`[TellMeMore:TabMessenger] ✅ Retry succeeded for tab #${tabId}`);
        return retryResp;
      } catch (injectErr) {
        console.warn('[TellMeMore:TabMessenger] ❌ Programmatic injection error:', injectErr);
        throw new Error(
          'TellMeMore не подключен к этой странице. Пожалуйста, перейдите на вкладку Telegram или Facebook и обновите её (нажмите F5 или Cmd+R).'
        );
      }
    }

    throw err;
  }
}
