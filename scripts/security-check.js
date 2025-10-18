import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIRECTORIES = ['src', 'scripts', 'server'];
const BANNED_PATTERNS = [
  { regex: /eval\(/, message: 'Avoid eval for security reasons' },
  { regex: /new Function\(/, message: 'Dynamic Function constructor is disallowed' },
  { regex: /child_process/, message: 'Spawning child processes is not permitted in this project' }
];

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const resolvedPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(resolvedPath)));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(resolvedPath);
    }
  }

  return files;
};

const runSecurityChecks = async () => {
  const violations = [];

  for (const directory of DIRECTORIES) {
    try {
      const files = await collectFiles(directory);
      for (const filePath of files) {
        const contents = await readFile(filePath, 'utf-8');
        for (const { regex, message } of BANNED_PATTERNS) {
          if (!filePath.endsWith('scripts/security-check.js') && regex.test(contents)) {
            violations.push(`${filePath}: ${message}`);
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  if (violations.length > 0) {
    console.error('Security check failed:\n' + violations.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Security checks passed');
  }
};

runSecurityChecks().catch((error) => {
  console.error('Security checks could not be completed:', error);
  process.exitCode = 1;
});
