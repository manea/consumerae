import {
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  Lock,
  Printer,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { buildConsumerBriefMarkdown } from '../core/briefBuilder.ts';
import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import type { ApiMode, ConsumerDossierRecord } from '../lib/api.ts';
import { STATUS_LABELS, type Locale } from '../lib/i18n.ts';

interface Props {
  locale: Locale;
  mode: ApiMode;
  input: AssessmentInput;
  result: AssessmentResult;
  shaDigest: string;
  dossiers: ConsumerDossierRecord[];
  busyAction: string | null;
  onSaveDraft: (title: string) => Promise<void>;
  onFinalize: (dossierCode: string) => Promise<void>;
  onDuplicate: (dossierCode: string) => Promise<void>;
  onDelete: (dossierCode: string) => Promise<void>;
  onDownloadBrief: (record: ConsumerDossierRecord) => Promise<void>;
  onDownloadCsv: (record: ConsumerDossierRecord) => Promise<void>;
  onOpenPublicReport: (slugOrCode: string) => void;
  onCopyText: (label: string, text: string) => Promise<void>;
  onPrint: () => void;
}

export function DossierVaultAndPrint({
  locale,
  mode,
  input,
  result,
  shaDigest,
  dossiers,
  busyAction,
  onSaveDraft,
  onFinalize,
  onDuplicate,
  onDelete,
  onDownloadBrief,
  onDownloadCsv,
  onOpenPublicReport,
  onCopyText,
  onPrint,
}: Props) {
  const isAr = locale === 'ar';
  const [draftTitle, setDraftTitle] = useState('');

  const previewMarkdown = buildConsumerBriefMarkdown(
    input,
    result,
    'DRAFT-PREVIEW',
    shaDigest,
    locale,
  );

  const handleSave = async () => {
    await onSaveDraft(draftTitle);
    setDraftTitle('');
  };

  return (
    <div className="space-y-4">
      <section className="cns-card rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              {isAr
                ? 'خزنة الملفات والتثبيت ببصمة SHA-256 (CNS-YYYY-0001)'
                : 'Immutable ConsumerAE Dossier Vault & SHA-256 Sealing (CNS-YYYY-0001)'}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {isAr
                ? `الوضع النشط: ${mode === 'server' ? 'SQLite WAL (حفظ وتقارير عامة)' : 'تخزين محلي $0'} · بصمة التقييم الحالي:`
                : `Active Mode: ${mode === 'server' ? 'SQLite WAL Server' : '$0 Browser LocalStorage'} · Live SHA-256:`}
            </p>
          </div>
          <span
            dir="ltr"
            className="cns-mono rounded-lg px-2.5 py-1 text-[11px] font-semibold"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-primary)' }}
          >
            {shaDigest ? `${shaDigest.slice(0, 16)}…` : 'COMPUTING…'}
          </span>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <input
            dir="auto"
            className="cns-input flex-1"
            value={draftTitle}
            placeholder={
              isAr
                ? 'عنوان الملف الاختياري (مثال: تدقيق حماية المستهلك الربع الرابع — دبي)'
                : 'Optional dossier title (e.g., Dubai Retail Consumer Protection Audit Q4)'
            }
            onChange={(e) => setDraftTitle(e.target.value)}
          />
          <button
            data-testid="save-dossier-btn"
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => void handleSave()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
          >
            <FilePlus2 className="h-4 w-4" />
            {isAr ? 'حفظ مسودة ملف' : 'Save Dossier Draft'}
          </button>
          <button
            type="button"
            onClick={() => void onCopyText(isAr ? 'مذكرة الامتثال' : 'Brief MD', previewMarkdown)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold cursor-pointer"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
          >
            <Copy className="h-3.5 w-3.5" />
            {isAr ? 'نسخ الملخص (MD)' : 'Copy Brief MD'}
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold cursor-pointer"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
          >
            <Printer className="h-3.5 w-3.5" />
            {isAr ? 'طباعة' : 'Print'}
          </button>
        </div>
      </section>

      <section className="cns-card rounded-2xl p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {isAr ? `سجل الملفات المحفوظة (${dossiers.length})` : `Saved Audit Dossiers (${dossiers.length})`}
        </h3>

        {dossiers.length === 0 ? (
          <p className="rounded-xl p-4 text-xs" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            {isAr
              ? 'لا توجد ملفات محفوظة بعد. اضغط «حفظ مسودة ملف» لإنشاء CNS-2026-0001 ثم «ختم وتثبيت» لإصدار الرابط العام /r/...'
              : 'No dossiers stored yet. Click "Save Dossier Draft" to allocate CNS-2026-0001 and seal an immutable /r/... report.'}
          </p>
        ) : (
          <div className="space-y-3">
            {dossiers.map((item) => {
              const isLocked = Boolean(item.lockedAt);
              return (
                <div
                  key={item.dossierCode}
                  className="rounded-xl border p-3.5 space-y-2.5"
                  style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cns-mono rounded px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--accent-primary)' }}>
                        {item.dossierCode}
                      </span>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          backgroundColor:
                            item.status === 'ready'
                              ? 'var(--accent-emerald-soft)'
                              : item.status === 'conditional'
                                ? 'var(--accent-amber-soft)'
                                : 'var(--accent-crimson-soft)',
                          color:
                            item.status === 'ready'
                              ? 'var(--accent-emerald)'
                              : item.status === 'conditional'
                                ? 'var(--accent-amber)'
                                : 'var(--accent-crimson)',
                        }}
                      >
                        {STATUS_LABELS[item.status][locale]} ({item.readinessScore}/100)
                      </span>
                      {isLocked && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={{ backgroundColor: 'var(--accent-teal-soft)', color: 'var(--accent-teal)' }}
                        >
                          <Lock className="h-3 w-3" />
                          {isAr ? 'مختوم غير قابل للتعديل' : 'Sealed'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {!isLocked && (
                        <button
                          data-testid={`finalize-dossier-${item.dossierCode}`}
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() => void onFinalize(item.dossierCode)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer"
                          style={{ backgroundColor: 'var(--accent-teal)', color: '#FFFFFF' }}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {isAr ? 'ختم وتثبيت' : 'Finalize Seal'}
                        </button>
                      )}
                      {isLocked && (
                        <button
                          data-testid={`open-public-${item.dossierCode}`}
                          type="button"
                          onClick={() => onOpenPublicReport(item.dossierCode)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer"
                          style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {isAr ? `التقرير العام /r/${item.dossierCode}` : `View /r/${item.dossierCode}`}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() => void onDownloadBrief(item)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer"
                        style={{ borderColor: 'var(--border-strong)' }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        brief.md
                      </button>
                      <button
                        data-testid={`export-csv-${item.dossierCode}`}
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() => void onDownloadCsv(item)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer"
                        style={{ borderColor: 'var(--border-strong)' }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        export.csv
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() => void onDuplicate(item.dossierCode)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer"
                        style={{ borderColor: 'var(--border-strong)' }}
                      >
                        {isAr ? 'نسخ' : 'Duplicate'}
                      </button>
                      {!isLocked && (
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() => void onDelete(item.dossierCode)}
                          aria-label={`Delete ${item.dossierCode}`}
                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold cursor-pointer"
                          style={{ borderColor: 'var(--accent-crimson)', color: 'var(--accent-crimson)' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {item.dossierSha256 && (
                    <div dir="ltr" className="cns-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      SHA-256: {item.dossierSha256} {item.publicSlug ? `| /r/${item.publicSlug}` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
