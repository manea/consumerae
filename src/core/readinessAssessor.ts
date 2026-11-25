import type {
  AssessmentInput,
  AssessmentResult,
  FindingItem,
  ReadinessStatus,
} from './types.ts';
import {
  CONSUMERAE_TOOL_VERSION,
  CONSUMER_CONTROLS,
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
} from './consumerCatalog.ts';
import { evaluateConsumerObligations } from './consumerEngine.ts';
import { canonicalizeDossierPayload, computePayloadDigest } from './dossierDigest.ts';
import { auditReceiptCsv } from './receiptCsvAuditor.ts';

export function evaluateConsumerCoreSync(input: AssessmentInput): AssessmentResult {
  const obligations = evaluateConsumerObligations(input);

  const controls: FindingItem[] = CONSUMER_CONTROLS.map((spec) => {
    let passed = true;
    let detailAr = spec.summaryAr;
    let detailEn = spec.summaryEn;
    let remediationAr = 'مكتمل — حافظ على إصدار الفاتورة العربية والالتزام بمُهَل 7/14/30 يوماً.';
    let remediationEn = 'Compliant — maintain Arabic invoicing and 7d/14d/30d statutory consumer SLAs.';

    switch (spec.id) {
      case 'CNS-CTRL-01': {
        passed = !obligations.arabicInvoiceGap;
        if (!passed) {
          detailAr =
            'لم تصدر فاتورة مفصلة باللغة العربية أو تنقصها بيانات الأساس (الاسم التجاري، العنوان، السعر بالدرهم، الكمية، التاريخ، مدة الضمان)؛ يعرض المنشأة لغرامة 100,000 د.إ.';
          detailEn =
            'Detailed purchase invoice is missing prominent Arabic text or core fields (trade name, AED price, quantity, date, warranty term), exposing the supplier to an AED 100,000 fine.';
          remediationAr =
            'أضف قوالب فواتير ثنائية اللغة تبرز جميع البنود القانونية باللغة العربية فوراً لكل عملية بيع.';
          remediationEn =
            'Deploy bilingual Arabic-primary itemized invoice templates with AED pricing and warranty term disclosures.';
        }
        break;
      }

      case 'CNS-CTRL-02': {
        passed = !obligations.prohibitedClauseGap;
        if (!passed) {
          const clauses = obligations.art34Scan.matchedClauses.join('، ');
          detailAr = `وجود شرط محظور بموجب المادة (34) من القرار 66/2023${clauses ? ` (${clauses})` : ''} يعفي المزوّد من المسؤولية أو يمنع الاسترجاع/الاستبدال خارج الاستثناءات المقررة.`;
          detailEn = `Prohibited Article 34 clause(s) detected${clauses ? ` (${clauses})` : ''}; blanket No-Refund/No-Exchange or defect liability waivers are legally null and void.`;
          remediationAr =
            'احذف عبارات «البضاعة المباعة لا ترد ولا تستبدل» وإخلاء المسؤولية عن العيوب من الفواتير واللافتات وشروط الموقع الرقمي.';
          remediationEn =
            'Remove blanket No-Refund/No-Exchange, unilateral modification, and defect-liability disclaimers across receipts, signage, and web terms.';
        }
        break;
      }

      case 'CNS-CTRL-03': {
        passed = !obligations.defectRemedyGap;
        if (!passed) {
          detailAr = `عدم الوفاء بحقوق معالجة العيوب بموجب المادتين 25 و27 (عمر المطالبة ${input.daysSinceDefectDiscovery} يوماً، تكرار العيب ${input.repeatDefectCount} مرة)؛ تبلغ الغرامة الإدارية 250,000 د.إ.`;
          detailEn = `Active defect claim (${input.daysSinceDefectDiscovery} days, ${input.repeatDefectCount} repeat failures) was not honored under Art. 25 (30d missing/conflicting warranty) or Art. 27 (AED 250k fine).`;
          remediationAr =
            'اعرض على المستهلك الإصلاح المجاني أو الاستبدال أو رد الثمن كاملاً (وإلزاماً الاستبدال/الاسترداد عند تكرار العيب مرتين فأكثر).';
          remediationEn =
            'Provide free repair, replacement, or full refund at consumer choice (mandatory replacement or refund once defects recur twice or warranty is absent/conflicting).';
        }
        break;
      }

      case 'CNS-CTRL-04': {
        passed = !obligations.sparePartsOrSubstituteGap;
        if (!passed) {
          detailAr = `تأخر في مهلة قطع الغيار (${input.sparePartDeliveryDays} يوماً مقابل سقف ${obligations.sparePartSlaDays} يوماً) أو غياب السلعة البديلة المجانية بعد ${input.warrantyRepairDays} أيام صيانة (> 7 أيام).`;
          detailEn = `Spare-parts SLA breached (${input.sparePartDeliveryDays}d delivered vs. ${obligations.sparePartSlaDays}d statutory limit) or warranty repair (${input.warrantyRepairDays}d > 7d) lacked a free temporary substitute.`;
          remediationAr =
            'التزم بمهلة 7/14/30 يوماً لقطع الغيار وفق المادة 14 ووفّر بديلاً مؤقتاً مجاناً عند تجاوز صيانة الضمان 7 أيام.';
          remediationEn =
            'Enforce Art. 14 spare-parts fulfillment windows (7d regular / 14d irregular / 30d parallel import) and issue free temporary substitutes beyond 7 repair days.';
        }
        break;
      }

      case 'CNS-CTRL-05': {
        passed = !obligations.postPurchaseDiscountGap;
        if (!passed) {
          detailAr = `أُعلن تخفيض خلال 7 أيام من الشراء دون إشعار مسبق بفرق قدره ${obligations.recoverablePriceDifferenceAed} د.إ ضمن نافذة المطالبة البالغة 30 يوماً دون رده للمستهلك.`;
          detailEn = `Undisclosed discount announced within 7 days of purchase created a ${obligations.recoverablePriceDifferenceAed} AED claim within the 30-day window without refund settlement.`;
          remediationAr =
            'وثّق إشعارات التخفيض قبل الشراء أو رد فرق السعر فوراً لكل مستهلك يتقدم خلال 30 يوماً من تاريخ الفاتورة.';
          remediationEn =
            'Provide advance written discount notices or refund price differences promptly when claimed within 30 days of purchase.';
        }
        break;
      }

      case 'CNS-CTRL-06': {
        passed = !obligations.ecommerceDisclosureGap;
        if (!passed) {
          detailAr =
            'نقص في الإفصاحات الإلزامية للتجارة الإلكترونية باللغة العربية وفق المادة 40 (بيانات المنتج والمستورد، بلد المنشأ، السعر بالدرهم شامل الضريبة، شروط الاسترجاع).';
          detailEn =
            'Online / free-zone B2C storefront lacks complete Article 40 Arabic disclosures (producer/importer, origin, tax-inclusive AED price, and clear return terms).';
          remediationAr =
            'انشر حقول المادة 40 باللغة العربية في جميع صفحات المنتجات وسلة الدفع مع مطابقة بائعي الأطراف الثالثة.';
          remediationEn =
            'Publish complete Article 40 Arabic product, origin, tax-inclusive AED price, and return-policy fields across storefront and marketplace listings.';
        }
        break;
      }

      case 'CNS-CTRL-07': {
        passed = !obligations.trnOrWorkflowGap;
        if (!passed) {
          detailAr =
            obligations.tradeTrnValid === false
              ? 'الرقم الضريبي الإماراتي غير مطابق لصيغة 15 خانة المبدوءة بـ 100 أو ينقص مسار معالجة الشكاوى والتظلمات خلال 15 يوم عمل.'
              : 'لم يُوثق مسار معالجة شكاوى المستهلك والتظلمات أمام الدوائر الاقتصادية خلال مهلة 15 يوم عمل.';
          detailEn =
            obligations.tradeTrnValid === false
              ? 'UAE TRN format is invalid (must be 15 digits starting with 100) or 15-working-day grievance procedure is missing.'
              : 'Consumer complaint escalation and 15-working-day regulatory grievance workflow are not documented.';
          remediationAr =
            'صحّح الرقم الضريبي (100xxxxxxxxxxxx) وفعّل سجل الشكاوى ومسار التظلم الإداري خلال 15 يوم عمل.';
          remediationEn =
            'Correct the 15-digit UAE TRN (100 prefix) and formalize consumer complaint & 15-working-day regulatory grievance handling.';
        }
        break;
      }

      default:
        break;
    }

    return {
      controlId: spec.id,
      severity: spec.severity,
      passed,
      legalRef: spec.legalRef,
      titleAr: spec.titleAr,
      titleEn: spec.titleEn,
      detailAr,
      detailEn,
      remediationAr,
      remediationEn,
    };
  });

  const weightById = new Map(CONSUMER_CONTROLS.map((c) => [c.id, c.weight]));
  const failedControls = controls.filter((c) => !c.passed);
  const failedWeight = failedControls.reduce(
    (sum, item) => sum + (weightById.get(item.controlId) ?? 0),
    0,
  );
  const criticalFailures = failedControls.filter((c) => c.severity === 'critical').length;

  const readinessScore = obligations.isSubjectToConsumerLaw
    ? Math.max(0, 100 - failedWeight)
    : 100;

  let readinessStatus: ReadinessStatus = 'ready';
  if (obligations.isSubjectToConsumerLaw && failedControls.length > 0) {
    readinessStatus = readinessScore >= 70 && criticalFailures === 0 ? 'conditional' : 'blocked';
  }

  const result: AssessmentResult = {
    toolVersion: CONSUMERAE_TOOL_VERSION,
    merchantName: input.merchantName,
    channel: input.channel,
    readinessScore,
    readinessStatus,
    obligations,
    controls,
    disclaimerAr: LEGAL_DISCLAIMER_AR,
    disclaimerEn: LEGAL_DISCLAIMER_EN,
  };

  if (input.receiptCsv && input.receiptCsv.trim().length > 0) {
    result.csvAudit = auditReceiptCsv(input.receiptCsv);
  }

  return result;
}

export async function assessConsumerReadiness(
  input: AssessmentInput,
): Promise<AssessmentResult & { dossierSha256: string }> {
  const coreResult = evaluateConsumerCoreSync(input);
  const dossierSha256 = await computePayloadDigest(canonicalizeDossierPayload(coreResult));
  return {
    ...coreResult,
    dossierSha256,
  };
}
