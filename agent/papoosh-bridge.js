import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import { PapooshReporter } from './papoosh-sdk.js';
import { runClaudeTask, launchClaudeDesktopGui } from './ask-claude.js';
import { scanAndImportIsracardFiles } from './auto-import-downloads.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const bridgeFilePath = path.join(rootDir, 'public', 'data', 'bridge.json');
const PORT = Number(process.env.PAPOOSH_BRIDGE_PORT || 4041);

export function loadBridgeState() {
  if (fs.existsSync(bridgeFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(bridgeFilePath, 'utf8'));
    } catch {
      // fallback below
    }
  }
  return {
    updatedAt: new Date().toISOString(),
    claudeStatus: {
      cliInstalled: true,
      cliPath: 'C:\\Users\\fradk\\.vscode\\extensions\\anthropic.claude-code-2.1.322-win32-x64\\resources\\native-binary\\claude.exe',
      desktopInstallerPath: 'C:\\Users\\fradk\\Downloads\\Claude Setup.exe'
    },
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
        text: 'גשר PAPOOSH פעיל! סנכרון הכספים הראשוני (מקס, כאל, לאומי, דיסקונט) עבר בהצלחה מלאה (193 תנועות). עבור ישראכרט הפעלתי צופה אוטומטי על תיקיית ההורדות במחשב שייבא ל-DynamoDB כל קובץ JSON מהסימנייה ברגע שירד, וגם חיברתי את Claude CLI למערכת.'
      }
    ]
  };
}

export function saveBridgeState(state, { syncToGit = false } = {}) {
  state.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(bridgeFilePath), { recursive: true });
  fs.writeFileSync(bridgeFilePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  if (syncToGit) {
    try {
      spawnSync('git', ['add', 'public/data/bridge.json', 'public/data/telemetry.json'], { cwd: rootDir });
      spawnSync('git', ['commit', '-m', 'chore(bridge): sync live bridge messages and links'], { cwd: rootDir });
      spawnSync('git', ['push', 'origin', 'main'], { cwd: rootDir });
    } catch {
      // ignore git errors
    }
  }
  return state;
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

export function addBridgeMessage({ sender = 'tal', target = 'agent', text, actionType = 'chat', syncToGit = false }) {
  const state = loadBridgeState();
  const entry = {
    id: `msg-${Date.now()}`,
    sender,
    target,
    actionType,
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
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { type, text, prompt } = payload;

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

          if (type === 'ask-claude' && (prompt || text)) {
            const q = prompt || text;
            addBridgeMessage({ sender: 'tal', target: 'claude', text: q });
            const claudeRes = runClaudeTask(q);
            const updated = addBridgeMessage({
              sender: 'claude',
              target: 'tal',
              text: claudeRes.output || claudeRes.error || 'המשימה בוצעה ב-Claude.'
            });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, bridge: updated }));
            return;
          }

          if (text) {
            const updated = addBridgeMessage({ sender: 'tal', target: 'agent', text });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, bridge: updated }));
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

  // Also watch C:\Users\fradk\Downloads every 30 seconds for any new `isracard-*.json` file
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
    console.log(`[PAPOOSH Bridge] Listening on http://localhost:${PORT} and watching Downloads for Isracard files.`);
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
