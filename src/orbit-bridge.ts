import type { AppContext } from './app-context';
import {
  createBrowserPosterActions,
  type PosterActions,
  type PosterExportOutcome,
} from './browser-actions';

export const ORBIT_BRIDGE_CHANNEL = 'orbit-project-bridge';
export const ORBIT_BRIDGE_VERSION = 1;
export const POSTER_PROJECT_ID = 'poster';
export const POSTER_EXPORT_MIME_TYPE = 'image/png';

export interface PosterProjectReadyMessage {
  readonly channel: typeof ORBIT_BRIDGE_CHANNEL;
  readonly version: typeof ORBIT_BRIDGE_VERSION;
  readonly projectId: typeof POSTER_PROJECT_ID;
  readonly type: 'project-ready';
}

export interface PosterFileExportMessage {
  readonly channel: typeof ORBIT_BRIDGE_CHANNEL;
  readonly version: typeof ORBIT_BRIDGE_VERSION;
  readonly projectId: typeof POSTER_PROJECT_ID;
  readonly type: 'file-export';
  readonly requestId: string;
  readonly filename: string;
  readonly mimeType: typeof POSTER_EXPORT_MIME_TYPE;
  readonly size: number;
  readonly data: ArrayBuffer;
}

export interface PosterHostReadyMessage {
  readonly channel: typeof ORBIT_BRIDGE_CHANNEL;
  readonly version: typeof ORBIT_BRIDGE_VERSION;
  readonly projectId: typeof POSTER_PROJECT_ID;
  readonly type: 'host-ready';
  readonly capabilities: readonly ['file-export'];
}

export interface PosterFileExportResultMessage {
  readonly channel: typeof ORBIT_BRIDGE_CHANNEL;
  readonly version: typeof ORBIT_BRIDGE_VERSION;
  readonly projectId: typeof POSTER_PROJECT_ID;
  readonly type: 'file-export-result';
  readonly requestId: string;
  readonly status: 'shared' | 'cancelled' | 'error';
}

type OrbitHostMessage = PosterHostReadyMessage | PosterFileExportResultMessage;

interface EmbeddedPosterActionsEnvironment {
  readonly targetWindow: Window;
  readonly parentWindow: Pick<Window, 'postMessage'>;
  readonly createRequestId: () => string;
  readonly responseTimeoutMs: number;
  readonly browserActions: PosterActions;
}

const defaultEmbeddedEnvironment = (): EmbeddedPosterActionsEnvironment => ({
  targetWindow: window,
  parentWindow: window.parent,
  createRequestId: () => crypto.randomUUID(),
  responseTimeoutMs: 120_000,
  browserActions: createBrowserPosterActions(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isOrbitHostMessage = (value: unknown): value is OrbitHostMessage => {
  if (!isRecord(value)) return false;
  if (
    value.channel !== ORBIT_BRIDGE_CHANNEL ||
    value.version !== ORBIT_BRIDGE_VERSION ||
    value.projectId !== POSTER_PROJECT_ID
  ) {
    return false;
  }

  if (value.type === 'host-ready') {
    return (
      Array.isArray(value.capabilities) &&
      value.capabilities.length === 1 &&
      value.capabilities[0] === 'file-export'
    );
  }

  return (
    value.type === 'file-export-result' &&
    typeof value.requestId === 'string' &&
    (value.status === 'shared' || value.status === 'cancelled' || value.status === 'error')
  );
};

export const createEmbeddedPosterActions = (
  environment: EmbeddedPosterActionsEnvironment = defaultEmbeddedEnvironment(),
): PosterActions => {
  let initialized = false;
  let destroyed = false;
  let hostAvailable = false;
  const pending = new Map<
    string,
    {
      readonly resolve: (outcome: PosterExportOutcome) => void;
      readonly timeout: number;
    }
  >();

  const settle = (requestId: string, outcome: PosterExportOutcome) => {
    const request = pending.get(requestId);
    if (!request) return;
    environment.targetWindow.clearTimeout(request.timeout);
    pending.delete(requestId);
    request.resolve(outcome);
  };

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== environment.parentWindow || !isOrbitHostMessage(event.data)) return;

    if (event.data.type === 'host-ready') {
      hostAvailable = true;
      return;
    }

    settle(event.data.requestId, event.data.status === 'error' ? 'failed' : event.data.status);
  };

  return {
    init() {
      if (initialized || destroyed) return;
      initialized = true;
      environment.targetWindow.addEventListener('message', handleMessage);
      const ready: PosterProjectReadyMessage = {
        channel: ORBIT_BRIDGE_CHANNEL,
        version: ORBIT_BRIDGE_VERSION,
        projectId: POSTER_PROJECT_ID,
        type: 'project-ready',
      };
      environment.parentWindow.postMessage(ready, '*');
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      environment.targetWindow.removeEventListener('message', handleMessage);
      for (const requestId of pending.keys()) settle(requestId, 'failed');
      environment.browserActions.destroy();
    },
    copyText: (text) => environment.browserActions.copyText(text),
    async exportPng(blob, filename) {
      if (destroyed || !hostAvailable || blob.type !== POSTER_EXPORT_MIME_TYPE) {
        return 'unavailable';
      }

      try {
        const data = await blob.arrayBuffer();
        const requestId = environment.createRequestId();
        const message: PosterFileExportMessage = {
          channel: ORBIT_BRIDGE_CHANNEL,
          version: ORBIT_BRIDGE_VERSION,
          projectId: POSTER_PROJECT_ID,
          type: 'file-export',
          requestId,
          filename,
          mimeType: POSTER_EXPORT_MIME_TYPE,
          size: data.byteLength,
          data,
        };

        const result = new Promise<PosterExportOutcome>((resolve) => {
          const timeout = environment.targetWindow.setTimeout(
            () => settle(requestId, 'failed'),
            environment.responseTimeoutMs,
          );
          pending.set(requestId, { resolve, timeout });
        });
        environment.parentWindow.postMessage(message, '*');
        return await result;
      } catch {
        return 'failed';
      }
    },
  };
};

export const createPosterActions = (context: AppContext): PosterActions =>
  context === 'embedded' ? createEmbeddedPosterActions() : createBrowserPosterActions();
