import { execFileSync } from 'node:child_process';

import { defineConfig, type Plugin, type UserConfig } from 'vite';

import { resolveAppContext, type AppContext } from './src/app-context';

export interface PosterBuildProfile {
  context: AppContext;
  base: '/poster/' | './';
  outDir: 'dist' | 'dist-embedded';
}

const buildProfiles = {
  web: {
    context: 'web',
    base: '/poster/',
    outDir: 'dist',
  },
  embedded: {
    context: 'embedded',
    base: './',
    outDir: 'dist-embedded',
  },
} satisfies Record<AppContext, PosterBuildProfile>;

export const resolveBuildProfile = (mode: string): PosterBuildProfile =>
  buildProfiles[resolveAppContext(mode)];

export const readSourceCommit = (): string => {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();

  if (!/^[a-f\d]{40}$/u.test(commit)) {
    throw new Error(`Expected a full Git commit SHA, received: ${commit}`);
  }

  return commit;
};

export const createAppContextHtmlPlugin = (context: AppContext): Plugin => ({
  name: 'poster-app-context',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      return html.replace('<html lang="de">', `<html lang="de" data-app-context="${context}">`);
    },
  },
});

export const createEmbeddedProvenancePlugin = (commit: string): Plugin => ({
  name: 'poster-embedded-provenance',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'ki-node-project.json',
      source: `${JSON.stringify(
        {
          formatVersion: 1,
          projectId: 'poster',
          repository: 'ki-node/poster',
          commit,
          buildCommand: 'npm run build:embedded',
          buildContext: 'embedded',
        },
        null,
        2,
      )}\n`,
    });
  },
});

export const createViteConfig = (mode: string, sourceCommit = readSourceCommit()): UserConfig => {
  const profile = resolveBuildProfile(mode);
  const plugins: Plugin[] = [createAppContextHtmlPlugin(profile.context)];

  if (profile.context === 'embedded') {
    plugins.push(createEmbeddedProvenancePlugin(sourceCommit));
  }

  return {
    base: profile.base,
    plugins,
    build: {
      outDir: profile.outDir,
      target: 'es2022',
      sourcemap: false,
      reportCompressedSize: true,
    },
  };
};

export default defineConfig(({ mode }) => createViteConfig(mode));
