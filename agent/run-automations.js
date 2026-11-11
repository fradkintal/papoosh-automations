import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { PapooshReporter } from './papoosh-sdk.js';

const FINANCE_DIR = 'C:\\Users\\fradk\\PROGRAMS\\finance-aggregator';
const FINANCE_DASHBOARD_URL = 'https://d2ezttw1p31agb.cloudfront.net';
const REQUIRED_AWS_PROFILE = 'finance-scraper';

/**
 * Checks whether the AWS profile `finance-scraper` exists in ~/.aws/config or ~/.aws/credentials
 * without reading or logging any secret keys.
 */
function hasAwsProfile(profileName) {
  const awsDir = path.join(os.homedir(), '.aws');
  const files = ['config', 'credentials'];
  const headerRegex = new RegExp(`^\\[(?:profile\\s+)?${profileName}\\]\\s*$`, 'm');

  for (const file of files) {
    const fullPath = path.join(awsDir, file);
    try {
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (headerRegex.test(content)) {
          return true;
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  try {
    const out = execSync('aws configure list-profiles', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 4000
    });
    const profiles = out.split(/\r?\n/).map((s) => s.trim());
    return profiles.includes(profileName);
  } catch {
    return false;
  }
}

/**
 * Sanitizes output from `npm run sync -- all` according to strict privacy rules:
 * - Never log or store amounts, merchant names, card numbers, or passwords.
 * - Extract only:
 *   - Success: exit code 0 and "All providers synced." (+ optional total transactions count)
 *   - Failure: exit code 1 and "Done with errors: <providers>" or "Sync failed: <reason>"
 */
function parseSafeFinanceOutput(exitCode, stdout, stderr) {
  const combined = `${stdout || ''}\n${stderr || ''}`;
  const lines = combined
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Extract transaction count if printed safely (e.g. "Synced X transactions" or similar number-only counter)
  let txCountText = '';
  for (const line of lines) {
    const txMatch = line.match(/(\d+)\s+(?:transactions|תנועות)/i);
    if (txMatch) {
      txCountText = ` (${txMatch[1]} תנועות)`;
      break;
    }
  }

  const allSyncedLine = lines.find((l) => l.includes('All providers synced.'));
  if (exitCode === 0 && allSyncedLine) {
    return {
      status: 'success',
      summary: `All providers synced.${txCountText}`,
      details: [
        `קוד יציאה: 0`,
        `תוצאה: All providers synced.${txCountText}`,
        `תאריך בדיקה: ${new Date().toLocaleString('he-IL')}`
      ],
      alert: null
    };
  }

  const doneWithErrorsLine = lines.find((l) => l.startsWith('Done with errors:'));
  if (doneWithErrorsLine) {
    return {
      status: 'error',
      summary: doneWithErrorsLine,
      details: [
        `קוד יציאה: ${exitCode}`,
        `שגיאה: ${doneWithErrorsLine}`,
        `תאריך בדיקה: ${new Date().toLocaleString('he-IL')}`
      ],
      alert: {
        severity: 'critical',
        title: 'שגיאה בסנכרון חלק מהגופים ב-Finance Aggregator',
        message: doneWithErrorsLine,
        actionHint: `בדוק את החיבור בדשבורד: ${FINANCE_DASHBOARD_URL}`
      }
    };
  }

  const syncFailedLine = lines.find((l) => l.startsWith('Sync failed:'));
  if (syncFailedLine) {
    return {
      status: 'error',
      summary: syncFailedLine,
      details: [
        `קוד יציאה: ${exitCode}`,
        `שגיאה: ${syncFailedLine}`,
        `תאריך בדיקה: ${new Date().toLocaleString('he-IL')}`
      ],
      alert: {
        severity: 'critical',
        title: 'כשל בסנכרון Finance Aggregator',
        message: syncFailedLine,
        actionHint: `בדוק את החיבור בדשבורד: ${FINANCE_DASHBOARD_URL}`
      }
    };
  }

  return {
    status: exitCode === 0 ? 'success' : 'error',
    summary: exitCode === 0 ? `הסנכרון הסתיים (קוד 0)${txCountText}` : `הסנכרון נכשל (קוד יציאה ${exitCode})`,
    details: [
      `קוד יציאה: ${exitCode}`,
      `תאריך בדיקה: ${new Date().toLocaleString('he-IL')}`
    ],
    alert:
      exitCode === 0
        ? null
        : {
            severity: 'critical',
            title: 'כשל בהרצת סנכרון Finance Aggregator',
            message: `הפקודה npm run sync -- all הסתיימה עם קוד יציאה ${exitCode}.`,
            actionHint: 'בדוק את לוג הריצה המקומי במחשב הנייח.'
          }
  };
}

/**
 * Runs or checks the Finance Aggregator sync according to preconditions.
 * Note: Pass `--run-finance-sync` to actually execute `npm run sync -- all` when profile is present.
 */
function checkOrRunFinanceSync(shouldExecuteSync = false) {
  const startMs = Date.now();
  const profileExists = hasAwsProfile(REQUIRED_AWS_PROFILE);

  if (!profileExists) {
    return {
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      status: 'warning',
      summary: 'צריך להגדיר פרופיל AWS finance-scraper (הסנכרון לא הורץ)',
      details: [
        `תנאי מוקדם: בדיקת פרופיל AWS בשם ${REQUIRED_AWS_PROFILE}`,
        `סטטוס: הפרופיל חסר במחשב זה – הסנכרון לא הופעל בהתאם להנחיות`
      ],
      alert: {
        id: 'alert-aws-finance-scraper',
        automationId: 'finance-aggregator-sync',
        category: 'finance',
        severity: 'warning',
        title: 'צריך להגדיר פרופיל AWS finance-scraper',
        message: 'פרופיל ה-AWS בשם finance-scraper אינו מוגדר עדיין במחשב החדש, ולכן סנכרון הכספים לא הופעל.',
        actionHint: 'הגדר פרופיל AWS בשם finance-scraper (אזור il-central-1)',
        createdAt: new Date().toISOString(),
        resolved: false
      }
    };
  }

  if (!shouldExecuteSync) {
    return {
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      status: 'success',
      summary: 'פרופיל AWS finance-scraper מוגדר ומוכן לסנכרון (07:00 ו-19:00)',
      details: [
        `✓ פרופיל AWS ${REQUIRED_AWS_PROFILE} קיים`,
        `✓ מוכן להרצת npm run sync -- all מתוך ${FINANCE_DIR}`
      ],
      alert: null
    };
  }

  // Execute `npm run sync -- all` inside C:\Users\fradk\PROGRAMS\finance-aggregator
  const proc = spawnSync('npm', ['run', 'sync', '--', 'all'], {
    cwd: FINANCE_DIR,
    shell: true,
    encoding: 'utf8',
    timeout: 300000
  });

  const parsed = parseSafeFinanceOutput(proc.status ?? 1, proc.stdout, proc.stderr);
  return {
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    status: parsed.status,
    summary: parsed.summary,
    details: parsed.details,
    alert: parsed.alert
      ? {
          id: `alert-finance-sync-${Date.now()}`,
          automationId: 'finance-aggregator-sync',
          category: 'finance',
          ...parsed.alert,
          createdAt: new Date().toISOString(),
          resolved: false
        }
      : null
  };
}

function runRealChecks() {
  const args = process.argv.slice(2);
  const executeFinanceSync = args.includes('--run-finance-sync');
  const existing = PapooshReporter.loadTelemetry();
  const now = new Date();
  const nowIso = now.toISOString();

  // Keep only real runs (filter out any old hardcoded mock runs like run-102..run-107 or run-sim-*)
  const realPastRuns = (existing.recentRuns || []).filter(
    (r) => !/^run-10[0-9]$/.test(r.id) && !String(r.id).startsWith('run-sim-')
  );

  // Check Finance Aggregator precondition / sync
  const financeResult = checkOrRunFinanceSync(executeFinanceSync);

  const financeRunEntry = {
    id: `run-finance-${Date.now()}`,
    automationId: 'finance-aggregator-sync',
    name: 'סנכרון כספים (Finance Aggregator)',
    category: 'finance',
    status: financeResult.status,
    timestamp: financeResult.ranAt,
    durationMs: financeResult.durationMs,
    summary: financeResult.summary,
    details: financeResult.details
  };

  // Monthly reminder check (around the 12th of the month for ONE ZERO & Isracard manual import)
  const dayOfMonth = now.getDate();
  const isAround12th = dayOfMonth >= 11 && dayOfMonth <= 14;

  // Build real alerts list
  const alerts = [];
  if (financeResult.alert) {
    alerts.push(financeResult.alert);
  }
  if (isAround12th) {
    alerts.push({
      id: `alert-monthly-import-${now.getFullYear()}-${now.getMonth() + 1}`,
      automationId: 'finance-monthly-import-reminder',
      category: 'finance',
      severity: 'info',
      title: 'תזכורת חודשית: ייבוא ידני של ONE ZERO וישראכרט',
      message:
        'לקראת תכנון התקציב ב-15 לחודש: יש להוריד קובץ xls מאתר ONE ZERO וקובץ JSON מישראכרט (באמצעות ה-Bookmarklet בדפדפן) ולהעלות אותם במסך הייבוא בדשבורד.',
      actionHint: `מסך הייבוא בדשבורד: ${FINANCE_DASHBOARD_URL}`,
      createdAt: nowIso,
      resolved: false
    });
  }

  // Find latest real Gmail run if one occurred
  const lastGmailRun = realPastRuns.find((r) => r.automationId === 'gmail-smart-invoices');

  const recentRuns = [financeRunEntry, ...realPastRuns].slice(0, 50);

  const automations = [
    {
      id: 'finance-aggregator-sync',
      name: 'סנכרון כספים (Finance Aggregator)',
      category: 'finance',
      schedule: 'פעמיים ביום (07:00 ו-19:00)',
      cron: '0 7,19 * * *',
      lastStatus: financeResult.status,
      lastRunAt: financeResult.ranAt,
      nextRunAt: null,
      lastDurationMs: financeResult.durationMs,
      totalRuns: recentRuns.filter((r) => r.automationId === 'finance-aggregator-sync').length,
      repoPath: FINANCE_DIR,
      description:
        'מריץ npm run sync -- all מתוך תיקיית הפרויקט (מסנכרן ל-DynamoDB ב-il-central-1 רק גופים שמוגדרים ב-.env: מקס, כאל, לאומי ודיסקונט). ONE ZERO וישראכרט מיובאים ידנית בלבד.',
      lastSummary: financeResult.summary
    },
    {
      id: 'finance-monthly-import-reminder',
      name: 'תזכורת חודשית: ייבוא ONE ZERO וישראכרט',
      category: 'finance',
      schedule: 'פעם בחודש ב-12 לחודש (לקראת ה-15)',
      cron: '0 9 12 * *',
      lastStatus: isAround12th ? 'warning' : 'success',
      lastRunAt: nowIso,
      nextRunAt: null,
      lastDurationMs: 10,
      totalRuns: isAround12th ? 1 : 0,
      repoPath: FINANCE_DASHBOARD_URL,
      description:
        'תזכורת חודשית סביב ה-12 לחודש לייבא ידנית קובץ xls מ-ONE ZERO וקובץ JSON מישראכרט (דרך ה-Bookmarklet) למסך הייבוא בדשבורד. ללא הרצה אוטומטית.',
      lastSummary: isAround12th
        ? 'תזכורת פעילה לחודש זה: מומלץ לייבא ONE ZERO וישראכרט לפני ה-15 לחודש.'
        : 'ממתין ל-12 לחודש.'
    },
    {
      id: 'gmail-smart-invoices',
      name: 'סידור וסיכום מיילים יומי - פפוש (Gmail)',
      category: 'email',
      schedule: 'כל בוקר ב-08:00',
      cron: '0 8 * * *',
      lastStatus: lastGmailRun ? lastGmailRun.status : 'info',
      lastRunAt: lastGmailRun ? lastGmailRun.timestamp : null,
      nextRunAt: null,
      lastDurationMs: lastGmailRun ? lastGmailRun.durationMs : 0,
      totalRuns: recentRuns.filter((r) => r.automationId === 'gmail-smart-invoices').length,
      repoPath: 'fradkintal@gmail.com',
      description:
        'תיוג אוטומטי וארכוב התראות GitHub (Label_14), האוניברסיטה הפתוחה (Label_15), קבלות (Label_6) ומיילים פיננסיים (Label_16), הסרה מדיוורים פרסומיים ותקציר בוקר יומי (ללא הצלבת מידע פיננסי).',
      lastSummary: lastGmailRun ? lastGmailRun.summary : 'טרם הורץ היום'
    },
    {
      id: 'github-programs-sync',
      name: 'משיכת עדכונים לילית מ-GitHub (git pull בלבד)',
      category: 'system',
      schedule: 'כל לילה ב-02:00',
      cron: '0 2 * * *',
      lastStatus: 'info',
      lastRunAt: null,
      nextRunAt: null,
      lastDurationMs: 0,
      totalRuns: recentRuns.filter((r) => r.automationId === 'github-programs-sync').length,
      repoPath: 'C:\\Users\\fradk\\PROGRAMS',
      description:
        'מבצע git pull בלבד בלילה למאגרים בתיקיית PROGRAMS. ללא git push אוטומטי ב-finance-aggregator (מכיוון ש-push ל-main מפעיל פריסה לענן).',
      lastSummary: 'מוגדר למשיכת עדכונים לילית (git pull בלבד).'
    }
  ];

  const tools = [
    {
      id: 'tool-finance',
      name: 'Finance Aggregator',
      subtitle: 'אגרגטור כספים אישי • DynamoDB (il-central-1)',
      category: 'finance',
      badge: 'כספים',
      localPath: FINANCE_DIR,
      repoUrl: FINANCE_DASHBOARD_URL,
      tech: 'Node.js • DynamoDB (il-central-1) • CloudFront Dashboard',
      status: financeResult.status === 'success' ? 'active' : 'needs-config',
      statusLabel:
        financeResult.status === 'success'
          ? 'מוכן לסנכרון'
          : 'צריך להגדיר פרופיל AWS finance-scraper'
    },
    {
      id: 'tool-gmail-ai',
      name: 'סידור מיילים יומי (Gmail)',
      subtitle: 'תיוג אוטומטי (GitHub, אונ׳ פתוחה, קבלות, פיננסים) ותקציר יומי',
      category: 'email',
      badge: 'Gmail',
      localPath: 'fradkintal@gmail.com',
      repoUrl: 'https://mail.google.com',
      tech: 'Gmail OAuth2 • Daily 08:00 Schedule',
      status: 'active',
      statusLabel: 'פעיל (08:00)'
    },
    {
      id: 'tool-the-team',
      name: 'הצוות (The Team Sys)',
      subtitle: 'ניהול עובדים, מגורים באילת, טופס 101 וסגירת חודש',
      category: 'business',
      badge: 'הצוות',
      localPath: 'C:\\Users\\fradk\\PROGRAMS\\the-team-sys',
      repoUrl: 'https://github.com/fradkintal/the-team-sys',
      tech: 'React • AWS • SMS Auth',
      status: 'active',
      statusLabel: 'קיים ב-PROGRAMS'
    },
    {
      id: 'tool-el-sol',
      name: 'אל סול ניהול מבנים (El-Sol Sys)',
      subtitle: 'מתחם בית אורן ולב אילת • דוחות תפוסה בוואטסאפ',
      category: 'business',
      badge: 'אל סול',
      localPath: 'C:\\Users\\fradk\\PROGRAMS\\el-sol-sys',
      repoUrl: 'https://github.com/fradkintal/el-sol-sys',
      tech: 'Python Lambda • DynamoDB • Green API WhatsApp',
      status: 'active',
      statusLabel: 'קיים ב-PROGRAMS'
    }
  ];

  return PapooshReporter.saveTelemetry({
    updatedAt: nowIso,
    automations,
    recentRuns,
    alerts,
    tools
  });
}

const result = runRealChecks();
console.log(
  `[PAPOOSH Runner] Completed real state check. Real runs recorded: ${result.recentRuns.length}, Open alerts: ${result.alerts.length}`
);
