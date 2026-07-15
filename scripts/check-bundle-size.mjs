import { gzipSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const budgets = { '.css': 18_000, '.js': 25_000 };
const outputDirectory = process.argv[2] ?? 'dist';
const assetDirectory = new URL(`../${outputDirectory}/assets/`, import.meta.url);
const assets = await readdir(assetDirectory);

for (const asset of assets) {
  const extension = Object.keys(budgets).find((candidate) => asset.endsWith(candidate));

  if (!extension) continue;

  const compressedSize = gzipSync(await readFile(join(assetDirectory.pathname, asset))).byteLength;
  const budget = budgets[extension];

  if (compressedSize > budget) {
    throw new Error(`${asset}: ${compressedSize} bytes gzip exceeds ${budget} byte budget`);
  }

  console.log(`${asset}: ${compressedSize}/${budget} bytes gzip`);
}
