import { describe, expect, it, vi } from 'vitest';

import { createBrowserPosterActions } from './browser-actions';

const createEnvironment = () => {
  const link = { download: '', href: '', click: vi.fn() };
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
  const createObjectURL = vi.fn<() => string>().mockReturnValue('blob:poster');
  const revokeObjectURL = vi.fn();

  return {
    link,
    writeText,
    createObjectURL,
    revokeObjectURL,
    environment: {
      clipboard: { writeText },
      createDownloadLink: () => link,
      createObjectURL,
      revokeObjectURL,
    },
  };
};

describe('browser poster actions', () => {
  it('keeps clipboard as an optional browser fallback', async () => {
    const { environment, writeText } = createEnvironment();
    const actions = createBrowserPosterActions(environment);

    await expect(actions.copyText('SEED-42')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('SEED-42');
  });

  it('fails safely when clipboard or a future host bridge is unavailable', async () => {
    const { environment } = createEnvironment();
    const actions = createBrowserPosterActions({ ...environment, clipboard: undefined });

    await expect(actions.copyText('SEED-42')).resolves.toBe(false);
  });

  it('downloads a Blob with the normal browser API and always revokes its URL', async () => {
    const { environment, link, revokeObjectURL } = createEnvironment();
    const actions = createBrowserPosterActions(environment);
    const blob = new Blob(['poster'], { type: 'image/png' });

    await expect(actions.exportPng(blob, 'poster.png')).resolves.toBe('downloaded');
    expect(link.download).toBe('poster.png');
    expect(link.href).toBe('blob:poster');
    expect(link.click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:poster');
  });
});
