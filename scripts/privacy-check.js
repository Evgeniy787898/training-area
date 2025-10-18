import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_LEGAL_BASES = new Set(['consent', 'contract', 'legal_obligation', 'legitimate_interest']);

const hasRequiredFields = (entry) =>
  typeof entry.dataset === 'string' &&
  entry.dataset.length > 0 &&
  typeof entry.purpose === 'string' &&
  entry.purpose.length > 0 &&
  Number.isInteger(entry.retentionDays) &&
  entry.retentionDays > 0 &&
  Array.isArray(entry.access) &&
  entry.access.length > 0 &&
  entry.access.every((value) => typeof value === 'string' && value.length > 0) &&
  REQUIRED_LEGAL_BASES.has(entry.legalBasis);

const validateInventory = (inventory) => {
  if (!Array.isArray(inventory) || inventory.length === 0) {
    throw new Error('Privacy inventory must contain at least one dataset');
  }

  const retentionViolations = [];

  for (const entry of inventory) {
    if (!hasRequiredFields(entry)) {
      throw new Error(`Invalid privacy entry: ${JSON.stringify(entry)}`);
    }

    if (entry.retentionDays > 365) {
      retentionViolations.push(entry.dataset);
    }
  }

  if (retentionViolations.length > 0) {
    throw new Error(`Retention exceeds 365 days for: ${retentionViolations.join(', ')}`);
  }
};

const main = async () => {
  const filePath = path.resolve('docs/privacy/data-inventory.json');
  const raw = await readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);

  validateInventory(data);
  const summary = data.map((item) => `${item.dataset} (${item.legalBasis})`).join(', ');
  console.log(`Privacy controls validated for datasets: ${summary}`);
};

main().catch((error) => {
  console.error('Privacy check failed:', error.message);
  process.exitCode = 1;
});
