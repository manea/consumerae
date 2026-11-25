import { Download, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { auditReceiptCsv, exportReceiptAuditCsv } from '../core/receiptCsvAuditor.ts';
import type { Locale } from '../lib/i18n.ts';

interface Props {
  locale: Locale;
  csvText: string;
  sampleCsv: string;
  onCsvChange: (nextCsv: string) => void;
  onDownload: (filename: string, content: string, mime: string) => void;
}

export function ReceiptCsvAuditPanel({
  locale,
  csvText,
  sampleCsv,
  onCsvChange,
  onDownload,
}: Props) {
  const isAr = locale === 'ar';
  const summary = useMemo(() => auditReceiptCsv(csvText), [csvText]);

  const handleExport = () => {
    const wire = exportReceiptAuditCsv(summary);
    onDownload('consumerae-receipts-audit.csv', wire, 'text/csv;charset=utf-8');
  };

  return (
    <section className="cns-card rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {isAr
              ? 'مدقق دفعات الفواتير والإيصالات CSV الآمن (CWE-1236 + UTF-8 BOM)'
              : 'Batch Receipt & Case CSV Auditor (CWE-1236 + UTF-8 BOM)'}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {isAr
              ? 'تدقيق جماعي لغياب الفاتورة العربية وشروط المادة 34 وتأخر قطع الغيار وتصدير آمن لـ Excel'
              : 'Audits Arabic invoice coverage, Art. 34 clauses, 7d/14d/30d spare parts SLAs & exports Excel-safe BOM CSV'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCsvChange(sampleCsv)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isAr ? 'تحميل العينة' : 'Load Sample'}
          </button>
          <button
            type="button"
            onClick={() => onCsvChange('')}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isAr ? 'مسح' : 'Clear'}
          </button>
          <button
            type="button"
            disabled={summary.totalRows === 0}
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-45"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
          >
            <Download className="h-3.5 w-3.5" />
            {isAr ? 'تصدير UTF-8 BOM CSV' : 'Export Safe BOM CSV'}
          </button>
        </div>
      </div>

      <textarea
        data-testid="receipt-csv-textarea"
        dir="ltr"
        rows={5}
        className="cns-input cns-mono text-xs"
        value={csvText}
        onChange={(e) => onCsvChange(e.target.value)}
        aria-label={isAr ? 'بيانات CSV للإيصالات' : 'Receipt audit CSV input'}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'الصفوف' : 'Rows'}
          </div>
          <div className="num-tabular text-lg font-extrabold">{summary.totalRows}</div>
        </div>
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'مخالفة' : 'Violations'}
          </div>
          <div className="num-tabular text-lg font-extrabold" style={{ color: 'var(--accent-crimson)' }}>
            {summary.violationRows}
          </div>
        </div>
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'بلا فاتورة عربية' : 'No Arabic Inv'}
          </div>
          <div className="num-tabular text-lg font-extrabold">{summary.missingArabicInvoiceRows}</div>
        </div>
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'بنود مادة 34' : 'Art. 34 Hits'}
          </div>
          <div className="num-tabular text-lg font-extrabold">{summary.art34ProhibitedClauseRows}</div>
        </div>
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'تعقيم CWE-1236' : 'CWE-1236 Guarded'}
          </div>
          <div className="num-tabular text-lg font-extrabold" style={{ color: 'var(--accent-teal)' }}>
            {summary.formulaInjectionSanitizedCount}
          </div>
        </div>
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'تعرض الدفعة' : 'Max Exposure'}
          </div>
          <div className="num-tabular text-sm font-extrabold" style={{ color: 'var(--accent-crimson)' }}>
            AED {summary.totalEstimatedExposureMaxAed.toLocaleString('en-US')}
          </div>
        </div>
      </div>

      {summary.rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                <th className="p-2.5 text-start">{isAr ? 'المرجع' : 'Case ID'}</th>
                <th className="p-2.5 text-start">{isAr ? 'التاجر / الصنف' : 'Merchant / Item'}</th>
                <th className="p-2.5 text-start">{isAr ? 'عربي' : 'Arabic'}</th>
                <th className="p-2.5 text-start">{isAr ? 'مادة 34 / قطع' : 'Art. 34 / Parts'}</th>
                <th className="p-2.5 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="p-2.5 text-end">{isAr ? 'التعرض الأقصى' : 'Max Fine'}</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => {
                const statusColor =
                  row.status === 'compliant'
                    ? 'var(--accent-emerald)'
                    : row.status === 'attention'
                      ? 'var(--accent-amber)'
                      : 'var(--accent-crimson)';
                return (
                  <tr key={row.rowNumber} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td dir="ltr" className="cns-mono p-2.5 font-semibold">
                      {row.caseId}
                    </td>
                    <td dir="auto" className="p-2.5">
                      {row.merchantOrItemEn}
                    </td>
                    <td className="p-2.5">{row.arabicInvoiceIssued ? '✓' : '✗'}</td>
                    <td className="cns-mono p-2.5 text-[11px]">
                      {row.art34MatchedClauses.length > 0
                        ? row.art34MatchedClauses.join(', ')
                        : `${row.sparePartDays}d / ${row.sparePartSlaDays}d`}
                    </td>
                    <td className="p-2.5 font-bold uppercase" style={{ color: statusColor }}>
                      {row.status}
                    </td>
                    <td dir="ltr" className="num-tabular p-2.5 text-end font-semibold">
                      AED {row.estimatedExposureMaxAed.toLocaleString('en-US')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
