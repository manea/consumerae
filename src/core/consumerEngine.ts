import type {
  Art34ScanResult,
  AssessmentInput,
  ConsumerObligationEvaluation,
  MerchantChannel,
  PenaltyTierCode,
  SparePartDemandKind,
} from './types.ts';
import {
  CR66_ARABIC_INVOICE_FINE_AED,
  CR66_CLOSURE_MAX_DAYS,
  CR66_CLOSURE_MIN_HOURS,
  CR66_DEFECT_NO_WARRANTY_DAYS,
  CR66_DEFECT_SPARE_PARTS_FINE_AED,
  CR66_DISCOUNT_CLAIM_WINDOW_DAYS,
  CR66_REPEAT_DEFECT_REFUND_COUNT,
  CR66_SPARE_PART_IRREGULAR_DAYS,
  CR66_SPARE_PART_PARALLEL_IMPORT_DAYS,
  CR66_SPARE_PART_REGULAR_DAYS,
  CR66_TEMP_SUBSTITUTE_THRESHOLD_DAYS,
  FDL5_GRIEVANCE_WORKING_DAYS,
  FL15_ADMIN_FINE_CAP_AED,
  FL15_CRIMINAL_FINE_CAP_AED,
} from './consumerCatalog.ts';

interface ClausePattern {
  label: string;
  regex: RegExp;
  strictLiabilityOrUnilateral: boolean;
}

const ART34_PATTERNS: readonly ClausePattern[] = [
  { label: 'no refund', regex: /\bno\s+refunds?\b/i, strictLiabilityOrUnilateral: false },
  { label: 'no exchange', regex: /\bno\s+exchanges?\b/i, strictLiabilityOrUnilateral: false },
  { label: 'no return', regex: /\bno\s+returns?\b/i, strictLiabilityOrUnilateral: false },
  { label: 'non-refundable', regex: /\bnon[-\s]?refundable\b/i, strictLiabilityOrUnilateral: false },
  { label: 'non-exchangeable', regex: /\bnon[-\s]?exchangeable\b/i, strictLiabilityOrUnilateral: false },
  { label: 'all sales final', regex: /\ball\s+sales\s+(?:are\s+)?final\b/i, strictLiabilityOrUnilateral: false },
  { label: 'sold as is', regex: /\bsold\s+as[-\s]?is\b/i, strictLiabilityOrUnilateral: true },
  { label: 'not liable for any defect', regex: /\bnot\s+liable\s+for\s+(?:any\s+)?defects?\b/i, strictLiabilityOrUnilateral: true },
  { label: 'exclude liability', regex: /\bexclud(?:e|ing|es)\s+(?:all\s+|legal\s+|statutory\s+)?liability\b/i, strictLiabilityOrUnilateral: true },
  { label: 'unilateral termination', regex: /\bunilateral(?:ly)?\s+(?:terminat|amend|interpret)/i, strictLiabilityOrUnilateral: true },
  { label: 'sole discretion to amend', regex: /\bsole\s+discretion\s+to\s+(?:amend|modify|cancel)/i, strictLiabilityOrUnilateral: true },
  { label: 'البضاعة المباعة لا ترد ولا تستبدل', regex: /البضاعة\s+المباعة\s+لا\s+ترد(?:\s+ولا\s+تستبدل)?/u, strictLiabilityOrUnilateral: false },
  { label: 'لا استرجاع', regex: /(?:^|[\s،,.؛:(])لا\s*(?:يوجد\s*)?استرجاع/u, strictLiabilityOrUnilateral: false },
  { label: 'لا يستبدل', regex: /(?:^|[\s،,.؛:(])لا\s*(?:تستبدل|يستبدل|استبدال)/u, strictLiabilityOrUnilateral: false },
  { label: 'لا يرد', regex: /(?:^|[\s،,.؛:(])لا\s*(?:ترد|يرد)/u, strictLiabilityOrUnilateral: false },
  { label: 'بدون ضمان', regex: /بدون\s+ضمان|لا\s+يشمل\s+الضمان/u, strictLiabilityOrUnilateral: true },
  { label: 'إخلاء مسؤولية', regex: /(?:إ|ا)خلاء\s*(?:كامل\s*)?(?:ال)?مسؤولية/u, strictLiabilityOrUnilateral: true },
  { label: 'تعديل الشروط منفرد', regex: /تعديل\s+(?:الشروط|العقد)\s+(?:بشكل\s+)?منفرد|بإرادة\s+منفردة/u, strictLiabilityOrUnilateral: true },
];

export function normalizeTrnDigits(rawTrn: string): string {
  return String(rawTrn ?? '').replace(/[^0-9]/g, '');
}

export function validateUaeTrn(rawTrn: string): boolean {
  const digits = normalizeTrnDigits(rawTrn);
  return digits.length === 15 && digits.startsWith('100');
}

export function getSparePartSlaDays(kind: SparePartDemandKind): number {
  switch (kind) {
    case 'regular_continuous':
      return CR66_SPARE_PART_REGULAR_DAYS;
    case 'irregular_demand':
      return CR66_SPARE_PART_IRREGULAR_DAYS;
    case 'parallel_external_import':
      return CR66_SPARE_PART_PARALLEL_IMPORT_DAYS;
    case 'none':
    default:
      return 0;
  }
}

export function computeRecoverablePriceDifferenceAed(
  originalPriceAed: number,
  discountedPriceAed: number,
): number {
  if (!Number.isFinite(originalPriceAed) || !Number.isFinite(discountedPriceAed)) {
    return 0;
  }
  const diff = originalPriceAed - discountedPriceAed;
  if (diff <= 0) {
    return 0;
  }
  return Math.round(diff * 100) / 100;
}

function stripArabicDiacritics(value: string): string {
  return value.replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim();
}

export function scanReceiptTermsForArt34Violations(
  receiptTermsText: string,
  statutoryExemptionCategory = false,
): Art34ScanResult {
  const normalized = stripArabicDiacritics(String(receiptTermsText ?? ''));
  if (!normalized) {
    return {
      hasProhibitedTerms: false,
      hasStrictLiabilityOrUnilateralWaiver: false,
      matchedClauses: [],
      exemptExceptionClaimed: statutoryExemptionCategory,
    };
  }

  const matchedClauses: string[] = [];
  let hasStrictLiabilityOrUnilateralWaiver = false;
  for (const pattern of ART34_PATTERNS) {
    if (pattern.regex.test(normalized)) {
      if (!matchedClauses.includes(pattern.label)) {
        matchedClauses.push(pattern.label);
      }
      if (pattern.strictLiabilityOrUnilateral) {
        hasStrictLiabilityOrUnilateralWaiver = true;
      }
    }
  }

  return {
    hasProhibitedTerms: matchedClauses.length > 0,
    hasStrictLiabilityOrUnilateralWaiver,
    matchedClauses,
    exemptExceptionClaimed: statutoryExemptionCategory,
  };
}

export function getAuthorityLabels(channel: MerchantChannel): { ar: string; en: string } {
  switch (channel) {
    case 'uae_ecommerce_platform':
      return {
        ar: 'وزارة الاقتصاد الإماراتية ودوائر التنمية الاقتصادية (DET / ADDED / التجارة الإلكترونية)',
        en: 'UAE Ministry of Economy & Local Economic Departments (DET / ADDED E-Commerce)',
      };
    case 'uae_commercial_agent_service':
      return {
        ar: 'وزارة الاقتصاد الإماراتية ولجنة الوكالات التجارية / حماية المستهلك',
        en: 'UAE Ministry of Economy & Consumer Protection / Commercial Agency Authorities',
      };
    case 'uae_freezone_b2c_supplier':
      return {
        ar: 'سلطة المنطقة الحرة الإماراتية بالتكامل مع قانون حماية المستهلك الاتحادي',
        en: 'UAE Free-Zone Licensing Authority & Federal Consumer Protection Framework',
      };
    case 'b2b_wholesale_resale_exempt':
      return {
        ar: 'معاملة جملة تجارية صرفة لإعادة البيع (خارج نطاق المستهلك النهائي)',
        en: 'Pure B2B Wholesale-for-Resale Transaction (Outside End-Consumer Scope)',
      };
    case 'uae_retail_storefront':
    default:
      return {
        ar: 'دائرة التنمية الاقتصادية المحلية (DET دبي / ADDED أبوظبي / الشارقة) ووزارة الاقتصاد',
        en: 'Local DED / DET Dubai / ADDED Abu Dhabi & UAE Ministry of Economy',
      };
  }
}

export function evaluateConsumerObligations(input: AssessmentInput): ConsumerObligationEvaluation {
  const isSubjectToConsumerLaw = input.channel !== 'b2b_wholesale_resale_exempt';
  const corporateEndUserProtected = isSubjectToConsumerLaw && input.isCorporateEndUserSale;
  const authority = getAuthorityLabels(input.channel);

  const rawTrn = String(input.tradeTrn ?? '').trim();
  const tradeTrnValid = rawTrn.length > 0 ? validateUaeTrn(rawTrn) : null;

  const art34Scan = scanReceiptTermsForArt34Violations(
    input.receiptTermsText ?? '',
    input.statutoryExemptionCategory,
  );
  const sparePartSlaDays = getSparePartSlaDays(input.sparePartDemandKind);
  const recoverablePriceDifferenceAed = computeRecoverablePriceDifferenceAed(
    input.originalPriceAed,
    input.discountedPriceAed,
  );

  const arabicInvoiceGap =
    isSubjectToConsumerLaw && (!input.hasArabicInvoice || !input.invoiceIncludesCoreFields);

  const prohibitedClauseGap =
    isSubjectToConsumerLaw &&
    (input.hasProhibitedWaiverClause ||
      art34Scan.hasStrictLiabilityOrUnilateralWaiver ||
      (art34Scan.hasProhibitedTerms && !input.statutoryExemptionCategory));

  const within30dNoWarranty =
    input.lacksOrConflictingWarranty &&
    Math.max(0, input.daysSinceDefectDiscovery) <= CR66_DEFECT_NO_WARRANTY_DAYS;
  const repeatDefectTrigger = input.repeatDefectCount >= CR66_REPEAT_DEFECT_REFUND_COUNT;

  const defectRemedyGap =
    isSubjectToConsumerLaw &&
    input.hasActiveDefectClaim &&
    !input.defectRemedyHonored &&
    (within30dNoWarranty || input.supplierCausedDefect || repeatDefectTrigger);

  const sparePartSlaExceeded =
    input.sparePartsRequested &&
    sparePartSlaDays > 0 &&
    input.sparePartDeliveryDays > sparePartSlaDays;
  const tempSubstituteMissing =
    input.warrantyRepairDays > CR66_TEMP_SUBSTITUTE_THRESHOLD_DAYS &&
    !input.temporarySubstituteProvided;

  const sparePartsOrSubstituteGap =
    isSubjectToConsumerLaw && (sparePartSlaExceeded || tempSubstituteMissing);

  const postPurchaseDiscountGap =
    isSubjectToConsumerLaw &&
    input.discountAnnouncedWithin7Days &&
    !input.discountPriorNoticeGiven &&
    Math.max(0, input.daysSincePurchaseForDiscount) <= CR66_DISCOUNT_CLAIM_WINDOW_DAYS &&
    recoverablePriceDifferenceAed > 0 &&
    !input.priceDifferenceRefunded;

  const onlineObligated =
    input.channel === 'uae_ecommerce_platform' ||
    input.channel === 'uae_freezone_b2c_supplier' ||
    input.sellsOnline;

  const ecommerceDisclosureGap =
    isSubjectToConsumerLaw && onlineObligated && !input.ecommerceArabicDisclosuresComplete;

  const trnOrWorkflowGap =
    isSubjectToConsumerLaw &&
    (!input.complaintAndGrievanceWorkflowReady || tradeTrnValid === false);

  const hasAnyGap =
    arabicInvoiceGap ||
    prohibitedClauseGap ||
    defectRemedyGap ||
    sparePartsOrSubstituteGap ||
    postPurchaseDiscountGap ||
    ecommerceDisclosureGap ||
    trnOrWorkflowGap;

  let penaltyTierCode: PenaltyTierCode = 'compliant_no_penalty';
  let projectedMinimumFineAed = 0;
  let projectedMaximumFineAed = 0;
  let statutoryCriminalCapAed = 0;
  let temporaryClosureRisk = false;
  let closureWindowHoursMin = 0;
  let closureWindowDaysMax = 0;
  let licenseRevocationRisk = false;

  if (!isSubjectToConsumerLaw) {
    penaltyTierCode = 'exempt_b2b_resale';
  } else if (hasAnyGap) {
    const hasSevereOperationalBreach =
      prohibitedClauseGap || defectRemedyGap || sparePartsOrSubstituteGap;
    const baseMax = hasSevereOperationalBreach
      ? CR66_DEFECT_SPARE_PARTS_FINE_AED
      : CR66_ARABIC_INVOICE_FINE_AED;
    const baseMin = arabicInvoiceGap ? CR66_ARABIC_INVOICE_FINE_AED : 50_000;
    const repeats = Math.max(0, Math.floor(input.priorOffenseCount));

    if (repeats === 0) {
      penaltyTierCode = hasSevereOperationalBreach
        ? 'administrative_fine_250k'
        : 'administrative_fine_100k';
      projectedMinimumFineAed = Math.min(baseMax, baseMin);
      projectedMaximumFineAed = baseMax;
      statutoryCriminalCapAed = hasSevereOperationalBreach
        ? FL15_CRIMINAL_FINE_CAP_AED
        : FL15_ADMIN_FINE_CAP_AED;
    } else if (repeats === 1) {
      const doubledMax = Math.min(FL15_ADMIN_FINE_CAP_AED, baseMax * 2);
      const doubledMin = Math.min(doubledMax, baseMin * 2);
      penaltyTierCode =
        doubledMax >= 500_000 ? 'escalated_repeat_or_severe_1m_2m' : 'administrative_fine_250k';
      projectedMinimumFineAed = doubledMin;
      projectedMaximumFineAed = doubledMax;
      statutoryCriminalCapAed = FL15_CRIMINAL_FINE_CAP_AED;
      temporaryClosureRisk = true;
      closureWindowHoursMin = CR66_CLOSURE_MIN_HOURS;
      closureWindowDaysMax = CR66_CLOSURE_MAX_DAYS;
    } else {
      penaltyTierCode = 'escalated_repeat_or_severe_1m_2m';
      projectedMinimumFineAed = Math.min(FL15_ADMIN_FINE_CAP_AED, baseMin * 2);
      projectedMaximumFineAed = FL15_ADMIN_FINE_CAP_AED;
      statutoryCriminalCapAed = FL15_CRIMINAL_FINE_CAP_AED;
      temporaryClosureRisk = true;
      closureWindowHoursMin = CR66_CLOSURE_MIN_HOURS;
      closureWindowDaysMax = CR66_CLOSURE_MAX_DAYS;
      licenseRevocationRisk = true;
    }
  }

  return {
    regulatoryAuthorityAr: authority.ar,
    regulatoryAuthorityEn: authority.en,
    isSubjectToConsumerLaw,
    corporateEndUserProtected,
    tradeTrnValid,
    art34Scan,
    sparePartSlaDays,
    recoverablePriceDifferenceAed,
    statutoryGrievanceWorkingDays: FDL5_GRIEVANCE_WORKING_DAYS,
    statutoryDefectNoWarrantyDays: CR66_DEFECT_NO_WARRANTY_DAYS,
    statutoryDiscountClaimWindowDays: CR66_DISCOUNT_CLAIM_WINDOW_DAYS,
    statutoryTempSubstituteThresholdDays: CR66_TEMP_SUBSTITUTE_THRESHOLD_DAYS,
    arabicInvoiceGap,
    prohibitedClauseGap,
    defectRemedyGap,
    sparePartsOrSubstituteGap,
    postPurchaseDiscountGap,
    ecommerceDisclosureGap,
    trnOrWorkflowGap,
    penaltyTierCode,
    projectedMinimumFineAed,
    projectedMaximumFineAed,
    statutoryCriminalCapAed,
    temporaryClosureRisk,
    closureWindowHoursMin,
    closureWindowDaysMax,
    licenseRevocationRisk,
  };
}
