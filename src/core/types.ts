export type MerchantChannel =
  | 'uae_retail_storefront'
  | 'uae_ecommerce_platform'
  | 'uae_commercial_agent_service'
  | 'uae_freezone_b2c_supplier'
  | 'b2b_wholesale_resale_exempt';

export type SparePartDemandKind =
  | 'regular_continuous'
  | 'irregular_demand'
  | 'parallel_external_import'
  | 'none';

export type PenaltyTierCode =
  | 'compliant_no_penalty'
  | 'exempt_b2b_resale'
  | 'administrative_fine_100k'
  | 'administrative_fine_250k'
  | 'escalated_repeat_or_severe_1m_2m';

export type ConsumerControlId =
  | 'CNS-CTRL-01'
  | 'CNS-CTRL-02'
  | 'CNS-CTRL-03'
  | 'CNS-CTRL-04'
  | 'CNS-CTRL-05'
  | 'CNS-CTRL-06'
  | 'CNS-CTRL-07';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export type ReadinessStatus = 'ready' | 'conditional' | 'blocked';

export interface ConsumerControlSpec {
  id: ConsumerControlId;
  weight: number;
  severity: SeverityLevel;
  legalRef: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
}

export interface Art34ScanResult {
  hasProhibitedTerms: boolean;
  hasStrictLiabilityOrUnilateralWaiver: boolean;
  matchedClauses: string[];
  exemptExceptionClaimed: boolean;
}

export interface AssessmentInput {
  merchantName: string;
  tradeTrn?: string;
  channel: MerchantChannel;
  sellsOnline: boolean;
  isCorporateEndUserSale: boolean;
  hasArabicInvoice: boolean;
  invoiceIncludesCoreFields: boolean;
  hasProhibitedWaiverClause: boolean;
  receiptTermsText?: string;
  statutoryExemptionCategory: boolean;
  hasActiveDefectClaim: boolean;
  daysSinceDefectDiscovery: number;
  lacksOrConflictingWarranty: boolean;
  supplierCausedDefect: boolean;
  repeatDefectCount: number;
  defectRemedyHonored: boolean;
  sparePartsRequested: boolean;
  sparePartDemandKind: SparePartDemandKind;
  sparePartDeliveryDays: number;
  warrantyRepairDays: number;
  temporarySubstituteProvided: boolean;
  discountAnnouncedWithin7Days: boolean;
  discountPriorNoticeGiven: boolean;
  daysSincePurchaseForDiscount: number;
  originalPriceAed: number;
  discountedPriceAed: number;
  priceDifferenceRefunded: boolean;
  ecommerceArabicDisclosuresComplete: boolean;
  complaintAndGrievanceWorkflowReady: boolean;
  priorOffenseCount: number;
  receiptCsv?: string;
  notes?: string;
}

export interface ConsumerObligationEvaluation {
  regulatoryAuthorityAr: string;
  regulatoryAuthorityEn: string;
  isSubjectToConsumerLaw: boolean;
  corporateEndUserProtected: boolean;
  tradeTrnValid: boolean | null;
  art34Scan: Art34ScanResult;
  sparePartSlaDays: number;
  recoverablePriceDifferenceAed: number;
  statutoryGrievanceWorkingDays: number;
  statutoryDefectNoWarrantyDays: number;
  statutoryDiscountClaimWindowDays: number;
  statutoryTempSubstituteThresholdDays: number;
  arabicInvoiceGap: boolean;
  prohibitedClauseGap: boolean;
  defectRemedyGap: boolean;
  sparePartsOrSubstituteGap: boolean;
  postPurchaseDiscountGap: boolean;
  ecommerceDisclosureGap: boolean;
  trnOrWorkflowGap: boolean;
  penaltyTierCode: PenaltyTierCode;
  projectedMinimumFineAed: number;
  projectedMaximumFineAed: number;
  statutoryCriminalCapAed: number;
  temporaryClosureRisk: boolean;
  closureWindowHoursMin: number;
  closureWindowDaysMax: number;
  licenseRevocationRisk: boolean;
}

export interface FindingItem {
  controlId: ConsumerControlId;
  severity: SeverityLevel;
  passed: boolean;
  legalRef: string;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  remediationAr: string;
  remediationEn: string;
}

export interface ReceiptCaseRowAudit {
  rowNumber: number;
  caseId: string;
  merchantOrItemEn: string;
  channel: MerchantChannel;
  arabicInvoiceIssued: boolean;
  art34MatchedClauses: string[];
  defectDaysSincePurchase: number;
  defectRemedyHonored: boolean;
  sparePartKind: SparePartDemandKind;
  sparePartDays: number;
  sparePartSlaDays: number;
  warrantyRepairDays: number;
  tempSubstituteProvided: boolean;
  recoverablePriceDiffAed: number;
  trnValid: boolean | null;
  status: 'compliant' | 'attention' | 'violation';
  violationReasons: string[];
  estimatedExposureMaxAed: number;
  sanitizedFormulaFields: number;
}

export interface ReceiptCsvAuditSummary {
  totalRows: number;
  compliantRows: number;
  attentionRows: number;
  violationRows: number;
  missingArabicInvoiceRows: number;
  art34ProhibitedClauseRows: number;
  sparePartOrSubstituteBreachRows: number;
  totalEstimatedExposureMaxAed: number;
  formulaInjectionSanitizedCount: number;
  rows: ReceiptCaseRowAudit[];
}

export interface AssessmentResult {
  toolVersion: string;
  merchantName: string;
  channel: MerchantChannel;
  readinessScore: number;
  readinessStatus: ReadinessStatus;
  obligations: ConsumerObligationEvaluation;
  controls: FindingItem[];
  csvAudit?: ReceiptCsvAuditSummary;
  dossierSha256?: string;
  disclaimerAr: string;
  disclaimerEn: string;
}

export interface ConsumerPreset {
  id: string;
  labelAr: string;
  labelEn: string;
  summaryAr: string;
  summaryEn: string;
  input: AssessmentInput;
  sampleCsv: string;
}
