import type {
  MerchantChannel,
  ReceiptCaseRowAudit,
  ReceiptCsvAuditSummary,
  SparePartDemandKind,
} from './types.ts';
import {
  CR66_ARABIC_INVOICE_FINE_AED,
  CR66_DEFECT_NO_WARRANTY_DAYS,
  CR66_DEFECT_SPARE_PARTS_FINE_AED,
  CR66_TEMP_SUBSTITUTE_THRESHOLD_DAYS,
} from './consumerCatalog.ts';
import {
  computeRecoverablePriceDifferenceAed,
  getSparePartSlaDays,
  scanReceiptTermsForArt34Violations,
  validateUaeTrn,
} from './consumerEngine.ts';

const FORMULA_LEAD_REGEX = /^[\t\r\n\uFEFF\x00-\x20]*([=+\-@])/;

export function needsCsvFormulaSanitization(value: string): boolean {
  const str = String(value ?? '');
  return str.length > 0 && FORMULA_LEAD_REGEX.test(str);
}

export function sanitizeCsvTextField(value: string): {
  sanitized: string;
  wasSanitized: boolean;
} {
  const str = String(value ?? '');
  if (!str) return { sanitized: '', wasSanitized: false };
  if (str.startsWith("'") && FORMULA_LEAD_REGEX.test(str.slice(1))) {
    return { sanitized: str, wasSanitized: false };
  }
  if (FORMULA_LEAD_REGEX.test(str)) {
    return { sanitized: `'${str}`, wasSanitized: true };
  }
  return { sanitized: str, wasSanitized: false };
}

export function formatSafeCsvCell(value: string | number | boolean): {
  cell: string;
  wasSanitized: boolean;
} {
  const raw = String(value ?? '');
  const { sanitized, wasSanitized } = sanitizeCsvTextField(raw);
  const escaped = sanitized.replace(/"/g, '""');
  return { cell: `"${escaped}"`, wasSanitized };
}

function parseBool(raw: string | undefined): boolean {
  const norm = String(raw ?? '').trim().toLowerCase();
  return norm === 'true' || norm === '1' || norm === 'yes' || norm === 'y';
}

function parseNumNonNeg(raw: string | undefined): number {
  const n = Number(String(raw ?? '').replace(/[,\s]/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function parseChannel(raw: string | undefined): MerchantChannel {
  const norm = String(raw ?? '').trim().toLowerCase();
  switch (norm) {
    case 'uae_ecommerce_platform':
    case 'uae_commercial_agent_service':
    case 'uae_freezone_b2c_supplier':
    case 'b2b_wholesale_resale_exempt':
    case 'uae_retail_storefront':
      return norm;
    default:
      return 'uae_retail_storefront';
  }
}

function parseSparePartKind(raw: string | undefined): SparePartDemandKind {
  const norm = String(raw ?? '').trim().toLowerCase();
  switch (norm) {
    case 'regular_continuous':
    case 'irregular_demand':
    case 'parallel_external_import':
    case 'none':
      return norm;
    default:
      return 'none';
  }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

export function auditReceiptCsv(csvText: string): ReceiptCsvAuditSummary {
  const rawLines = String(csvText ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    return {
      totalRows: 0,
      compliantRows: 0,
      attentionRows: 0,
      violationRows: 0,
      missingArabicInvoiceRows: 0,
      art34ProhibitedClauseRows: 0,
      sparePartOrSubstituteBreachRows: 0,
      totalEstimatedExposureMaxAed: 0,
      formulaInjectionSanitizedCount: 0,
      rows: [],
    };
  }

  const firstCells = parseCsvLine(rawLines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const hasHeader =
    firstCells.includes('case_id') ||
    firstCells.includes('arabic_invoice') ||
    firstCells.includes('waiver_clause_text');

  const headerIndex = new Map<string, number>();
  if (hasHeader) {
    firstCells.forEach((h, idx) => headerIndex.set(h, idx));
  }

  const startIdx = hasHeader ? 1 : 0;
  const rows: ReceiptCaseRowAudit[] = [];

  let compliantRows = 0;
  let attentionRows = 0;
  let violationRows = 0;
  let missingArabicInvoiceRows = 0;
  let art34ProhibitedClauseRows = 0;
  let sparePartOrSubstituteBreachRows = 0;
  let totalEstimatedExposureMaxAed = 0;
  let formulaInjectionSanitizedCount = 0;

  const readField = (cells: string[], key: string, fallbackIdx: number): string => {
    const idx = headerIndex.has(key) ? (headerIndex.get(key) as number) : fallbackIdx;
    return cells[idx] ?? '';
  };

  for (let i = startIdx; i < rawLines.length; i += 1) {
    const cells = parseCsvLine(rawLines[i]);
    const caseIdRaw = readField(cells, 'case_id', 0) || `CASE-${i - startIdx + 1}`;
    const merchantOrItemEn = readField(cells, 'merchant_or_item_en', 1) || 'UAE Consumer Case';
    const channel = parseChannel(readField(cells, 'channel', 2));
    const arabicInvoiceIssued = parseBool(readField(cells, 'arabic_invoice', 3));
    const waiverClauseText = readField(cells, 'waiver_clause_text', 4);
    const defectDaysSincePurchase = parseNumNonNeg(
      readField(cells, 'defect_days_since_purchase', 5),
    );
    const defectRemedyHonored = parseBool(readField(cells, 'defect_remedy_honored', 6));
    const sparePartKind = parseSparePartKind(readField(cells, 'spare_part_kind', 7));
    const sparePartDays = parseNumNonNeg(readField(cells, 'spare_part_days', 8));
    const warrantyRepairDays = parseNumNonNeg(readField(cells, 'warranty_repair_days', 9));
    const tempSubstituteProvided = parseBool(readField(cells, 'temp_substitute_provided', 10));
    const originalPriceAed = parseNumNonNeg(readField(cells, 'original_price_aed', 11));
    const discountedPriceAed = parseNumNonNeg(readField(cells, 'discounted_price_aed', 12));
    const trnRaw = readField(cells, 'trn', 13);

    let sanitizedFormulaFields = 0;
    for (const candidate of [caseIdRaw, merchantOrItemEn, waiverClauseText, trnRaw]) {
      if (needsCsvFormulaSanitization(candidate)) {
        sanitizedFormulaFields += 1;
      }
    }
    formulaInjectionSanitizedCount += sanitizedFormulaFields;

    const inScope = channel !== 'b2b_wholesale_resale_exempt';
    const art34 = scanReceiptTermsForArt34Violations(waiverClauseText, false);
    const sparePartSlaDays = getSparePartSlaDays(sparePartKind);
    const recoverablePriceDiffAed = computeRecoverablePriceDifferenceAed(
      originalPriceAed,
      discountedPriceAed,
    );
    const trnValid = trnRaw ? validateUaeTrn(trnRaw) : null;

    const violationReasons: string[] = [];
    let rowMaxExposure = 0;

    if (inScope) {
      if (!arabicInvoiceIssued) {
        missingArabicInvoiceRows += 1;
        violationReasons.push('MISSING_ARABIC_INVOICE_100K');
        rowMaxExposure = Math.max(rowMaxExposure, CR66_ARABIC_INVOICE_FINE_AED);
      }

      if (art34.hasProhibitedTerms) {
        art34ProhibitedClauseRows += 1;
        violationReasons.push('ART34_PROHIBITED_WAIVER_CLAUSE');
        rowMaxExposure = Math.max(rowMaxExposure, CR66_DEFECT_SPARE_PARTS_FINE_AED);
      }

      if (
        defectDaysSincePurchase > 0 &&
        defectDaysSincePurchase <= CR66_DEFECT_NO_WARRANTY_DAYS &&
        !defectRemedyHonored
      ) {
        violationReasons.push('DEFECT_REMEDY_UNHONORED_250K');
        rowMaxExposure = Math.max(rowMaxExposure, CR66_DEFECT_SPARE_PARTS_FINE_AED);
      }

      const partBreach = sparePartSlaDays > 0 && sparePartDays > sparePartSlaDays;
      const substituteBreach =
        warrantyRepairDays > CR66_TEMP_SUBSTITUTE_THRESHOLD_DAYS && !tempSubstituteProvided;
      if (partBreach || substituteBreach) {
        sparePartOrSubstituteBreachRows += 1;
        violationReasons.push(
          partBreach ? 'SPARE_PART_SLA_BREACHED_250K' : 'MISSING_TEMP_SUBSTITUTE_GT7D',
        );
        rowMaxExposure = Math.max(rowMaxExposure, CR66_DEFECT_SPARE_PARTS_FINE_AED);
      }

      if (trnValid === false) {
        violationReasons.push('INVALID_UAE_TRN_FORMAT');
      }
      if (recoverablePriceDiffAed > 0) {
        violationReasons.push('PRICE_DIFF_RECOVERY_CLAIM_OPEN');
      }
    }

    let status: ReceiptCaseRowAudit['status'] = 'compliant';
    if (
      violationReasons.some((r) =>
        [
          'MISSING_ARABIC_INVOICE_100K',
          'ART34_PROHIBITED_WAIVER_CLAUSE',
          'DEFECT_REMEDY_UNHONORED_250K',
          'SPARE_PART_SLA_BREACHED_250K',
          'MISSING_TEMP_SUBSTITUTE_GT7D',
        ].includes(r),
      )
    ) {
      status = 'violation';
      violationRows += 1;
    } else if (violationReasons.length > 0) {
      status = 'attention';
      attentionRows += 1;
    } else {
      compliantRows += 1;
    }

    totalEstimatedExposureMaxAed += rowMaxExposure;

    rows.push({
      rowNumber: i - startIdx + 1,
      caseId: sanitizeCsvTextField(caseIdRaw).sanitized,
      merchantOrItemEn: sanitizeCsvTextField(merchantOrItemEn).sanitized,
      channel,
      arabicInvoiceIssued,
      art34MatchedClauses: art34.matchedClauses,
      defectDaysSincePurchase,
      defectRemedyHonored,
      sparePartKind,
      sparePartDays,
      sparePartSlaDays,
      warrantyRepairDays,
      tempSubstituteProvided,
      recoverablePriceDiffAed,
      trnValid,
      status,
      violationReasons,
      estimatedExposureMaxAed: rowMaxExposure,
      sanitizedFormulaFields,
    });
  }

  return {
    totalRows: rows.length,
    compliantRows,
    attentionRows,
    violationRows,
    missingArabicInvoiceRows,
    art34ProhibitedClauseRows,
    sparePartOrSubstituteBreachRows,
    totalEstimatedExposureMaxAed,
    formulaInjectionSanitizedCount,
    rows,
  };
}

export function exportReceiptAuditCsv(summary: ReceiptCsvAuditSummary): string {
  const headers = [
    'row_number',
    'case_id',
    'merchant_or_item_en',
    'channel',
    'arabic_invoice_issued',
    'art34_matched_clauses',
    'defect_days_since_purchase',
    'defect_remedy_honored',
    'spare_part_kind',
    'spare_part_days',
    'spare_part_sla_days',
    'warranty_repair_days',
    'temp_substitute_provided',
    'recoverable_price_diff_aed',
    'trn_valid',
    'status',
    'violation_reasons',
    'estimated_exposure_max_aed',
  ];

  const lines: string[] = [headers.map((h) => formatSafeCsvCell(h).cell).join(',')];

  for (const row of summary.rows) {
    const ordered = [
      row.rowNumber,
      row.caseId,
      row.merchantOrItemEn,
      row.channel,
      row.arabicInvoiceIssued,
      row.art34MatchedClauses.join('; '),
      row.defectDaysSincePurchase,
      row.defectRemedyHonored,
      row.sparePartKind,
      row.sparePartDays,
      row.sparePartSlaDays,
      row.warrantyRepairDays,
      row.tempSubstituteProvided,
      row.recoverablePriceDiffAed,
      row.trnValid === null ? 'n/a' : row.trnValid,
      row.status,
      row.violationReasons.join('; '),
      row.estimatedExposureMaxAed,
    ];
    lines.push(ordered.map((v) => formatSafeCsvCell(v).cell).join(','));
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
