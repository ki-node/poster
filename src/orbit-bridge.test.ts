import { describe, expect, it, vi } from 'vitest';

import type { PosterActions } from './browser-actions';
import {
  createEmbeddedPosterActions,
  ORBIT_BRIDGE_CHANNEL,
  ORBIT_BRIDGE_VERSION,
  POSTER_PROJECT_ID,
  type PosterFileExportMessage,
} from './orbit-bridge';

const createHarness = () => {
  const target = new EventTarget() as EventTarget & Window;
  target.setTimeout = setTimeout;
  target.clearTimeout = clearTimeout;
  const parentWindow = { postMessage: vi.fn() };
  const destroyBrowserActions = vi.fn();
  const browserActions: PosterActions = {
    init: vi.fn(),
    destroy: destroyBrowserActions,
    copyText: vi.fn().mockResolvedValue(true),
    exportPng: vi.fn().mockResolvedValue('downloaded'),
  };
  const actions = createEmbeddedPosterActions({
    targetWindow: target,
    parentWindow: parentWindow as unknown as Pick<Window, 'postMessage'>,
    createRequestId: () => 'export-1',
    responseTimeoutMs: 1_000,
    browserActions,
  });
  const dispatch = (data: unknown, source: unknown = parentWindow) => {
    const event = new Event('message');
    Object.defineProperties(event, {
      data: { value: data },
      source: { value: source },
    });
    target.dispatchEvent(event);
  };

  return { actions, destroyBrowserActions, dispatch, parentWindow };
};

const hostReady = {
  channel: ORBIT_BRIDGE_CHANNEL,
  version: ORBIT_BRIDGE_VERSION,
  projectId: POSTER_PROJECT_ID,
  type: 'host-ready',
  capabilities: ['file-export'],
} as const;

describe('Orbit poster export adapter', () => {
  it('announces itself and sends one transferable binary export to a verified host', async () => {
    const { actions, dispatch, parentWindow } = createHarness();
    actions.init();
    dispatch(hostReady);

    const result = actions.exportPng(new Blob(['png'], { type: 'image/png' }), 'poster.png');
    await vi.waitFor(() => expect(parentWindow.postMessage).toHaveBeenCalledTimes(2));
    const [message, origin, transfer] = parentWindow.postMessage.mock.calls[1] as [
      PosterFileExportMessage,
      string,
      ArrayBuffer[],
    ];
    expect(message).toMatchObject({
      channel: ORBIT_BRIDGE_CHANNEL,
      version: ORBIT_BRIDGE_VERSION,
      projectId: POSTER_PROJECT_ID,
      type: 'file-export',
      requestId: 'export-1',
      filename: 'poster.png',
      mimeType: 'image/png',
      size: 3,
    });
    expect(message.data).toBeInstanceOf(ArrayBuffer);
    expect(origin).toBe('*');
    expect(transfer).toEqual([message.data]);

    dispatch({
      channel: ORBIT_BRIDGE_CHANNEL,
      version: ORBIT_BRIDGE_VERSION,
      projectId: POSTER_PROJECT_ID,
      type: 'file-export-result',
      requestId: 'export-1',
      status: 'shared',
    });
    await expect(result).resolves.toBe('shared');
  });

  it('never falls back to iframe navigation when no host is available', async () => {
    const { actions, parentWindow } = createHarness();
    actions.init();

    await expect(
      actions.exportPng(new Blob(['png'], { type: 'image/png' }), 'poster.png'),
    ).resolves.toBe('unavailable');
    expect(parentWindow.postMessage).toHaveBeenCalledOnce();
  });

  it('rejects foreign readiness and handles binary conversion failures', async () => {
    const { actions, dispatch, parentWindow } = createHarness();
    actions.init();
    dispatch(hostReady, { postMessage() {} });
    await expect(
      actions.exportPng(new Blob(['png'], { type: 'image/png' }), 'poster.png'),
    ).resolves.toBe('unavailable');

    dispatch(hostReady);
    const invalidBlob = new Blob(['png'], { type: 'image/png' });
    Object.defineProperty(invalidBlob, 'arrayBuffer', {
      value: () => Promise.reject(new Error('broken blob')),
    });
    await expect(actions.exportPng(invalidBlob, 'poster.png')).resolves.toBe('failed');
    expect(parentWindow.postMessage).toHaveBeenCalledTimes(1);
  });

  it('cleans up listeners and pending exports on destroy', async () => {
    const { actions, destroyBrowserActions, dispatch, parentWindow } = createHarness();
    actions.init();
    dispatch(hostReady);
    const result = actions.exportPng(new Blob(['png'], { type: 'image/png' }), 'poster.png');
    await vi.waitFor(() => expect(parentWindow.postMessage).toHaveBeenCalledTimes(2));

    actions.destroy();
    await expect(result).resolves.toBe('failed');
    expect(destroyBrowserActions).toHaveBeenCalledOnce();
    dispatch(hostReady);
    await expect(
      actions.exportPng(new Blob(['png'], { type: 'image/png' }), 'poster.png'),
    ).resolves.toBe('unavailable');
  });
});
