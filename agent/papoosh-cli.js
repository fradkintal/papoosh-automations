#!/usr/bin/env node
import { PapooshReporter } from './papoosh-sdk.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';

function getArg(flag, fallback = '') {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

if (command === 'report') {
  const automationId = getArg('--id', 'custom-script');
  const name = getArg('--name', automationId);
  const category = getArg('--category', 'system');
  const status = getArg('--status', 'success');
  const summary = getArg('--summary', 'הרצת אוטומציה הסתיימה בהצלחה');
  const durationMs = Number(getArg('--duration', '950'));
  const alertTitle = getArg('--alert-title', '');
  const alertMsg = getArg('--alert-msg', '');
  const syncToGit = args.includes('--push');

  const result = PapooshReporter.reportRun({
    automationId,
    name,
    category,
    status,
    summary,
    durationMs,
    alert: alertTitle ? { title: alertTitle, message: alertMsg || summary, severity: status === 'error' ? 'critical' : 'warning' } : null,
    syncToGit
  });

  console.log(`[PAPOOSH CLI] Reported '${name}' (${status}) -> Total runs today: ${result.summary.runsToday}`);
} else {
  console.log(`
PAPOOSH Automations CLI (פפוש אוטומציות)
Usage:
  node agent/papoosh-cli.js report --id <id> --name "<name>" --category <finance|email|business|calendar|system> --status <success|warning|error> --summary "<text>" [--push]
  `);
}
