import { spawnSync, spawn } from 'child_process';
import fs from 'fs';

const CLAUDE_CLI_PATH =
  'C:\\Users\\fradk\\.vscode\\extensions\\anthropic.claude-code-2.1.322-win32-x64\\resources\\native-binary\\claude.exe';
const CLAUDE_DESKTOP_PATHS = [
  `${process.env.LOCALAPPDATA}\\AnthropicClaude\\claude.exe`,
  `${process.env.LOCALAPPDATA}\\Programs\\claude\\Claude.exe`,
  'C:\\Users\\fradk\\Downloads\\Claude Setup.exe'
];

/**
 * Determines whether a task or uploaded file set benefits from consulting Claude
 * as a secondary deep-analysis specialist.
 */
export function shouldConsultClaude(text = '', savedFiles = []) {
  const lower = String(text).toLowerCase();
  if (
    lower.includes('claude') ||
    lower.includes('קלוד') ||
    lower.includes('ניתוח עומק') ||
    lower.includes('סקירת קוד') ||
    lower.includes('ארכיטקטורה') ||
    lower.includes('באג מורכב')
  ) {
    return true;
  }
  // If code, script, PDF, or text documents were attached alongside a question
  if (
    savedFiles.some((f) =>
      /\.(py|js|ts|tsx|jsx|sql|md|txt|csv|html|css)$/i.test(f.name || '')
    ) &&
    text.trim().length > 15
  ) {
    return true;
  }
  return false;
}

/**
 * Runs Claude CLI (`claude.exe`) in non-interactive print mode (`-p`) as a sub-specialist
 * for Antigravity (Papoosh orchestrator).
 */
export function runClaudeTask(
  prompt,
  { cwd = 'C:\\Users\\fradk\\PROGRAMS', files = [], model = '', timeoutMs = 180000 } = {}
) {
  if (!fs.existsSync(CLAUDE_CLI_PATH)) {
    throw new Error(`Claude binary not found at ${CLAUDE_CLI_PATH}`);
  }

  let fullPrompt = prompt;
  if (files && files.length > 0) {
    const fileList = files.map((f) => `- ${f.savedPath || f}`).join('\n');
    fullPrompt = `${prompt}\n\nקבצים מצורפים לעיון במחשב:\n${fileList}`;
  }

  const cliArgs = ['-p', fullPrompt];
  if (model) {
    cliArgs.push('--model', model);
  }

  const res = spawnSync(CLAUDE_CLI_PATH, cliArgs, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true
  });

  if (res.error) {
    throw res.error;
  }
  return {
    exitCode: res.status ?? 0,
    output: (res.stdout || '').trim(),
    error: (res.stderr || '').trim()
  };
}

export function launchClaudeDesktopGui() {
  for (const candidate of CLAUDE_DESKTOP_PATHS) {
    if (fs.existsSync(candidate)) {
      const child = spawn(candidate, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });
      child.unref();
      return { launched: true, path: candidate };
    }
  }
  return { launched: false, path: null };
}

// Allow CLI usage by Antigravity:
// node agent/ask-claude.js [--model opus|sonnet] [--file <path>] "<prompt>"
if (process.argv[1] && process.argv[1].endsWith('ask-claude.js')) {
  const args = process.argv.slice(2);
  if (args[0] === '--gui') {
    const guiRes = launchClaudeDesktopGui();
    console.log(JSON.stringify(guiRes));
  } else if (args.length > 0) {
    let model = '';
    const files = [];
    const promptParts = [];

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--model' && args[i + 1]) {
        model = args[++i];
      } else if (args[i] === '--file' && args[i + 1]) {
        files.push(args[++i]);
      } else {
        promptParts.push(args[i]);
      }
    }

    const prompt = promptParts.join(' ');
    const result = runClaudeTask(prompt, { files, model });
    console.log(result.output || result.error);
    process.exit(result.exitCode);
  } else {
    console.log('Usage: node agent/ask-claude.js [--model opus|sonnet] [--file <path>] "<prompt>" | --gui');
  }
}
