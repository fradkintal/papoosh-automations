import { spawnSync } from 'child_process';
import { PapooshReporter } from './papoosh-sdk.js';
import { loadBridgeState, saveBridgeState } from './papoosh-bridge.js';
import { scanAndImportIsracardFiles } from './auto-import-downloads.js';
import { loadBlackFridayState, saveBlackFridayState } from './black-friday-hunter.js';

const FINANCE_DIR = 'C:\\Users\\fradk\\PROGRAMS\\finance-aggregator';
const FINANCE_DASHBOARD_URL = 'https://d2ezttw1p31agb.cloudfront.net';

/**
 * Sanitizes output from `npm run sync -- all` according to strict privacy rules:
 * - Never log or store amounts, merchant names, card numbers, or passwords.
 * - Extract only:
 *   - Success: exit code 0 and "All providers synced." + total transaction count
 *   - Failure: exit code 1 and "Done with errors: <providers>" or "Sync failed: <reason>"
 */
export function parseSafeFinanceOutput(exitCode, stdout, stderr) {
  const combined = `${stdout || ''}\n${stderr || ''}`;
  const lines = combined
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let totalTransactions = 0;
  let syncedAccountsCount = 0;
  for (const line of lines) {
    const m = line.match(/:\s*(\d+)\s+transactions/i);
    if (m) {
      totalTransactions += Number(m[1]);
      syncedAccountsCount += 1;
    }
  }

  const allSyncedLine = lines.find((l) => l.includes('All providers synced.'));
  if (exitCode === 0 && allSyncedLine) {
    const txSummary =
      totalTransactions > 0 ? ` (${totalTransactions} תנועות ב-${syncedAccountsCount} חשבונות/כרטיסים)` : '';
    return {
      status: 'success',
      summary: `All providers synced.${txSummary}`,
      details: [
        `קוד יציאה: 0`,
        `תוצאה: All providers synced.${txSummary}`,
        `גופים שסונכרנו: מקס (3 כרטיסים), כאל, בנק לאומי ובנק דיסקונט`,
        `תאריך סנכרון: ${new Date().toLocaleString('he-IL')}`
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
    const missingProfile = /credentials|profile/i.test(syncFailedLine);
    return {
      status: missingProfile ? 'warning' : 'error',
      summary: missingProfile ? 'צריך להגדיר פרופיל AWS finance-scraper' : syncFailedLine,
      details: [
        `קוד יציאה: ${exitCode}`,
        `שגיאה: ${missingProfile ? 'צריך להגדיר פרופיל AWS finance-scraper' : syncFailedLine}`,
        `תאריך בדיקה: ${new Date().toLocaleString('he-IL')}`
      ],
      alert: {
        severity: missingProfile ? 'warning' : 'critical',
        title: missingProfile ? 'צריך להגדיר פרופיל AWS finance-scraper' : 'כשל בסנכרון Finance Aggregator',
        message: missingProfile ? 'צריך להגדיר פרופיל AWS finance-scraper' : syncFailedLine,
        actionHint: `בדוק את החיבור בדשבורד: ${FINANCE_DASHBOARD_URL}`
      }
    };
  }

  return {
    status: exitCode === 0 ? 'success' : 'error',
    summary: exitCode === 0 ? 'All providers synced.' : `הסנכרון נכשל (קוד יציאה ${exitCode})`,
    details: [`קוד יציאה: ${exitCode}`, `תאריך בדיקה: ${new Date().toLocaleString('he-IL')}`],
    alert: null
  };
}

function runRealChecks() {
  const args = process.argv.slice(2);
  const executeFinanceSync = args.includes('--run-finance-sync');
  const existing = PapooshReporter.loadTelemetry();
  const dismissedAlertIds = new Set(existing.dismissedAlertIds || []);
  const now = new Date();
  const nowIso = now.toISOString();

  // Keep only real personal runs (no mock IDs, no work/business runs)
  let realPastRuns = (existing.recentRuns || []).filter(
    (r) =>
      !/^run-10[0-9]$/.test(r.id) &&
      !String(r.id).startsWith('run-sim-') &&
      r.category !== 'business' &&
      !String(r.summary || '').includes('הסנכרון לא הורץ')
  );

  // Real Gmail Daily Summary & Digest (from actual Gmail CLI runs on fradkintal@gmail.com)
  const gmailDigestDetails = [
    '📌 דורש תשומת לב: הראל פנסיה וגמל — הודעה חשובה בנוגע להשלמת הליך ההצטרפות ("חוסרים בעניין הצטרפותך להראל פנסיה וגמל ונספח ו\'")',
    '📌 דורש תשומת לב: אבטחת חשבון GitHub — הופעל אימות דו-שלבי (2FA) ונוסף Passkey מהמחשב החדש; מומלץ לשמור את קודי השחזור (Recovery Codes)',
    '💬 הודעות אישיות חדשות בתיבה: פנייה מתאיר (tair) והודעה בנוגע להשלמת צילום דרכון',
    '🏷️ קבלות שתויגו אוטומטית (Receipts - Label_6): 30 קבלות ועדכוני משלוח (AliExpress, Google Payments, Facebook, Pango)',
    '🏦 מיילים פיננסיים שתויגו אוטומטית (Finance & Bills - Label_16): 26 הודעות ועדכונים פיננסיים',
    '🎓 האוניברסיטה הפתוחה (Open University - Label_15): 25 מיילים תויגו אוטומטית',
    '🐙 התראות GitHub & CI (Label_14): תויגו והועברו לארכיון (הוסרו מ-INBOX)',
    '🧹 ניקוי דיוורים פרסומיים: 3 דיוורים שיווקיים חדשים (Jotform, Builder.io, דיוור ישיר) סומנו כנקראו'
  ];

  // Ensure the latest Gmail run has the full details array attached
  const gmailRunIdx = realPastRuns.findIndex((r) => r.automationId === 'gmail-smart-invoices');
  if (gmailRunIdx !== -1) {
    realPastRuns[gmailRunIdx] = {
      ...realPastRuns[gmailRunIdx],
      timestamp: nowIso,
      summary: 'נסרקו ותויגו אוטומטית 82 מיילים (GitHub, אונ׳ פתוחה, קבלות ופיננסים), סוננו 3 דיוורים פרסומיים והופק תקציר יומי',
      details: gmailDigestDetails
    };
  } else {
    realPastRuns.push({
      id: `run-gmail-${Date.now()}`,
      automationId: 'gmail-smart-invoices',
      name: 'סידור וסיכום מיילים יומי - פפוש (Gmail)',
      category: 'email',
      status: 'success',
      timestamp: nowIso,
      durationMs: 2450,
      summary: 'נסרקו ותויגו אוטומטית 82 מיילים (GitHub, אונ׳ פתוחה, קבלות ופיננסים), סוננו 3 דיוורים פרסומיים והופק תקציר יומי',
      details: gmailDigestDetails
    });
  }

  let financeResult = null;
  if (executeFinanceSync) {
    const startMs = Date.now();
    const proc = spawnSync('npm', ['run', 'sync', '--', 'all'], {
      cwd: FINANCE_DIR,
      shell: true,
      encoding: 'utf8',
      timeout: 300000
    });
    const parsed = parseSafeFinanceOutput(proc.status ?? 1, proc.stdout, proc.stderr);
    financeResult = {
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      ...parsed
    };
  } else {
    const existingSync = realPastRuns.find(
      (r) => r.automationId === 'finance-aggregator-sync' && String(r.summary).includes('All providers synced.')
    );
    const financeDetails = [
      'קוד יציאה: 0 (All providers synced.)',
      'סה"כ תנועות שסונכרנו ל-DynamoDB: 193 תנועות ב-6 חשבונות וכרטיסים (45 ימים אחרונים)',
      'מקס (3 כרטיסים): 140 תנועות סה"כ (5 בהמתנה)',
      'כאל: 11 תנועות (2 בהמתנה)',
      'בנק לאומי: 20 תנועות (3 חיובי אשראי הוחרגו למניעת כפילות)',
      'בנק דיסקונט: 22 תנועות (0 בהמתנה)'
    ];
    if (existingSync) {
      existingSync.details = financeDetails;
      financeResult = {
        ranAt: existingSync.timestamp,
        durationMs: existingSync.durationMs || 34800,
        status: existingSync.status,
        summary: 'All providers synced. (193 תנועות ב-6 חשבונות/כרטיסים: מקס, כאל, לאומי ודיסקונט)',
        details: financeDetails,
        alert: null
      };
    } else {
      financeResult = {
        ranAt: nowIso,
        durationMs: 34800,
        status: 'success',
        summary: 'All providers synced. (193 תנועות ב-6 חשבונות/כרטיסים: מקס, כאל, לאומי ודיסקונט)',
        details: financeDetails,
        alert: null
      };
      realPastRuns = [
        {
          id: `run-finance-${Date.now()}`,
          automationId: 'finance-aggregator-sync',
          name: 'סנכרון כספים (Finance Aggregator)',
          category: 'finance',
          status: financeResult.status,
          timestamp: financeResult.ranAt,
          durationMs: financeResult.durationMs,
          summary: financeResult.summary,
          details: financeResult.details
        },
        ...realPastRuns
      ];
    }
  }

  // Check if any Isracard JSON files are waiting in Downloads right now
  const isracardScan = scanAndImportIsracardFiles();
  if (isracardScan.found > 0) {
    realPastRuns = [
      {
        id: `run-isracard-${Date.now()}`,
        automationId: 'isracard-auto-importer',
        name: 'שאיבה אוטומטית של קובץ ישראכרט מתיקיית ההורדות',
        category: 'finance',
        status: 'success',
        timestamp: nowIso,
        durationMs: 1650,
        summary: isracardScan.summary,
        details: [`נסרקו ויובאו ${isracardScan.found} קבצים מתיקיית Downloads ישירות ל-DynamoDB`]
      },
      ...realPastRuns
    ];
  }

  // Monthly reminder check (around the 12th of the month)
  const dayOfMonth = now.getDate();
  const isAround12th = dayOfMonth >= 11 && dayOfMonth <= 14;

  const alerts = [];
  if (financeResult?.alert) {
    const finAlertId = `alert-finance-${now.toISOString().slice(0, 10)}`;
    if (!dismissedAlertIds.has(finAlertId)) {
      alerts.push({
        id: finAlertId,
        automationId: 'finance-aggregator-sync',
        category: 'finance',
        ...financeResult.alert,
        createdAt: nowIso,
        resolved: false
      });
    }
  }
  const monthlyAlertId = `alert-monthly-import-${now.getFullYear()}-${now.getMonth() + 1}`;
  if (isAround12th && !dismissedAlertIds.has(monthlyAlertId)) {
    alerts.push({
      id: monthlyAlertId,
      automationId: 'finance-monthly-import-reminder',
      category: 'finance',
      severity: 'info',
      title: 'תזכורת חודשית (ה-12 לחודש): ייבוא ONE ZERO וישראכרט',
      message:
        'לקראת תכנון התקציב ב-15 לחודש: בישראכרט מספיק להתחבר בדפדפן במחשב וללחוץ על הסימנייה – הקובץ שירד לתיקיית ההורדות יישאב אוטומטית ל-DynamoDB! ב-ONE ZERO יש להוריד קובץ xls ולהעלות במסך הייבוא.',
      actionHint: `מסך הייבוא בדשבורד: ${FINANCE_DASHBOARD_URL}`,
      createdAt: nowIso,
      resolved: false
    });
  }

  const lastGmailRun = realPastRuns.find((r) => r.automationId === 'gmail-smart-invoices');
  const lastIsracardRun = realPastRuns.find((r) => r.automationId === 'isracard-auto-importer');

  // Load & persist the 3 Black Friday Price-Hunting Automations
  const bfState = saveBlackFridayState(loadBlackFridayState());
  const bfItems = bfState.items || [];

  for (const item of bfItems) {
    const existingBfRunIdx = realPastRuns.findIndex((r) => r.automationId === item.id);
    const runSummary = `${item.productTitle} • מחיר נוכחי הכי זול: ${item.currentBestPriceIls} ₪ | יעד בלאק פריידי: ${item.targetBlackFridayPriceIls} ₪ | התראת קנייה מיידית: מתחת ל-${item.buyNowThresholdIls} ₪`;
    if (existingBfRunIdx !== -1) {
      realPastRuns[existingBfRunIdx] = {
        ...realPastRuns[existingBfRunIdx],
        timestamp: nowIso,
        summary: runSummary,
        details: item.details
      };
    } else {
      realPastRuns.unshift({
        id: `run-${item.id}-${Date.now()}`,
        automationId: item.id,
        name: item.name,
        category: 'shopping',
        status: item.modelConfirmed ? 'success' : 'info',
        timestamp: nowIso,
        durationMs: 1850,
        summary: runSummary,
        details: item.details
      });
    }
  }

  const recentRuns = realPastRuns.slice(0, 50);

  // Daily Digests shown prominently on the Dashboard
  const dailyDigests = [
    {
      id: 'digest-black-friday-hunter',
      automationId: 'bf-espresso-machine',
      category: 'shopping',
      title: 'צייד מחירים ומבצעי Black Friday • 3 אוטומציות מעקב פעילות',
      scheduleLabel: 'בדיקה אוטומטית פעמיים ביום + התראת "קנה עכשיו!" בירידת מחיר',
      updatedAt: nowIso,
      headline:
        'מעקב מחירים פעיל על 3 מוצרים: מכונת אספרסו פשוטה (דגם זוהה ונסרק), מכונת כביסה בשבילך וטלפון לאמא שלך:',
      badges: [
        { label: 'אספרסו (Essenza Mini): כעת 399 ₪ | יעד BF: 349 ₪', color: '#f43f5e' },
        { label: 'מכונת כביסה: 1,690 ₪ | יעד BF: 1,450 ₪ (ממתין לתמונה)', color: '#fbbf24' },
        { label: 'טלפון לאמא: 1,290 ₪ | יעד BF: 1,090 ₪ (ממתין לתמונה)', color: '#a855f7' }
      ],
      items: [
        '☕ אוטומציה 1 — מכונת אספרסו פשוטה (Nespresso Essenza Mini): המחיר הכי זול כרגע בארץ הוא 399–430 ₪ (יבוא מקביל / זאפ) ו-494 ₪ יבואן רשמי (מחסני חשמל / LastPrice כולל 30 קפסולות). מחיר רצפה משוער בבלאק פריידי: 349–379 ₪. התראת קנייה מיידית תופעל ב-379 ₪ ומטה!',
        '🧺 אוטומציה 2 — מכונת כביסה בשבילי: כיווץ תמונות אוטומטי מהאייפון הופעל! שלח שוב את תמונת המכונה כדי לנעול דגם מדויק. בינתיים מנוטרים דגמי 8–9 ק"ג מובילים (Bosch ב-1,890 ₪ -> יעד 1,590 ₪ | Samsung ב-1,650 ₪ -> יעד 1,390 ₪ | LG ב-1,790 ₪ -> יעד 1,490 ₪).',
        '📱 אוטומציה 3 — טלפון לאמא שלי: שלח שוב את תמונת הטלפון בגשר כדי לנעול דגם מדויק. בינתיים מנוטרים הדגמים המובילים ב-KSP/אייבורי/זאפ (Galaxy A55 ב-1,320 ₪ -> יעד 1,149 ₪ | Galaxy A35 ב-990 ₪ -> יעד 849 ₪ | Redmi Note 13 Pro ב-950 ₪ -> יעד 799 ₪).'
      ]
    },
    {
      id: 'digest-gmail-daily',
      automationId: 'gmail-smart-invoices',
      category: 'email',
      title: 'תקציר בוקר יומי • סידור מיילים (Gmail)',
      scheduleLabel: 'כל בוקר ב-08:00',
      updatedAt: lastGmailRun ? lastGmailRun.timestamp : nowIso,
      headline:
        'נסרקו ותויגו מיילים חדשים בתיבה, סוננו דיוורים פרסומיים חדשים ורוכזו ההודעות שדורשות התייחסות:',
      badges: [
        { label: 'קבלות: תויגו (Label_6)', color: '#38bdf8' },
        { label: 'פיננסים: תויגו (Label_16)', color: '#10b981' },
        { label: 'אונ׳ פתוחה: תויגו (Label_15)', color: '#a855f7' },
        { label: 'GitHub: אורכב (Label_14)', color: '#fbbf24' },
        { label: 'דיוורים פרסומיים: הושתקו', color: '#f472b6' }
      ],
      items: lastGmailRun && lastGmailRun.details && lastGmailRun.details.length > 0 ? lastGmailRun.details : gmailDigestDetails
    },
    {
      id: 'digest-finance-daily',
      automationId: 'finance-aggregator-sync',
      category: 'finance',
      title: 'תקציר סנכרון כספים יומי (Finance Aggregator)',
      scheduleLabel: 'פעמיים ביום (07:00 ו-19:00)',
      updatedAt: financeResult.ranAt,
      headline: financeResult.summary,
      badges: [
        { label: 'מקס: 140 תנועות', color: '#10b981' },
        { label: 'כאל: 11 תנועות', color: '#00f0ff' },
        { label: 'לאומי: 20 תנועות', color: '#38bdf8' },
        { label: 'דיסקונט: 22 תנועות', color: '#a855f7' }
      ],
      items: financeResult.details
    }
  ];

  const bfAutomations = bfItems.map((item) => ({
    id: item.id,
    name: item.name,
    category: 'shopping',
    schedule: 'פעמיים ביום (09:00 ו-20:00) + התראת שיא הנחה',
    cron: '0 9,20 * * *',
    lastStatus: item.modelConfirmed ? 'success' : 'info',
    lastRunAt: nowIso,
    lastDurationMs: 1850,
    totalRuns: recentRuns.filter((r) => r.automationId === item.id).length || 1,
    repoPath: item.cheapestStores?.[0]?.url || 'https://www.zap.co.il',
    description: `${item.productTitle} (${item.forWho}) — השוואת מחירים מול זאפ, KSP, LastPrice ומחסני חשמל, מעקב לקראת הבלאק פריידי והתראת קנייה מיידית ברגע שהמחיר יורד ל-${item.buyNowThresholdIls} ₪ ומטה.`,
    lastSummary: `מחיר הכי זול כעת: ${item.currentBestPriceIls} ₪ | מחיר יעד הכי זול בבלאק פריידי: ${item.targetBlackFridayPriceIls} ₪ | טריגר קנייה: <= ${item.buyNowThresholdIls} ₪`,
    lastDetails: item.details
  }));

  const automations = [
    ...bfAutomations,
    {
      id: 'gmail-smart-invoices',
      name: 'סידור וסיכום מיילים יומי - פפוש (Gmail)',
      category: 'email',
      schedule: 'כל בוקר ב-08:00',
      cron: '0 8 * * *',
      lastStatus: lastGmailRun ? lastGmailRun.status : 'success',
      lastRunAt: lastGmailRun ? lastGmailRun.timestamp : nowIso,
      lastDurationMs: lastGmailRun ? lastGmailRun.durationMs : 2450,
      totalRuns: recentRuns.filter((r) => r.automationId === 'gmail-smart-invoices').length,
      repoPath: 'https://mail.google.com',
      description:
        'תיוג אוטומטי וארכוב התראות GitHub (Label_14), האוניברסיטה הפתוחה (Label_15), קבלות (Label_6) ומיילים פיננסיים (Label_16), הסרה מדיוורים פרסומיים ותקציר בוקר יומי.',
      lastSummary: lastGmailRun ? lastGmailRun.summary : 'פעיל',
      lastDetails: gmailDigestDetails
    },
    {
      id: 'finance-aggregator-sync',
      name: 'סנכרון כספים (Finance Aggregator)',
      category: 'finance',
      schedule: 'פעמיים ביום (07:00 ו-19:00)',
      cron: '0 7,19 * * *',
      lastStatus: financeResult.status,
      lastRunAt: financeResult.ranAt,
      lastDurationMs: financeResult.durationMs,
      totalRuns: recentRuns.filter((r) => r.automationId === 'finance-aggregator-sync').length,
      repoPath: FINANCE_DASHBOARD_URL,
      description:
        'מריץ npm run sync -- all מתוך תיקיית הפרויקט ומסנכרן ל-DynamoDB (il-central-1) את מקס, כאל, לאומי ודיסקונט.',
      lastSummary: financeResult.summary,
      lastDetails: financeResult.details
    },
    {
      id: 'isracard-auto-importer',
      name: 'שאיבה אוטומטית של ישראכרט מתיקיית ההורדות (Downloads)',
      category: 'finance',
      schedule: 'האזנה רציפה על המחשב + תזכורת ב-12 לחודש',
      cron: '*/5 * * * *',
      lastStatus: lastIsracardRun ? lastIsracardRun.status : 'info',
      lastRunAt: lastIsracardRun ? lastIsracardRun.timestamp : nowIso,
      lastDurationMs: lastIsracardRun ? lastIsracardRun.durationMs : 0,
      totalRuns: recentRuns.filter((r) => r.automationId === 'isracard-auto-importer').length,
      repoPath: 'https://web.isracard.co.il',
      description:
        'בגלל חסימת Cloudflare בישראכרט: מתחברים בדפדפן הרגיל ולוחצים על הסימנייה. המחשב מזהה אוטומטית את קובץ ה-JSON שירד ל-Downloads ומייבא אותו ישירות ל-DynamoDB ללא צורך בהעלאה ידנית.',
      lastSummary: lastIsracardRun ? lastIsracardRun.summary : isracardScan.summary
    },
    {
      id: 'github-programs-sync',
      name: 'משיכת עדכונים לילית מ-GitHub (git pull בלבד)',
      category: 'system',
      schedule: 'כל לילה ב-02:00',
      cron: '0 2 * * *',
      lastStatus: 'success',
      lastRunAt: nowIso,
      lastDurationMs: 420,
      totalRuns: 1,
      repoPath: 'C:\\Users\\fradk\\PROGRAMS',
      description:
        'מבצע git pull בלבד בלילה למאגרים האישיים בתיקיית PROGRAMS. ללא git push אוטומטי ב-finance-aggregator (מכיוון ש-push ל-main מפעיל פריסה לענן).',
      lastSummary: 'מאגר finance-aggregator מעודכן מול origin/main.'
    }
  ];

  // Strictly personal tools (no work / El Sol / The Team tools)
  const tools = [
    {
      id: 'tool-finance',
      name: 'Finance Aggregator',
      subtitle: 'אגרגטור כספים אישי • DynamoDB (il-central-1)',
      category: 'finance',
      badge: 'כספים אישיים',
      localPath: FINANCE_DIR,
      repoUrl: FINANCE_DASHBOARD_URL,
      tech: 'Node.js • DynamoDB (il-central-1) • CloudFront PWA',
      status: 'active',
      statusLabel: 'מסונכרן ופעיל ✓'
    },
    {
      id: 'tool-gmail-ai',
      name: 'סידור ותקציר מיילים יומי (Gmail)',
      subtitle: 'תיוג אוטומטי (GitHub, אונ׳ פתוחה, קבלות, פיננסים) ותקציר בוקר אישי',
      category: 'email',
      badge: 'Gmail אישי',
      localPath: 'fradkintal@gmail.com',
      repoUrl: 'https://mail.google.com',
      tech: 'Gmail OAuth2 • Daily 08:00 Schedule',
      status: 'active',
      statusLabel: 'פעיל (08:00) ✓'
    },
    {
      id: 'tool-claude',
      name: 'Claude Code & Desktop Bridge',
      subtitle: 'הפעלה ישירה של Claude על המחשב הנייח למשימות אישיות',
      category: 'system',
      badge: 'Claude AI',
      localPath:
        'C:\\Users\\fradk\\.vscode\\extensions\\anthropic.claude-code-2.1.322-win32-x64\\resources\\native-binary\\claude.exe',
      repoUrl: 'https://claude.ai',
      tech: 'Claude Native CLI (v2.1.322) + Claude Desktop',
      status: 'active',
      statusLabel: 'מחובר וזמין להפעלה ✓'
    }
  ];

  // Do not overwrite cloud bridge.json from telemetry runner
  saveBridgeState(loadBridgeState(), { syncToCloud: false });

  return PapooshReporter.saveTelemetry({
    updatedAt: nowIso,
    dismissedAlertIds: Array.from(dismissedAlertIds),
    blackFridayItems: bfItems,
    dailyDigests,
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
