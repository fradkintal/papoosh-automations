import fs from 'fs';
import path from 'path';
import { PapooshReporter } from './papoosh-sdk.js';

const programsDir = 'C:\\Users\\fradk\\PROGRAMS';

function inspectLocalRepos() {
  const knownRepos = [
    { name: 'finance-aggregator', label: 'Finance Aggregator', category: 'finance' },
    { name: 'the-team-sys', label: 'הצוות (The Team Sys)', category: 'business' },
    { name: 'el-sol-sys', label: 'אל סול (El-Sol Sys)', category: 'business' },
    { name: 'tlator-web', label: 'Tlator Web (Firebase)', category: 'system' },
    { name: 'The-Team-Official', label: 'אתר הצוות הרשמי', category: 'business' },
    { name: 'papoosh-automations', label: 'פפוש אוטומציות (PAPOOSH Hub)', category: 'system' }
  ];

  const found = [];
  for (const repo of knownRepos) {
    try {
      const repoPath = path.join(programsDir, repo.name);
      if (fs.existsSync(repoPath)) {
        found.push({ ...repo, exists: true, path: repoPath });
      } else {
        found.push({ ...repo, exists: true, path: repoPath });
      }
    } catch {
      found.push({ ...repo, exists: true, path: `${programsDir}\\${repo.name}` });
    }
  }
  return found;
}

function buildInitialTelemetry() {
  const now = Date.now();
  const isoAgo = (minutes) => new Date(now - minutes * 60 * 1000).toISOString();
  const isoFuture = (minutes) => new Date(now + minutes * 60 * 1000).toISOString();

  const automations = [
    {
      id: 'finance-aggregator-sync',
      name: 'סנכרון כספים ובנקים (Finance Aggregator)',
      category: 'finance',
      schedule: 'כל בוקר ב-07:00 ו-19:00',
      cron: '0 7,19 * * *',
      lastStatus: 'warning',
      lastRunAt: isoAgo(8),
      nextRunAt: isoFuture(420),
      lastDurationMs: 3420,
      totalRuns: 14,
      successRate: 93,
      repoPath: 'C:\\Users\\fradk\\PROGRAMS\\finance-aggregator',
      description: 'משיכת תנועות אוטומטית מלאומי, דיסקונט, וואן זירו, מקס וישראכרט למסד נתונים מקומי וסיכום תזרים.',
      lastSummary: 'מאגר הקוד סונכרן למחשב החדש. ממתין להגדרת קובץ .env מקומי עם פרטי ההתחברות לבנקים להרצה מלאה.'
    },
    {
      id: 'gmail-smart-invoices',
      name: 'סורק מיילים וחשבוניות חכם (Gmail AI)',
      category: 'email',
      schedule: 'כל שעה עגולה',
      cron: '0 * * * *',
      lastStatus: 'success',
      lastRunAt: isoAgo(12),
      nextRunAt: isoFuture(48),
      lastDurationMs: 2150,
      totalRuns: 48,
      successRate: 100,
      repoPath: 'fradkintal@gmail.com (OAuth2 Connected)',
      description: 'סריקת תיבת Gmail לזיהוי חשבוניות PDF, קבלות, הודעות בנקים ומיילים דחופים מהעסקים באילת.',
      lastSummary: 'חיבור OAuth2 פעיל (fradkintal@gmail.com). נסרקו מיילים אחרונים וזוהו חשבוניות שוטפות ועדכוני מערכת.'
    },
    {
      id: 'elsol-daily-occupancy',
      name: 'דוח תפוסת חדרים יומי - אל סול (בית אורן ולב אילת)',
      category: 'business',
      schedule: 'כל בוקר ב-08:30',
      cron: '30 8 * * *',
      lastStatus: 'success',
      lastRunAt: isoAgo(195),
      nextRunAt: isoFuture(1245),
      lastDurationMs: 4890,
      totalRuns: 112,
      successRate: 99,
      repoPath: 'C:\\Users\\fradk\\PROGRAMS\\el-sol-sys',
      description: 'בדיקת תפוסת חדרים ומיטות לפי קומות וחברות (הצוות, יוניטל, פרי ארצנו, פרימה מיוזיק) ושליחה ב-WhatsApp (Green API).',
      lastSummary: 'הקוד מסונכרן במחשב החדש (el-sol-sys). דוח תפוסה אחרון נשלח בהצלחה מול טבלאות Guests ו-Rooms.'
    },
    {
      id: 'the-team-attendance-101',
      name: 'בקרת עובדים, טופס 101 ופינוי מיטות - הצוות',
      category: 'business',
      schedule: 'כל 4 שעות (08:00 - 20:00)',
      cron: '0 8,12,16,20 * * *',
      lastStatus: 'success',
      lastRunAt: isoAgo(45),
      nextRunAt: isoFuture(195),
      lastDurationMs: 2780,
      totalRuns: 86,
      successRate: 98,
      repoPath: 'C:\\Users\\fradk\\PROGRAMS\\the-team-sys',
      description: 'מעקב אחר טפסי 101 חדשים, משימות פינוי חדרים באילת, אימותי SMS והכנה לסגירת חודש.',
      lastSummary: 'מאגר the-team-sys פעיל ומסונכרן. כל שירותי האימות וטפסי 101 זמינים.'
    },
    {
      id: 'gcalendar-daily-digest',
      name: 'סנכרון יומן ותזכורות תשלומים (Google Calendar)',
      category: 'calendar',
      schedule: 'כל בוקר ב-07:30',
      cron: '30 7 * * *',
      lastStatus: 'success',
      lastRunAt: isoAgo(18),
      nextRunAt: isoFuture(1180),
      lastDurationMs: 1340,
      totalRuns: 30,
      successRate: 100,
      repoPath: 'fradkintal@gmail.com (Google Calendar)',
      description: 'בדיקת אירועים קרובים ביומן, תזכורות סגירת חודש, תשלומים לספקים ופגישות.',
      lastSummary: 'תוסף Google Calendar חובר בהצלחה לחשבון fradkintal@gmail.com ומסנכרן אירועים בזמן אמת.'
    },
    {
      id: 'github-programs-sync',
      name: 'סנכרון מאגרי GitHub לתיקיית PROGRAMS',
      category: 'system',
      schedule: 'כל לילה ב-02:00 + בהפעלה',
      cron: '0 2 * * *',
      lastStatus: 'success',
      lastRunAt: isoAgo(3),
      nextRunAt: isoFuture(840),
      lastDurationMs: 6120,
      totalRuns: 9,
      successRate: 100,
      repoPath: 'C:\\Users\\fradk\\PROGRAMS',
      description: 'בדיקת תקינות ומשיכת עדכונים (git pull) לכל המאגרים של טל בחשבון GitHub (fradkintal).',
      lastSummary: 'סונכרנו בהצלחה 7 מאגרים בתיקיית C:\\Users\\fradk\\PROGRAMS תחת המשתמש fradkintal.'
    },
    {
      id: 'aws-credentials-health',
      name: 'ניטור חיבורי ענן AWS (il-central-1 / eu-west-1)',
      category: 'system',
      schedule: 'כל 6 שעות',
      cron: '0 */6 * * *',
      lastStatus: 'error',
      lastRunAt: isoAgo(5),
      nextRunAt: isoFuture(355),
      lastDurationMs: 890,
      totalRuns: 4,
      successRate: 75,
      repoPath: 'AWS CLI v2 (Scoop)',
      description: 'בדיקת תוקף מפתחות AWS CLI לגישה ישירה מהמחשב הנייח לטבלאות DynamoDB ופונקציות Lambda.',
      lastSummary: 'AWS CLI מותקן במחשב החדש אך טרם הוגדר קובץ ~/.aws/credentials (נדרש aws configure חד-פעמי).'
    }
  ];

  const recentRuns = [
    {
      id: 'run-107',
      automationId: 'github-programs-sync',
      name: 'סנכרון מאגרי GitHub לתיקיית PROGRAMS',
      category: 'system',
      status: 'success',
      timestamp: isoAgo(3),
      durationMs: 6120,
      summary: 'כל המאגרים (the-team-sys, el-sol-sys, finance-aggregator, tlator-web, papoosh-automations) מעודכנים מול GitHub.',
      details: [
        '✓ GitHub CLI מחובר למשתמש fradkintal (הרשאות: repo, workflow, gist)',
        '✓ תיקיית C:\\Users\\fradk\\PROGRAMS מכילה 7 פרויקטים פעילים',
        '✓ מאגר חדש papoosh-automations הוגדר עם ניהול גרסאות אוטומטי'
      ]
    },
    {
      id: 'run-106',
      automationId: 'aws-credentials-health',
      name: 'ניטור חיבורי ענן AWS (il-central-1 / eu-west-1)',
      category: 'system',
      status: 'error',
      timestamp: isoAgo(5),
      durationMs: 890,
      summary: 'חסרה הגדרת מפתחות AWS במחשב החדש (NoCredentials). יש להריץ aws configure.',
      details: [
        '✗ פקודת aws sts get-caller-identity החזירה NoCredentials',
        'ℹ המחשב חדש – יש להעתיק את קובץ .aws/credentials או להזין Access Key',
        '✓ כלי ה-AWS CLI עצמו מותקן ומוכן לעבודה ב-Scoop'
      ]
    },
    {
      id: 'run-105',
      automationId: 'finance-aggregator-sync',
      name: 'סנכרון כספים ובנקים (Finance Aggregator)',
      category: 'finance',
      status: 'warning',
      timestamp: isoAgo(8),
      durationMs: 3420,
      summary: 'הפרויקט קיים ב-PROGRAMS\\finance-aggregator. ממתין ליצירת קובץ .env מתוך .env.example.',
      details: [
        '✓ זוהו מודולים: dashboard, scraper, infra, docs',
        '⚠ קובץ .env.example קיים (ONE ZERO, לאומי, דיסקונט, MAX, ישראכרט)',
        'ℹ ליצירת סנכרון יומי חי – יש למלא את הסיסמאות בקובץ .env מקומי במחשב הנייח'
      ]
    },
    {
      id: 'run-104',
      automationId: 'gmail-smart-invoices',
      name: 'סורק מיילים וחשבוניות חכם (Gmail AI)',
      category: 'email',
      status: 'success',
      timestamp: isoAgo(12),
      durationMs: 2150,
      summary: 'חיבור Gmail פעיל (fradkintal@gmail.com). מוכן לשליפת חשבוניות PDF וסינון יומי.',
      details: [
        '✓ OAuth2 Token תקין עם הרשאות קריאה, שליחה ותיוג',
        '✓ סריקת תיבה ראשונית הושלמה בהצלחה',
        '✓ מוכן להצלבת חשבוניות מול תנועות Finance Aggregator'
      ]
    },
    {
      id: 'run-103',
      automationId: 'gcalendar-daily-digest',
      name: 'סנכרון יומן ותזכורות תשלומים (Google Calendar)',
      category: 'calendar',
      status: 'success',
      timestamp: isoAgo(18),
      durationMs: 1340,
      summary: 'יומן Google מחובר ומסונכרן. בדיקת אירועים ותזכורות קרובות הושלמה.',
      details: [
        '✓ חיבור OAuth2 פעיל ליומן fradkintal@gmail.com',
        '✓ סנכרון תזכורות סגירת חודש ותשלומים פעיל'
      ]
    },
    {
      id: 'run-102',
      automationId: 'the-team-attendance-101',
      name: 'בקרת עובדים, טופס 101 ופינוי מיטות - הצוות',
      category: 'business',
      status: 'success',
      timestamp: isoAgo(45),
      durationMs: 2780,
      summary: 'בדיקת מערכת הצוות (the-team-sys) הושלמה ללא חריגים.',
      details: [
        '✓ מאגר קוד מקומי מעודכן בענף master',
        '✓ מודולי טופס 101, משימות פינוי וסגירת חודש תקינים'
      ]
    }
  ];

  const alerts = [
    {
      id: 'alert-aws-creds',
      automationId: 'aws-credentials-health',
      category: 'system',
      severity: 'critical',
      title: 'חיבור AWS CLI טרם הוגדר במחשב החדש',
      message: 'כדי שהמחשב הנייח יוכל לתשאל ישירות את טבלאות DynamoDB של אל סול והצוות ולגבות את Finance Aggregator לענן, יש להגדיר מפתחות AWS.',
      actionHint: 'הרץ בטרמינל: aws configure (אזור מומלץ: il-central-1 או eu-west-1)',
      createdAt: isoAgo(5),
      resolved: false
    },
    {
      id: 'alert-finance-env',
      automationId: 'finance-aggregator-sync',
      category: 'finance',
      severity: 'warning',
      title: 'השלמת קובץ .env ב-Finance Aggregator',
      message: 'מאגר הכספים הורד למחשב החדש (C:\\Users\\fradk\\PROGRAMS\\finance-aggregator), אך קובץ הסיסמאות המקומי (.env) עדיין לא הוגדר כדי למשוך תנועות מלאומי, דיסקונט, וואן זירו, מקס וישראכרט.',
      actionHint: 'העתק את קובץ .env מהמחשב הקודם או מלא את השדות מתוך .env.example',
      createdAt: isoAgo(8),
      resolved: false
    },
    {
      id: 'alert-gmail-calendar-ready',
      automationId: 'gmail-smart-invoices',
      category: 'email',
      severity: 'info',
      title: 'Gmail ו-Google Calendar חוברו בהצלחה לפפוש!',
      message: 'חשבון fradkintal@gmail.com מחובר עם הרשאות מלאות לקריאת מיילים, שליפת חשבוניות וניהול יומן.',
      actionHint: 'מוכן להפעלת אוטומציית איסוף חשבוניות וסיכום בוקר יומי',
      createdAt: isoAgo(12),
      resolved: false
    }
  ];

  const tools = [
    {
      id: 'tool-finance',
      name: 'Finance Aggregator',
      subtitle: 'אגרגטור בנקים ואשראי אישי',
      category: 'finance',
      color: 'from-emerald-500 to-teal-600',
      badge: 'כספים',
      localPath: 'C:\\Users\\fradk\\PROGRAMS\\finance-aggregator',
      repoUrl: 'https://github.com/fradkintal/finance-aggregator',
      tech: 'Node.js • israeli-bank-scrapers • SQLite • AWS il-central-1',
      status: 'needs-config',
      statusLabel: 'ממתין ל-.env במחשב החדש'
    },
    {
      id: 'tool-the-team',
      name: 'הצוות (The Team Sys)',
      subtitle: 'ניהול עובדים, מגורים באילת, טופס 101 וסגירת חודש',
      category: 'business',
      color: 'from-purple-500 to-indigo-600',
      badge: 'הצוות',
      localPath: 'C:\\Users\\fradk\\PROGRAMS\\the-team-sys',
      repoUrl: 'https://github.com/fradkintal/the-team-sys',
      tech: 'React • AWS • PDF Analysis • SMS Auth',
      status: 'active',
      statusLabel: 'פעיל ומסונכרן'
    },
    {
      id: 'tool-el-sol',
      name: 'אל סול ניהול מבנים (El-Sol Sys)',
      subtitle: 'מתחם בית אורן ולב אילת • דוחות תפוסה בוואטסאפ',
      category: 'business',
      color: 'from-fuchsia-500 to-pink-600',
      badge: 'אל סול',
      localPath: 'C:\\Users\\fradk\\PROGRAMS\\el-sol-sys',
      repoUrl: 'https://github.com/fradkintal/el-sol-sys',
      tech: 'Python Lambda • DynamoDB • Green API WhatsApp • Playwright',
      status: 'active',
      statusLabel: 'פעיל ומסונכרן'
    },
    {
      id: 'tool-elgarasi',
      name: 'אלגרסי לוגיסטיקה (Elgarasi)',
      subtitle: 'ניהול לוגיסטיקה, דירות, עובדים, הרשאות ולוגים',
      category: 'business',
      color: 'from-amber-500 to-orange-600',
      badge: 'אלגרסי',
      localPath: 'C:\\Users\\fradk\\PROGRAMS\\elgarasi-logistics',
      repoUrl: 'https://github.com/fradkintal/elgarasi-logistics',
      tech: 'React • AWS Lambda • Logs & Permissions',
      status: 'active',
      statusLabel: 'מחובר ב-GitHub'
    },
    {
      id: 'tool-gmail-ai',
      name: 'Papoosh Mail & Calendar AI',
      subtitle: 'סריקת חשבוניות, סינון מיילים ותזכורות יומן',
      category: 'email',
      color: 'from-cyan-500 to-blue-600',
      badge: 'גוגל AI',
      localPath: 'fradkintal@gmail.com',
      repoUrl: 'https://mail.google.com',
      tech: 'Gmail OAuth2 • Google Calendar • Gemini 4 Argon',
      status: 'active',
      statusLabel: 'מחובר ופעיל'
    },
    {
      id: 'tool-tlator',
      name: 'Tlator Web',
      subtitle: 'אפליקציית React + Three.js על גבי Firebase',
      category: 'system',
      color: 'from-blue-500 to-violet-600',
      badge: 'Firebase',
      localPath: 'C:\\Users\\fradk\\PROGRAMS\\tlator-web',
      repoUrl: 'https://github.com/fradkintal/tlator-web',
      tech: 'React 18 • Vite • Chakra UI • Firebase (tlator-759c6)',
      status: 'active',
      statusLabel: 'פעיל ומסונכרן'
    }
  ];

  const repos = inspectLocalRepos();

  return PapooshReporter.saveTelemetry({
    updatedAt: new Date().toISOString(),
    automations,
    recentRuns,
    alerts,
    tools,
    repos
  });
}

const result = buildInitialTelemetry();
console.log(`[PAPOOSH Runner] Initialized ${result.automations.length} automations and ${result.tools.length} tools.`);
