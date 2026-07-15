export interface PosterActions {
  copyText(text: string): Promise<boolean>;
  downloadFile(blob: Blob, filename: string): boolean;
}

interface DownloadLink {
  download: string;
  href: string;
  click(): void;
}

interface BrowserActionsEnvironment {
  clipboard?: Pick<Clipboard, 'writeText'>;
  createDownloadLink(): DownloadLink;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

const defaultEnvironment = (): BrowserActionsEnvironment => ({
  clipboard: navigator.clipboard,
  createDownloadLink: () => document.createElement('a'),
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
});

/** Browser-only fallbacks; a future optional host bridge can implement the same interface. */
export const createBrowserPosterActions = (
  environment: BrowserActionsEnvironment = defaultEnvironment(),
): PosterActions => ({
  async copyText(text) {
    if (!environment.clipboard) return false;

    try {
      await environment.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
  downloadFile(blob, filename) {
    let url: string | undefined;

    try {
      url = environment.createObjectURL(blob);
      const link = environment.createDownloadLink();
      link.download = filename;
      link.href = url;
      link.click();
      return true;
    } catch {
      return false;
    } finally {
      if (url) environment.revokeObjectURL(url);
    }
  },
});
