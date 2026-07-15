export interface PosterActions {
  init(): void;
  destroy(): void;
  copyText(text: string): Promise<boolean>;
  exportPng(blob: Blob, filename: string): Promise<PosterExportOutcome>;
}

export type PosterExportOutcome = 'downloaded' | 'shared' | 'cancelled' | 'unavailable' | 'failed';

interface DownloadLink {
  download: string;
  href: string;
  click(): void;
}

interface BrowserActionsEnvironment {
  clipboard?: Pick<Clipboard, 'writeText'>;
  getClipboard?(): Pick<Clipboard, 'writeText'> | undefined;
  createDownloadLink(): DownloadLink;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

const defaultEnvironment = (): BrowserActionsEnvironment => ({
  getClipboard: () => navigator.clipboard,
  createDownloadLink: () => document.createElement('a'),
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
});

/** Browser-only fallbacks; a future optional host bridge can implement the same interface. */
export const createBrowserPosterActions = (
  environment: BrowserActionsEnvironment = defaultEnvironment(),
): PosterActions => ({
  init() {},
  destroy() {},
  async copyText(text) {
    const clipboard = environment.getClipboard?.() ?? environment.clipboard;
    if (!clipboard) return false;

    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
  exportPng(blob, filename) {
    let url: string | undefined;

    try {
      url = environment.createObjectURL(blob);
      const link = environment.createDownloadLink();
      link.download = filename;
      link.href = url;
      link.click();
      return Promise.resolve('downloaded');
    } catch {
      return Promise.resolve('failed');
    } finally {
      if (url) environment.revokeObjectURL(url);
    }
  },
});
