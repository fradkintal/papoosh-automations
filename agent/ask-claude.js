import { spawnSync, spawn } from 'child_process';
import fs from 'fs';

const CLAUDE_CLI_PATH =
  'C:\\Users\\fradk\\.vscode\\extensions\\anthropic.claude-code-2.1.322-win32-x64\\resources\\native-binary\\claude.exe';
const CLAUDE_DESKTOP_PATHS = [
  `${process.env.LOCALAPPDATA}\\AnthropicClaude\\claude.exe`,
  `${process.env.LOCALAPPDATA}\\Programs\\claude\\Claude.exe`,
  'C:\\Users\\fradk\\Downloads\\Claude Setup.exe'
];

export function runClaudeTask(prompt, { cwd = 'C:\\Users\\fradk\\PROGRAMS', timeoutMs = 180000 } = {}) {
  if (!fs.existsSync(CLAUDE_CLI_PATH)) {
    throw new Error(`Claude binary not found at ${CLAUDE_CLI_PATH}`);
  }

  const res = spawnSync(CLAUDE_CLI_PATH, ['-p', prompt], {
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

// Allow CLI usage: node agent/ask-claude.js "prompt..."
if (process.argv[1] && process.argv[1].endsWith('ask-claude.js')) {
  const args = process.argv.slice(2);
  if (args[0] === '--gui') {
    const guiRes = launchClaudeDesktopGui();
    console.log(JSON.stringify(guiRes));
  } else if (args.length > 0) {
    const prompt = args.join(' ');
    const result = runClaudeTask(prompt);
    console.log(result.output || result.error);
    process.exit(result.exitCode);
  } else {
    console.log('Usage: node agent/ask-claude.js "<prompt>" | --gui');
  }
}
