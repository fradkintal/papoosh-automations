import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
const ARCHIVE_DIR = path.join(DOWNLOADS_DIR, 'imported-to-finance');
const FINANCE_DIR = 'C:\\Users\\fradk\\PROGRAMS\\finance-aggregator';

/**
 * Scans C:\Users\fradk\Downloads for `isracard-*.json` files produced by the Isracard bookmarklet.
 * When found, imports them directly into DynamoDB using finance-aggregator's own importer logic
 * and moves the processed file into Downloads/imported-to-finance so it is never imported twice.
 * Privacy rule: only prints/returns card count, added count, duplicates count, and date range.
 */
export function scanAndImportIsracardFiles() {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    return { found: 0, importedFiles: [], summary: 'תיקיית Downloads לא נמצאה' };
  }

  const files = fs
    .readdirSync(DOWNLOADS_DIR)
    .filter((f) => /^isracard-.*\.json$/i.test(f))
    .map((f) => path.join(DOWNLOADS_DIR, f));

  if (files.length === 0) {
    return {
      found: 0,
      importedFiles: [],
      summary: 'ממתין לקובץ isracard-*.json בתיקיית ההורדות (נוצר בלחיצה על סימניית ישראכרט בדפדפן)'
    };
  }

  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const results = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    // Run a one-off tsx inline script inside finance-aggregator/api so it uses @fa/shared and DynamoDB directly
    const inlineScript = `
      import fs from 'node:fs';
      import path from 'node:path';
      import { parseIsracardExport } from '@fa/shared';
      import { importStatement, parseImportRequest } from './src/importer.ts';
      import { dynamoRepository } from './src/repository.ts';

      process.loadEnvFile(path.resolve('..', '.env'));
      const raw = JSON.parse(fs.readFileSync(${JSON.stringify(filePath)}, 'utf8'));
      const parsed = parseIsracardExport(raw);
      if (!parsed || !parsed.cards.length) {
        console.error('INVALID_ISRACARD_FILE');
        process.exit(1);
      }
      const repo = dynamoRepository(process.env.TABLE_NAME!);
      const now = new Date().toISOString();
      let totalAdded = 0;
      let totalDuplicates = 0;
      for (const card of parsed.cards) {
        if (!card.rows.length) continue;
        const req = parseImportRequest({ provider: 'isracard', account: card.last4, rows: card.rows, balance: null });
        const res = await importStatement(repo, req, now);
        totalAdded += res.added;
        totalDuplicates += res.duplicates;
      }
      console.log(JSON.stringify({ cards: parsed.cards.length, added: totalAdded, duplicates: totalDuplicates }));
    `;

    const proc = spawnSync('npx', ['tsx', '-e', inlineScript], {
      cwd: path.join(FINANCE_DIR, 'api'),
      shell: true,
      encoding: 'utf8',
      timeout: 60000
    });

    if (proc.status === 0) {
      let stats = { cards: 1, added: 0, duplicates: 0 };
      try {
        const lastLine = (proc.stdout || '').trim().split(/\r?\n/).pop();
        if (lastLine) stats = JSON.parse(lastLine);
      } catch {
        // ignore parse error
      }
      const destPath = path.join(ARCHIVE_DIR, `${Date.now()}-${fileName}`);
      fs.renameSync(filePath, destPath);
      results.push({
        fileName,
        status: 'success',
        cards: stats.cards,
        added: stats.added,
        duplicates: stats.duplicates
      });
    } else {
      results.push({
        fileName,
        status: 'error',
        error: 'קובץ JSON לא תקין או שגיאת גישה ל-DynamoDB'
      });
    }
  }

  const totalAdded = results.reduce((acc, r) => acc + (r.added || 0), 0);
  return {
    found: files.length,
    importedFiles: results,
    summary: `יובאו אוטומטית ${files.length} קובצי ישראכרט (${totalAdded} תנועות חדשות נוספו ל-DynamoDB)`
  };
}

if (process.argv[1] && process.argv[1].endsWith('auto-import-downloads.js')) {
  const res = scanAndImportIsracardFiles();
  console.log(JSON.stringify(res, null, 2));
}
