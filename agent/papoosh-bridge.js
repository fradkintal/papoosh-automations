import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync, execSync } from 'child_process';
import {
  PapooshReporter,
  CLOUD_BRIDGE_URL,
  CLOUD_BRIDGE_BUCKET,
  CLOUD_BRIDGE_REGION
} from './papoosh-sdk.js';
import { runClaudeTask, launchClaudeDesktopGui, shouldConsultClaude } from './ask-claude.js';
import { scanAndImportIsracardFiles } from './auto-import-downloads.js';
import { analyzeUploadedShoppingImages } from './black-friday-hunter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const bridgeFilePath = path.join(rootDir, 'public', 'data', 'bridge.json');
const incomingFilesDir = 'C:\\Users\\fradk\\PROGRAMS\\papoosh-automations\\incoming-files';
const incomingTasksLogPath = 'C:\\Users\\fradk\\PROGRAMS\\papoosh-automations\\incoming-tasks.jsonl';
const downloadsDir = 'C:\\Users\\fradk\\Downloads';
const PORT = Number(process.env.PAPOOSH_BRIDGE_PORT || 4041);

export function loadBridgeState() {
  if (fs.existsSync(bridgeFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(bridgeFilePath, 'utf8'));
      if (!parsed.files) parsed.files = [];
      parsed.orchestratorMode = 'papoosh-primary-with-claude-subagent';
      parsed.cloudBridgeUrl = CLOUD_BRIDGE_URL;
      return parsed;
    } catch {
      // fallback below
    }
  }
  return {
    updatedAt: new Date().toISOString(),
    orchestratorMode: 'papoosh-primary-with-claude-subagent',
    cloudBridgeUrl: CLOUD_BRIDGE_URL,
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
        text: 'גשר הענן הדו-כיווני (AWS HTTPS Cloud Bridge) של פפוש מחובר ופעיל! כל הודעה, בקשת אוטומציה או קובץ שתשלח מהאייפון (גם מרשת סלולרית מחוץ לבית) עוברים מיד לענן ונקלטים במחשב הנייח ובשיחה שלנו.'
      }
    ]
  };
}

export function saveBridgeState(state, { syncToGit = false, syncToCloud = true } = {}) {
  state.updatedAt = new Date().toISOString();
  state.incomingFilesDir = incomingFilesDir;
  state.cloudBridgeUrl = CLOUD_BRIDGE_URL;
  fs.mkdirSync(path.dirname(bridgeFilePath), { recursive: true });
  fs.writeFileSync(bridgeFilePath, JSON.stringify(state, null, 2) + '\n', 'utf8');

  if (syncToCloud) {
    PapooshReporter.syncFileToCloudS3(bridgeFilePath, 'state/bridge.json');
  }

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
  return saveBridgeState(state, { syncToGit, syncToCloud: true });
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
  return saveBridgeState(state, { syncToGit, syncToCloud: true });
}

/**
 * Polls `s3://papoosh-bridge-904610892841/inbox/` for new tasks/files sent from the iPhone over HTTPS.
 */
export function pollCloudInbox() {
  try {
    const lsOut = execSync(
      `aws s3 ls s3://${CLOUD_BRIDGE_BUCKET}/inbox/ --profile default --region ${CLOUD_BRIDGE_REGION}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }
    );
    const lines = lsOut
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];

    // Pull latest state/bridge.json from S3 first so we merge cleanly
    try {
      execSync(
        `aws s3 cp s3://${CLOUD_BRIDGE_BUCKET}/state/bridge.json "${bridgeFilePath}" --profile default --region ${CLOUD_BRIDGE_REGION}`,
        { stdio: 'ignore', windowsHide: true }
      );
    } catch {
      // ignore
    }

    fs.mkdirSync(incomingFilesDir, { recursive: true });
    const processedTasks = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      const fileName = parts[parts.length - 1];
      if (!fileName || !fileName.endsWith('.json')) continue;

      const s3Key = `inbox/${fileName}`;
      const tmpTaskPath = path.join(incomingFilesDir, `_tmp_${fileName}`);
      execSync(
        `aws s3 cp s3://${CLOUD_BRIDGE_BUCKET}/${s3Key} "${tmpTaskPath}" --profile default --region ${CLOUD_BRIDGE_REGION}`,
        { stdio: 'ignore', windowsHide: true }
      );
      const task = JSON.parse(fs.readFileSync(tmpTaskPath, 'utf8'));
      fs.unlinkSync(tmpTaskPath);

      // Download any attached files from S3 to incoming-files
      const downloadedFiles = [];
      for (const att of task.attachments || []) {
        if (att.s3Key) {
          const safeName = path.basename(att.name || 'file').replace(/[<>:"/\\|?*]+/g, '_');
          const localFile = path.join(incomingFilesDir, `${Date.now()}-${safeName}`);
          execSync(
            `aws s3 cp s3://${CLOUD_BRIDGE_BUCKET}/${att.s3Key} "${localFile}" --profile default --region ${CLOUD_BRIDGE_REGION}`,
            { stdio: 'ignore', windowsHide: true }
          );
          if (/^isracard-.*\.json$/i.test(safeName) && fs.existsSync(downloadsDir)) {
            fs.copyFileSync(localFile, path.join(downloadsDir, safeName));
          }
          downloadedFiles.push({ ...att, savedPath: localFile });
        }
      }

      // Append to incoming-tasks.jsonl for the Antigravity conversation agent
      fs.appendFileSync(
        incomingTasksLogPath,
        JSON.stringify({ ...task, downloadedFiles, receivedOnPcAt: new Date().toISOString() }) + '\n',
        'utf8'
      );

      // Execute immediate PC actions if requested
      if (task.type === 'open-isracard') {
        spawn('cmd', ['/c', 'start', 'https://web.isracard.co.il'], { detached: true, stdio: 'ignore' }).unref();
        addBridgeMessage({
          sender: 'agent',
          text: 'פתחתי בדפדפן של המחשב הנייח את אתר ישראכרט (web.isracard.co.il).'
        });
      } else if (
        task.type === 'import-isracard-downloads' ||
        downloadedFiles.some((f) => /^isracard-.*\.json$/i.test(f.name))
      ) {
        const importRes = scanAndImportIsracardFiles();
        addBridgeMessage({
          sender: 'agent',
          text: `בוצעה סריקת ושאיבת ישראכרט במחשב: ${importRes.summary}`
        });
      } else if (task.type === 'launch-claude-desktop') {
        const guiRes = launchClaudeDesktopGui();
        addBridgeMessage({
          sender: 'agent',
          text: guiRes.launched ? `הפעלתי את Claude במחשב (${guiRes.path}).` : 'לא נמצא קובץ הפעלה גרפי.'
        });
      } else if (
        downloadedFiles.some((f) => /\.(jpg|jpeg|png|webp|heic)$/i.test(f.name || f.savedPath || ''))
      ) {
        const visionAnalysis = analyzeUploadedShoppingImages(downloadedFiles, task.text || '');
        if (visionAnalysis) {
          addBridgeMessage({
            sender: 'agent',
            claudeAssisted: true,
            text: `📸 זוהו התמונות שהעלית לצייד המחירים של בלאק פריידי:\n${visionAnalysis}`
          });
        }
      } else if (task.text && shouldConsultClaude(task.text, downloadedFiles)) {
        try {
          const claudeRes = runClaudeTask(task.text, { files: downloadedFiles });
          if (claudeRes.output) {
            addBridgeMessage({
              sender: 'agent',
              claudeAssisted: true,
              text: `המחשב קלט את הבקשה וביצע ניתוח ראשוני בעזרת Claude:\n${claudeRes.output}`
            });
          }
        } catch {
          // Antigravity conversation handles it
        }
      }

      // Delete processed inbox item from S3
      execSync(
        `aws s3 rm s3://${CLOUD_BRIDGE_BUCKET}/${s3Key} --profile default --region ${CLOUD_BRIDGE_REGION}`,
        { stdio: 'ignore', windowsHide: true }
      );
      processedTasks.push(task);
    }

    return processedTasks;
  } catch {
    return [];
  }
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
              text: 'פתחתי בדפדפן של המחשב הנייח את אתר ישראכרט (web.isracard.co.il).'
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

          const savedFiles = saveIncomingAttachments(attachments || []);
          const taskText = (text || prompt || '').trim();

          if (taskText || savedFiles.length > 0) {
            const fileNamesLabel = savedFiles.map((f) => f.name).join(', ');
            const displayUserText =
              taskText || `הועלו ${savedFiles.length} קבצים לגשר: ${fileNamesLabel}`;

            fs.appendFileSync(
              incomingTasksLogPath,
              JSON.stringify({
                taskId: `local-${Date.now()}`,
                createdAt: new Date().toISOString(),
                type: type || 'task',
                text: taskText,
                downloadedFiles: savedFiles
              }) + '\n',
              'utf8'
            );

            let updated = addBridgeMessage({
              sender: 'tal',
              target: 'agent',
              text: displayUserText,
              attachments: savedFiles
            });

            if (savedFiles.some((f) => /\.(jpg|jpeg|png|webp|heic)$/i.test(f.name || f.savedPath || ''))) {
              const visionAnalysis = analyzeUploadedShoppingImages(savedFiles, taskText);
              if (visionAnalysis) {
                updated = addBridgeMessage({
                  sender: 'agent',
                  claudeAssisted: true,
                  text: `📸 זוהו התמונות שהעלית לצייד המחירים של בלאק פריידי:\n${visionAnalysis}`
                });
              }
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

  // Poll Cloud Bridge S3 Inbox every 6 seconds for tasks/files sent from iPhone over HTTPS
  setInterval(() => {
    pollCloudInbox();
  }, 6000);

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
    console.log(
      `[PAPOOSH Bridge] Listening on http://localhost:${PORT} + Polling Cloud Bridge (${CLOUD_BRIDGE_URL}) every 6s.`
    );
  });
}

if (process.argv[1] && process.argv[1].endsWith('papoosh-bridge.js')) {
  const args = process.argv.slice(2);
  if (args.includes('--init-only')) {
    saveBridgeState(loadBridgeState(), { syncToCloud: false });
    console.log('[PAPOOSH Bridge] Initialized public/data/bridge.json');
  } else if (args.includes('--poll-once')) {
    const tasks = pollCloudInbox();
    console.log(JSON.stringify({ polled: tasks.length, tasks }, null, 2));
  } else {
    saveBridgeState(loadBridgeState(), { syncToCloud: true });
    startLocalBridgeServer();
  }
}
