import { validateUaeTrn } from '../core/consumerEngine.ts';
import type {
  AssessmentInput,
  AssessmentResult,
  MerchantChannel,
  SparePartDemandKind,
} from '../core/types.ts';
import {
  CHANNEL_LABELS,
  PENALTY_TIER_LABELS,
  SPARE_PART_LABELS,
  STATUS_LABELS,
  type Locale,
} from '../lib/i18n.ts';

interface Props {
  locale: Locale;
  input: AssessmentInput;
  result: AssessmentResult;
  onChange: (updater: (prev: AssessmentInput) => AssessmentInput) => void;
}

export function ComplianceAndExposurePanel({ locale, input, result, onChange }: Props) {
  const isAr = locale === 'ar';
  const { obligations } = result;
  const trnValue = (input.tradeTrn || '').trim();
  const trnValid = trnValue.length > 0 ? validateUaeTrn(trnValue) : null;

  const setField = <K extends keyof AssessmentInput>(key: K, value: AssessmentInput[K]) => {
    onChange((prev) => ({ ...prev, [key]: value }));
  };

  const statusTone =
    result.readinessStatus === 'ready'
      ? { bg: 'var(--accent-emerald-soft)', color: 'var(--accent-emerald)' }
      : result.readinessStatus === 'conditional'
        ? { bg: 'var(--accent-amber-soft)', color: 'var(--accent-amber)' }
        : { bg: 'var(--accent-crimson-soft)', color: 'var(--accent-crimson)' };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div data-testid="status-badge" className="cns-card rounded-xl p-3.5">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'حالة الجاهزية والدرجة' : 'Readiness Score & Status'}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="num-tabular text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              {result.readinessScore}/100
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{ backgroundColor: statusTone.bg, color: statusTone.color }}
            >
              {STATUS_LABELS[result.readinessStatus][locale]}
            </span>
          </div>
        </div>

        <div className="cns-card rounded-xl p-3.5">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'الفاتورة العربية والمادة 34' : 'Arabic Invoice & Art. 34 Scan'}
          </div>
          <div className="mt-1.5 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {obligations.arabicInvoiceGap || obligations.prohibitedClauseGap
              ? isAr
                ? 'تم رصد فجوات حرجة ✗'
                : 'Critical Gaps Flagged ✗'
              : isAr
                ? 'سليم ومتوافق ✓'
                : 'Compliant ✓'}
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {isAr
              ? `عبارات مادة 34 المكتشفة: ${obligations.art34Scan.matchedClauses.length}`
              : `Art. 34 Matched Phrases: ${obligations.art34Scan.matchedClauses.length}`}
          </div>
        </div>

        <div className="cns-card rounded-xl p-3.5">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'قطع الغيار وفرق السعر (30ي)' : 'Spare Parts SLA & 30d Price Diff'}
          </div>
          <div className="num-tabular mt-1.5 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {isAr
              ? `سقف ${obligations.sparePartSlaDays} ي · فرق ${obligations.recoverablePriceDifferenceAed.toLocaleString('en-US')} د.إ`
              : `${obligations.sparePartSlaDays}d SLA · AED ${obligations.recoverablePriceDifferenceAed.toLocaleString('en-US')}`}
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {obligations.sparePartsOrSubstituteGap || obligations.postPurchaseDiscountGap
              ? isAr
                ? 'مخالفة مهلة قطع أو بديل/خصم'
                : 'Spare-part / loaner / discount gap'
              : isAr
                ? 'المهل مستوفاة ✓'
                : 'Within statutory SLA ✓'}
          </div>
        </div>

        <div data-testid="metric-fine-exposure" className="cns-card rounded-xl p-3.5">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'التعرض للغرامات والإغلاق' : 'Fine Exposure & Closure Risk'}
          </div>
          <div
            className="num-tabular mt-1.5 text-sm font-extrabold"
            style={{
              color:
                obligations.projectedMaximumFineAed > 0
                  ? 'var(--accent-crimson)'
                  : 'var(--accent-emerald)',
            }}
          >
            {isAr
              ? `حتى ${obligations.projectedMaximumFineAed.toLocaleString('en-US')} د.إ`
              : `Up to AED ${obligations.projectedMaximumFineAed.toLocaleString('en-US')}`}
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {obligations.temporaryClosureRisk
              ? isAr
                ? `إغلاق 24 ساعة–90 يوماً${obligations.licenseRevocationRisk ? ' + إلغاء رخصة' : ''}`
                : `Closure 24h–90d${obligations.licenseRevocationRisk ? ' + Revocation' : ''}`
              : PENALTY_TIER_LABELS[obligations.penaltyTierCode][locale]}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="cns-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {isAr ? '1. هوية التاجر والقناة والرقم الضريبي (TRN 100)' : '1. Merchant Profile, Channel & 100 TRN'}
          </h3>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {isAr ? 'اسم المنشأة / التاجر' : 'Merchant / Legal Entity Name'}
            </label>
            <input
              dir="auto"
              className="cns-input"
              value={input.merchantName}
              onChange={(e) => setField('merchantName', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <span>{isAr ? 'الرقم الضريبي الإماراتي (اختياري)' : 'UAE TRN (100 prefix, optional)'}</span>
                {trnValid !== null && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                    style={{
                      backgroundColor: trnValid ? 'var(--accent-emerald-soft)' : 'var(--accent-crimson-soft)',
                      color: trnValid ? 'var(--accent-emerald)' : 'var(--accent-crimson)',
                    }}
                  >
                    {trnValid ? (isAr ? '100 ✓' : 'Valid ✓') : isAr ? 'صيغة خطأ ✗' : 'Invalid ✗'}
                  </span>
                )}
              </label>
              <input
                data-testid="trn-input"
                dir="ltr"
                className="cns-input cns-mono"
                value={input.tradeTrn ?? ''}
                placeholder="100452819300003"
                onChange={(e) => setField('tradeTrn', e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {isAr ? 'تكرار المخالفات السابقة' : 'Prior Offense Count'}
              </label>
              <input
                data-testid="prior-offense-input"
                dir="ltr"
                type="number"
                min={0}
                max={20}
                className="cns-input num-tabular"
                value={input.priorOffenseCount}
                onChange={(e) => setField('priorOffenseCount', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {isAr ? 'قناة البيع والنطاق التنظيمي' : 'Sales Channel & Scope'}
            </label>
            <select
              className="cns-input"
              value={input.channel}
              onChange={(e) => setField('channel', e.target.value as MerchantChannel)}
            >
              {(Object.keys(CHANNEL_LABELS) as MerchantChannel[]).map((ch) => (
                <option key={ch} value={ch}>
                  {CHANNEL_LABELS[ch][locale]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                type="checkbox"
                checked={input.sellsOnline}
                onChange={(e) => setField('sellsOnline', e.target.checked)}
              />
              <span>{isAr ? 'يبيع عبر متجر أو تطبيق رقمي (م 40)' : 'Sells Online / E-Commerce (Art. 40)'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                type="checkbox"
                checked={input.isCorporateEndUserSale}
                onChange={(e) => setField('isCorporateEndUserSale', e.target.checked)}
              />
              <span>{isAr ? 'مشتري اعتباري للاستهلاك النهائي' : 'Corporate End-User Purchase'}</span>
            </label>
          </div>
        </div>

        <div className="cns-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {isAr
              ? '2. الفاتورة العربية (100k د.إ) وكاشف المادة 34'
              : '2. Arabic Invoice (AED 100k) & Art. 34 Waiver Scanner'}
          </h3>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                data-testid="toggle-hasArabicInvoice"
                type="checkbox"
                checked={input.hasArabicInvoice}
                onChange={(e) => setField('hasArabicInvoice', e.target.checked)}
              />
              <span>{isAr ? 'إصدار فاتورة باللغة العربية' : 'Issued Arabic Purchase Invoice'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                data-testid="toggle-invoiceIncludesCoreFields"
                type="checkbox"
                checked={input.invoiceIncludesCoreFields}
                onChange={(e) => setField('invoiceIncludesCoreFields', e.target.checked)}
              />
              <span>{isAr ? 'اكتمال الحقول (السعر AED، الضمان، التاريخ)' : 'Core Fields Complete (AED, Warranty, Date)'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                data-testid="toggle-hasProhibitedWaiverClause"
                type="checkbox"
                checked={input.hasProhibitedWaiverClause}
                onChange={(e) => setField('hasProhibitedWaiverClause', e.target.checked)}
              />
              <span>{isAr ? 'وجود شرط مسبق برفض الاسترجاع' : 'Manual Blanket No-Refund Flag'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                type="checkbox"
                checked={input.statutoryExemptionCategory}
                onChange={(e) => setField('statutoryExemptionCategory', e.target.checked)}
              />
              <span>{isAr ? 'سلعة تفصيل/سريعة التلف (استثناء ضيق)' : 'Custom / Perishable Statutory Exception'}</span>
            </label>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {isAr
                ? 'نص شروط الفاتورة / الإيصال (فحص فوري لنصوص المادة 34 بالعربية والإنجليزية)'
                : 'Receipt / Terms Text (Live Bilingual Art. 34 Scanner)'}
            </label>
            <textarea
              data-testid="receipt-terms-textarea"
              dir="auto"
              rows={2}
              className="cns-input"
              value={input.receiptTermsText ?? ''}
              onChange={(e) => setField('receiptTermsText', e.target.value)}
            />
            {obligations.art34Scan.matchedClauses.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {obligations.art34Scan.matchedClauses.map((clause) => (
                  <span
                    key={clause}
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{
                      backgroundColor: 'var(--accent-crimson-soft)',
                      color: 'var(--accent-crimson)',
                    }}
                  >
                    Art. 34: {clause}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="cns-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {isAr
              ? '3. معالجة العيوب (م 25 و27) وخصم ما بعد الشراء (7 / 30 يوماً)'
              : '3. Defect Remedies (Arts. 25 & 27) & 7d/30d Post-Purchase Discount'}
          </h3>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                type="checkbox"
                checked={input.hasActiveDefectClaim}
                onChange={(e) => setField('hasActiveDefectClaim', e.target.checked)}
              />
              <span>{isAr ? 'وجود مطالبة عيب قائمة' : 'Active Defect Claim Present'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                data-testid="toggle-defectRemedyHonored"
                type="checkbox"
                checked={input.defectRemedyHonored}
                onChange={(e) => setField('defectRemedyHonored', e.target.checked)}
              />
              <span>{isAr ? 'تم الوفاء بالإصلاح/الاستبدال/الرد' : 'Remedy Honored (Repair/Replace/Refund)'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                type="checkbox"
                checked={input.lacksOrConflictingWarranty}
                onChange={(e) => setField('lacksOrConflictingWarranty', e.target.checked)}
              />
              <span>{isAr ? 'غياب الضمان أو تعارضه (30 يوماً م 25)' : 'Missing / Conflicting Warranty (30d Art. 25)'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                type="checkbox"
                checked={input.supplierCausedDefect}
                onChange={(e) => setField('supplierCausedDefect', e.target.checked)}
              />
              <span>{isAr ? 'العيب عائد للمزوّد / التصنيع' : 'Supplier-Attributable Defect (Art. 27)'}</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {isAr ? 'أيام اكتشاف العيب' : 'Defect Age (d)'}
              </label>
              <input
                dir="ltr"
                type="number"
                min={0}
                className="cns-input num-tabular"
                value={input.daysSinceDefectDiscovery}
                onChange={(e) => setField('daysSinceDefectDiscovery', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {isAr ? 'مرات تكرار العيب' : 'Repeat Failures'}
              </label>
              <input
                dir="ltr"
                type="number"
                min={0}
                className="cns-input num-tabular"
                value={input.repeatDefectCount}
                onChange={(e) => setField('repeatDefectCount', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {isAr ? 'السعر الأصلي (د.إ)' : 'Orig Price (AED)'}
              </label>
              <input
                dir="ltr"
                type="number"
                min={0}
                className="cns-input num-tabular"
                value={input.originalPriceAed}
                onChange={(e) => setField('originalPriceAed', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {isAr ? 'السعر بعد الخصم' : 'Discounted AED'}
              </label>
              <input
                dir="ltr"
                type="number"
                min={0}
                className="cns-input num-tabular"
                value={input.discountedPriceAed}
                onChange={(e) => setField('discountedPriceAed', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs items-center">
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                type="checkbox"
                checked={input.discountAnnouncedWithin7Days}
                onChange={(e) => setField('discountAnnouncedWithin7Days', e.target.checked)}
              />
              <span>{isAr ? 'تخفيض خلال 7 أيام' : '7-Day Price Drop'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                data-testid="toggle-priceDifferenceRefunded"
                type="checkbox"
                checked={input.priceDifferenceRefunded}
                onChange={(e) => setField('priceDifferenceRefunded', e.target.checked)}
              />
              <span>{isAr ? 'تم رد فرق السعر' : 'Price Diff Refunded'}</span>
            </label>
            <div>
              <input
                dir="ltr"
                type="number"
                min={0}
                className="cns-input num-tabular"
                aria-label={isAr ? 'أيام المطالبة من الشراء' : 'Days since purchase for discount'}
                value={input.daysSincePurchaseForDiscount}
                onChange={(e) =>
                  setField('daysSincePurchaseForDiscount', Math.max(0, Number(e.target.value) || 0))
                }
              />
            </div>
          </div>
        </div>

        <div className="cns-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {isAr
              ? '4. قطع الغيار (م 14) والبديل المؤقت وإفصاحات التجارة (م 40)'
              : '4. Spare Parts (Art. 14), Loaner > 7d, Art. 40 E-Commerce & Grievances'}
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {isAr ? 'نوع طلب قطعة الغيار' : 'Spare Part Demand Kind'}
              </label>
              <select
                className="cns-input"
                value={input.sparePartDemandKind}
                onChange={(e) => setField('sparePartDemandKind', e.target.value as SparePartDemandKind)}
              >
                {(Object.keys(SPARE_PART_LABELS) as SparePartDemandKind[]).map((k) => (
                  <option key={k} value={k}>
                    {SPARE_PART_LABELS[k][locale]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {isAr ? 'أيام تسليم القطعة' : 'Parts Delivery (d)'}
              </label>
              <input
                data-testid="spare-part-days-input"
                dir="ltr"
                type="number"
                min={0}
                className="cns-input num-tabular"
                value={input.sparePartDeliveryDays}
                onChange={(e) => setField('sparePartDeliveryDays', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {isAr ? 'أيام إصلاح الضمان' : 'Repair Days'}
              </label>
              <input
                dir="ltr"
                type="number"
                min={0}
                className="cns-input num-tabular"
                value={input.warrantyRepairDays}
                onChange={(e) => setField('warrantyRepairDays', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                type="checkbox"
                checked={input.sparePartsRequested}
                onChange={(e) => setField('sparePartsRequested', e.target.checked)}
              />
              <span>{isAr ? 'طلب قطع غيار نشط' : 'Spare Parts Requested'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                data-testid="toggle-temporarySubstituteProvided"
                type="checkbox"
                checked={input.temporarySubstituteProvided}
                onChange={(e) => setField('temporarySubstituteProvided', e.target.checked)}
              />
              <span>{isAr ? 'توفير سلعة بديلة مجانية (>7 ي)' : 'Free Temporary Substitute Provided'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                data-testid="toggle-ecommerceArabicDisclosuresComplete"
                type="checkbox"
                checked={input.ecommerceArabicDisclosuresComplete}
                onChange={(e) => setField('ecommerceArabicDisclosuresComplete', e.target.checked)}
              />
              <span>{isAr ? 'اكتمال بيانات المادة 40 بالعربية' : 'Art. 40 Arabic Disclosures Complete'}</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                data-testid="toggle-complaintAndGrievanceWorkflowReady"
                type="checkbox"
                checked={input.complaintAndGrievanceWorkflowReady}
                onChange={(e) => setField('complaintAndGrievanceWorkflowReady', e.target.checked)}
              />
              <span>{isAr ? 'جاهزية مسار الشكاوى (15 يوم عمل)' : '15-Working-Day Grievance Workflow'}</span>
            </label>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {isAr ? 'ملاحظات المراجعة الداخلية' : 'Internal Review Notes'}
            </label>
            <input
              dir="auto"
              className="cns-input"
              value={input.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
