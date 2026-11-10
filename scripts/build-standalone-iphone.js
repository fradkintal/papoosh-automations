import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

function buildStandaloneIphoneFiles() {
  if (!fs.existsSync(distDir)) {
    console.error('[PAPOOSH Standalone] dist directory not found. Run vite build first.');
    process.exit(1);
  }

  const indexHtmlPath = path.join(distDir, 'index.html');
  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Embed logo as base64 data URI
  const logoPath = path.join(publicDir, 'papoosh-logo.jpg');
  let logoBase64 = '';
  let logoDataUri = './papoosh-logo.jpg';
  if (fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString('base64');
    logoDataUri = `data:image/jpeg;base64,${logoBase64}`;
  }

  // Embed initial telemetry & version JSON into window.__PAPOOSH_EMBEDDED__
  const telemetryPath = path.join(publicDir, 'data', 'telemetry.json');
  const versionPath = path.join(publicDir, 'version.json');
  const telemetryData = fs.existsSync(telemetryPath)
    ? JSON.parse(fs.readFileSync(telemetryPath, 'utf8'))
    : null;
  const versionData = fs.existsSync(versionPath)
    ? JSON.parse(fs.readFileSync(versionPath, 'utf8'))
    : null;

  // Inline CSS files
  html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g, (match, href) => {
    const cleanHref = href.replace(/^\.\//, '').replace(/^\//, '');
    const cssPath = path.join(distDir, cleanHref);
    if (fs.existsSync(cssPath)) {
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      return `<style>${cssContent}</style>`;
    }
    return match;
  });

  // Inline JS bundles
  html = html.replace(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g, (match, src) => {
    const cleanSrc = src.replace(/^\.\//, '').replace(/^\//, '');
    const jsPath = path.join(distDir, cleanSrc);
    if (fs.existsSync(jsPath)) {
      let jsContent = fs.readFileSync(jsPath, 'utf8');
      jsContent = jsContent.replace(/\.\/papoosh-logo\.jpg/g, logoDataUri);
      // Escape closing script tags if any exist inside string literals
      jsContent = jsContent.replace(/<\/script>/gi, '<\\/script>');
      return `<script>window.__PAPOOSH_EMBEDDED__ = ${JSON.stringify({
        logoDataUri,
        telemetry: telemetryData,
        version: versionData
      })};</script>\n<script type="module">${jsContent}</script>`;
    }
    return match;
  });

  html = html.replace(/\.\/papoosh-logo\.jpg/g, logoDataUri);

  const standaloneOutDist = path.join(distDir, 'PAPOOSH-iPhone-App.html');
  const standaloneOutPublic = path.join(publicDir, 'PAPOOSH-iPhone-App.html');
  fs.writeFileSync(standaloneOutDist, html, 'utf8');
  fs.writeFileSync(standaloneOutPublic, html, 'utf8');

  // Generate iOS WebClip .mobileconfig for direct iPhone Home Screen App Icon installation
  const mobileConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>Icon</key>
      <data>${logoBase64}</data>
      <key>IgnoreManifestScope</key>
      <true/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>PAPOOSH</string>
      <key>PayloadDescription</key>
      <string>מתקין את אפליקציית פפוש אוטומציות על מסך הבית באייפון</string>
      <key>PayloadDisplayName</key>
      <string>PAPOOSH • פפוש אוטומציות</string>
      <key>PayloadIdentifier</key>
      <string>il.co.papoosh.automations.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>8A9B2C3D-4E5F-6A7B-8C9D-0E1F2A3B4C5D</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>https://fradkintal.github.io/papoosh-automations/</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>אפליקציית פפוש אוטומציות לאייפון - מרכז השליטה האישי של טל פרדקין</string>
  <key>PayloadDisplayName</key>
  <string>PAPOOSH • פפוש אוטומציות</string>
  <key>PayloadIdentifier</key>
  <string>il.co.papoosh.automations.profile</string>
  <key>PayloadOrganization</key>
  <string>Tal Fradkin - PAPOOSH</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>1F2E3D4C-5B6A-7988-97A6-B5C4D3E2F100</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

  fs.writeFileSync(path.join(distDir, 'PAPOOSH-iPhone.mobileconfig'), mobileConfigXml, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'PAPOOSH-iPhone.mobileconfig'), mobileConfigXml, 'utf8');

  console.log('[PAPOOSH Standalone] Built dist/PAPOOSH-iPhone-App.html and dist/PAPOOSH-iPhone.mobileconfig successfully!');
}

buildStandaloneIphoneFiles();
