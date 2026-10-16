/**
 * @file src/adapters/telegram/tg-input.ts
 * @description Safe draft injection into Telegram Web's rich text contenteditable editor.
 */

export class TelegramInputManager {
  /**
   * Safely inserts draft text into Telegram Web's contenteditable editor.
   */
  static insertText(inputEl: HTMLElement, text: string): boolean {
    try {
      inputEl.focus();

      // Clear existing selection and select all in the input
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Primary approach: document.execCommand('insertText') preserves Telegram's internal React/Angular state
      const success = document.execCommand('insertText', false, text);

      if (!success) {
        // Fallback: direct text assignment with synthetic InputEvent
        inputEl.textContent = text;
        inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: text }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      }

      console.log(`[TellMeMore:TGInput] ✍️ Injected draft text (${text.length} chars) into Telegram editor.`);
      return true;
    } catch (err) {
      console.error('[TellMeMore:TGInput] ❌ Failed to insert text into Telegram editor:', err);
      return false;
    }
  }
}
