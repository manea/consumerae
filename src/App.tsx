import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Database,
  Globe,
  Moon,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { ComplianceAndExposurePanel } from './components/ComplianceAndExposurePanel.tsx';
import { ConsumerSlaAndPenaltySvg } from './components/ConsumerSlaAndPenaltySvg.tsx';
import { ControlsAndFindingsPanel } from './components/ControlsAndFindingsPanel.tsx';
import { DossierVaultAndPrint } from './components/DossierVaultAndPrint.tsx';
import { ReceiptCsvAuditPanel } from './components/ReceiptCsvAuditPanel.tsx';
import { CONSUMERAE_TOOL_VERSION } from './core/consumerCatalog.ts';
import { CONSUMER_PRESETS } from './core/presets.ts';
import { assessConsumerReadiness, evaluateConsumerCoreSync } from './core/readinessAssessor.ts';
import type { AssessmentInput, AssessmentResult } from './core/types.ts';
import {
  type ApiMode,
  type ConsumerDossierRecord,
  type PublicConsumerReport,
  deleteDossier,
  detectServerMode,
  duplicateDossier,
  fetchBriefMarkdown,
  fetchExportCsv,
  fetchPublicReport,
  finalizeDossier,
  listDossiers,
  saveDossier,
} from './lib/api.ts';
import { stripBase, withBase } from './lib/basePath.ts';
import {
  STATUS_LABELS,
  UI_COPY,
  type Locale,
  type ThemeName,
} from './lib/i18n.ts';

type StudioTab = 'dashboard' | 'controls' | 'csv' | 'vault';

const LS_LOCALE = 'consumerae.v1.locale';
const LS_THEME = 'consumerae.v1.theme';

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LS_LOCALE);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // Ignore storage read errors
  }
  return 'ar';
}

function getInitialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === 'alabaster-consumer' || saved === 'obsidian-watch') return saved;
  } catch {
    // Ignore storage read errors
  }
  return 'alabaster-consumer';
}

function parsePublicSlugFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const rel = stripBase(window.location.pathname);
  const match = rel.match(/^\/r\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]!) : null;
}

function triggerFileDownload(filename: string, content: string | Blob, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const [mode, setMode] = useState<ApiMode>('local');
  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(CONSUMER_PRESETS[0]!.id);
  const [input, setInput] = useState<AssessmentInput>(() => ({
    ...structuredClone(CONSUMER_PRESETS[0]!.input),
    receiptCsv: CONSUMER_PRESETS[0]!.input.receiptCsv ?? CONSUMER_PRESETS[0]!.sampleCsv,
  }));
  const [shaDigest, setShaDigest] = useState<string>('');
  const [dossiers, setDossiers] = useState<ConsumerDossierRecord[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [publicSlugRoute, setPublicSlugRoute] = useState<string | null>(() =>
    parsePublicSlugFromLocation(),
  );
  const [publicReportState, setPublicReportState] = useState<{
    loading: boolean;
    error: string | null;
    data: PublicConsumerReport | null;
  }>({ loading: false, error: null, data: null });

  const copy = UI_COPY[locale];
  const isAr = locale === 'ar';

  const syncCore = useMemo(() => evaluateConsumerCoreSync(input), [input]);
  const liveResult: AssessmentResult = useMemo(
    () => ({
      ...syncCore,
      dossierSha256: shaDigest,
    }),
    [syncCore, shaDigest],
  );

  const selectedPreset = useMemo(
    () => CONSUMER_PRESETS.find((p) => p.id === selectedPresetId) ?? CONSUMER_PRESETS[0]!,
    [selectedPresetId],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(LS_LOCALE, locale);
    } catch {
      // Ignore storage write errors
    }
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'obsidian-watch' ? '#07101D' : '#F7F9FC');
    }
    try {
      localStorage.setItem(LS_THEME, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  useEffect(() => {
    let active = true;
    void assessConsumerReadiness(input).then((res) => {
      if (active) {
        setShaDigest(res.dossierSha256);
      }
    });
    return () => {
      active = false;
    };
  }, [input]);

  useEffect(() => {
    let active = true;
    void detectServerMode().then(async (detected) => {
      if (!active) return;
      setMode(detected);
      const rows = await listDossiers(detected).catch(() => []);
      if (active) setDossiers(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setPublicSlugRoute(parsePublicSlugFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!publicSlugRoute) return;
    let active = true;
    setPublicReportState({ loading: true, error: null, data: null });
    void detectServerMode().then(async (detected) => {
      if (!active) return;
      setMode(detected);
      try {
        const rep = await fetchPublicReport(detected, publicSlugRoute);
        if (active) setPublicReportState({ loading: false, error: null, data: rep });
      } catch (err) {
        if (active) {
          setPublicReportState({
            loading: false,
            error: err instanceof Error ? err.message : copy.missingReport,
            data: null,
          });
        }
      }
    });
    return () => {
      active = false;
    };
  }, [publicSlugRoute, copy.missingReport]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 3200);
  };

  const refreshVault = async (activeMode = mode) => {
    const rows = await listDossiers(activeMode);
    setDossiers(rows);
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = CONSUMER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setInput({
      ...structuredClone(preset.input),
      receiptCsv: preset.sampleCsv,
    });
  };

  const handleSaveDraft = async (title: string) => {
    setBusyAction('save');
    try {
      const saved = await saveDossier(mode, input, title);
      await refreshVault();
      showToast(isAr ? `تم حفظ الملف ${saved.dossierCode}` : `Saved dossier ${saved.dossierCode}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleFinalize = async (dossierCode: string) => {
    setBusyAction(dossierCode);
    try {
      const sealed = await finalizeDossier(mode, dossierCode);
      await refreshVault();
      showToast(
        isAr
          ? `تم ختم ${sealed.dossierCode} ببصمة SHA-256`
          : `Sealed ${sealed.dossierCode} with SHA-256`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Finalize failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDuplicate = async (dossierCode: string) => {
    setBusyAction(dossierCode);
    try {
      const dup = await duplicateDossier(mode, dossierCode);
      await refreshVault();
      showToast(isAr ? `تم إنشاء نسخة ${dup.dossierCode}` : `Duplicated ${dup.dossierCode}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Duplicate failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (dossierCode: string) => {
    setBusyAction(dossierCode);
    try {
      await deleteDossier(mode, dossierCode);
      await refreshVault();
      showToast(isAr ? `تم حذف ${dossierCode}` : `Deleted ${dossierCode}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadBrief = async (record: ConsumerDossierRecord) => {
    setBusyAction(record.dossierCode);
    try {
      const md = await fetchBriefMarkdown(mode, record, locale);
      triggerFileDownload(`${record.dossierCode}.${locale}.brief.md`, md, 'text/markdown;charset=utf-8');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadCsv = async (record: ConsumerDossierRecord) => {
    setBusyAction(record.dossierCode);
    try {
      const { filename, content } = await fetchExportCsv(mode, record);
      triggerFileDownload(filename, content, 'text/csv;charset=utf-8');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'CSV export failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenPublicReport = (slugOrCode: string) => {
    const nextPath = withBase(`/r/${encodeURIComponent(slugOrCode)}`);
    window.history.pushState({}, '', nextPath);
    setPublicSlugRoute(slugOrCode);
  };

  const handleBackToStudio = () => {
    window.history.pushState({}, '', withBase('/'));
    setPublicSlugRoute(null);
  };

  const handleCopyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(isAr ? `تم نسخ ${label}` : `Copied ${label}`);
    } catch {
      showToast(isAr ? 'تعذر النسخ التلقائي للحافظة' : 'Clipboard copy unavailable');
    }
  };

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="cns-card no-print rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
              >
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {copy.brandTitle}
                </h1>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {copy.brandSub}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              >
                <Database className="h-3.5 w-3.5" style={{ color: 'var(--accent-teal)' }} />
                {mode === 'server' ? copy.serverBadge : copy.localBadge}
              </span>

              <button
                data-testid="lang-toggle-btn"
                type="button"
                onClick={() => setLocale((prev) => (prev === 'ar' ? 'en' : 'ar'))}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
              >
                <Globe className="h-3.5 w-3.5" />
                {isAr ? 'English (LTR)' : 'العربية (RTL)'}
              </button>

              <button
                data-testid="theme-toggle-btn"
                type="button"
                onClick={() =>
                  setTheme((prev) =>
                    prev === 'alabaster-consumer' ? 'obsidian-watch' : 'alabaster-consumer',
                  )
                }
                aria-label={isAr ? 'تبديل المظهر' : 'Toggle Theme'}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
              >
                {theme === 'alabaster-consumer' ? (
                  <Moon className="h-3.5 w-3.5" />
                ) : (
                  <Sun className="h-3.5 w-3.5" />
                )}
                {theme === 'alabaster-consumer'
                  ? isAr
                    ? 'الوضع الليلي'
                    : 'Obsidian Watch'
                  : isAr
                    ? 'المظهر الفاتح'
                    : 'Alabaster Consumer'}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold cursor-pointer"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
              >
                <Printer className="h-3.5 w-3.5" />
                {copy.printBtn}
              </button>
            </div>
          </div>

          {!publicSlugRoute && (
            <div className="mt-4 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <label
                  htmlFor="preset-select"
                  className="text-xs font-bold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {copy.presetLabel}
                </label>
                <select
                  data-testid="preset-select"
                  id="preset-select"
                  className="cns-input w-full min-w-0 max-w-full sm:w-auto sm:min-w-[380px]"
                  value={selectedPresetId}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                >
                  {CONSUMER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {isAr ? p.labelAr : p.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="ConsumerAE sections">
                {(
                  [
                    ['dashboard', copy.tabDashboard],
                    ['controls', copy.tabControls],
                    ['csv', copy.tabCsv],
                    ['vault', copy.tabVault],
                  ] as const
                ).map(([tabKey, label]) => {
                  const selected = activeTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      data-testid={`tab-${tabKey}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveTab(tabKey)}
                      className="rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors"
                      style={
                        selected
                          ? { backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }
                          : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        {toast && (
          <div
            role="status"
            className="no-print rounded-xl border px-4 py-2 text-xs font-bold"
            style={{
              backgroundColor: 'var(--accent-teal-soft)',
              borderColor: 'var(--accent-teal)',
              color: 'var(--accent-teal)',
            }}
          >
            {toast}
          </div>
        )}

        <main className="space-y-4">
          {publicSlugRoute ? (
            <section className="cns-card rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="no-print flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleBackToStudio}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {copy.backToWorkspace}
                </button>
                {publicReportState.data && (
                  <span
                    data-testid="public-view-count"
                    className="cns-mono rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-primary)' }}
                  >
                    {copy.viewsLabel}: {publicReportState.data.viewCount}
                  </span>
                )}
              </div>

              {publicReportState.loading ? (
                <p className="text-sm">{isAr ? 'جارٍ تحميل التقرير المختوم...' : 'Loading sealed report...'}</p>
              ) : publicReportState.error || !publicReportState.data ? (
                <div className="rounded-xl p-4 text-sm font-semibold" style={{ backgroundColor: 'var(--accent-crimson-soft)', color: 'var(--accent-crimson)' }}>
                  <ShieldAlert className="mb-1 inline-block h-4 w-4 me-1.5" />
                  {publicReportState.error || copy.missingReport}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div>
                      <div className="cns-mono text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>
                        {publicReportState.data.report.dossierCode} · {publicReportState.data.report.publicSlug}
                      </div>
                      <h2 className="text-lg font-extrabold">{publicReportState.data.report.merchantName}</h2>
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                      {STATUS_LABELS[publicReportState.data.report.status][locale]} ({publicReportState.data.report.readinessScore}/100)
                    </span>
                  </div>

                  <div dir="ltr" className="cns-mono rounded-xl p-3 text-xs" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                    SHA-256: {publicReportState.data.report.dossierSha256}
                  </div>

                  <pre
                    dir={isAr ? 'rtl' : 'ltr'}
                    className="overflow-x-auto whitespace-pre-wrap rounded-xl border p-4 text-xs leading-relaxed"
                    style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
                  >
                    {isAr ? publicReportState.data.report.briefAr : publicReportState.data.report.briefEn}
                  </pre>
                </div>
              )}
            </section>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <>
                  <ConsumerSlaAndPenaltySvg
                    locale={locale}
                    theme={theme}
                    input={input}
                    result={liveResult}
                  />
                  <ComplianceAndExposurePanel
                    locale={locale}
                    input={input}
                    result={liveResult}
                    onChange={setInput}
                  />
                </>
              )}

              {activeTab === 'controls' && (
                <ControlsAndFindingsPanel locale={locale} controls={liveResult.controls} />
              )}

              {activeTab === 'csv' && (
                <ReceiptCsvAuditPanel
                  locale={locale}
                  csvText={input.receiptCsv ?? ''}
                  sampleCsv={selectedPreset.sampleCsv}
                  onCsvChange={(next) => setInput((prev) => ({ ...prev, receiptCsv: next }))}
                  onDownload={triggerFileDownload}
                />
              )}

              {activeTab === 'vault' && (
                <DossierVaultAndPrint
                  locale={locale}
                  mode={mode}
                  input={input}
                  result={liveResult}
                  shaDigest={shaDigest}
                  dossiers={dossiers}
                  busyAction={busyAction}
                  onSaveDraft={handleSaveDraft}
                  onFinalize={handleFinalize}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onDownloadBrief={handleDownloadBrief}
                  onDownloadCsv={handleDownloadCsv}
                  onOpenPublicReport={handleOpenPublicReport}
                  onCopyText={handleCopyText}
                  onPrint={() => window.print()}
                />
              )}
            </>
          )}
        </main>

        <footer className="cns-card rounded-2xl p-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <p data-testid="legal-disclaimer-banner">{isAr ? liveResult.disclaimerAr : liveResult.disclaimerEn}</p>
          <p className="cns-mono mt-1 text-[11px]">
            ConsumerAE v{CONSUMERAE_TOOL_VERSION} · MIT · FL 15/2020, FDL 5/2023 &amp; CR 66/2023
          </p>
        </footer>
      </div>
    </div>
  );
}
