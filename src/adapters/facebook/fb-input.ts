/**
 * @file src/adapters/facebook/fb-input.ts
 * @description Safe text insertion into Facebook's Lexical / Draft.js contenteditable inputs.
 */

export class FacebookInputManager {
  static insertText(inputElement: HTMLElement, text: string): boolean {
    try {
      inputElement.focus();

      // Place cursor at the end of the input
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputElement);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);

      // 1. Try modern InputEvent 'insertText' (Supported by Lexical)
      const inputEvent = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      });

      const handled = !inputElement.dispatchEvent(inputEvent);

      // 2. Use document.execCommand as solid fallback for contenteditable
      if (!handled) {
        document.execCommand('insertText', false, text);
      }

      // 3. Dispatch trailing input event to notify state managers
      inputElement.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text,
        })
      );

      return true;
    } catch (error) {
      console.error('[TellMeMore] Error inserting text into Facebook input:', error);
      return false;
    }
  }
}
