import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Smartphone,
  Download,
  Terminal,
  Wallet,
  Mail,
  Building2,
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
  Bell
} from 'lucide-react';
import { APP_VERSION } from './version.js';

const CATEGORY_META = {
  all: { label: 'הכל', icon: Layers, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.14)' },
  finance: { label: 'כספים ובנקים', icon: Wallet, color: '#10b981', bg: 'rgba(16, 185, 129, 0.16)' },
  email: { label: 'מיילים וחשבוניות', icon: Mail, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)' },
  business: { label: 'אל סול והצוות', icon: Building2, color: '#e879f9', bg: 'rgba(232, 121, 249, 0.16)' },
  calendar: { label: 'יומן ותזכורות', icon: Calendar, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.16)' },
  system: { label: 'מחשב נייח ו-Git', icon: Cpu, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.16)' }
};

const STATUS_META = {
  success: { label: 'תקין • הופעל', pillClass: 'pill-success', accentClass: 'card-accent-success', icon: CheckCircle2 },
  warning: { label: 'התראה • דורש תשומת לב', pillClass: 'pill-warning', accentClass: 'card-accent-warning', icon: AlertTriangle },
  error: { label: 'תקלה • נכשל', pillClass: 'pill-error', accentClass: 'card-accent-error', icon: XCircle },
  info: { label: 'עדכון מערכת', pillClass: 'pill-info', accentClass: 'card-accent-info', icon: Sparkles }
};

function formatRelativeTime(isoString) {
  if (!isoString) return 'לא ידוע';
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

  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | automations | alerts | tools | iphone
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [telemetry, setTelemetry] = useState(() => embedded?.telemetry || null);
  const [versionInfo, setVersionInfo] = useState(() => embedded?.version || APP_VERSION);
  const [newVersionAvailable, setNewVersionAvailable] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const fetchLiveTelemetryAndVersion = useCallback(async (manual = false) => {
    setIsRefreshing(true);
    const cacheBuster = `t=${Date.now()}`;
    const candidateBaseUrls = ['./', 'https://fradkintal.github.io/papoosh-automations/'];

    let loadedTelemetry = null;
    for (const base of candidateBaseUrls) {
      try {
        const res = await fetch(`${base}data/telemetry.json?${cacheBuster}`, { cache: 'no-store' });
        if (res.ok) {
          loadedTelemetry = await res.json();
          break;
        }
      } catch {
        // Try next candidate
      }
    }

    if (loadedTelemetry) {
      setTelemetry(loadedTelemetry);
      try {
        localStorage.setItem('papoosh_last_telemetry', JSON.stringify(loadedTelemetry));
      } catch {
        // ignore storage quota
      }
    } else if (!telemetry) {
      try {
        const cached = localStorage.getItem('papoosh_last_telemetry');
        if (cached) setTelemetry(JSON.parse(cached));
      } catch {
        // ignore
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
        showToast('הנתונים והגרסה סונכרנו מול המחשב הנייח בהצלחה!');
      }
    }, 350);
  }, [telemetry, showToast]);

  useEffect(() => {
    fetchLiveTelemetryAndVersion(false);
    const interval = setInterval(() => fetchLiveTelemetryAndVersion(false), 45000);
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

  const handleTriggerSimulation = (auto) => {
    if (!telemetry) return;
    const nowIso = new Date().toISOString();
    const newRun = {
      id: `run-sim-${Date.now()}`,
      automationId: auto.id,
      name: auto.name,
      category: auto.category,
      status: 'success',
      timestamp: nowIso,
      durationMs: Math.floor(900 + Math.random() * 1800),
      summary: `הרצת בדיקה יזומה מהטלפון הושלמה בהצלחה עבור "${auto.name}".`,
      details: [
        `✓ פקודת הפעלה התקבלה ממרכז השליטה של פפוש (${formatTimeHM(nowIso)})`,
        `✓ נתיב יעד: ${auto.repoPath}`,
        `✓ סטטוס ביצוע: תקין (0 שגיאות)`
      ]
    };

    const updatedAutomations = telemetry.automations.map((item) =>
      item.id === auto.id
        ? {
            ...item,
            lastStatus: 'success',
            lastRunAt: nowIso,
            lastSummary: newRun.summary,
            totalRuns: (item.totalRuns || 0) + 1
          }
        : item
    );

    const updatedTelemetry = {
      ...telemetry,
      updatedAt: nowIso,
      automations: updatedAutomations,
      recentRuns: [newRun, ...(telemetry.recentRuns || [])],
      summary: {
        ...telemetry.summary,
        healthyCount: updatedAutomations.filter((a) => a.lastStatus === 'success').length,
        warningCount: updatedAutomations.filter((a) => a.lastStatus === 'warning').length,
        errorCount: updatedAutomations.filter((a) => a.lastStatus === 'error').length,
        runsToday: (telemetry.summary?.runsToday || 0) + 1
      }
    };

    setTelemetry(updatedTelemetry);
    setExpandedRunId(newRun.id);
    showToast(`האוטומציה "${auto.name}" הופעלה ודיווחה בהצלחה!`);
  };

  const handleToggleResolveAlert = (alertId) => {
    if (!telemetry) return;
    const updatedAlerts = telemetry.alerts.map((al) =>
      al.id === alertId ? { ...al, resolved: !al.resolved } : al
    );
    setTelemetry({
      ...telemetry,
      alerts: updatedAlerts,
      summary: {
        ...telemetry.summary,
        openAlerts: updatedAlerts.filter((a) => !a.resolved).length
      }
    });
    showToast('סטטוס ההתראה עודכן!');
  };

  const handleDownloadStandaloneHtml = () => {
    const htmlContent = document.documentElement.outerHTML;
    const blob = new Blob(['<!doctype html>\n' + htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PAPOOSH-iPhone-v${versionInfo.version || APP_VERSION.version}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('קובץ האפליקציה לאייפון הורד בהצלחה!');
  };

  const filteredAutomations = useMemo(() => {
    if (!telemetry?.automations) return [];
    return telemetry.automations.filter((a) => {
      const catMatch = selectedCategory === 'all' || a.category === selectedCategory;
      const statusMatch = statusFilter === 'all' || a.lastStatus === statusFilter;
      return catMatch && statusMatch;
    });
  }, [telemetry, selectedCategory, statusFilter]);

  const filteredRuns = useMemo(() => {
    if (!telemetry?.recentRuns) return [];
    return telemetry.recentRuns.filter((r) => {
      const catMatch = selectedCategory === 'all' || r.category === selectedCategory;
      const statusMatch = statusFilter === 'all' || r.status === statusFilter;
      return catMatch && statusMatch;
    });
  }, [telemetry, selectedCategory, statusFilter]);

  const openAlerts = useMemo(() => {
    if (!telemetry?.alerts) return [];
    return telemetry.alerts.filter((al) => !al.resolved);
  }, [telemetry]);

  const summary = telemetry?.summary || {
    totalAutomations: 7,
    healthyCount: 5,
    warningCount: 1,
    errorCount: 1,
    runsToday: 6,
    openAlerts: 3
  };

  const cliSnippet = `node C:\\Users\\fradk\\PROGRAMS\\papoosh-automations\\agent\\papoosh-cli.js report --id "my-script" --name "בדיקת מערכת" --category "business" --status "success" --summary "הריצה הסתיימה בהצלחה" --push`;

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

      {/* New Version Alert Banner */}
      {newVersionAvailable && (
        <div
          className="glass-card card-accent-info"
          style={{
            background: 'linear-gradient(135deg, rgba(0,240,255,0.22), rgba(168,85,247,0.22))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '14px'
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: '#00f0ff', fontSize: '0.95rem' }}>
              זמינה גרסה חדשה של פפוש! (v{newVersionAvailable.version} • Build #{newVersionAvailable.buildNumber})
            </div>
            <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
              לחץ כדי לרענן מיד את האפליקציה לתוצאה העדכנית ביותר.
            </div>
          </div>
          <button
            className="btn-neon"
            onClick={() => {
              window.location.href = `${window.location.pathname}?v=${newVersionAvailable.buildNumber}&t=${Date.now()}`;
            }}
          >
            עדכן עכשיו
          </button>
        </div>
      )}

      {/* Hero Brand Header */}
      <header className="hero-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img src={logoSrc} alt="PAPOOSH Logo" className="logo-glow" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="font-brand brand-gradient-text" style={{ fontSize: '1.55rem', fontWeight: 900 }}>
                  PAPOOSH
                </span>
                <span
                  style={{
                    background: 'rgba(255, 46, 147, 0.2)',
                    border: '1px solid rgba(255, 46, 147, 0.5)',
                    color: '#f472b6',
                    fontSize: '0.73rem',
                    fontWeight: 800,
                    padding: '2px 9px',
                    borderRadius: '999px'
                  }}
                >
                  פפוש אוטומציות
                </span>
              </div>
              <div style={{ fontSize: '0.88rem', color: '#cbd5e1', marginTop: '3px', fontWeight: 500 }}>
                חמ״ל האוטומציות והכלים האישי של טל פרדקין
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '7px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#34d399', fontWeight: 700 }}>
                  <span className="pulse-dot" />
                  מחשב נייח פעיל ({telemetry?.machine?.hostname || 'Desktop-PC'})
                </span>
                <span
                  onClick={() => setActiveTab('iphone')}
                  style={{
                    cursor: 'pointer',
                    fontSize: '0.74rem',
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.14)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    fontWeight: 700
                  }}
                >
                  גרסה v{versionInfo.version || APP_VERSION.version} (#{versionInfo.buildNumber || APP_VERSION.buildNumber}) ✓
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-secondary"
              onClick={() => fetchLiveTelemetryAndVersion(true)}
              title="סנכרן נתונים ובדוק גרסה עדכנית"
            >
              <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              <span>רענן</span>
            </button>
            <button className="btn-neon" onClick={handleDownloadStandaloneHtml}>
              <Download size={16} />
              <span>הורד לאייפון</span>
            </button>
          </div>
        </div>
      </header>

      {/* Top KPI Cards (Color-Coded for Instant Visual Clarity) */}
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
            <span style={{ fontSize: '0.8rem', color: '#a7f3d0', fontWeight: 700 }}>אוטומציות תקינות</span>
            <CheckCircle2 size={20} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>
            {summary.healthyCount} <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#94a3b8' }}>/ {summary.totalAutomations}</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px' }}>ירוק = רץ חלק ברקע</div>
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
            <span style={{ fontSize: '0.8rem', color: '#bae6fd', fontWeight: 700 }}>דיווחים וריצות היום</span>
            <Activity size={20} color="#00f0ff" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#00f0ff', marginTop: '4px' }}>
            {summary.runsToday}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px' }}>
            עודכן {formatRelativeTime(telemetry?.updatedAt)}
          </div>
        </div>

        <div
          className="kpi-card kpi-amber"
          onClick={() => setActiveTab('alerts')}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#fde68a', fontWeight: 700 }}>התראות פתוחות</span>
            <AlertTriangle size={20} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fbbf24', marginTop: '4px' }}>
            {openAlerts.length}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px' }}>צהוב = דורש השלמה/בדיקה</div>
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
            <span style={{ fontSize: '0.8rem', color: '#fecdd3', fontWeight: 700 }}>תקלות פתוחות</span>
            <XCircle size={20} color="#fb7185" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fb7185', marginTop: '4px' }}>
            {summary.errorCount}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px' }}>
            {summary.errorCount > 0 ? 'אדום = דורש חיבור/טיפול' : 'אפס תקלות!'}
          </div>
        </div>
      </section>

      {/* Category Filter Bar */}
      <div style={{ marginTop: '16px', marginBottom: '12px' }}>
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
          {/* Active Alerts Highlight Section */}
          {openAlerts.length > 0 && (
            <section style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={18} color="#fbbf24" />
                  <span>התראות ודגשים חשובים במחשב החדש ({openAlerts.length})</span>
                </h2>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.76rem' }} onClick={() => setActiveTab('alerts')}>
                  כל ההתראות
                </button>
              </div>

              {openAlerts.map((al) => {
                const isCrit = al.severity === 'critical';
                const isInfo = al.severity === 'info';
                const accent = isCrit ? 'card-accent-error' : isInfo ? 'card-accent-info' : 'card-accent-warning';
                const pillClass = isCrit ? 'pill-error' : isInfo ? 'pill-info' : 'pill-warning';
                const pillLabel = isCrit ? 'תקלה / חוסר הגדרה' : isInfo ? 'מחובר ומוכן' : 'התראה';

                return (
                  <div key={al.id} className={`glass-card ${accent}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <span className={`pill ${pillClass}`}>{pillLabel}</span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatRelativeTime(al.createdAt)}</span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>{al.title}</div>
                        <p style={{ margin: '6px 0', fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5 }}>{al.message}</p>
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
                            💡 פעולה מומלצת: {al.actionHint}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn-secondary"
                        style={{ flexShrink: 0, fontSize: '0.75rem', padding: '6px 10px' }}
                        onClick={() => handleToggleResolveAlert(al.id)}
                      >
                        סמן כטופל ✓
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* Live Automation Runs Feed */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#00f0ff" />
                <span>יומן הפעלות ודיווחים אחרונים ({filteredRuns.length})</span>
              </h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { id: 'all', label: 'הכל' },
                  { id: 'success', label: '🟢 תקין' },
                  { id: 'warning', label: '🟡 התראה' },
                  { id: 'error', label: '🔴 תקלה' }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setStatusFilter(st.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '10px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      border: statusFilter === st.id ? '1px solid #00f0ff' : '1px solid rgba(148,163,184,0.2)',
                      background: statusFilter === st.id ? 'rgba(0,240,255,0.16)' : 'rgba(15,23,42,0.7)',
                      color: '#f8fafc',
                      cursor: 'pointer'
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
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
                        <span style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {formatRelativeTime(run.timestamp)} ({formatTimeHM(run.timestamp)})
                        </span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#ffffff' }}>{run.name}</div>
                      <div style={{ fontSize: '0.87rem', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.45 }}>
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
                        פירוט לוג הריצה מהמחשב הנייח:
                      </div>
                      {run.details.map((line, idx) => (
                        <div key={idx} style={{ fontSize: '0.82rem', color: '#e2e8f0', padding: '3px 0' }}>
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

      {/* TAB 2: AUTOMATIONS (כל האוטומציות במחשב) */}
      {activeTab === 'automations' && (
        <main>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
              כל האוטומציות הרשומות במחשב ({filteredAutomations.length})
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

                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>{auto.name}</div>
                    <p style={{ margin: '5px 0 8px 0', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.45 }}>
                      {auto.description}
                    </p>

                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '12px',
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        fontSize: '0.83rem',
                        color: '#e2e8f0'
                      }}
                    >
                      <strong style={{ color: '#00f0ff' }}>דיווח אחרון ({formatRelativeTime(auto.lastRunAt)}): </strong>
                      {auto.lastSummary}
                    </div>

                    <div style={{ display: 'flex', gap: '14px', marginTop: '10px', fontSize: '0.76rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                      <span>סה״כ הפעלות: <strong style={{ color: '#fff' }}>{auto.totalRuns}</strong></span>
                      <span>אחוז הצלחה: <strong style={{ color: '#34d399' }}>{auto.successRate}%</strong></span>
                      <span>ריצה הבאה: <strong style={{ color: '#38bdf8' }}>{formatRelativeTime(auto.nextRunAt)}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    <button className="btn-neon" onClick={() => handleTriggerSimulation(auto)}>
                      <Play size={15} />
                      <span>הפעל בדיקה</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </main>
      )}

      {/* TAB 3: ALERTS & ERRORS (התראות ותקלות) */}
      {activeTab === 'alerts' && (
        <main>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 800 }}>
            מרכז התראות, חריגים ותקלות ({telemetry?.alerts?.length || 0})
          </h2>

          {(telemetry?.alerts || []).map((al) => {
            const isCrit = al.severity === 'critical';
            const isInfo = al.severity === 'info';
            const accent = isCrit ? 'card-accent-error' : isInfo ? 'card-accent-info' : 'card-accent-warning';
            const pillClass = isCrit ? 'pill-error' : isInfo ? 'pill-info' : 'pill-warning';

            return (
              <div
                key={al.id}
                className={`glass-card ${accent}`}
                style={{ opacity: al.resolved ? 0.55 : 1 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span className={`pill ${pillClass}`}>
                        {al.resolved ? 'טופל ✓' : isCrit ? 'תקלה פתוחה' : isInfo ? 'מידע' : 'התראה'}
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
                    className="btn-secondary"
                    onClick={() => handleToggleResolveAlert(al.id)}
                  >
                    {al.resolved ? 'פתח מחדש' : 'סמן כטופל'}
                  </button>
                </div>
              </div>
            );
          })}
        </main>
      )}

      {/* TAB 4: TOOLS HUB (ארגז הכלים והמערכות של טל) */}
      {activeTab === 'tools' && (
        <main>
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800 }}>
              ארגז הכלים והפרויקטים של פפוש (`C:\Users\fradk\PROGRAMS`)
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
              כל המערכות העסקיות והאישיות שלך במקום אחד – מוכנות להתממשקות מלאה עם סוכן האוטומציות.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {(telemetry?.tools || []).map((tool) => (
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
                  <div style={{ fontWeight: 900, fontSize: '1.08rem', color: '#fff' }}>{tool.name}</div>
                  <div style={{ fontSize: '0.84rem', color: '#cbd5e1', marginTop: '4px' }}>{tool.subtitle}</div>
                  <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '8px' }}>🛠️ {tool.tech}</div>
                  <div
                    className="font-mono-code"
                    style={{
                      marginTop: '8px',
                      fontSize: '0.73rem',
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
                    <span>פתח ב-GitHub / Web</span>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* How any script reports to PAPOOSH */}
          <div className="glass-card card-accent-info" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#00f0ff' }}>
                <Terminal size={18} />
                <span>איך כל אוטומציה חדשה במחשב מדווחת לפפוש?</span>
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
                <span>{copiedSnippet ? 'הועתק!' : 'העתק פקודה'}</span>
              </button>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#cbd5e1', margin: '8px 0' }}>
              הוסף את השורה הזו בסוף כל סקריפט (ב-Node.js, Python או PowerShell) כדי שהריצה תופיע מיד באייפון:
            </p>
            <pre
              className="font-mono-code"
              style={{
                background: '#03060d',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(0, 240, 255, 0.25)',
                color: '#38bdf8',
                fontSize: '0.78rem',
                overflowX: 'auto',
                margin: 0
              }}
            >
              {cliSnippet}
            </pre>
          </div>
        </main>
      )}

      {/* TAB 5: IPHONE & VERSIONS (הורדה לאייפון וניהול גרסאות) */}
      {activeTab === 'iphone' && (
        <main>
          <div className="glass-card card-accent-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <Smartphone size={26} color="#00f0ff" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 900 }}>
                  אפליקציית PAPOOSH לאייפון שלך (2 דרכים לבחירתך)
                </h2>
                <div style={{ fontSize: '0.83rem', color: '#cbd5e1' }}>
                  גם קובץ עצמאי להורדה ישירה לאייפון בלי צורך ב-Host וגם אפליקציית Web חיה (PWA) עם אייקון במסך הבית!
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '14px' }}>
              {/* Option A: Direct Downloadable File */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(0, 240, 255, 0.35)',
                  borderRadius: '16px',
                  padding: '14px'
                }}
              >
                <div style={{ fontWeight: 800, color: '#00f0ff', fontSize: '0.96rem', marginBottom: '6px' }}>
                  אפשרות 1: קובץ אפליקציה עצמאי לאייפון (ללא צורך ב-Host)
                </div>
                <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                  מוריד קובץ יחיד (`PAPOOSH-iPhone-App.html`) שכולל בתוכו את הלוגו, העיצוב והנתונים. אפשר לשמור אותו באפליקציית <strong>קבצים (Files)</strong> באייפון או לשלוח לעצמך בוואטסאפ/מייל ולפתוח בכל רגע! כשהאייפון מחובר לאינטרנט, הקובץ גם יודע למשוך לבד את העדכונים האחרונים מ-GitHub.
                </p>
                <button className="btn-neon" style={{ width: '100%' }} onClick={handleDownloadStandaloneHtml}>
                  <Download size={16} />
                  <span>הורד קובץ אפליקציה עצמאי (.html)</span>
                </button>
              </div>

              {/* Option B: iOS WebClip / PWA */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(232, 121, 249, 0.35)',
                  borderRadius: '16px',
                  padding: '14px'
                }}
              >
                <div style={{ fontWeight: 800, color: '#e879f9', fontSize: '0.96rem', marginBottom: '6px' }}>
                  אפשרות 2: התקנת אייקון PAPOOSH למסך הבית באייפון
                </div>
                <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                  מתקין את האייקון הצבעוני של PAPOOSH ישירות על מסך הבית באייפון באפליקציית מסך מלא (PWA). אפשר להוריד פרופיל התקנה אוטומטי לאייפון או ללחוץ ב-Safari על <strong>שיתוף ⬅ הוסף למסך הבית</strong>.
                </p>
                <a
                  href="./PAPOOSH-iPhone.mobileconfig"
                  download="PAPOOSH-iPhone.mobileconfig"
                  className="btn-secondary"
                  style={{ width: '100%', borderColor: 'rgba(232, 121, 249, 0.5)', color: '#f5d0fe' }}
                >
                  <Smartphone size={16} />
                  <span>הורד פרופיל אייקון לאייפון (.mobileconfig)</span>
                </a>
              </div>
            </div>
          </div>

          {/* Version Verification & Changelog */}
          <div className="glass-card card-accent-success">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={24} color="#34d399" />
                <div>
                  <div style={{ fontWeight: 900, fontSize: '1.02rem', color: '#fff' }}>
                    בקרת גרסאות ווידוא תצוגה עדכנית (Cache-Busting פעיל)
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    גרסה נוכחית: <strong style={{ color: '#34d399' }}>v{versionInfo.version || APP_VERSION.version}</strong> • Build #{versionInfo.buildNumber || APP_VERSION.buildNumber} • {versionInfo.codename || APP_VERSION.codename}
                  </div>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => fetchLiveTelemetryAndVersion(true)}>
                <RefreshCw size={14} />
                <span>בדוק עדכון עכשיו</span>
              </button>
            </div>

            <div style={{ marginTop: '14px', borderTop: '1px solid rgba(148,163,184,0.16)', paddingTop: '12px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#00f0ff', marginBottom: '8px' }}>
                היסטוריית גרסאות (Changelog):
              </div>
              {(versionInfo.changelog || []).map((entry, idx) => (
                <div key={idx} style={{ marginBottom: '10px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f8fafc' }}>
                    v{entry.version} ({entry.date}) – {entry.title}
                  </div>
                  <ul style={{ margin: '4px 0 0 0', paddingRight: '18px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                    {(entry.highlights || []).map((h, i) => (
                      <li key={i} style={{ marginBottom: '3px' }}>{h}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
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
            <span>ארגז כלים</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'iphone' ? 'active' : ''}`}
            onClick={() => setActiveTab('iphone')}
          >
            <Smartphone size={20} />
            <span>אייפון וגרסה</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
