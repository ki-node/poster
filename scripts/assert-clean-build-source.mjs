import { execFileSync } from 'node:child_process';

const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
  encoding: 'utf8',
}).trim();

if (status) {
  throw new Error(
    `Embedded builds must come from a clean, committed source tree. Commit or remove:\n${status}`,
  );
}

console.log('Embedded build source is clean and fully committed.');
