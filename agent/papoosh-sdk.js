import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const telemetryPath = path.join(rootDir, 'public', 'data', 'telemetry.json');

export class PapooshReporter {
  static loadTelemetry() {
    if (fs.existsSync(telemetryPath)) {
      return JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));
    }
    return {
      updatedAt: new Date().toISOString(),
      machine: {},
      summary: { totalAutomations: 0, healthyCount: 0, warningCount: 0, errorCount: 0, runsToday: 0 },
      automations: [],
      recentRuns: [],
      alerts: [],
      tools: []
    };
  }

  static saveTelemetry(data, { syncToGit = false } = {}) {
    data.updatedAt = new Date().toISOString();
    data.machine = {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
      totalMemoryGb: Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10,
      freeMemoryGb: Math.round((os.freemem() / (1024 ** 3)) * 10) / 10,
      cpuModel: os.cpus()?.[0]?.model?.trim() || 'Desktop CPU',
      cpuCores: os.cpus()?.length || 8,
      status: 'online'
    };

    // Recompute summary counters
    const automations = data.automations || [];
    data.summary = {
      totalAutomations: automations.length,
      healthyCount: automations.filter((a) => a.lastStatus === 'success').length,
      warningCount: automations.filter((a) => a.lastStatus === 'warning').length,
      errorCount: automations.filter((a) => a.lastStatus === 'error').length,
      runsToday: (data.recentRuns || []).length,
      openAlerts: (data.alerts || []).filter((al) => !al.resolved).length
    };

    fs.mkdirSync(path.dirname(telemetryPath), { recursive: true });
    fs.writeFileSync(telemetryPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

    if (syncToGit) {
      try {
        execSync('git add public/data/telemetry.json && git commit -m "chore(telemetry): update live automation status" && git push', {
          cwd: rootDir,
          stdio: 'ignore'
        });
      } catch {
        // Ignore if git remote is not reachable or no changes
      }
    }
    return data;
  }

  static reportRun({
    automationId,
    name,
    category = 'system',
    status = 'success',
    summary = '',
    durationMs = 1200,
    details = [],
    alert = null,
    syncToGit = false
  }) {
    const data = this.loadTelemetry();
    const now = new Date().toISOString();
    const runEntry = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      automationId,
      name: name || automationId,
      category,
      status,
      timestamp: now,
      durationMs,
      summary,
      details
    };

    data.recentRuns = [runEntry, ...(data.recentRuns || [])].slice(0, 50);

    const existingAuto = (data.automations || []).find((a) => a.id === automationId);
    if (existingAuto) {
      existingAuto.lastStatus = status;
      existingAuto.lastRunAt = now;
      existingAuto.lastSummary = summary;
      existingAuto.lastDurationMs = durationMs;
      existingAuto.totalRuns = (existingAuto.totalRuns || 0) + 1;
    }

    if (alert) {
      data.alerts = [
        {
          id: `alert-${Date.now()}`,
          automationId,
          category,
          severity: alert.severity || (status === 'error' ? 'critical' : 'warning'),
          title: alert.title,
          message: alert.message,
          actionHint: alert.actionHint || '',
          createdAt: now,
          resolved: false
        },
        ...(data.alerts || [])
      ].slice(0, 30);
    }

    return this.saveTelemetry(data, { syncToGit });
  }
}
