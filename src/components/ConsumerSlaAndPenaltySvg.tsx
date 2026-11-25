import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import type { Locale, ThemeName } from '../lib/i18n.ts';

interface Props {
  locale: Locale;
  theme: ThemeName;
  input: AssessmentInput;
  result: AssessmentResult;
}

export function ConsumerSlaAndPenaltySvg({ locale, theme, input, result }: Props) {
  const isAr = locale === 'ar';
  const isDark = theme === 'obsidian-watch';
  const { obligations } = result;

  const surface = isDark ? '#0E1A2D' : '#FFFFFF';
  const cardBg = isDark ? '#14233B' : '#F8FAFC';
  const border = isDark ? '#2B4263' : '#CBD5E1';
  const textMain = isDark ? '#F1F5F9' : '#0B192C';
  const textSub = isDark ? '#AFC0DA' : '#475569';
  const okColor = isDark ? '#34D399' : '#047857';
  const warnColor = isDark ? '#FBBF24' : '#B45309';
  const dangerColor = isDark ? '#FB7185' : '#BE123C';
  const primaryColor = isDark ? '#38BDF8' : '#0F294A';

  const spareBreached =
    obligations.sparePartsOrSubstituteGap &&
    input.sparePartsRequested &&
    obligations.sparePartSlaDays > 0 &&
    input.sparePartDeliveryDays > obligations.sparePartSlaDays;
  const subBreached =
    obligations.sparePartsOrSubstituteGap &&
    input.warrantyRepairDays > 7 &&
    !input.temporarySubstituteProvided;

  const slaCards = [
    {
      x: 18,
      title: isAr ? 'قطع غيار دورية (م 14)' : 'Regular Spare Parts (Art. 14)',
      limit: isAr ? '7 أيام فأقل' : '<= 7 Days',
      sub:
        input.sparePartDemandKind === 'regular_continuous'
          ? isAr
            ? `الفعلي: ${input.sparePartDeliveryDays} يوم`
            : `Actual: ${input.sparePartDeliveryDays}d`
          : isAr
            ? 'طلب مستمر'
            : 'Continuous Demand',
      tone:
        input.sparePartDemandKind === 'regular_continuous' && spareBreached
          ? dangerColor
          : okColor,
    },
    {
      x: 240,
      title: isAr ? 'قطع غير دورية (م 14)' : 'Irregular Spare Parts (Art. 14)',
      limit: isAr ? '14 يوماً فأقل' : '<= 14 Days',
      sub:
        input.sparePartDemandKind === 'irregular_demand'
          ? isAr
            ? `الفعلي: ${input.sparePartDeliveryDays} يوم`
            : `Actual: ${input.sparePartDeliveryDays}d`
          : isAr
            ? 'طلب غير منتظم'
            : 'Non-Continuous',
      tone:
        input.sparePartDemandKind === 'irregular_demand' && spareBreached
          ? warnColor
          : okColor,
    },
    {
      x: 462,
      title: isAr ? 'موازي / عيوب / خصم (م 25)' : 'Parallel / Defect / Price Diff',
      limit: isAr ? '30 يوماً فأقل' : '<= 30 Days',
      sub: isAr
        ? `عيوب: ${input.daysSinceDefectDiscovery}ي | فرق: ${obligations.recoverablePriceDifferenceAed} د.إ`
        : `Defect: ${input.daysSinceDefectDiscovery}d | Diff: AED ${obligations.recoverablePriceDifferenceAed}`,
      tone:
        obligations.defectRemedyGap ||
        obligations.postPurchaseDiscountGap ||
        (input.sparePartDemandKind === 'parallel_external_import' && spareBreached)
          ? dangerColor
          : okColor,
    },
    {
      x: 684,
      title: isAr ? 'بديل صيانة الضمان (م 27)' : 'Free Repair Substitute (Art. 27)',
      limit: isAr ? 'أكثر من 7 أيام صيانة' : '> 7 Repair Days',
      sub: isAr
        ? `صيانة ${input.warrantyRepairDays}ي · ${input.temporarySubstituteProvided ? 'بديل متاح ✓' : 'بلا بديل'}`
        : `Repair ${input.warrantyRepairDays}d · ${input.temporarySubstituteProvided ? 'Loaner ✓' : 'No Loaner'}`,
      tone: subBreached ? dangerColor : okColor,
    },
  ];

  const penaltyLadder = [
    {
      x: 18,
      code: 'compliant_no_penalty',
      head: isAr ? 'ممتثل بالكامل' : 'Compliant',
      amt: 'AED 0',
      sub: isAr ? 'سجل سليم بلا مخالفات' : 'Full FL 15/2020 & CR 66/2023',
      color: okColor,
    },
    {
      x: 240,
      code: 'administrative_fine_100k',
      head: isAr ? 'فاتورة / إفصاح عربي' : 'Arabic Invoice / Art. 40',
      amt: 'AED 100,000',
      sub: isAr ? 'غياب العربية أو بيانات التجارة' : 'Missing Arabic or Art. 40 Fields',
      color: warnColor,
    },
    {
      x: 462,
      code: 'administrative_fine_250k',
      head: isAr ? 'عيوب / قطع / المادة 34' : 'Defect / Parts / Art. 34',
      amt: 'AED 250,000',
      sub: isAr ? 'رفض الاسترداد أو شروط مجحفة' : 'Breached Remedies or Waivers',
      color: warnColor,
    },
    {
      x: 684,
      code: 'escalated_repeat_or_severe_1m_2m',
      head: isAr ? 'تصعيد التكرار والإغلاق' : 'Repeat Escalation & Closure',
      amt: 'AED 1M / 2M',
      sub: isAr ? 'إغلاق 24 ساعة–90 يوماً وإلغاء' : '24h–90d Closure & Cancellation',
      color: dangerColor,
    },
  ];

  return (
    <section className="cns-card rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {isAr
              ? 'خريطة المهل القانونية (7 / 14 / 30 يوماً) وسُلّم الجزاءات (CR 66/2023)'
              : 'UAE Statutory SLA Gates (7d / 14d / 30d) & CR 66/2023 Penalty Ladder'}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {isAr
              ? 'تتبّع فوري لمُهَل قطع الغيار والسلعة البديلة ونافذة الـ 30 يوماً وحساب السقف المالي التقديري'
              : 'Live statutory timeline for spare parts, temporary loaner substitutes, 30-day claims & admin/criminal caps'}
          </p>
        </div>
        <span
          className="cns-mono num-tabular rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: 'var(--bg-soft)',
            color: primaryColor,
          }}
        >
          {isAr
            ? `السقف التقديري: ${obligations.projectedMaximumFineAed.toLocaleString('en-US')} د.إ`
            : `Est. Max Fine: AED ${obligations.projectedMaximumFineAed.toLocaleString('en-US')}`}
        </span>
      </div>

      <svg
        viewBox="0 0 920 296"
        role="img"
        aria-label={
          isAr
            ? 'مخطط المهل القانونية لحماية المستهلك وسُلّم الجزاءات'
            : 'UAE Consumer Protection SLA and Penalty Ladder Diagram'
        }
        className="w-full h-auto"
        style={{ direction: 'ltr' }}
      >
        <rect x="2" y="2" width="916" height="292" rx="16" fill={surface} stroke={border} strokeWidth="1.5" />

        <text x="20" y="28" fill={textSub} fontSize="11.5" fontWeight="700">
          {isAr
            ? '1) مُهَل الاستجابة والالتزام الإلزامية (المواد 14 و25 و27 من قرار 66/2023)'
            : '1) STATUTORY SLA GATES (CR 66/2023 ARTICLES 14, 25 & 27)'}
        </text>

        {slaCards.map((c) => (
          <g key={c.x}>
            <rect x={c.x} y="38" width="218" height="96" rx="12" fill={cardBg} stroke={c.tone} strokeWidth="1.8" />
            <rect x={c.x} y="38" width="218" height="6" rx="3" fill={c.tone} />
            <text x={c.x + 12} y="62" fill={textSub} fontSize="11" fontWeight="600">
              {c.title}
            </text>
            <text x={c.x + 12} y="90" fill={c.tone} fontSize="17" fontWeight="800">
              {c.limit}
            </text>
            <text x={c.x + 12} y="118" fill={textMain} fontSize="11.5" fontWeight="500">
              {c.sub}
            </text>
          </g>
        ))}

        <text x="20" y="160" fill={textSub} fontSize="11.5" fontWeight="700">
          {isAr
            ? '2) سُلّم الغرامات الإدارية والجنائية والإغلاق (ملحق 2 والقانون 15/2020)'
            : '2) PENALTY ESCALATION & CLOSURE LADDER (ANNEX 2 & FL 15/2020)'}
        </text>

        {penaltyLadder.map((tier) => {
          const isActive =
            obligations.penaltyTierCode === tier.code ||
            (obligations.penaltyTierCode === 'exempt_b2b_resale' && tier.code === 'compliant_no_penalty');
          return (
            <g key={tier.code}>
              <rect
                x={tier.x}
                y="172"
                width="218"
                height="104"
                rx="12"
                fill={isActive ? (isDark ? '#1A2D4A' : '#EEF6FF') : cardBg}
                stroke={isActive ? tier.color : border}
                strokeWidth={isActive ? '2.5' : '1.4'}
              />
              <text x={tier.x + 12} y="196" fill={textMain} fontSize="11.5" fontWeight="700">
                {tier.head}
              </text>
              <text x={tier.x + 12} y="225" fill={tier.color} fontSize="17.5" fontWeight="800">
                {tier.amt}
              </text>
              <text x={tier.x + 12} y="248" fill={textSub} fontSize="10.8">
                {tier.sub}
              </text>
              {isActive && (
                <g>
                  <rect x={tier.x + 12} y="256" width="84" height="14" rx="7" fill={tier.color} />
                  <text x={tier.x + 54} y="266" fill="#FFFFFF" fontSize="9" fontWeight="800" textAnchor="middle">
                    {isAr ? 'الوضع الحالي' : 'ACTIVE TIER'}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
