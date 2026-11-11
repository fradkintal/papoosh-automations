import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import { PapooshReporter } from './papoosh-sdk.js';
import { runClaudeTask, launchClaudeDesktopGui, shouldConsultClaude } from './ask-claude.js';
import { scanAndImportIsracardFiles } from './auto-import-downloads.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const bridgeFilePath = path.join(rootDir, 'public', 'data', 'bridge.json');
const incomingFilesDir = 'C:\\Users\\fradk\\PROGRAMS\\papoosh-automations\\incoming-files';
const downloadsDir = 'C:\\Users\\fradk\\Downloads';
const PORT = Number(process.env.PAPOOSH_BRIDGE_PORT || 4041);

export function loadBridgeState() {
  if (fs.existsSync(bridgeFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(bridgeFilePath, 'utf8'));
      if (!parsed.files) parsed.files = [];
      parsed.orchestratorMode = 'papoosh-primary-with-claude-subagent';
      return parsed;
    } catch {
      // fallback below
    }
  }
  return {
    updatedAt: new Date().toISOString(),
    orchestratorMode: 'papoosh-primary-with-claude-subagent',
    incomingFilesDir,
    claudeStatus: {
      cliInstalled: true,
      role: 'עוזר עומק אוטומטי מנוהל על ידי פפוש (Antigravity)',
      cliPath:
        'C:\\Users\\fradk\\.vscode\\extensions\\anthropic.claude-code-2.1.322-win32-x64\\resources\\native-binary\\claude.exe',
      desktopInstallerPath: 'C:\\Users\\fradk\\Downloads\\Claude Setup.exe'
    },
    files: [],
    links: [
      {
        id: 'link-finance-dashboard',
        title: 'דשבורד כספים אישי (Finance Aggregator)',
        url: 'https://d2ezttw1p31agb.cloudfront.net',
        category: 'finance',
        note: 'מסך התוכנית, התנועות והעלאת קובצי ONE ZERO / ישראכרט',
        addedAt: new Date().toISOString()
      },
      {
        id: 'link-isracard-web',
        title: 'אתר ישראכרט החדש (להתחברות ולחיצה על הסימנייה)',
        url: 'https://web.isracard.co.il',
        category: 'finance',
        note: 'לאחר ההתחברות בדפדפן במחשב, לחיצה על הסימנייה מורידה קובץ JSON שנשאב אוטומטית מתיקיית Downloads ל-DynamoDB',
        addedAt: new Date().toISOString()
      },
      {
        id: 'link-papoosh-github',
        title: 'מאגר GitHub - פפוש אוטומציות',
        url: 'https://github.com/fradkintal/papoosh-automations',
        category: 'system',
        note: 'קוד המקור, היסטוריית הגרסאות והגדרות ה-Actions של האפליקציה',
        addedAt: new Date().toISOString()
      }
    ],
    messages: [
      {
        id: 'msg-welcome-bridge',
        sender: 'agent',
        target: 'tal',
        timestamp: new Date().toISOString(),
        text: 'גשר PAPOOSH פעיל! אני מקבל כאן את כל המשימות והקבצים שלך במרוכז (תמונות, PDF, JSON, XLS או מסמכים), שומר אותם בתיקיית incoming-files במחשב, ומפעיל אוטומטית גם את Claude כעוזר עומק מתי שצריך.'
      }
    ]
  };
}

export function saveBridgeState(state, { syncToGit = false } = {}) {
  state.updatedAt = new Date().toISOString();
  state.incomingFilesDir = incomingFilesDir;
  fs.mkdirSync(path.dirname(bridgeFilePath), { recursive: true });
  fs.writeFileSync(bridgeFilePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  if (syncToGit) {
    try {
      spawnSync('git', ['add', 'public/data/bridge.json', 'public/data/telemetry.json'], { cwd: rootDir });
      spawnSync('git', ['commit', '-m', 'chore(bridge): sync live bridge messages, files and links'], { cwd: rootDir });
      spawnSync('git', ['push', 'origin', 'main'], { cwd: rootDir });
    } catch {
      // ignore git errors
    }
  }
  return state;
}

/**
 * Saves uploaded files (base64 encoded) from the Web App to `incoming-files/` on the PC.
 */
export function saveIncomingAttachments(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  fs.mkdirSync(incomingFilesDir, { recursive: true });

  const saved = [];
  for (const att of attachments) {
    if (!att || !att.name || !att.contentBase64) continue;
    const safeName = path.basename(att.name).replace(/[<>:"/\\|?*]+/g, '_');
    const stampedName = `${Date.now()}-${safeName}`;
    const targetPath = path.join(incomingFilesDir, stampedName);

    const base64Clean = String(att.contentBase64).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    fs.writeFileSync(targetPath, buffer);

    // If the user uploaded an Isracard export JSON (`isracard-*.json`), also copy to Downloads so auto-importer picks it up
    if (/^isracard-.*\.json$/i.test(safeName) && fs.existsSync(downloadsDir)) {
      const dlCopy = path.join(downloadsDir, safeName);
      fs.writeFileSync(dlCopy, buffer);
    }

    saved.push({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: safeName,
      size: buffer.length,
      type: att.type || 'application/octet-stream',
      savedPath: targetPath,
      uploadedAt: new Date().toISOString()
    });
  }

  return saved;
}

export function addBridgeLink({ title, url, category = 'system', note = '', syncToGit = false }) {
  const state = loadBridgeState();
  const entry = {
    id: `link-${Date.now()}`,
    title,
    url,
    category,
    note,
    addedAt: new Date().toISOString()
  };
  state.links = [entry, ...(state.links || [])];
  return saveBridgeState(state, { syncToGit });
}

export function addBridgeMessage({
  sender = 'tal',
  target = 'agent',
  text,
  attachments = [],
  claudeAssisted = false,
  actionType = 'task',
  syncToGit = false
}) {
  const state = loadBridgeState();
  if (attachments && attachments.length > 0) {
    state.files = [...attachments, ...(state.files || [])].slice(0, 50);
  }
  const entry = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    sender,
    target,
    actionType,
    claudeAssisted,
    attachments,
    timestamp: new Date().toISOString(),
    text
  };
  state.messages = [entry, ...(state.messages || [])].slice(0, 100);
  return saveBridgeState(state, { syncToGit });
}

function startLocalBridgeServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url?.startsWith('/api/status')) {
      const telemetry = PapooshReporter.loadTelemetry();
      const bridge = loadBridgeState();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, telemetry, bridge }));
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/api/action')) {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          const payload = JSON.parse(body || '{}');
          const { type, text, prompt, alertId, attachments } = payload;

          if (type === 'dismiss-alert' && alertId) {
            const updatedTelemetry = PapooshReporter.dismissAlert(alertId, { syncToGit: true });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, telemetry: updatedTelemetry }));
            return;
          }

          if (type === 'open-isracard') {
            spawn('cmd', ['/c', 'start', 'https://web.isracard.co.il'], { detached: true, stdio: 'ignore' }).unref();
            const updated = addBridgeMessage({
              sender: 'agent',
              text: 'פתחתי בדפדפן של המחשב הנייח את אתר ישראכרט (web.isracard.co.il). לאחר שתתחבר ותלחץ על הסימנייה, הקובץ שירד לתיקיית ההורדות ייובא אוטומטית ל-DynamoDB!'
            });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, bridge: updated }));
            return;
          }

          if (type === 'import-isracard-downloads') {
            const importRes = scanAndImportIsracardFiles();
            const updated = addBridgeMessage({
              sender: 'agent',
              text: importRes.summary
            });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, importRes, bridge: updated }));
            return;
          }

          if (type === 'launch-claude-desktop') {
            const guiRes = launchClaudeDesktopGui();
            const updated = addBridgeMessage({
              sender: 'agent',
              text: guiRes.launched
                ? `הפעלתי את Claude על המחשב הנייח (${guiRes.path}).`
                : 'לא נמצא קובץ הפעלה גרפי של Claude.'
            });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, guiRes, bridge: updated }));
            return;
          }

          // Unified Task & File Receiver (All tasks go to Papoosh/Antigravity, which uses Claude when appropriate)
          const savedFiles = saveIncomingAttachments(attachments || []);
          const taskText = (text || prompt || '').trim();

          if (taskText || savedFiles.length > 0) {
            const fileNamesLabel = savedFiles.map((f) => f.name).join(', ');
            const displayUserText =
              taskText || `הועלו ${savedFiles.length} קבצים לגשר: ${fileNamesLabel}`;

            let updated = addBridgeMessage({
              sender: 'tal',
              target: 'agent',
              text: displayUserText,
              attachments: savedFiles
            });

            // Check if an uploaded file is an Isracard export
            if (savedFiles.some((f) => /^isracard-.*\.json$/i.test(f.name))) {
              const importRes = scanAndImportIsracardFiles();
              updated = addBridgeMessage({
                sender: 'agent',
                target: 'tal',
                text: `קלטתי את קובץ ישראכרט שהעלית לגשר וביצעתי ייבוא אוטומטי ל-DynamoDB: ${importRes.summary}`
              });
            } else if (shouldConsultClaude(taskText, savedFiles)) {
              // Automatically consult Claude as a deep-analysis sub-agent when warranted
              try {
                const claudeRes = runClaudeTask(taskText, { files: savedFiles });
                if (claudeRes.output) {
                  updated = addBridgeMessage({
                    sender: 'agent',
                    target: 'tal',
                    claudeAssisted: true,
                    text: `קיבלתי את המשימה${savedFiles.length ? ` ואת הקבצים (${fileNamesLabel})` : ''} ונעזרתי גם ב-Claude לניתוח עומק:\n${claudeRes.output}`
                  });
                }
              } catch {
                // If Claude CLI times out, Papoosh handles directly in conversation
              }
            } else if (savedFiles.length > 0) {
              updated = addBridgeMessage({
                sender: 'agent',
                target: 'tal',
                text: `הקבצים נשמרו במחשב בתיקיית incoming-files (${fileNamesLabel}) וזמינים עבורי לטיפול בשיחה.`
              });
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, savedFiles, bridge: updated }));
            return;
          }

          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Unsupported action' }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: String(err) }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  // Watch C:\Users\fradk\Downloads every 30 seconds for any new `isracard-*.json` file
  setInterval(() => {
    try {
      const res = scanAndImportIsracardFiles();
      if (res.found > 0) {
        PapooshReporter.reportRun({
          automationId: 'isracard-auto-importer',
          name: 'שאיבה אוטומטית של קובץ ישראכרט מתיקיית ההורדות',
          category: 'finance',
          status: 'success',
          summary: res.summary,
          durationMs: 1800,
          syncToGit: true
        });
        addBridgeMessage({
          sender: 'agent',
          text: `זוהה ויובא אוטומטית קובץ ישראכרט מתיקיית ההורדות: ${res.summary}`,
          syncToGit: true
        });
      }
    } catch {
      // ignore watcher error
    }
  }, 30000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[PAPOOSH Bridge] Listening on http://localhost:${PORT} (File Uploads + Unified Orchestrator + Isracard Watcher).`);
  });
}

if (process.argv[1] && process.argv[1].endsWith('papoosh-bridge.js')) {
  const args = process.argv.slice(2);
  if (args.includes('--init-only')) {
    saveBridgeState(loadBridgeState());
    console.log('[PAPOOSH Bridge] Initialized public/data/bridge.json');
  } else {
    saveBridgeState(loadBridgeState());
    startLocalBridgeServer();
  }
}
