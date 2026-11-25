import type { AssessmentInput, AssessmentResult, MerchantChannel } from './types.ts';

function escMdCell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatNum(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
}

const CHANNEL_LABELS: Record<MerchantChannel, { ar: string; en: string }> = {
  uae_retail_storefront: {
    ar: 'متجر تجزئة في البر الرئيسي بالإمارات (DET / ADDED / DED)',
    en: 'UAE Mainland Retail Storefront (DET / ADDED / DED)',
  },
  uae_ecommerce_platform: {
    ar: 'متجر أو منصة تجارة إلكترونية في الإمارات (المادة 40)',
    en: 'UAE E-Commerce Storefront / Marketplace Platform (Art. 40)',
  },
  uae_commercial_agent_service: {
    ar: 'وكيل تجاري محلي / مركز صيانة معتمد (المادة 14 و27)',
    en: 'Local Commercial Agent / Authorized Service Center (Arts. 14 & 27)',
  },
  uae_freezone_b2c_supplier: {
    ar: 'مزوّد منطقة حرة يبيع للمستهلكين داخل الإمارات',
    en: 'UAE Free-Zone B2C Supplier Selling to UAE Consumers',
  },
  b2b_wholesale_resale_exempt: {
    ar: 'معاملة جملة تجارية صرفة لإعادة البيع (مستثناة)',
    en: 'Pure B2B Wholesale-for-Resale Transaction (Exempt)',
  },
};

export function buildConsumerBriefMarkdown(
  input: AssessmentInput,
  result: AssessmentResult,
  dossierCode: string,
  sha256Digest = '',
  locale: 'en' | 'ar' = 'ar',
): string {
  const digest = sha256Digest || result.dossierSha256 || '';
  const channelLbl = CHANNEL_LABELS[input.channel] ?? {
    ar: input.channel,
    en: input.channel,
  };
  const { obligations, csvAudit } = result;
  const art34Clauses = obligations.art34Scan.matchedClauses.length
    ? obligations.art34Scan.matchedClauses.join('، ')
    : locale === 'ar'
      ? 'لا توجد'
      : 'None';

  if (locale === 'ar') {
    const lines: string[] = [
      `# ملف جاهزية حماية المستهلك الإماراتي (FL 15/2020, FDL 5/2023 & CR 66/2023) — \`${escMdCell(dossierCode)}\``,
      '',
      `> **تنويه الاستقلالية:** ${result.disclaimerAr}`,
      '',
      '## 1. هوية المنشأة ونطاق القانون والتزامات المهل والجزاءات',
      '',
      '| البند | القيمة |',
      '|---|---|',
      `| رمز الملف | \`${escMdCell(dossierCode)}\` |`,
      `| الأداة والإصدار | \`ConsumerAE v${escMdCell(result.toolVersion)}\` |`,
      `| التاجر / المزوّد | ${escMdCell(input.merchantName)} |`,
      `| الرقم الضريبي (\`100 TRN\`) | \`${escMdCell(input.tradeTrn || 'N/A')}\` (${obligations.tradeTrnValid === null ? 'اختياري غير مرفق' : obligations.tradeTrnValid ? 'صالح ✓' : 'غير صالح ✗'}) |`,
      `| قناة البيع | ${channelLbl.ar} |`,
      `| شمول المشتري المؤسسي النهائي | ${obligations.corporateEndUserProtected ? 'مشمول بالحماية (استهلاك نهائي)' : obligations.isSubjectToConsumerLaw ? 'خاضع (بيع للمستهلك)' : 'مستثنى (جملة لإعادة البيع)'} |`,
      `| كشف شروط المادة \`34\` | ${escMdCell(art34Clauses)} |`,
      `| مهلة قطع الغيار (\`م 14\`) والبديل المؤقت | سقف قطع الغيار \`${obligations.sparePartSlaDays} يوماً\` (الفعلي \`${input.sparePartDeliveryDays}\` ي) \| صيانة \`${input.warrantyRepairDays}\` ي (>7 ي: ${input.temporarySubstituteProvided ? 'بديل متاح ✓' : 'غير متاح'}) |`,
      `| فرق السعر المسترد (\`7/30 يوماً\`) | \`${formatNum(obligations.recoverablePriceDifferenceAed)} د.إ\` |`,
      `| مرحلة الجزاءات (\`CR 66/2023\`) | \`${obligations.penaltyTierCode}\` |`,
      `| التقدير الإداري / السقف الجنائي | \`${formatNum(obligations.projectedMinimumFineAed)}–${formatNum(obligations.projectedMaximumFineAed)} د.إ\` (سقف جنائي \`${formatNum(obligations.statutoryCriminalCapAed)} د.إ\`) |`,
      `| الإغلاق المؤقت وإلغاء الرخصة | إغلاق \`24 ساعة – 90 يوماً\`: **${obligations.temporaryClosureRisk ? 'قائم' : 'لا'}** \| إلغاء الرخصة: **${obligations.licenseRevocationRisk ? 'قائم' : 'لا'}** |`,
      `| حالة الجاهزية والدرجة | **${result.readinessStatus.toUpperCase()}** (**${result.readinessScore}/100**) |`,
      `| بصمة التثبيت \`SHA-256\` | \`${escMdCell(digest || 'PENDING')}\` |`,
      '',
      '## 2. مصفوفة الضوابط السباعية (FL 15/2020 & CR 66/2023)',
      '',
      '| الضابط | الحالة | المرجع القانوني | التفاصيل وإجراء المعالجة |',
      '|---|---|---|---|',
    ];

    for (const c of result.controls) {
      const badge = c.passed ? 'ممتثل ✓' : `فجوة (${c.severity.toUpperCase()}) ✗`;
      lines.push(
        `| \`${escMdCell(c.controlId)}\` — ${escMdCell(c.titleAr)} | ${badge} | ${escMdCell(c.legalRef)} | ${escMdCell(c.detailAr)} **الإجراء:** ${escMdCell(c.remediationAr)} |`,
      );
    }

    if (csvAudit) {
      lines.push(
        '',
        '## 3. ملخص تدقيق دفعة الفواتير والإيصالات (CSV CWE-1236)',
        '',
        `- إجمالي الصفوف المفحوصة: **${csvAudit.totalRows}** (ممتثل: **${csvAudit.compliantRows}** · تنبيه: **${csvAudit.attentionRows}** · مخالفة: **${csvAudit.violationRows}**)`,
        `- فواتير بلا نص عربي: **${csvAudit.missingArabicInvoiceRows}** · بنود مخالفة للمادة \`34\`: **${csvAudit.art34ProhibitedClauseRows}** · إخلال قطع الغيار/البديل: **${csvAudit.sparePartOrSubstituteBreachRows}**`,
        `- التعرض الإجمالي الأقصى المقدر بالدفعة: **${formatNum(csvAudit.totalEstimatedExposureMaxAed)} د.إ** · الحقول المعقمة \`CWE-1236\`: **${csvAudit.formulaInjectionSanitizedCount}**`,
      );
    }

    return lines.join('\n') + '\n';
  }

  const lines: string[] = [
    `# UAE Consumer Protection Readiness Brief (FL 15/2020, FDL 5/2023 & CR 66/2023) — \`${escMdCell(dossierCode)}\``,
    '',
    `> **Independence Notice:** ${result.disclaimerEn}`,
    '',
    '## 1. Merchant Profile, Statutory SLAs & Penalty Exposure',
    '',
    '| Field | Value |',
    '|---|---|',
    `| Dossier Code | \`${escMdCell(dossierCode)}\` |`,
    `| Engine & Version | \`ConsumerAE v${escMdCell(result.toolVersion)}\` |`,
    `| Merchant / Supplier | ${escMdCell(input.merchantName)} |`,
    `| UAE TRN (\`100\`) | \`${escMdCell(input.tradeTrn || 'N/A')}\` (${obligations.tradeTrnValid === null ? 'Not Provided' : obligations.tradeTrnValid ? 'Valid ✓' : 'Invalid ✗'}) |`,
    `| Sales Channel | ${channelLbl.en} |`,
    `| Scope & Corporate End-User | ${obligations.corporateEndUserProtected ? 'Protected (Corporate End-User)' : obligations.isSubjectToConsumerLaw ? 'In Scope (UAE Consumer Law)' : 'Exempt (Pure B2B Resale)'} |`,
    `| Art. 34 Scan Clauses | ${escMdCell(art34Clauses)} |`,
    `| Spare Parts (\`Art. 14\`) & Loaner | SLA \`${obligations.sparePartSlaDays}d\` (Actual \`${input.sparePartDeliveryDays}d\`) \| Repair \`${input.warrantyRepairDays}d\` (>7d Loaner: ${input.temporarySubstituteProvided ? 'Yes' : 'No'}) |`,
    `| Recoverable Price Diff (\`7d/30d\`) | \`AED ${formatNum(obligations.recoverablePriceDifferenceAed)}\` |`,
    `| Penalty Tier (\`CR 66/2023\`) | \`${obligations.penaltyTierCode}\` |`,
    `| Admin Exposure / Criminal Cap | \`AED ${formatNum(obligations.projectedMinimumFineAed)}–${formatNum(obligations.projectedMaximumFineAed)}\` (Criminal Cap \`AED ${formatNum(obligations.statutoryCriminalCapAed)}\`) |`,
    `| Closure & Licence Revocation Risk | Closure \`24h–90d\`: **${obligations.temporaryClosureRisk ? 'Yes' : 'No'}** \| Revocation: **${obligations.licenseRevocationRisk ? 'Yes' : 'No'}** |`,
    `| Readiness Status & Score | **${result.readinessStatus.toUpperCase()}** (**${result.readinessScore}/100**) |`,
    `| Canonical \`SHA-256\` Digest | \`${escMdCell(digest || 'PENDING')}\` |`,
    '',
    '## 2. Seven-Control Matrix (FL 15/2020 & CR 66/2023)',
    '',
    '| Control | Status | Legal Basis | Finding & Remediation |',
    '|---|---|---|---|',
  ];

  for (const c of result.controls) {
    const badge = c.passed ? 'PASS ✓' : `GAP (${c.severity.toUpperCase()}) ✗`;
    lines.push(
      `| \`${escMdCell(c.controlId)}\` — ${escMdCell(c.titleEn)} | ${badge} | ${escMdCell(c.legalRef)} | ${escMdCell(c.detailEn)} **Action:** ${escMdCell(c.remediationEn)} |`,
    );
  }

  if (csvAudit) {
    lines.push(
      '',
      '## 3. Batch Receipt & Case CSV Audit (CWE-1236 Safe)',
      '',
      `- Total Audited Rows: **${csvAudit.totalRows}** (Compliant: **${csvAudit.compliantRows}** · Attention: **${csvAudit.attentionRows}** · Violation: **${csvAudit.violationRows}**)`,
      `- Missing Arabic Invoice Rows: **${csvAudit.missingArabicInvoiceRows}** · Art. 34 Clause Rows: **${csvAudit.art34ProhibitedClauseRows}** · Spare-Part / Loaner Breaches: **${csvAudit.sparePartOrSubstituteBreachRows}**`,
      `- Combined Estimated Max Exposure: **AED ${formatNum(csvAudit.totalEstimatedExposureMaxAed)}** · CWE-1236 Fields Sanitized: **${csvAudit.formulaInjectionSanitizedCount}**`,
    );
  }

  return lines.join('\n') + '\n';
}
