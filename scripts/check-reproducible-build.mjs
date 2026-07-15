import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const embeddedDirectory = path.join(repositoryRoot, 'dist-embedded');

const hashDirectory = async (directory, root = directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await hashDirectory(entryPath, root)));
    else {
      const hash = createHash('sha256')
        .update(await readFile(entryPath))
        .digest('hex');
      files.push([path.relative(root, entryPath), hash]);
    }
  }

  return files;
};

const firstBuild = await hashDirectory(embeddedDirectory);
execFileSync('npm', ['run', 'build:embedded'], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: 'inherit',
});
const secondBuild = await hashDirectory(embeddedDirectory);

assert.deepEqual(secondBuild, firstBuild, 'Embedded output changed across identical clean builds.');
console.log(`Embedded build is reproducible across ${String(firstBuild.length)} files.`);
