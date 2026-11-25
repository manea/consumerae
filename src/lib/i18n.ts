import type {
  MerchantChannel,
  PenaltyTierCode,
  ReadinessStatus,
  SparePartDemandKind,
} from '../core/types.ts';

export type Locale = 'ar' | 'en';
export type ThemeName = 'alabaster-consumer' | 'obsidian-watch';

export const STATUS_LABELS: Record<ReadinessStatus, { ar: string; en: string }> = {
  ready: { ar: 'ممتثل ✓', en: 'READY ✓' },
  conditional: { ar: 'تنبيه / مخالفة جزئية', en: 'CONDITIONAL' },
  blocked: { ar: 'مخالف / خطر إغلاق ✗', en: 'BLOCKED ✗' },
};

export const CHANNEL_LABELS: Record<MerchantChannel, { ar: string; en: string }> = {
  uae_retail_storefront: {
    ar: 'متجر تجزئة بالبر الرئيسي (DET / ADDED / DED)',
    en: 'UAE Mainland Retail Storefront (DET / ADDED / DED)',
  },
  uae_ecommerce_platform: {
    ar: 'منصة أو متجر تجارة إلكترونية (المادة 40)',
    en: 'UAE E-Commerce Platform / Online Store (Art. 40)',
  },
  uae_commercial_agent_service: {
    ar: 'وكيل تجاري / مركز صيانة معتمد (م 14 و27)',
    en: 'Commercial Agent / Authorized Service Center (Arts. 14 & 27)',
  },
  uae_freezone_b2c_supplier: {
    ar: 'مزوّد منطقة حرة يبيع للمستهلكين بالإمارات',
    en: 'UAE Free-Zone B2C Supplier Selling to UAE Consumers',
  },
  b2b_wholesale_resale_exempt: {
    ar: 'بيع جملة تجاري لإعادة البيع (مستثنى من النطاق)',
    en: 'Pure B2B Wholesale-for-Resale (Exempt Scope)',
  },
};

export const SPARE_PART_LABELS: Record<SparePartDemandKind, { ar: string; en: string }> = {
  regular_continuous: {
    ar: 'قطع دورية مستمرة الطلب (سقف 7 أيام)',
    en: 'Regular / Continuous Demand (7-Day SLA)',
  },
  irregular_demand: {
    ar: 'قطع غير دورية الطلب (سقف 14 يوماً)',
    en: 'Irregular Demand Parts (14-Day SLA)',
  },
  parallel_external_import: {
    ar: 'مستورد من خارج الوكيل المحلي (سقف 30 يوماً)',
    en: 'Parallel External Import via Local Agent (30-Day SLA)',
  },
  none: {
    ar: 'لا توجد طلبات قطع غيار',
    en: 'No Spare Parts Requested',
  },
};

export const PENALTY_TIER_LABELS: Record<PenaltyTierCode, { ar: string; en: string }> = {
  compliant_no_penalty: {
    ar: 'ممتثل — لا غرامات (0 د.إ)',
    en: 'Compliant — No Fine (AED 0)',
  },
  exempt_b2b_resale: {
    ar: 'مستثنى (جملة تجارية لإعادة البيع)',
    en: 'Exempt (Pure B2B Wholesale Resale)',
  },
  administrative_fine_100k: {
    ar: 'غرامة إدارية حتى 100,000 د.إ (فاتورة / إفصاح عربي)',
    en: 'Admin Fine up to AED 100,000 (Arabic Invoice / Disclosures)',
  },
  administrative_fine_250k: {
    ar: 'غرامة إدارية حتى 250,000 د.إ (عيوب / قطع / المادة 34)',
    en: 'Admin Fine up to AED 250,000 (Defects / Spare Parts / Art. 34)',
  },
  escalated_repeat_or_severe_1m_2m: {
    ar: 'تصعيد تكرار حتى 1 مليون د.إ إدارياً / 2 مليون جنائياً + إغلاق 24 ساعة–90 يوماً',
    en: 'Escalated Repeat up to AED 1M Admin / AED 2M Criminal + 24h–90d Closure',
  },
};

export const UI_COPY = {
  ar: {
    brandTitle: 'ConsumerAE — مدقق حماية المستهلك الإماراتي',
    brandSub:
      'القانون الاتحادي 15/2020 والمرسوم بقانون 5/2023 واللائحة التنفيذية 66/2023 (الفاتورة العربية، المادة 34، العيوب 30 يوماً، قطع الغيار 7/14/30 يوماً)',
    serverBadge: 'SQLite WAL حي',
    localBadge: 'تخزين محلي $0',
    presetLabel: 'سيناريو معياري:',
    printBtn: 'طباعة / PDF',
    tabDashboard: 'الالتزامات والجزاءات',
    tabControls: 'الضوابط السبعة (7)',
    tabCsv: 'تدقيق الإيصالات CSV',
    tabVault: 'خزنة الملفات والختم',
    missingReport: 'تعذر العثور على التقرير المختوم المطلوب.',
    viewsLabel: 'المشاهدات',
    backToWorkspace: 'العودة للاستوديو',
  },
  en: {
    brandTitle: 'ConsumerAE — UAE Consumer Protection Compliance Studio',
    brandSub:
      'Federal Law No. 15/2020, FDL 5/2023 & Cabinet Resolution No. 66/2023 (Arabic Invoices, Art. 34 Waivers, 30d Defects & 7d/14d/30d Spare Parts)',
    serverBadge: 'Live SQLite WAL',
    localBadge: '$0 Local Mode',
    presetLabel: 'Scenario Preset:',
    printBtn: 'Print / PDF',
    tabDashboard: 'Obligations & Penalties',
    tabControls: '7-Control Matrix',
    tabCsv: 'Receipt CSV Audit',
    tabVault: 'Vault & SHA-256',
    missingReport: 'Sealed public ConsumerAE report was not found.',
    viewsLabel: 'Views',
    backToWorkspace: 'Back to Studio',
  },
} as const;
