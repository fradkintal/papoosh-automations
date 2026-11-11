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
  const detailsRaw = getArg('--details', '');
  const details = detailsRaw
    ? detailsRaw.split('|').map((s) => s.trim()).filter(Boolean)
    : [];
  const alertTitle = getArg('--alert-title', '');
  const alertMsg = getArg('--alert-msg', '');
  const syncToGit = args.includes('--push');

  const digest =
    details.length > 0
      ? {
          title: name,
          headline: summary,
          items: details
        }
      : null;

  const result = PapooshReporter.reportRun({
    automationId,
    name,
    category,
    status,
    summary,
    durationMs,
    details,
    digest,
    alert: alertTitle
      ? { title: alertTitle, message: alertMsg || summary, severity: status === 'error' ? 'critical' : 'warning' }
      : null,
    syncToGit
  });

  console.log(`[PAPOOSH CLI] Reported '${name}' (${status}) -> Total runs today: ${result.summary.runsToday}`);
} else if (command === 'dismiss-alert') {
  const alertId = getArg('--id', '');
  const syncToGit = args.includes('--push');
  if (alertId) {
    PapooshReporter.dismissAlert(alertId, { syncToGit });
    console.log(`[PAPOOSH CLI] Dismissed alert '${alertId}'`);
  }
} else {
  console.log(`
PAPOOSH Automations CLI (פפוש אוטומציות אישי)
Usage:
  node agent/papoosh-cli.js report --id <id> --name "<name>" --category <finance|email|calendar|system> --status <success|warning|error> --summary "<text>" [--details "שורה 1|שורה 2"] [--push]
  node agent/papoosh-cli.js dismiss-alert --id <alertId> [--push]
  `);
}
