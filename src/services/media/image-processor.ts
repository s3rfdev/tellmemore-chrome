/**
 * @file src/services/media/image-processor.ts
 * @description Image compression, hashing, and one-time Vision caching to avoid duplicate LLM calls.
 */

import { IChatRepository } from '../../core/interfaces/chat-repository';

export class ImageProcessor {
  constructor(private chatRepo: IChatRepository) {}

  /**
   * Generates a simple hash string for an image URL.
   */
  hashImageUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `img_hash_${Math.abs(hash)}`;
  }

  /**
   * Compresses an image element or URL to max 800px JPEG quality 0.7 using Canvas.
   */
  async compressImage(imageUrl: string, maxDimension = 800, quality = 0.7): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];

        resolve({ base64, mimeType: 'image/jpeg' });
      };

      img.onerror = (e) => reject(new Error(`Failed to load image for compression: ${e}`));
      img.src = imageUrl;
    });
  }

  /**
   * Processes an image attachment:
   * 1. Checks if already transcribed/summarized in IndexedDB cache.
   * 2. If not, compresses image and sends to Vision model.
   * 3. Saves summary to IndexedDB.
   */
  async getOrSummarizeImage(
    imageUrl: string,
    visionCallback: (compressedBase64: string, mimeType: string) => Promise<string>
  ): Promise<string> {
    const hash = this.hashImageUrl(imageUrl);

    // 1. Check cache
    const cachedSummary = await this.chatRepo.getCachedImageSummary(hash);
    if (cachedSummary) {
      return cachedSummary;
    }

    // 2. Compress image
    try {
      const { base64, mimeType } = await this.compressImage(imageUrl);

      // 3. Vision LLM call
      const summary = await visionCallback(base64, mimeType);

      // 4. Save to cache
      await this.chatRepo.setCachedImageSummary(hash, summary);

      return summary;
    } catch (err) {
      console.warn('[TellMeMore] Image processing fallback:', err);
      return '[Изображение не удалось проанализировать]';
    }
  }
}
