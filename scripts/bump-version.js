import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const versionJsonPath = path.join(rootDir, 'public', 'version.json');
const srcVersionPath = path.join(rootDir, 'src', 'version.js');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));

const args = process.argv.slice(2);
if (args.includes('--patch')) {
  const parts = pkg.version.split('.').map(Number);
  parts[2] += 1;
  pkg.version = parts.join('.');
} else if (args.includes('--minor')) {
  const parts = pkg.version.split('.').map(Number);
  parts[1] += 1;
  parts[2] = 0;
  pkg.version = parts.join('.');
}

const nowIso = new Date().toISOString();
versionData.version = pkg.version;
versionData.buildNumber = (versionData.buildNumber || 0) + 1;
versionData.releasedAt = nowIso;

const noteArgIndex = args.indexOf('--note');
if (noteArgIndex !== -1 && args[noteArgIndex + 1]) {
  versionData.changelog.unshift({
    version: pkg.version,
    date: nowIso.slice(0, 10),
    title: args[noteArgIndex + 1],
    highlights: [args[noteArgIndex + 1]]
  });
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2) + '\n', 'utf8');

const srcVersionContent = `export const APP_VERSION = {
  version: "${versionData.version}",
  buildNumber: ${versionData.buildNumber},
  releasedAt: "${versionData.releasedAt}",
  codename: "${versionData.codename || 'PAPOOSH Neon Core'}",
  repoUrl: "https://github.com/fradkintal/papoosh-automations",
  liveUrl: "https://fradkintal.github.io/papoosh-automations/"
};
`;

fs.writeFileSync(srcVersionPath, srcVersionContent, 'utf8');
console.log(`[PAPOOSH Version] Updated to v${versionData.version} (Build #${versionData.buildNumber}) at ${nowIso}`);
