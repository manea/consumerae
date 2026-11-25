import { CheckCircle2, XCircle } from 'lucide-react';
import type { FindingItem } from '../core/types.ts';
import type { Locale } from '../lib/i18n.ts';

interface Props {
  locale: Locale;
  controls: FindingItem[];
}

export function ControlsAndFindingsPanel({ locale, controls }: Props) {
  const isAr = locale === 'ar';

  return (
    <section className="cns-card rounded-2xl p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {isAr
            ? 'مصفوفة الضوابط السباعية (FL 15/2020 & CR 66/2023)'
            : 'Seven-Control UAE Consumer Protection Matrix (FL 15/2020 & CR 66/2023)'}
        </h2>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {isAr
            ? 'تقييم تفصيلي لكل ضابط قانوني مع المرجع النظامي وإجراء التصحيح المطلوب'
            : 'Control-by-control assessment covering Arabic invoicing, Art. 34 waivers, 30d/7d/14d SLAs, Art. 40, and 100 TRN'}
        </p>
      </div>

      <div className="space-y-3">
        {controls.map((item) => {
          const passTone = item.passed
            ? { bg: 'var(--accent-emerald-soft)', fg: 'var(--accent-emerald)' }
            : { bg: 'var(--accent-crimson-soft)', fg: 'var(--accent-crimson)' };

          return (
            <div
              key={item.controlId}
              className="rounded-xl border p-3.5"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.passed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-emerald)' }} />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-crimson)' }} />
                  )}
                  <span className="cns-mono text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>
                    {item.controlId}
                  </span>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {isAr ? item.titleAr : item.titleEn}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="cns-mono rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase"
                    style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--text-secondary)' }}
                  >
                    {item.severity}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ backgroundColor: passTone.bg, color: passTone.fg }}
                  >
                    {item.passed ? (isAr ? 'ممتثل ✓' : 'PASS ✓') : isAr ? 'فجوة ✗' : 'GAP ✗'}
                  </span>
                </div>
              </div>

              <div className="cns-mono mt-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {item.legalRef}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {isAr ? item.detailAr : item.detailEn}
              </p>
              <div
                className="mt-2 rounded-lg px-2.5 py-1.5 text-xs"
                style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>
                  {isAr ? 'إجراء التصحيح: ' : 'Remediation: '}
                </strong>
                {isAr ? item.remediationAr : item.remediationEn}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
