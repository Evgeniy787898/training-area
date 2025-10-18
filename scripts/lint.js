import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const TARGET_DIRECTORIES = ['src', 'tests', 'scripts', 'api', 'server'];

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

const hasTrailingWhitespace = (line) => /\s+$/.test(line);

const runLint = async () => {
  const errors = [];

  for (const directory of TARGET_DIRECTORIES) {
    try {
      const files = await collectFiles(directory);
      for (const filePath of files) {
        const contents = await readFile(filePath, 'utf-8');
        const lines = contents.split('\n');

        lines.forEach((line, index) => {
          if (hasTrailingWhitespace(line)) {
            errors.push(`${filePath}:${index + 1} Trailing whitespace detected`);
          }

          if (!filePath.endsWith('scripts/lint.js') && line.includes('TODO')) {
            errors.push(`${filePath}:${index + 1} Task markers are not allowed`);
          }

          if (filePath.startsWith('src/') && line.includes('console.log')) {
            errors.push(`${filePath}:${index + 1} console.log is not allowed in source files`);
          }
        });

        if (contents.includes('\r')) {
          errors.push(`${filePath} contains Windows style line endings`);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  if (errors.length > 0) {
    console.error('Lint failed:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Lint passed successfully');
  }
};

runLint().catch((error) => {
  console.error('Lint execution failed:', error);
  process.exitCode = 1;
});
