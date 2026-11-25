import { describe, expect, it } from 'vitest';
import {
  CONSUMERAE_TOOL_VERSION,
  CONSUMER_PRESETS,
  assessConsumerReadiness,
  auditReceiptCsv,
  canonicalizeDossierPayload,
  computeDossierSha256,
  computeRecoverablePriceDifferenceAed,
  evaluateConsumerCoreSync,
  evaluateConsumerObligations,
  exportReceiptAuditCsv,
  formatSafeCsvCell,
  getSparePartSlaDays,
  needsCsvFormulaSanitization,
  sanitizeCsvTextField,
  scanReceiptTermsForArt34Violations,
  validateUaeTrn,
} from '../../src/core/index.ts';
import type { AssessmentInput } from '../../src/core/types.ts';

function cleanBaseInput(overrides: Partial<AssessmentInput> = {}): AssessmentInput {
  return {
    ...CONSUMER_PRESETS[0].input,
    ...overrides,
  };
}

describe('ConsumerAE Zero-Dependency UAE Consumer Protection Core (FL 15/2020, FDL 5/2023 & CR 66/2023)', () => {
  it('1. exposes tool version 0.5.0 and explicit UAE MoE/DET/ADDED non-affiliation disclaimers', () => {
    expect(CONSUMERAE_TOOL_VERSION).toBe('0.5.0');
    const res = evaluateConsumerCoreSync(cleanBaseInput());
    expect(res.disclaimerAr).toContain('لا تتبع وزارة الاقتصاد');
    expect(res.disclaimerEn).toContain('not affiliated with the UAE Ministry of Economy');
  });

  it('2. evaluates Preset 1 (compliant retail storefront) at 100/100 ready with 0 AED penalty', () => {
    const res = evaluateConsumerCoreSync({
      ...CONSUMER_PRESETS[0].input,
      receiptCsv: CONSUMER_PRESETS[0].sampleCsv,
    });
    expect(res.readinessStatus).toBe('ready');
    expect(res.readinessScore).toBe(100);
    expect(res.obligations.penaltyTierCode).toBe('compliant_no_penalty');
    expect(res.obligations.projectedMinimumFineAed).toBe(0);
    expect(res.obligations.projectedMaximumFineAed).toBe(0);
    expect(res.obligations.temporaryClosureRisk).toBe(false);
    expect(res.csvAudit?.totalRows).toBe(2);
    expect(res.csvAudit?.compliantRows).toBe(2);
  });

  it('3. evaluates Preset 2 (service agent irregular spare-part 19d & 10d repair without loaner) at 85/100 conditional', () => {
    const res = evaluateConsumerCoreSync({
      ...CONSUMER_PRESETS[1].input,
      receiptCsv: CONSUMER_PRESETS[1].sampleCsv,
    });
    expect(res.readinessStatus).toBe('conditional');
    expect(res.readinessScore).toBe(85);
    expect(res.obligations.sparePartsOrSubstituteGap).toBe(true);
    expect(res.obligations.corporateEndUserProtected).toBe(true);
    expect(res.obligations.penaltyTierCode).toBe('administrative_fine_250k');
    expect(res.obligations.projectedMaximumFineAed).toBe(250_000);
    expect(res.obligations.temporaryClosureRisk).toBe(false);
    expect(res.csvAudit?.sparePartOrSubstituteBreachRows).toBe(1);
  });

  it('4. evaluates Preset 3 (3rd repeat offender) at 0/100 blocked with AED 1M admin / 2M criminal caps and closure risk', () => {
    const res = evaluateConsumerCoreSync({
      ...CONSUMER_PRESETS[2].input,
      receiptCsv: CONSUMER_PRESETS[2].sampleCsv,
    });
    expect(res.readinessStatus).toBe('blocked');
    expect(res.readinessScore).toBe(0);
    expect(res.obligations.penaltyTierCode).toBe('escalated_repeat_or_severe_1m_2m');
    expect(res.obligations.projectedMaximumFineAed).toBe(1_000_000);
    expect(res.obligations.statutoryCriminalCapAed).toBe(2_000_000);
    expect(res.obligations.temporaryClosureRisk).toBe(true);
    expect(res.obligations.closureWindowHoursMin).toBe(24);
    expect(res.obligations.closureWindowDaysMax).toBe(90);
    expect(res.obligations.licenseRevocationRisk).toBe(true);
    expect(res.csvAudit?.formulaInjectionSanitizedCount).toBe(1);
    expect(res.csvAudit?.violationRows).toBe(2);
  });

  it('5. penalizes missing Arabic invoice text (hasArabicInvoice=false) with CNS-CTRL-01 fail and AED 100k fine', () => {
    const res = evaluateConsumerCoreSync(cleanBaseInput({ hasArabicInvoice: false }));
    const ctrl1 = res.controls.find((c) => c.controlId === 'CNS-CTRL-01');
    expect(ctrl1?.passed).toBe(false);
    expect(res.readinessStatus).toBe('blocked');
    expect(res.readinessScore).toBe(80);
    expect(res.obligations.arabicInvoiceGap).toBe(true);
    expect(res.obligations.penaltyTierCode).toBe('administrative_fine_100k');
    expect(res.obligations.projectedMinimumFineAed).toBe(100_000);
    expect(res.obligations.projectedMaximumFineAed).toBe(100_000);
  });

  it('6. fails CNS-CTRL-01 when Arabic invoice lacks core itemized fields (AED, date, warranty, address)', () => {
    const res = evaluateConsumerCoreSync(cleanBaseInput({ invoiceIncludesCoreFields: false }));
    const ctrl1 = res.controls.find((c) => c.controlId === 'CNS-CTRL-01');
    expect(ctrl1?.passed).toBe(false);
    expect(res.obligations.arabicInvoiceGap).toBe(true);
    expect(res.obligations.projectedMaximumFineAed).toBe(100_000);
  });

  it('7. scans English Art. 34 prohibited phrases: no refund, no exchange, all sales final', () => {
    const scan = scanReceiptTermsForArt34Violations(
      'Notice: All sales are final. No refund and no exchange accepted.',
    );
    expect(scan.hasProhibitedTerms).toBe(true);
    expect(scan.matchedClauses).toContain('all sales final');
    expect(scan.matchedClauses).toContain('no refund');
    expect(scan.matchedClauses).toContain('no exchange');
    expect(scan.hasStrictLiabilityOrUnilateralWaiver).toBe(false);
  });

  it('8. flags English Art. 34 strict liability exclusion and unilateral termination clauses', () => {
    const scan = scanReceiptTermsForArt34Violations(
      'Supplier is not liable for any defect and reserves unilateral termination rights.',
    );
    expect(scan.hasProhibitedTerms).toBe(true);
    expect(scan.hasStrictLiabilityOrUnilateralWaiver).toBe(true);
    expect(scan.matchedClauses).toContain('not liable for any defect');
    expect(scan.matchedClauses).toContain('unilateral termination');
  });

  it('9. scans Arabic Art. 34 phrases: البضاعة المباعة لا ترد ولا تستبدل، لا استرجاع، إخلاء مسؤولية', () => {
    const scan = scanReceiptTermsForArt34Violations(
      'تنبيه: البضاعة المباعة لا ترد ولا تستبدل، لا استرجاع للمبالغ مع إخلاء مسؤولية عن العيوب.',
    );
    expect(scan.hasProhibitedTerms).toBe(true);
    expect(scan.hasStrictLiabilityOrUnilateralWaiver).toBe(true);
    expect(scan.matchedClauses).toContain('البضاعة المباعة لا ترد ولا تستبدل');
    expect(scan.matchedClauses).toContain('لا استرجاع');
    expect(scan.matchedClauses).toContain('إخلاء مسؤولية');
  });

  it('10. permits narrow non-defect return limits when statutoryExemptionCategory=true without liability waiver', () => {
    const evalRes = evaluateConsumerObligations(
      cleanBaseInput({
        statutoryExemptionCategory: true,
        hasProhibitedWaiverClause: false,
        receiptTermsText: 'Custom tailored item: No exchange for sizing preference.',
      }),
    );
    expect(evalRes.art34Scan.hasProhibitedTerms).toBe(true);
    expect(evalRes.art34Scan.hasStrictLiabilityOrUnilateralWaiver).toBe(false);
    expect(evalRes.prohibitedClauseGap).toBe(false);
  });

  it('11. STILL blocks statutoryExemptionCategory=true when terms include defect-liability waiver or unilateral terms', () => {
    const evalRes = evaluateConsumerObligations(
      cleanBaseInput({
        statutoryExemptionCategory: true,
        hasProhibitedWaiverClause: false,
        receiptTermsText: 'Fresh custom basket; vendor not liable for any defect or بدون ضمان.',
      }),
    );
    expect(evalRes.art34Scan.hasStrictLiabilityOrUnilateralWaiver).toBe(true);
    expect(evalRes.prohibitedClauseGap).toBe(true);
  });

  it('12. enforces Art. 25 30-day exact boundary (Day 30 triggers defectRemedyGap vs Day 31 non-supplier defect)', () => {
    const day30 = evaluateConsumerObligations(
      cleanBaseInput({
        hasActiveDefectClaim: true,
        lacksOrConflictingWarranty: true,
        supplierCausedDefect: false,
        repeatDefectCount: 0,
        daysSinceDefectDiscovery: 30,
        defectRemedyHonored: false,
      }),
    );
    expect(day30.defectRemedyGap).toBe(true);
    expect(day30.projectedMaximumFineAed).toBe(250_000);

    const day31 = evaluateConsumerObligations(
      cleanBaseInput({
        hasActiveDefectClaim: true,
        lacksOrConflictingWarranty: true,
        supplierCausedDefect: false,
        repeatDefectCount: 0,
        daysSinceDefectDiscovery: 31,
        defectRemedyHonored: false,
      }),
    );
    expect(day31.defectRemedyGap).toBe(false);
  });

  it('13. enforces Art. 27 supplier-caused defect remedy even after Day 30 when unhonored', () => {
    const res = evaluateConsumerObligations(
      cleanBaseInput({
        hasActiveDefectClaim: true,
        lacksOrConflictingWarranty: false,
        supplierCausedDefect: true,
        daysSinceDefectDiscovery: 90,
        defectRemedyHonored: false,
      }),
    );
    expect(res.defectRemedyGap).toBe(true);
    expect(res.penaltyTierCode).toBe('administrative_fine_250k');
  });

  it('14. distinguishes Art. 27 recurring defect count boundary (1 prior attempt vs 2 repeat failures)', () => {
    const oneFailure = evaluateConsumerObligations(
      cleanBaseInput({
        hasActiveDefectClaim: true,
        lacksOrConflictingWarranty: false,
        supplierCausedDefect: false,
        repeatDefectCount: 1,
        defectRemedyHonored: false,
      }),
    );
    expect(oneFailure.defectRemedyGap).toBe(false);

    const twoFailures = evaluateConsumerObligations(
      cleanBaseInput({
        hasActiveDefectClaim: true,
        lacksOrConflictingWarranty: false,
        supplierCausedDefect: false,
        repeatDefectCount: 2,
        defectRemedyHonored: false,
      }),
    );
    expect(twoFailures.defectRemedyGap).toBe(true);
    expect(twoFailures.projectedMaximumFineAed).toBe(250_000);
  });

  it('15. checks Art. 14 spare-part SLA lookup constants (7d regular / 14d irregular / 30d parallel / 0 none)', () => {
    expect(getSparePartSlaDays('regular_continuous')).toBe(7);
    expect(getSparePartSlaDays('irregular_demand')).toBe(14);
    expect(getSparePartSlaDays('parallel_external_import')).toBe(30);
    expect(getSparePartSlaDays('none')).toBe(0);
  });

  it('16. enforces Art. 14 regular spare parts exact boundary (7 days passes vs 8 days fails)', () => {
    const day7 = evaluateConsumerObligations(
      cleanBaseInput({
        sparePartsRequested: true,
        sparePartDemandKind: 'regular_continuous',
        sparePartDeliveryDays: 7,
      }),
    );
    expect(day7.sparePartsOrSubstituteGap).toBe(false);

    const day8 = evaluateConsumerObligations(
      cleanBaseInput({
        sparePartsRequested: true,
        sparePartDemandKind: 'regular_continuous',
        sparePartDeliveryDays: 8,
      }),
    );
    expect(day8.sparePartsOrSubstituteGap).toBe(true);
    expect(day8.projectedMaximumFineAed).toBe(250_000);
  });

  it('17. enforces Art. 14 irregular spare parts exact boundary (14 days passes vs 15 days fails)', () => {
    const day14 = evaluateConsumerObligations(
      cleanBaseInput({
        sparePartsRequested: true,
        sparePartDemandKind: 'irregular_demand',
        sparePartDeliveryDays: 14,
      }),
    );
    expect(day14.sparePartsOrSubstituteGap).toBe(false);

    const day15 = evaluateConsumerObligations(
      cleanBaseInput({
        sparePartsRequested: true,
        sparePartDemandKind: 'irregular_demand',
        sparePartDeliveryDays: 15,
      }),
    );
    expect(day15.sparePartsOrSubstituteGap).toBe(true);
  });

  it('18. enforces Art. 14 parallel external import local-agent 30-day spare-part boundary (30d passes vs 31d fails)', () => {
    const day30 = evaluateConsumerObligations(
      cleanBaseInput({
        channel: 'uae_commercial_agent_service',
        sparePartsRequested: true,
        sparePartDemandKind: 'parallel_external_import',
        sparePartDeliveryDays: 30,
      }),
    );
    expect(day30.sparePartsOrSubstituteGap).toBe(false);

    const day31 = evaluateConsumerObligations(
      cleanBaseInput({
        channel: 'uae_commercial_agent_service',
        sparePartsRequested: true,
        sparePartDemandKind: 'parallel_external_import',
        sparePartDeliveryDays: 31,
      }),
    );
    expect(day31.sparePartsOrSubstituteGap).toBe(true);
  });

  it('19. enforces Art. 27 temporary substitute rule (> 7d repair without substitute fails; with substitute passes)', () => {
    const day7NoLoaner = evaluateConsumerObligations(
      cleanBaseInput({ warrantyRepairDays: 7, temporarySubstituteProvided: false }),
    );
    expect(day7NoLoaner.sparePartsOrSubstituteGap).toBe(false);

    const day8NoLoaner = evaluateConsumerObligations(
      cleanBaseInput({ warrantyRepairDays: 8, temporarySubstituteProvided: false }),
    );
    expect(day8NoLoaner.sparePartsOrSubstituteGap).toBe(true);

    const day12WithLoaner = evaluateConsumerObligations(
      cleanBaseInput({ warrantyRepairDays: 12, temporarySubstituteProvided: true }),
    );
    expect(day12WithLoaner.sparePartsOrSubstituteGap).toBe(false);
  });

  it('20. computes recoverable post-purchase discount difference cleanly including zero and negative clamps', () => {
    expect(computeRecoverablePriceDifferenceAed(1999.99, 1599.49)).toBe(400.5);
    expect(computeRecoverablePriceDifferenceAed(500, 500)).toBe(0);
    expect(computeRecoverablePriceDifferenceAed(400, 500)).toBe(0);
    expect(computeRecoverablePriceDifferenceAed(Number.NaN, 100)).toBe(0);
  });

  it('21. enforces 30-day post-purchase discount window when 7-day discount lacks prior notice', () => {
    const day30Unrefunded = evaluateConsumerObligations(
      cleanBaseInput({
        discountAnnouncedWithin7Days: true,
        discountPriorNoticeGiven: false,
        daysSincePurchaseForDiscount: 30,
        originalPriceAed: 1200,
        discountedPriceAed: 900,
        priceDifferenceRefunded: false,
      }),
    );
    expect(day30Unrefunded.recoverablePriceDifferenceAed).toBe(300);
    expect(day30Unrefunded.postPurchaseDiscountGap).toBe(true);

    const day31Expired = evaluateConsumerObligations(
      cleanBaseInput({
        discountAnnouncedWithin7Days: true,
        discountPriorNoticeGiven: false,
        daysSincePurchaseForDiscount: 31,
        originalPriceAed: 1200,
        discountedPriceAed: 900,
        priceDifferenceRefunded: false,
      }),
    );
    expect(day31Expired.postPurchaseDiscountGap).toBe(false);

    const priorNoticeExempt = evaluateConsumerObligations(
      cleanBaseInput({
        discountAnnouncedWithin7Days: true,
        discountPriorNoticeGiven: true,
        daysSincePurchaseForDiscount: 10,
        originalPriceAed: 1200,
        discountedPriceAed: 900,
        priceDifferenceRefunded: false,
      }),
    );
    expect(priorNoticeExempt.postPurchaseDiscountGap).toBe(false);
  });

  it('22. enforces Art. 40 Arabic e-commerce disclosures for online, platform & free-zone B2C sellers, skipping pure offline stores', () => {
    for (const channel of ['uae_ecommerce_platform', 'uae_freezone_b2c_supplier'] as const) {
      const onlineGap = evaluateConsumerObligations(
        cleanBaseInput({ channel, sellsOnline: false, ecommerceArabicDisclosuresComplete: false }),
      );
      expect(onlineGap.ecommerceDisclosureGap).toBe(true);
    }

    const storefrontOnlineGap = evaluateConsumerObligations(
      cleanBaseInput({
        channel: 'uae_retail_storefront',
        sellsOnline: true,
        ecommerceArabicDisclosuresComplete: false,
      }),
    );
    expect(storefrontOnlineGap.ecommerceDisclosureGap).toBe(true);

    const pureOffline = evaluateConsumerObligations(
      cleanBaseInput({
        channel: 'uae_retail_storefront',
        sellsOnline: false,
        ecommerceArabicDisclosuresComplete: false,
      }),
    );
    expect(pureOffline.ecommerceDisclosureGap).toBe(false);
  });

  it('23. exempts pure B2B wholesale-for-resale transactions (0 AED) while protecting corporate end-users', () => {
    const corporateEndUser = evaluateConsumerCoreSync(
      cleanBaseInput({
        channel: 'uae_retail_storefront',
        isCorporateEndUserSale: true,
        hasArabicInvoice: false,
      }),
    );
    expect(corporateEndUser.obligations.isSubjectToConsumerLaw).toBe(true);
    expect(corporateEndUser.obligations.corporateEndUserProtected).toBe(true);
    expect(corporateEndUser.obligations.arabicInvoiceGap).toBe(true);

    const b2bWholesale = evaluateConsumerCoreSync({
      ...CONSUMER_PRESETS[2].input,
      channel: 'b2b_wholesale_resale_exempt',
    });
    expect(b2bWholesale.obligations.isSubjectToConsumerLaw).toBe(false);
    expect(b2bWholesale.obligations.penaltyTierCode).toBe('exempt_b2b_resale');
    expect(b2bWholesale.obligations.projectedMaximumFineAed).toBe(0);
    expect(b2bWholesale.readinessScore).toBe(100);
    expect(b2bWholesale.readinessStatus).toBe('ready');
  });

  it('24. validates 15-digit UAE TRN starting with 100 and permits omitted optional TRN', () => {
    expect(validateUaeTrn('100452819300003')).toBe(true);
    expect(validateUaeTrn('100-4528-1930-0003')).toBe(true);
    expect(validateUaeTrn('200452819300003')).toBe(false);
    expect(validateUaeTrn('1004528193000')).toBe(false);

    const emptyTrn = evaluateConsumerObligations(cleanBaseInput({ tradeTrn: '' }));
    expect(emptyTrn.tradeTrnValid).toBeNull();
    expect(emptyTrn.trnOrWorkflowGap).toBe(false);

    const badTrn = evaluateConsumerObligations(cleanBaseInput({ tradeTrn: '999123' }));
    expect(badTrn.tradeTrnValid).toBe(false);
    expect(badTrn.trnOrWorkflowGap).toBe(true);
  });

  it('25. doubles administrative fines (2x) on 1st repeat offense and triggers closure risk without premature licence revocation', () => {
    const invoiceRepeat1 = evaluateConsumerObligations(
      cleanBaseInput({ hasArabicInvoice: false, priorOffenseCount: 1 }),
    );
    expect(invoiceRepeat1.projectedMinimumFineAed).toBe(200_000);
    expect(invoiceRepeat1.projectedMaximumFineAed).toBe(200_000);
    expect(invoiceRepeat1.temporaryClosureRisk).toBe(true);
    expect(invoiceRepeat1.licenseRevocationRisk).toBe(false);

    const defectRepeat1 = evaluateConsumerObligations(
      cleanBaseInput({ hasProhibitedWaiverClause: true, priorOffenseCount: 1 }),
    );
    expect(defectRepeat1.projectedMaximumFineAed).toBe(500_000);
    expect(defectRepeat1.penaltyTierCode).toBe('escalated_repeat_or_severe_1m_2m');
    expect(defectRepeat1.temporaryClosureRisk).toBe(true);
    expect(defectRepeat1.licenseRevocationRisk).toBe(false);
  });

  it('26. caps 2+ repeat administrative exposure at AED 1,000,000, criminal cap at AED 2,000,000 & enables licence revocation risk', () => {
    const repeat2 = evaluateConsumerObligations(
      cleanBaseInput({
        hasArabicInvoice: false,
        hasProhibitedWaiverClause: true,
        priorOffenseCount: 2,
      }),
    );
    expect(repeat2.projectedMaximumFineAed).toBe(1_000_000);
    expect(repeat2.statutoryCriminalCapAed).toBe(2_000_000);
    expect(repeat2.temporaryClosureRisk).toBe(true);
    expect(repeat2.licenseRevocationRisk).toBe(true);
    expect(repeat2.statutoryGrievanceWorkingDays).toBe(15);
  });

  it('27. audits empty CSV safely returning zeroed summary metrics', () => {
    const empty = auditReceiptCsv('   \n  ');
    expect(empty.totalRows).toBe(0);
    expect(empty.violationRows).toBe(0);
    expect(empty.totalEstimatedExposureMaxAed).toBe(0);
    expect(empty.rows).toEqual([]);
  });

  it('28. parses headerless positional CSV rows accurately', () => {
    const headerless =
      'CASE-901,Positional Merchant,uae_retail_storefront,false,No refund,12,false,regular_continuous,10,9,false,500,400,100452819300003';
    const summary = auditReceiptCsv(headerless);
    expect(summary.totalRows).toBe(1);
    expect(summary.violationRows).toBe(1);
    expect(summary.missingArabicInvoiceRows).toBe(1);
    expect(summary.art34ProhibitedClauseRows).toBe(1);
    expect(summary.sparePartOrSubstituteBreachRows).toBe(1);
    expect(summary.rows[0].recoverablePriceDiffAed).toBe(100);
    expect(summary.rows[0].estimatedExposureMaxAed).toBe(250_000);
  });

  it('29. sanitizes CWE-1236 formula-injection leads (=, +, -, @, whitespace/tab) and avoids double-quoting prefixed values', () => {
    expect(needsCsvFormulaSanitization('=CMD|calc')).toBe(true);
    expect(needsCsvFormulaSanitization(' +1+1')).toBe(true);
    expect(needsCsvFormulaSanitization('\t-SUM(A1:A2)')).toBe(true);
    expect(needsCsvFormulaSanitization('@HYPERLINK')).toBe(true);
    expect(needsCsvFormulaSanitization("'=SAFE")).toBe(false);

    expect(sanitizeCsvTextField('=INJECT')).toEqual({ sanitized: "'=INJECT", wasSanitized: true });
    expect(sanitizeCsvTextField("'=ALREADY")).toEqual({
      sanitized: "'=ALREADY",
      wasSanitized: false,
    });

    const formatted = formatSafeCsvCell('+SUM("1")');
    expect(formatted.wasSanitized).toBe(true);
    expect(formatted.cell).toBe(`"'+SUM(""1"")"`);
  });

  it('30. counts multiple CWE-1236 risky fields in CSV rows and exports UTF-8 BOM + CRLF', () => {
    const riskyCsv = [
      'case_id,merchant_or_item_en,channel,arabic_invoice,waiver_clause_text,defect_days_since_purchase,defect_remedy_honored,spare_part_kind,spare_part_days,warranty_repair_days,temp_substitute_provided,original_price_aed,discounted_price_aed,trn',
      '=CASE-1,+Evil Shop,uae_retail_storefront,true,@No refund,0,true,none,0,0,false,100,100,-123',
    ].join('\n');
    const summary = auditReceiptCsv(riskyCsv);
    expect(summary.formulaInjectionSanitizedCount).toBe(4);
    expect(summary.rows[0].sanitizedFormulaFields).toBe(4);
    expect(summary.rows[0].caseId).toBe("'=CASE-1");

    const wireCsv = exportReceiptAuditCsv(summary);
    expect(wireCsv.startsWith('\uFEFF')).toBe(true);
    expect(wireCsv).toContain('\r\n');
    expect(wireCsv).toContain(`"'=CASE-1"`);
    expect(wireCsv).toContain(`"'+Evil Shop"`);
  });

  it('31. treats B2B wholesale rows in CSV as exempt from consumer violation exposure', () => {
    const csv = [
      'case_id,merchant_or_item_en,channel,arabic_invoice,waiver_clause_text,defect_days_since_purchase,defect_remedy_honored,spare_part_kind,spare_part_days,warranty_repair_days,temp_substitute_provided,original_price_aed,discounted_price_aed,trn',
      'B2B-1,Bulk Distributor Carton,b2b_wholesale_resale_exempt,false,All sales final,15,false,regular_continuous,20,12,false,1000,700,100452819300003',
    ].join('\n');
    const summary = auditReceiptCsv(csv);
    expect(summary.totalRows).toBe(1);
    expect(summary.compliantRows).toBe(1);
    expect(summary.violationRows).toBe(0);
    expect(summary.totalEstimatedExposureMaxAed).toBe(0);
  });

  it('32. flags CSV attention status when TRN is invalid or price diff exists without statutory breach', () => {
    const csv = [
      'case_id,merchant_or_item_en,channel,arabic_invoice,waiver_clause_text,defect_days_since_purchase,defect_remedy_honored,spare_part_kind,spare_part_days,warranty_repair_days,temp_substitute_provided,original_price_aed,discounted_price_aed,trn',
      'CASE-ATTN,Valid Invoice Promo Row,uae_retail_storefront,true,Standard Statutory Return,0,true,none,0,0,false,900,750,invalid-trn',
    ].join('\n');
    const summary = auditReceiptCsv(csv);
    expect(summary.attentionRows).toBe(1);
    expect(summary.violationRows).toBe(0);
    expect(summary.rows[0].status).toBe('attention');
    expect(summary.rows[0].violationReasons).toEqual([
      'INVALID_UAE_TRN_FORMAT',
      'PRICE_DIFF_RECOVERY_CLAIM_OPEN',
    ]);
  });

  it('33. produces deterministic 64-hex SHA-256 digests invariant to key order and control array order', async () => {
    const r1 = await assessConsumerReadiness({
      ...CONSUMER_PRESETS[0].input,
      receiptCsv: CONSUMER_PRESETS[0].sampleCsv,
    });
    expect(r1.dossierSha256).toMatch(/^[a-f0-9]{64}$/);

    const reversedControlsPayload = {
      ...evaluateConsumerCoreSync({
        ...CONSUMER_PRESETS[0].input,
        receiptCsv: CONSUMER_PRESETS[0].sampleCsv,
      }),
      controls: [...r1.controls].reverse(),
    };
    const h2 = await computeDossierSha256(reversedControlsPayload);
    expect(h2).toBe(r1.dossierSha256);

    const modified = await assessConsumerReadiness({
      ...CONSUMER_PRESETS[0].input,
      merchantName: 'Modified Merchant LLC',
      receiptCsv: CONSUMER_PRESETS[0].sampleCsv,
    });
    expect(modified.dossierSha256).not.toBe(r1.dossierSha256);
    expect(canonicalizeDossierPayload({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('34. blocks offline storefront with missing complaint workflow and calculates exact weight sum 100 across 7 controls', () => {
    const res = evaluateConsumerCoreSync(
      cleanBaseInput({
        sellsOnline: false,
        complaintAndGrievanceWorkflowReady: false,
      }),
    );
    expect(res.controls).toHaveLength(7);
    expect(res.readinessScore).toBe(95);
    expect(res.readinessStatus).toBe('conditional');
    const allFailed = evaluateConsumerCoreSync(CONSUMER_PRESETS[2].input);
    expect(allFailed.controls.every((c) => !c.passed)).toBe(true);
    expect(allFailed.readinessScore).toBe(0);
  });
});
