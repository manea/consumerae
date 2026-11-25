import type { ConsumerControlSpec } from './types.ts';

export const CONSUMERAE_TOOL_VERSION = '0.5.0';

export const CR66_ARABIC_INVOICE_FINE_AED = 100_000;
export const CR66_DEFECT_SPARE_PARTS_FINE_AED = 250_000;
export const FL15_ADMIN_FINE_CAP_AED = 1_000_000;
export const FL15_CRIMINAL_FINE_CAP_AED = 2_000_000;

export const CR66_DEFECT_NO_WARRANTY_DAYS = 30;
export const CR66_DISCOUNT_TRIGGER_DAYS = 7;
export const CR66_DISCOUNT_CLAIM_WINDOW_DAYS = 30;
export const CR66_SPARE_PART_REGULAR_DAYS = 7;
export const CR66_SPARE_PART_IRREGULAR_DAYS = 14;
export const CR66_SPARE_PART_PARALLEL_IMPORT_DAYS = 30;
export const CR66_TEMP_SUBSTITUTE_THRESHOLD_DAYS = 7;
export const CR66_REPEAT_DEFECT_REFUND_COUNT = 2;

export const FDL5_GRIEVANCE_WORKING_DAYS = 15;
export const CR66_CLOSURE_MIN_HOURS = 24;
export const CR66_CLOSURE_MAX_DAYS = 90;

export const LEGAL_DISCLAIMER_AR =
  'تنويه تنظيمي: أداة ConsumerAE أداة مساعدة هندسية وإدارية مفتوحة المصدر ولا تتبع وزارة الاقتصاد الإماراتية أو دائرة الاقتصاد والسياحة بدبي (DET) أو دائرة التنمية الاقتصادية بأبوظبي (ADDED) أو أي دائرة تنمية اقتصادية محلية، ولا تمثل استشارة قانونية رسمية. تستند إلى القانون الاتحادي (15/2020) والمرسوم بقانون (5/2023) وقرار مجلس الوزراء (66/2023).';

export const LEGAL_DISCLAIMER_EN =
  'Regulatory Disclaimer: ConsumerAE is an independent open-source UAE consumer protection readiness tool not affiliated with the UAE Ministry of Economy, Dubai DET, Abu Dhabi ADDED, or any local Department of Economic Development, and does not constitute formal legal advice. Modeled on Federal Law No. 15/2020, FDL No. 5/2023, and Cabinet Resolution No. 66/2023.';

export const CONSUMER_CONTROLS: readonly ConsumerControlSpec[] = [
  {
    id: 'CNS-CTRL-01',
    weight: 20,
    severity: 'critical',
    legalRef: 'FL 15/2020 Art. 8 & CR 66/2023 — Mandatory Arabic Detailed Invoice (AED 100,000 Fine)',
    titleAr: 'إصدار فاتورة مفصلة باللغة العربية متضمنة الحقول الجوهرية (AED)',
    titleEn: 'Mandatory Arabic Itemized Invoice with Core Commercial Fields (AED)',
    summaryAr:
      'إلزام المزوّد بإصدار فاتورة واضحة باللغة العربية (مع جواز إضافة لغة أخرى) تبيّن الاسم التجاري والعنوان والسعر بالدرهم والكمية والتاريخ ومدة الضمان لتفادي غرامة 100,000 د.إ.',
    summaryEn:
      'Suppliers must issue an itemized invoice prominently featuring Arabic (additional languages optional) with trade name, address, AED price, quantity, date, and warranty term (AED 100,000 fine if omitted).',
  },
  {
    id: 'CNS-CTRL-02',
    weight: 20,
    severity: 'critical',
    legalRef: 'CR 66/2023 Art. 34 — Prohibition & Nullity of Unfair Waivers and No-Refund Clauses',
    titleAr: 'حظر الشروط المجحفة وعبارات «لا استرجاع ولا استبدال» وإسقاط الضمان (المادة 34)',
    titleEn: 'Article 34 Ban on Unfair Waivers, No-Refund Clauses & Unilateral Modification',
    summaryAr:
      'بطلان أي نص في الفاتورة أو الإيصال أو العقد الرقمي يعفي المزوّد من المسؤولية القانونية عن العيوب أو يتضمن حظراً عاماً للاسترجاع/الاستبدال خارج الاستثناءات القانونية الضيقة.',
    summaryEn:
      'Renders null and void any clause in contracts, receipts, invoices, or digital terms disclaiming defect liability, asserting unilateral amendment rights, or enforcing blanket No-Refund/No-Exchange rules.',
  },
  {
    id: 'CNS-CTRL-03',
    weight: 20,
    severity: 'critical',
    legalRef: 'FL 15/2020 Art. 12 & CR 66/2023 Arts. 25 & 27 — 30-Day Defect Refund & Remedy Choice',
    titleAr: 'معالجة العيوب خلال 30 يوماً (بلا ضمان/تعارض) وحق الاستبدال أو الاسترداد عند التكرار',
    titleEn: '30-Day Defect Remedy, Consumer Choice (Repair/Replace/Refund) & Repeat-Defect Guard',
    summaryAr:
      'استرداد السلعة ورد الثمن عند ظهور عيب خلال 30 يوماً دون ضمان أو مع ضمان متعارض (م25)، ومنح المستهلك حق الإصلاح أو الاستبدال أو الاسترداد والاسترداد الإلزامي عند تكرار العيب مرتين فأكثر (م27 — 250k د.إ).',
    summaryEn:
      'Mandatory refund for defects appearing within 30 days absent valid/consistent warranty (Art. 25), consumer remedy choice for supplier-attributable faults, and replacement/refund on >= 2 failed repairs (Art. 27 — AED 250k fine).',
  },
  {
    id: 'CNS-CTRL-04',
    weight: 15,
    severity: 'high',
    legalRef: 'CR 66/2023 Arts. 14, 16 & 27 — Spare Parts (7d / 14d / 30d) & Free Substitute > 7d',
    titleAr: 'التزام مُهَل قطع الغيار (7 / 14 / 30 يوماً) وتوفير السلعة البديلة بعد 7 أيام صيانة',
    titleEn: 'Spare Parts Availability SLAs (7d / 14d / 30d) & Free Substitute Beyond 7-Day Repair',
    summaryAr:
      'توريد قطع الغيار الدورية خلال 7 أيام وغير الدورية خلال 14 يوماً والمستورد الموازي خلال 30 يوماً، وتوفير بديل مؤقت مجاناً إذا استمر إصلاح الضمان أكثر من 7 أيام (250,000 د.إ).',
    summaryEn:
      'Supplies regular spare parts within 7 days, irregular parts within 14 days, and parallel-import covered parts within 30 days, plus free temporary substitute goods if warranty repairs exceed 7 days (AED 250k fine).',
  },
  {
    id: 'CNS-CTRL-05',
    weight: 10,
    severity: 'high',
    legalRef: 'CR 66/2023 — Post-Purchase 7-Day Discount Disclosure & 30-Day Price-Difference Claim',
    titleAr: 'رد فرق السعر عند إعلان تخفيض خلال 7 أيام من الشراء (نافذة مطالبة 30 يوماً)',
    titleEn: '30-Day Price-Difference Recovery for Undisclosed Discounts Within 7 Days',
    summaryAr:
      'إذا أعلن المزوّد خصماً على السلعة أو الخدمة خلال 7 أيام تالية للشراء دون إشعار مسبق للمشتري، يلتزم برد فرق السعر خلال نافذة 30 يوماً من تاريخ الشراء.',
    summaryEn:
      'If a supplier launches a discount within 7 days of purchase without prior buyer notice, consumers retain a 30-day statutory right to recover the price difference.',
  },
  {
    id: 'CNS-CTRL-06',
    weight: 10,
    severity: 'medium',
    legalRef: 'CR 66/2023 Art. 40 & FDL 5/2023 — Arabic E-Commerce & Commercial FZ B2C Disclosures',
    titleAr: 'بيانات التجارة الإلكترونية الإلزامية بالعربية (المنتج، المنشأ، السعر، الاسترجاع)',
    titleEn: 'Article 40 E-Commerce Mandatory Arabic Product, Origin, Tax-Inclusive & Return Disclosures',
    summaryAr:
      'التزام المتاجر والمنصات الرقمية ومزوّدي المناطق الحرة للافراد بعرض بيانات المُنتِج والمستورد والمنشأ والسعر شاملاً الضريبة وتحذيرات السلامة وشروط الاسترجاع بالعربية.',
    summaryEn:
      'Online storefronts, platforms, and free-zone B2C sellers must publish Arabic producer/importer info, origin, tax-inclusive AED pricing, safety notices, and clear return terms.',
  },
  {
    id: 'CNS-CTRL-07',
    weight: 5,
    severity: 'low',
    legalRef: 'FDL 5/2023 & DET/DED Enforcement — Valid 100 UAE TRN & 15-Working-Day Grievance SLA',
    titleAr: 'صلاحية الرقم الضريبي الإماراتي (100 ذو 15 خانة) وجاهزية التظلمات (15 يوم عمل)',
    titleEn: 'Valid 15-Digit UAE TRN (100 prefix) & 15-Working-Day Complaint/Grievance Readiness',
    summaryAr:
      'التحقق من صيغة الرقم الضريبي للمزوّد (15 رقماً يبدأ بـ 100) وتوثيق مسار معالجة شكاوى المستهلك والتظلمات أمام السلطات الاقتصادية خلال 15 يوم عمل.',
    summaryEn:
      'Validates UAE Federal Tax Authority TRN format (15 digits starting with 100) and maintains complaint resolution and 15-working-day regulatory grievance procedures.',
  },
] as const;
