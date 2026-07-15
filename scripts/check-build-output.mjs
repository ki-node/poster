import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const pagesDirectory = path.join(repositoryRoot, 'dist');
const embeddedDirectory = path.join(repositoryRoot, 'dist-embedded');
const nestedEmbeddedUrl = new URL('https://local.invalid/projects/nested/poster/index.html');
const fullCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const readOutput = (directory, file = 'index.html') => readFile(path.join(directory, file), 'utf8');
const isExternalReference = (reference) => /^(?:[a-z]+:|\/\/|#|\?)/iu.test(reference);

const extractHtmlAssetReferences = (html) =>
  [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/giu)]
    .map((match) => match[1])
    .filter((reference) => reference && !isExternalReference(reference));

const assertFileExists = async (file, message) => {
  await assert.doesNotReject(access(file), message);
};

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    const stats = await lstat(entryPath);
    assert.equal(
      stats.isSymbolicLink(),
      false,
      `Build output must not contain symlinks: ${entryPath}`,
    );

    if (entry.isDirectory()) files.push(...(await collectFiles(entryPath)));
    else files.push(entryPath);
  }

  return files;
};

const localPathForReference = (directory, sourceFile, reference) => {
  const cleanReference = decodeURIComponent(reference.split(/[?#]/u)[0] ?? '');
  const candidate = path.resolve(path.dirname(sourceFile), cleanReference);
  const relative = path.relative(directory, candidate);

  assert.ok(
    relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    `Embedded reference escapes its output directory: ${reference}`,
  );

  return candidate;
};

const pagesHtml = await readOutput(pagesDirectory);
const embeddedHtml = await readOutput(embeddedDirectory);

assert.match(pagesHtml, /<html lang="de" data-app-context="web">/u);
assert.match(embeddedHtml, /<html lang="de" data-app-context="embedded">/u);
assert.ok(
  embeddedHtml.indexOf('data-app-context="embedded"') < embeddedHtml.indexOf('<script'),
  'Embedded context must be present before the first application script.',
);
assert.match(pagesHtml, /href="\/poster\/icon\.svg"/u);
assert.doesNotMatch(pagesHtml, /ki-node-project\.json/u);

const embeddedReferences = extractHtmlAssetReferences(embeddedHtml);
assert.ok(embeddedReferences.length > 0, 'Embedded HTML must reference local build assets.');

for (const reference of embeddedReferences) {
  assert.ok(!reference.startsWith('/'), `Embedded asset must be relative: ${reference}`);
  const resolvedUrl = new URL(reference, nestedEmbeddedUrl);
  assert.ok(
    resolvedUrl.pathname.startsWith('/projects/nested/poster/'),
    `Embedded asset escapes an arbitrary nested mount path: ${reference}`,
  );
  await assertFileExists(
    localPathForReference(embeddedDirectory, path.join(embeddedDirectory, 'index.html'), reference),
    `Missing embedded HTML asset: ${reference}`,
  );
}

const embeddedFiles = await collectFiles(embeddedDirectory);
const textFiles = embeddedFiles.filter((file) => /\.(?:css|html|js|json|svg)$/u.test(file));

for (const file of textFiles) {
  const content = await readFile(file, 'utf8');
  const relativeFile = path.relative(embeddedDirectory, file);

  assert.doesNotMatch(
    content,
    /(^|["'(=:\s])\/poster\//u,
    `Embedded output still depends on /poster/: ${relativeFile}`,
  );
  assert.doesNotMatch(
    content,
    /<(?:audio|iframe|img|script|source|video)\b[^>]*\bsrc=["'](?:https?:)?\/\//iu,
    `Embedded output contains an active network resource: ${relativeFile}`,
  );
  assert.doesNotMatch(
    content,
    /<link\b[^>]*\brel=["'](?:modulepreload|preload|stylesheet)["'][^>]*\bhref=["'](?:https?:)?\/\//iu,
    `Embedded output contains an external stylesheet or preload: ${relativeFile}`,
  );

  if (path.extname(file) !== '.css') continue;

  const cssReferences = [...content.matchAll(/url\(["']?([^"')]+)["']?\)/giu)]
    .map((match) => match[1])
    .filter((reference) => reference && !isExternalReference(reference));

  for (const reference of cssReferences) {
    assert.ok(!reference.startsWith('/'), `Embedded CSS asset must be relative: ${reference}`);
    await assertFileExists(
      localPathForReference(embeddedDirectory, file, reference),
      `Missing embedded CSS asset: ${reference}`,
    );
  }
}

const provenance = JSON.parse(await readOutput(embeddedDirectory, 'ki-node-project.json'));
assert.deepEqual(provenance, {
  formatVersion: 1,
  projectId: 'poster',
  repository: 'ki-node/poster',
  commit: fullCommit,
  buildCommand: 'npm run build:embedded',
  buildContext: 'embedded',
});
assert.match(provenance.commit, /^[a-f\d]{40}$/u);
assert.equal('timestamp' in provenance, false);
assert.equal('builtAt' in provenance, false);

console.log('Pages and embedded outputs have valid context, provenance and local asset paths.');
