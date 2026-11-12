import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Terminal,
  Wallet,
  Mail,
  Calendar,
  Cpu,
  Play,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wrench,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Layers,
  Bell,
  MessageSquare,
  Send,
  Link2,
  Bot,
  FileText,
  Paperclip,
  UploadCloud
} from 'lucide-react';
import { APP_VERSION } from './version.js';
import { CLOUD_BRIDGE_URL } from './cloudBridgeConfig.js';

const CATEGORY_META = {
  all: { label: 'הכל', icon: Layers, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.14)' },
  email: { label: 'מיילים ותקציר יומי', icon: Mail, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)' },
  finance: { label: 'כספים ובנקים', icon: Wallet, color: '#10b981', bg: 'rgba(16, 185, 129, 0.16)' },
  calendar: { label: 'יומן ותזכורות', icon: Calendar, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.16)' },
  system: { label: 'מחשב נייח ו-Claude', icon: Cpu, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.16)' }
};

const STATUS_META = {
  success: { label: 'תקין • הופעל', pillClass: 'pill-success', accentClass: 'card-accent-success', icon: CheckCircle2 },
  warning: { label: 'התראה • דורש תשומת לב', pillClass: 'pill-warning', accentClass: 'card-accent-warning', icon: AlertTriangle },
  error: { label: 'תקלה • נכשל', pillClass: 'pill-error', accentClass: 'card-accent-error', icon: XCircle },
  info: { label: 'פעיל / מוכן', pillClass: 'pill-info', accentClass: 'card-accent-info', icon: Sparkles }
};

const DISMISSED_ALERTS_STORAGE_KEY = 'papoosh_dismissed_alerts_v1';

function loadDismissedAlertsFromStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_ALERTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDismissedAlertsToStorage(ids) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISSED_ALERTS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

function formatRelativeTime(isoString) {
  if (!isoString) return 'טרם הורץ';
  const diffSec = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 0) {
    const futureMin = Math.round(Math.abs(diffSec) / 60);
    if (futureMin < 60) return `בעוד ${futureMin} דק׳`;
    const futureHr = Math.round(futureMin / 60);
    return `בעוד ${futureHr} שעות`;
  }
  if (diffSec < 60) return 'ממש עכשיו';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `לפני ${diffHr} שעות`;
  const diffDays = Math.floor(diffHr / 24);
  return `לפני ${diffDays} ימים`;
}

function formatTimeHM(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function App() {
  const embedded = typeof window !== 'undefined' ? window.__PAPOOSH_EMBEDDED__ : null;
  const logoSrc = embedded?.logoDataUri || './papoosh-logo.jpg';

  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | bridge | automations | alerts | tools
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [telemetry, setTelemetry] = useState(() => embedded?.telemetry || null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => loadDismissedAlertsFromStorage());
  const [bridge, setBridge] = useState(null);
  const [localBridgeOnline, setLocalBridgeOnline] = useState(false);
  const [versionInfo, setVersionInfo] = useState(() => embedded?.version || APP_VERSION);
  const [newVersionAvailable, setNewVersionAvailable] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [instructionText, setInstructionText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSendingInstruction, setIsSendingInstruction] = useState(false);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const handleHardRefreshApp = useCallback(() => {
    const nextBuild = newVersionAvailable?.buildNumber || versionInfo?.buildNumber || Date.now();
    window.location.href = `${window.location.pathname}?v=${nextBuild}&t=${Date.now()}`;
  }, [newVersionAvailable, versionInfo]);

  const fetchLiveTelemetryAndVersion = useCallback(async (manual = false) => {
    setIsRefreshing(true);
    const cacheBuster = `t=${Date.now()}`;

    // 1. Try AWS HTTPS Cloud Bridge first (works from iPhone on 5G/Wi-Fi and Desktop)
    let fetchedFromLiveBridge = false;
    try {
      const cloudRes = await fetch(`${CLOUD_BRIDGE_URL}?${cacheBuster}`, { cache: 'no-store' });
      if (cloudRes.ok) {
        const payload = await cloudRes.json();
        if (payload.telemetry) setTelemetry(payload.telemetry);
        if (payload.bridge) setBridge(payload.bridge);
        setLocalBridgeOnline(true);
        fetchedFromLiveBridge = true;
      }
    } catch {
      // Fallback to localhost or static JSON below
    }

    // 2. Try local PC bridge if Cloud Bridge wasn't reachable
    if (!fetchedFromLiveBridge) {
      try {
        const localRes = await fetch(`http://localhost:4041/api/status?${cacheBuster}`, { cache: 'no-store' });
        if (localRes.ok) {
          const payload = await localRes.json();
          if (payload.telemetry) setTelemetry(payload.telemetry);
          if (payload.bridge) setBridge(payload.bridge);
          setLocalBridgeOnline(true);
          fetchedFromLiveBridge = true;
        }
      } catch {
        setLocalBridgeOnline(false);
      }
    }

    // 3. Fallback to static hosted JSON files
    const candidateBaseUrls = ['./', 'https://fradkintal.github.io/papoosh-automations/'];

    if (!fetchedFromLiveBridge) {
      for (const base of candidateBaseUrls) {
        try {
          const res = await fetch(`${base}data/telemetry.json?${cacheBuster}`, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            setTelemetry(data);
            break;
          }
        } catch {
          // Try next candidate
        }
      }

      for (const base of candidateBaseUrls) {
        try {
          const bRes = await fetch(`${base}data/bridge.json?${cacheBuster}`, { cache: 'no-store' });
          if (bRes.ok) {
            const bData = await bRes.json();
            setBridge(bData);
            break;
          }
        } catch {
          // Try next candidate
        }
      }
    }

    for (const base of candidateBaseUrls) {
      try {
        const vRes = await fetch(`${base}version.json?${cacheBuster}`, { cache: 'no-store' });
        if (vRes.ok) {
          const remoteVer = await vRes.json();
          setVersionInfo(remoteVer);
          if (
            remoteVer.buildNumber &&
            APP_VERSION.buildNumber &&
            remoteVer.buildNumber > APP_VERSION.buildNumber
          ) {
            setNewVersionAvailable(remoteVer);
          }
          break;
        }
      } catch {
        // Try next candidate
      }
    }

    setTimeout(() => {
      setIsRefreshing(false);
      if (manual) {
        showToast('הנתונים והגרסה רועננו מול המחשב הנייח!');
      }
    }, 300);
  }, [showToast]);

  useEffect(() => {
    fetchLiveTelemetryAndVersion(false);
    const interval = setInterval(() => fetchLiveTelemetryAndVersion(false), 30000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchLiveTelemetryAndVersion(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchLiveTelemetryAndVersion]);

  // Dismiss alert -> disappears completely from screen + persists in localStorage + notifies PC bridge
  const handleDismissAlert = useCallback(
    async (alertId) => {
      const updatedDismissed = Array.from(new Set([...dismissedAlertIds, alertId]));
      setDismissedAlertIds(updatedDismissed);
      saveDismissedAlertsToStorage(updatedDismissed);

      if (telemetry) {
        const remainingAlerts = (telemetry.alerts || []).filter((al) => al.id !== alertId);
        setTelemetry({
          ...telemetry,
          alerts: remainingAlerts,
          summary: {
            ...telemetry.summary,
            openAlerts: remainingAlerts.length
          }
        });
      }

      showToast('ההתראה סומנה כטופלה והוסרה מהמסך ✓');

      try {
        await fetch(CLOUD_BRIDGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'dismiss-alert', alertId })
        });
      } catch {
        // Ignore cloud error
      }
      try {
        await fetch('http://localhost:4041/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'dismiss-alert', alertId })
        });
      } catch {
        // Local bridge not reachable
      }
    },
    [dismissedAlertIds, telemetry, showToast]
  );

  const handleSelectBridgeFiles = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;

    const readPromises = fileList.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream',
              contentBase64: String(reader.result || '')
            });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        })
    );

    const loaded = (await Promise.all(readPromises)).filter(Boolean);
    setSelectedFiles((prev) => [...prev, ...loaded]);
    e.target.value = '';
  };

  const handleRemoveSelectedFile = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSendBridgeAction = async (type, customText = '') => {
    setIsSendingInstruction(true);
    const attachmentsToSend = type === 'task' ? selectedFiles : [];
    const payloadObj = {
      type,
      text: customText,
      prompt: customText,
      attachments: attachmentsToSend
    };

    // 1. Send over HTTPS to AWS Cloud Bridge (works from iPhone anywhere + persists in S3)
    try {
      const cloudRes = await fetch(CLOUD_BRIDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadObj)
      });
      if (cloudRes.ok) {
        const data = await cloudRes.json();
        if (data.bridge) setBridge(data.bridge);
        showToast(
          attachmentsToSend.length > 0
            ? `הבקשה ו-${attachmentsToSend.length} קבצים נשלחו לענן ולמחשב הנייח!`
            : 'הבקשה נשלחה לענן ונקלטה במחשב הנייח!'
        );
        setInstructionText('');
        if (type === 'task') setSelectedFiles([]);
        setIsSendingInstruction(false);
        return;
      }
    } catch {
      // Fallback to localhost below
    }

    // 2. Fallback to localhost if on PC directly
    try {
      const res = await fetch('http://localhost:4041/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadObj)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.bridge) setBridge(data.bridge);
        showToast('המשימה התקבלה ובוצעה במחשב הנייח!');
        setInstructionText('');
        if (type === 'task') setSelectedFiles([]);
        setIsSendingInstruction(false);
        return;
      }
    } catch {
      // Fallback
    }

    const fallbackAttachments = attachmentsToSend.map((f) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: f.name,
      size: f.size,
      type: f.type,
      uploadedAt: new Date().toISOString()
    }));

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'tal',
      target: 'agent',
      attachments: fallbackAttachments,
      timestamp: new Date().toISOString(),
      text:
        customText ||
        (fallbackAttachments.length > 0
          ? `צורפו קבצים לטיפול: ${fallbackAttachments.map((f) => f.name).join(', ')}`
          : type)
    };
    setBridge((prev) => ({
      ...(prev || {}),
      files: [...fallbackAttachments, ...(prev?.files || [])],
      messages: [newMsg, ...(prev?.messages || [])]
    }));
    setInstructionText('');
    if (type === 'task') setSelectedFiles([]);
    setIsSendingInstruction(false);
    showToast('המשימה והקבצים נרשמו בגשר פפוש!');
  };

  const filteredDigests = useMemo(() => {
    if (!telemetry?.dailyDigests) return [];
    return telemetry.dailyDigests.filter(
      (d) => selectedCategory === 'all' || d.category === selectedCategory
    );
  }, [telemetry, selectedCategory]);

  const filteredAutomations = useMemo(() => {
    if (!telemetry?.automations) return [];
    return telemetry.automations
      .filter((a) => a.category !== 'business')
      .filter((a) => {
        const catMatch = selectedCategory === 'all' || a.category === selectedCategory;
        const statusMatch = statusFilter === 'all' || a.lastStatus === statusFilter;
        return catMatch && statusMatch;
      });
  }, [telemetry, selectedCategory, statusFilter]);

  const filteredRuns = useMemo(() => {
    if (!telemetry?.recentRuns) return [];
    return telemetry.recentRuns
      .filter((r) => r.category !== 'business')
      .filter((r) => {
        const catMatch = selectedCategory === 'all' || r.category === selectedCategory;
        const statusMatch = statusFilter === 'all' || r.status === statusFilter;
        return catMatch && statusMatch;
      });
  }, [telemetry, selectedCategory, statusFilter]);

  const openAlerts = useMemo(() => {
    if (!telemetry?.alerts) return [];
    return telemetry.alerts.filter(
      (al) => !al.resolved && !dismissedAlertIds.includes(al.id) && al.category !== 'business'
    );
  }, [telemetry, dismissedAlertIds]);

  const personalTools = useMemo(() => {
    if (!telemetry?.tools) return [];
    return telemetry.tools.filter((t) => t.category !== 'business');
  }, [telemetry]);

  const summary = telemetry?.summary || {
    totalAutomations: 0,
    healthyCount: 0,
    warningCount: 0,
    errorCount: 0,
    runsToday: 0,
    openAlerts: 0
  };

  const cliSnippet = `node C:\\Users\\fradk\\PROGRAMS\\papoosh-automations\\agent\\papoosh-cli.js report --id "my-personal-task" --name "אוטומציה אישית" --category "email" --status "success" --summary "התקציר היומי מוכן" --details "שורה 1 בתקציר|שורה 2 בתקציר" --push`;

  return (
    <div className="app-shell">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'linear-gradient(135deg, #00f0ff, #10b981)',
            color: '#030712',
            padding: '10px 20px',
            borderRadius: '999px',
            fontWeight: 800,
            fontSize: '0.9rem',
            boxShadow: '0 10px 30px rgba(0, 240, 255, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '92vw'
          }}
        >
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Outdated Version Banner -> Instant Refresh */}
      {newVersionAvailable && (
        <div
          className="glass-card card-accent-warning"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.24), rgba(255,46,147,0.22))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '14px'
          }}
        >
          <div>
            <div style={{ fontWeight: 900, color: '#fbbf24', fontSize: '0.96rem' }}>
              גרסת האפליקציה אינה מעודכנת! זמינה גרסה v{newVersionAvailable.version} (#{newVersionAvailable.buildNumber})
            </div>
            <div style={{ fontSize: '0.82rem', color: '#f8fafc' }}>
              לחץ על כפתור הרענון כדי לטעון מיד את הגרסה החדשה ביותר.
            </div>
          </div>
          <button className="btn-neon" onClick={handleHardRefreshApp}>
            <RefreshCw size={16} />
            <span>רענן לגרסה החדשה</span>
          </button>
        </div>
      )}

      {/* Hero Brand Header (Mobile Optimized, Personal Hub) */}
      <header className="hero-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
            <img src={logoSrc} alt="PAPOOSH Logo" className="logo-glow" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="font-brand brand-gradient-text" style={{ fontSize: '1.45rem', fontWeight: 900 }}>
                  PAPOOSH
                </span>
                <span
                  style={{
                    background: 'rgba(255, 46, 147, 0.2)',
                    border: '1px solid rgba(255, 46, 147, 0.5)',
                    color: '#f472b6',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 9px',
                    borderRadius: '999px'
                  }}
                >
                  פפוש אוטומציות אישי
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', color: '#cbd5e1', marginTop: '2px', fontWeight: 500 }}>
                חמ״ל האוטומציות האישיות, התקצירים והסוכנים של טל
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>
                  <span className="pulse-dot" />
                  {localBridgeOnline ? 'גשר ענן דו-כיווני חי (AWS HTTPS)' : `מחשב: ${telemetry?.machine?.hostname || 'פעיל'}`}
                </span>
                <span
                  style={{
                    fontSize: '0.73rem',
                    color: newVersionAvailable ? '#fbbf24' : '#34d399',
                    background: newVersionAvailable ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.15)',
                    border: newVersionAvailable ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(16, 185, 129, 0.38)',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    fontWeight: 800
                  }}
                >
                  {newVersionAvailable
                    ? `נדרש רענון ל-v${newVersionAvailable.version}`
                    : `גרסה v${APP_VERSION.version} (#${APP_VERSION.buildNumber}) מעודכנת ✓`}
                </span>
              </div>
            </div>
          </div>

          <button
            className={newVersionAvailable ? 'btn-neon' : 'btn-secondary'}
            onClick={() => (newVersionAvailable ? handleHardRefreshApp() : fetchLiveTelemetryAndVersion(true))}
            style={{ padding: '10px 14px' }}
          >
            <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            <span>{newVersionAvailable ? 'עדכן גרסה' : 'רענן'}</span>
          </button>
        </div>
      </header>

      {/* Top KPI Cards */}
      <section className="kpi-grid">
        <div
          className="kpi-card kpi-emerald"
          onClick={() => {
            setStatusFilter('success');
            setActiveTab('automations');
          }}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#a7f3d0', fontWeight: 700 }}>אוטומציות תקינות</span>
            <CheckCircle2 size={19} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>
            {summary.healthyCount} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>/ {summary.totalAutomations}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '2px' }}>ירוק = סנכרון תקין</div>
        </div>

        <div
          className="kpi-card kpi-cyan"
          onClick={() => {
            setStatusFilter('all');
            setActiveTab('dashboard');
          }}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#bae6fd', fontWeight: 700 }}>תקצירים והרצות</span>
            <FileText size={19} color="#00f0ff" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#00f0ff', marginTop: '4px' }}>
            {filteredDigests.length || summary.runsToday}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '2px' }}>
            עודכן {formatRelativeTime(telemetry?.updatedAt)}
          </div>
        </div>

        <div
          className="kpi-card kpi-amber"
          onClick={() => setActiveTab('alerts')}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#fde68a', fontWeight: 700 }}>התראות פתוחות</span>
            <AlertTriangle size={19} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fbbf24', marginTop: '4px' }}>
            {openAlerts.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '2px' }}>
            {openAlerts.length === 0 ? 'אין התראות פתוחות ✓' : 'נעלמות בסימון כטופל'}
          </div>
        </div>

        <div
          className="kpi-card kpi-rose"
          onClick={() => {
            setStatusFilter('error');
            setActiveTab('automations');
          }}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#fecdd3', fontWeight: 700 }}>תקלות פתוחות</span>
            <XCircle size={19} color="#fb7185" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fb7185', marginTop: '4px' }}>
            {summary.errorCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '2px' }}>
            {summary.errorCount > 0 ? 'אדום = דורש טיפול' : 'אפס תקלות!'}
          </div>
        </div>
      </section>

      {/* Category Filter Bar (Strictly Personal Categories) */}
      <div style={{ marginTop: '14px', marginBottom: '12px' }}>
        <div className="chip-row">
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const IconComp = meta.icon;
            const isActive = selectedCategory === key;
            return (
              <button
                key={key}
                className={`filter-chip ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(key)}
              >
                <IconComp size={15} color={isActive ? '#040711' : meta.color} />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: DASHBOARD (חמ"ל פפוש ראשי) */}
      {activeTab === 'dashboard' && (
        <main>
          {/* Open Alerts (disappear immediately when marked resolved!) */}
          {openAlerts.length > 0 && (
            <section style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.04rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={18} color="#fbbf24" />
                  <span>התראות ותזכורות פעילות ({openAlerts.length})</span>
                </h2>
              </div>

              {openAlerts.map((al) => {
                const isCrit = al.severity === 'critical';
                const isInfo = al.severity === 'info';
                const accent = isCrit ? 'card-accent-error' : isInfo ? 'card-accent-info' : 'card-accent-warning';
                const pillClass = isCrit ? 'pill-error' : isInfo ? 'pill-info' : 'pill-warning';
                const pillLabel = isCrit ? 'תקלה' : isInfo ? 'תזכורת' : 'התראה';

                return (
                  <div key={al.id} className={`glass-card ${accent}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <span className={`pill ${pillClass}`}>{pillLabel}</span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatRelativeTime(al.createdAt)}</span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#f8fafc' }}>{al.title}</div>
                        <p style={{ margin: '6px 0', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>{al.message}</p>
                        {al.actionHint && (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '7px 11px',
                              borderRadius: '10px',
                              background: 'rgba(15, 23, 42, 0.9)',
                              border: '1px solid rgba(0, 240, 255, 0.22)',
                              fontSize: '0.8rem',
                              color: '#38bdf8',
                              fontWeight: 600
                            }}
                          >
                            💡 {al.actionHint}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn-neon"
                        style={{ flexShrink: 0, fontSize: '0.76rem', padding: '8px 12px' }}
                        onClick={() => handleDismissAlert(al.id)}
                      >
                        <Check size={14} />
                        <span>טופל (העלים)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* Daily Summaries & Digests (תקצירים וסיכומים יומיים - כמו סידור המיילים) */}
          {filteredDigests.length > 0 && (
            <section style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.06rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={19} color="#38bdf8" />
                  <span>תקצירים וסיכומים יומיים ({filteredDigests.length})</span>
                </h2>
              </div>

              {filteredDigests.map((digest) => {
                const cat = CATEGORY_META[digest.category] || CATEGORY_META.email;
                const CatIcon = cat.icon;

                return (
                  <div
                    key={digest.id}
                    className="glass-card card-accent-info"
                    style={{
                      background: 'linear-gradient(155deg, rgba(15, 23, 42, 0.95), rgba(8, 20, 42, 0.92))',
                      border: '1px solid rgba(56, 189, 248, 0.35)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          className="pill"
                          style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.color}44` }}
                        >
                          <CatIcon size={13} />
                          {cat.label}
                        </span>
                        {digest.scheduleLabel && (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                            ⏰ {digest.scheduleLabel}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>
                        עודכן {formatRelativeTime(digest.updatedAt)} ({formatTimeHM(digest.updatedAt)})
                      </span>
                    </div>

                    <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#ffffff', marginBottom: '4px' }}>
                      {digest.title}
                    </div>
                    <div style={{ fontSize: '0.86rem', color: '#bae6fd', marginBottom: '10px', fontWeight: 600 }}>
                      {digest.headline}
                    </div>

                    {digest.badges && digest.badges.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {digest.badges.map((b, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              padding: '3px 10px',
                              borderRadius: '999px',
                              background: `${b.color}20`,
                              color: b.color,
                              border: `1px solid ${b.color}55`
                            }}
                          >
                            {b.label}
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      style={{
                        background: 'rgba(4, 7, 17, 0.85)',
                        borderRadius: '14px',
                        padding: '12px 14px',
                        border: '1px solid rgba(148, 163, 184, 0.16)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      {(digest.items || []).map((item, idx) => {
                        const isActionRequired = item.includes('דורש תשומת לב') || item.includes('הודעות אישיות');
                        return (
                          <div
                            key={idx}
                            style={{
                              fontSize: '0.85rem',
                              lineHeight: 1.5,
                              color: isActionRequired ? '#fef08a' : '#e2e8f0',
                              fontWeight: isActionRequired ? 700 : 500,
                              paddingBottom: idx < digest.items.length - 1 ? '7px' : 0,
                              borderBottom: idx < digest.items.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none'
                            }}
                          >
                            {item}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* Real Automation Runs Feed */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#00f0ff" />
                <span>יומן הרצות אמיתיות ({filteredRuns.length})</span>
              </h2>
            </div>

            {filteredRuns.map((run) => {
              const st = STATUS_META[run.status] || STATUS_META.info;
              const cat = CATEGORY_META[run.category] || CATEGORY_META.system;
              const CatIcon = cat.icon;
              const isExpanded = expandedRunId === run.id;

              return (
                <div
                  key={run.id}
                  className={`glass-card ${st.accentClass}`}
                  onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span className={`pill ${st.pillClass}`}>{st.label}</span>
                        <span
                          className="pill"
                          style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.color}44` }}
                        >
                          <CatIcon size={13} />
                          {cat.label}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {formatRelativeTime(run.timestamp)} ({formatTimeHM(run.timestamp)})
                        </span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>{run.name}</div>
                      <div style={{ fontSize: '0.86rem', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.45 }}>
                        {run.summary}
                      </div>
                    </div>
                    <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                      <span>{(run.durationMs / 1000).toFixed(1)}s</span>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {isExpanded && run.details && run.details.length > 0 && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        borderRadius: '12px',
                        background: 'rgba(4, 7, 17, 0.85)',
                        border: '1px solid rgba(148, 163, 184, 0.18)'
                      }}
                    >
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#00f0ff', marginBottom: '6px' }}>
                        תקציר ופלט הרצה מלא:
                      </div>
                      {run.details.map((line, idx) => (
                        <div key={idx} style={{ fontSize: '0.82rem', color: '#e2e8f0', padding: '4px 0' }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </main>
      )}

      {/* TAB 2: LIVE BRIDGE (חיבור חי בין המחשב, השיחה, קבלת קבצים ו-Claude כעוזר עומק) */}
      {activeTab === 'bridge' && (
        <main>
          <div className="glass-card card-accent-info">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MessageSquare size={22} color="#00f0ff" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900 }}>
                    גשר פפוש מאוחד: משימות, קבצים וקישורים
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                    כל המשימות והקבצים מגיעים אליי במרוכז — ואני מפעיל אוטומטית את Claude במחשב כשנדרש ניתוח עומק.
                  </div>
                </div>
              </div>

              <span
                className="pill"
                style={{
                  background: 'rgba(168, 85, 247, 0.18)',
                  color: '#e879f9',
                  border: '1px solid rgba(232, 121, 249, 0.45)',
                  fontSize: '0.73rem'
                }}
              >
                <Bot size={13} />
                <span>Claude מחובר כעוזר עומק אוטומטי ✓</span>
              </span>
            </div>

            {/* Selected Files Preview Row */}
            {selectedFiles.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '10px',
                  padding: '8px 10px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)'
                }}
              >
                {selectedFiles.map((file, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(4, 7, 17, 0.9)',
                      color: '#a7f3d0',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 700
                    }}
                  >
                    <Paperclip size={13} />
                    <span>
                      {file.name} ({Math.max(1, Math.round((file.size || 0) / 1024))}KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSelectedFile(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fb7185',
                        cursor: 'pointer',
                        fontWeight: 900,
                        padding: '0 2px'
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Unified Task Input + File Attachment Picker */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <label
                className="btn-secondary"
                style={{ cursor: 'pointer', padding: '11px 13px', flexShrink: 0 }}
                title="צרף קבצים, תמונות, קובץ ישראכרט/ONE ZERO או מסמכים"
              >
                <Paperclip size={16} color="#00f0ff" />
                <span>צרף קובץ</span>
                <input
                  type="file"
                  multiple
                  onChange={handleSelectBridgeFiles}
                  style={{ display: 'none' }}
                />
              </label>

              <input
                type="text"
                value={instructionText}
                onChange={(e) => setInstructionText(e.target.value)}
                placeholder="כתוב משימה, בקש אוטומציה חדשה, חיפוש קישור או הסבר לקובץ המצורף..."
                style={{
                  flex: 1,
                  minWidth: '180px',
                  background: 'rgba(4, 7, 17, 0.9)',
                  border: '1px solid rgba(0, 240, 255, 0.35)',
                  borderRadius: '14px',
                  padding: '11px 14px',
                  color: '#fff',
                  fontSize: '0.88rem',
                  fontFamily: 'inherit'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (instructionText.trim() || selectedFiles.length > 0)) {
                    handleSendBridgeAction('task', instructionText.trim());
                  }
                }}
              />
              <button
                className="btn-neon"
                disabled={isSendingInstruction || (!instructionText.trim() && selectedFiles.length === 0)}
                onClick={() => handleSendBridgeAction('task', instructionText.trim())}
              >
                <Send size={16} />
                <span>שלח לפפוש</span>
              </button>
            </div>

            {/* Quick Remote Actions on PC */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={() => handleSendBridgeAction('open-isracard')}>
                <Wallet size={14} color="#10b981" />
                <span>פתח ישראכרט במחשב</span>
              </button>
              <button className="btn-secondary" onClick={() => handleSendBridgeAction('import-isracard-downloads')}>
                <RefreshCw size={14} color="#00f0ff" />
                <span>שאב קובץ ישראכרט מ-Downloads</span>
              </button>
            </div>
          </div>

          {/* Received Files on PC (incoming-files) */}
          {bridge?.files && bridge.files.length > 0 && (
            <section style={{ marginBottom: '18px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UploadCloud size={18} color="#34d399" />
                <span>קבצים שהתקבלו במחשב הנייח ({bridge.files.length})</span>
              </h3>
              {bridge.files.map((f) => (
                <div key={f.id || f.name} className="glass-card card-accent-success" style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Paperclip size={14} color="#34d399" />
                        <span>{f.name}</span>
                      </div>
                      {f.savedPath && (
                        <div className="font-mono-code" style={{ fontSize: '0.73rem', color: '#38bdf8', marginTop: '3px' }}>
                          {f.savedPath}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                      {formatRelativeTime(f.uploadedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Saved Links & Online Discoveries */}
          <section style={{ marginBottom: '18px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link2 size={18} color="#00f0ff" />
              <span>קישורים אישיים שמורים ({bridge?.links?.length || 0})</span>
            </h3>
            {(bridge?.links || []).map((lnk) => (
              <div key={lnk.id} className="glass-card card-accent-info" style={{ padding: '13px 15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>{lnk.title}</div>
                    {lnk.note && <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '3px' }}>{lnk.note}</div>}
                  </div>
                  <a href={lnk.url} target="_blank" rel="noreferrer" className="btn-neon" style={{ padding: '8px 12px', fontSize: '0.8rem', flexShrink: 0 }}>
                    <ExternalLink size={14} />
                    <span>פתח</span>
                  </a>
                </div>
              </div>
            ))}
          </section>

          {/* Messages & Agent Responses Feed */}
          <section>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 800 }}>
              פיד משימות, קבצים ועדכונים בזמן אמת ({bridge?.messages?.length || 0})
            </h3>
            {(bridge?.messages || []).map((msg) => {
              const isUser = msg.sender === 'tal';
              return (
                <div
                  key={msg.id}
                  className={`glass-card ${isUser ? 'card-accent-info' : 'card-accent-success'}`}
                  style={{ padding: '12px 15px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: isUser ? '#00f0ff' : '#34d399' }}>
                        {isUser ? '👤 טל' : '🤖 פפוש (המנצח הראשי)'}
                      </strong>
                      {msg.claudeAssisted && (
                        <span
                          className="pill"
                          style={{
                            background: 'rgba(168, 85, 247, 0.2)',
                            color: '#e879f9',
                            border: '1px solid rgba(232, 121, 249, 0.4)',
                            fontSize: '0.68rem',
                            padding: '1px 7px'
                          }}
                        >
                          בשיתוף Claude 🧠
                        </span>
                      )}
                    </div>
                    <span>{formatRelativeTime(msg.timestamp)} ({formatTimeHM(msg.timestamp)})</span>
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#f8fafc', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {msg.text}
                  </div>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {msg.attachments.map((att, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'rgba(0, 240, 255, 0.12)',
                            border: '1px solid rgba(0, 240, 255, 0.3)',
                            color: '#38bdf8',
                            padding: '3px 9px',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}
                        >
                          <Paperclip size={12} />
                          <span>{att.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </main>
      )}

      {/* TAB 3: AUTOMATIONS (האוטומציות האישיות במחשב) */}
      {activeTab === 'automations' && (
        <main>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800 }}>
              האוטומציות האישיות הפעילות במחשב ({filteredAutomations.length})
            </h2>
            <button className="btn-secondary" onClick={() => setStatusFilter('all')}>
              הצג הכל
            </button>
          </div>

          {filteredAutomations.map((auto) => {
            const st = STATUS_META[auto.lastStatus] || STATUS_META.info;
            const cat = CATEGORY_META[auto.category] || CATEGORY_META.system;
            const CatIcon = cat.icon;

            return (
              <div key={auto.id} className={`glass-card ${st.accentClass}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span className={`pill ${st.pillClass}`}>{st.label}</span>
                      <span className="pill" style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.color}44` }}>
                        <CatIcon size={13} />
                        {cat.label}
                      </span>
                      <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>
                        ⏰ {auto.schedule}
                      </span>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: '1.04rem', color: '#ffffff' }}>{auto.name}</div>
                    <p style={{ margin: '5px 0 8px 0', fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.45 }}>
                      {auto.description}
                    </p>

                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        fontSize: '0.83rem',
                        color: '#e2e8f0'
                      }}
                    >
                      <strong style={{ color: '#00f0ff' }}>דיווח ותקציר אחרון ({formatRelativeTime(auto.lastRunAt)}): </strong>
                      <span>{auto.lastSummary}</span>

                      {auto.lastDetails && auto.lastDetails.length > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(148, 163, 184, 0.15)' }}>
                          {auto.lastDetails.map((line, i) => (
                            <div key={i} style={{ fontSize: '0.8rem', color: '#cbd5e1', padding: '2px 0' }}>
                              • {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '14px', marginTop: '10px', fontSize: '0.76rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                      <span>הרצות אמיתיות שתועדו: <strong style={{ color: '#fff' }}>{auto.totalRuns || 0}</strong></span>
                      <span>יעד: <strong style={{ color: '#38bdf8' }}>{auto.repoPath}</strong></span>
                    </div>
                  </div>

                  {auto.repoPath && String(auto.repoPath).startsWith('https://') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <a href={auto.repoPath} target="_blank" rel="noreferrer" className="btn-secondary">
                        <ExternalLink size={14} />
                        <span>פתח קישור</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </main>
      )}

      {/* TAB 4: ALERTS & ERRORS (התראות ותקלות - נעלמות מהמסך בסימון כטופל) */}
      {activeTab === 'alerts' && (
        <main>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800 }}>
              התראות ותזכורות פעילות ({openAlerts.length})
            </h2>
            {dismissedAlertIds.length > 0 && (
              <button
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                onClick={() => {
                  setDismissedAlertIds([]);
                  saveDismissedAlertsToStorage([]);
                  fetchLiveTelemetryAndVersion(false);
                }}
              >
                שחזר התראות שהוסתרו ({dismissedAlertIds.length})
              </button>
            )}
          </div>

          {openAlerts.length === 0 ? (
            <div className="glass-card card-accent-success" style={{ textAlign: 'center', padding: '28px 18px' }}>
              <CheckCircle2 size={36} color="#34d399" style={{ marginBottom: '8px' }} />
              <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#ffffff' }}>
                אין התראות פתוחות — הכל מטופל!
              </div>
              <div style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '4px' }}>
                כל ההתראות שסומנו כטופלו הוסרו מהמסך.
              </div>
            </div>
          ) : (
            openAlerts.map((al) => {
              const isCrit = al.severity === 'critical';
              const isInfo = al.severity === 'info';
              const accent = isCrit ? 'card-accent-error' : isInfo ? 'card-accent-info' : 'card-accent-warning';
              const pillClass = isCrit ? 'pill-error' : isInfo ? 'pill-info' : 'pill-warning';

              return (
                <div key={al.id} className={`glass-card ${accent}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span className={`pill ${pillClass}`}>
                          {isCrit ? 'תקלה פתוחה' : isInfo ? 'תזכורת' : 'התראה'}
                        </span>
                        <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{formatRelativeTime(al.createdAt)}</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{al.title}</div>
                      <p style={{ margin: '6px 0', fontSize: '0.86rem', color: '#cbd5e1' }}>{al.message}</p>
                      {al.actionHint && (
                        <div style={{ fontSize: '0.8rem', color: '#00f0ff', fontWeight: 600 }}>
                          💡 {al.actionHint}
                        </div>
                      )}
                    </div>
                    <button
                      className="btn-neon"
                      style={{ flexShrink: 0, fontSize: '0.76rem', padding: '8px 12px' }}
                      onClick={() => handleDismissAlert(al.id)}
                    >
                      <Check size={14} />
                      <span>טופל (העלים)</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </main>
      )}

      {/* TAB 5: TOOLS HUB (ארגז הכלים האישיים של טל) */}
      {activeTab === 'tools' && (
        <main>
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800 }}>
              הכלים והמערכות האישיות של פפוש
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {personalTools.map((tool) => (
              <div key={tool.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span
                      className="pill"
                      style={{
                        background: 'rgba(0, 240, 255, 0.14)',
                        color: '#00f0ff',
                        border: '1px solid rgba(0, 240, 255, 0.35)'
                      }}
                    >
                      {tool.badge}
                    </span>
                    <span className={`pill ${tool.status === 'active' ? 'pill-success' : 'pill-warning'}`}>
                      {tool.statusLabel}
                    </span>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#fff' }}>{tool.name}</div>
                  <div style={{ fontSize: '0.83rem', color: '#cbd5e1', marginTop: '4px' }}>{tool.subtitle}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px' }}>🛠️ {tool.tech}</div>
                  <div
                    className="font-mono-code"
                    style={{
                      marginTop: '8px',
                      fontSize: '0.72rem',
                      color: '#38bdf8',
                      background: 'rgba(4, 7, 17, 0.8)',
                      padding: '6px 9px',
                      borderRadius: '8px',
                      overflowX: 'auto'
                    }}
                  >
                    {tool.localPath}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <a
                    href={tool.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                    style={{ width: '100%' }}
                  >
                    <ExternalLink size={14} />
                    <span>פתח</span>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Version & Cache-Busting Status */}
          <div className="glass-card card-accent-success" style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color="#34d399" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>
                    בדיקת גרסה אוטומטית פעילה (v{APP_VERSION.version} • Build #{APP_VERSION.buildNumber})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    האפליקציה בודקת עדכונים אוטומטית בכל פתיחה ממסך הבית באייפון.
                  </div>
                </div>
              </div>
              <button className="btn-secondary" onClick={handleHardRefreshApp}>
                <RefreshCw size={14} />
                <span>רענון מלא</span>
              </button>
            </div>
          </div>

          {/* How any script reports to PAPOOSH */}
          <div className="glass-card card-accent-info" style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#00f0ff' }}>
                <Terminal size={18} />
                <span>פקודת דיווח מהירה מכל סקריפט אישי במחשב</span>
              </div>
              <button
                className="btn-secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(cliSnippet);
                  setCopiedSnippet(true);
                  setTimeout(() => setCopiedSnippet(false), 2500);
                }}
              >
                {copiedSnippet ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                <span>{copiedSnippet ? 'הועתק!' : 'העתק'}</span>
              </button>
            </div>
            <pre
              className="font-mono-code"
              style={{
                background: '#03060d',
                padding: '10px',
                borderRadius: '10px',
                border: '1px solid rgba(0, 240, 255, 0.25)',
                color: '#38bdf8',
                fontSize: '0.75rem',
                overflowX: 'auto',
                marginTop: '8px',
                marginBottom: 0
              }}
            >
              {cliSnippet}
            </pre>
          </div>
        </main>
      )}

      {/* iPhone Bottom Navigation Bar */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <button
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Activity size={20} />
            <span>חמ״ל פפוש</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'bridge' ? 'active' : ''}`}
            onClick={() => setActiveTab('bridge')}
          >
            <MessageSquare size={20} />
            <span>גשר וקישורים</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'automations' ? 'active' : ''}`}
            onClick={() => setActiveTab('automations')}
          >
            <Play size={20} />
            <span>אוטומציות</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            {openAlerts.length > 0 && <span className="nav-badge">{openAlerts.length}</span>}
            <AlertTriangle size={20} />
            <span>התראות</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            <Wrench size={20} />
            <span>כלים וגרסה</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
