# سجل التغييرات — ConsumerAE (مدقق حماية المستهلك الإماراتي)

## [0.5.0] — 2026-11-25
- ترقية الحزمة والكتالوج ومواصفات الاختبار إلى `0.5.0`، وإضافة رخصة [`LICENSE`](LICENSE) (`MIT`) وسير عمل [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (`Node 22 + typecheck + vitest + vite build`).
- نسخ لقطات Chrome الست الحية (`1280×800` و`390×844` بوضعَي `AR RTL Alabaster Consumer` و`EN LTR Obsidian Watch`) إلى `docs/screenshots/` وتضمينها في [`README.md`](README.md).

## [0.4.0] — 2026-11-25
### المضاف (المرحلة 4 — اختبارات `Playwright Chrome E2E` والمراجعة البصرية وحزمة النشر `$0`)
- ترقية الحزمة إلى `0.4.0` وإضافة [`playwright.config.ts`](playwright.config.ts) (`:4252`, `/usr/bin/google-chrome`) واختبارات [`tests/e2e/consumerae.spec.ts`](tests/e2e/consumerae.spec.ts) لسطح المكتب (`1280×800`) والجوال (`390×844`) في وضعَي `AR RTL Alabaster Consumer` و`EN LTR Obsidian Watch` مع التحقق من خلوّ التجاوز الأفقي (`scrollWidth <= innerWidth`) وإعادة تصحيح السيناريو الثالث إلى `100/100` وختم `CNS-2026-0001` وتنزيل `UTF-8 BOM CSV` ومسار `/r/CNS-2026-0001` (`Views: 1 -> 2`).
- المراجعة البصرية المباشرة لـ `6` لقطات شاشة Chrome حية والتأكد من وضوح الرسوم المتجهة والمحاذاة الثنائية الاتجاه وضبط عرض منتقي السيناريوهات على الجوال.
- إعداد حزمة النشر الصفرية `$0` ([`wrangler.jsonc`](wrangler.jsonc)، [`Dockerfile`](Dockerfile)، [`docker-compose.yml`](docker-compose.yml)، [`.dockerignore`](.dockerignore)، ملفات [`deploy/`](deploy/.env.example)، [`launch/DEPLOY-AND-SHARE.md`](launch/DEPLOY-AND-SHARE.md)، و[`README.md`](README.md)) مع اجتياز `bash -n deploy/*.sh` وبوابة `EXPORT_CLEAN_OK`.

## [0.3.0] — 2026-11-25
### المضاف (المرحلة 3 — واجهة الويب التفاعلية الثنائية الاتجاه AR RTL / EN LTR)
- ترقية الحزمة إلى `0.3.0` وإضافة واجهة `React 19.2 + Tailwind CSS v4 + Vite 8` عبر [vite.config.ts](vite.config.ts) (`:4252` نحو `:4251`) و[index.html](index.html) و[favicon.svg](public/favicon.svg) و[src/index.css](src/index.css) و[src/main.tsx](src/main.tsx) بمظهرَي `Alabaster Consumer / Obsidian Watch` وبدون شريط رأسي عائم (`no sticky top-0`).
- بناء مكتبات الواجهة [`src/lib/basePath.ts`](src/lib/basePath.ts) و[`src/lib/i18n.ts`](src/lib/i18n.ts) و[`src/lib/api.ts`](src/lib/api.ts) بالعمل المزدوج التلقائي (`SQLite WAL` عند توفر الخادم أو `$0 localStorage` دون خادم) ودعم النشر تحت المسار الفرعي `/consumerae`.
- بناء المكونات الخمسة [`ConsumerSlaAndPenaltySvg.tsx`](src/components/ConsumerSlaAndPenaltySvg.tsx) (مخطط مُهَل `7/14/30 يوماً` والبديل المؤقت وسلم `100k–250k–1M/2M` وإغلاق `24h–90d`)، [`ComplianceAndExposurePanel.tsx`](src/components/ComplianceAndExposurePanel.tsx) (فحص الفاتورة العربية وشروط المادة `34` والعيوب وقطع الغيار وفرق السعر و`100 TRN`)، [`ControlsAndFindingsPanel.tsx`](src/components/ControlsAndFindingsPanel.tsx)، [`ReceiptCsvAuditPanel.tsx`](src/components/ReceiptCsvAuditPanel.tsx)، و[`DossierVaultAndPrint.tsx`](src/components/DossierVaultAndPrint.tsx) مع [`src/App.tsx`](src/App.tsx) وعارض التقارير المختومة `/r/:slugOrCode`.

## [0.2.0] — 2026-11-25
### المضاف (المرحلة 2 — قاعدة `node:sqlite WAL` وخادم `HTTP/API` وباني الملخصات)
- ترقية الإصدار إلى `0.2.0` (`"dependencies": {}` وسكربت `"start": "node --no-warnings server/index.mjs"`) وإضافة باني الملخصات ثنائي اللغة [`briefBuilder.ts`](src/core/briefBuilder.ts) (`buildConsumerBriefMarkdown`).
- بناء طبقة التخزين [`server/db.mjs`](server/db.mjs) بوضع `node:sqlite WAL` مع جداول `profiles`, `dossier_counters` (ترقيم ذري `CNS-YYYY-0001`), `assessments`, و`public_report_views`.
- بناء خادم Node.js بدون تبعيات [`server/app.mjs`](server/app.mjs), [`server/index.mjs`](server/index.mjs) (`:4251`, `BASE_PATH=/consumerae`), و[`server/app.d.mts`](server/app.d.mts) بجميع مسارات التقييم والتدقيق والتصدير (`UTF-8 BOM + CRLF + CWE-1236`) والملخصات والإقفال (`409`) والتقارير العامة `/api/public/reports/:slugOrCode` وحواجز `413`/`429` وحقن `window.__CONSUMERAE_BASE__`.

## [0.1.0] — 2026-11-25
### المضاف (المرحلة 1 — النواة الصفرية المتخصصة)
- تأسيس [`projects/consumerae/`](package.json) بحزمة صفرية التبعيات التشغيلية (`"dependencies": {}`, رخصة `MIT`, Node 22 + TypeScript 5.9 + Vitest 5.1) وتوثيق المواصفة القانونية والمعمارية [`research/44-consumerae-spec-and-architecture.md`](../../research/44-consumerae-spec-and-architecture.md).
- بناء النواة الصفرية (`src/core/*`) استناداً إلى **القانون الاتحادي رقم `(15)` لسنة `2020`** و**المرسوم بقانون `(5)` لسنة `2023`** و**قرار مجلس الوزراء `(66)` لسنة `2023`**:
  - مدقق الفاتورة التفصيلية بالعربية (`100,000 د.إ`), وكاشف بطلان شروط الإعفاء/الاسترجاع ثنائي اللغة بموجب **المادة `34`** (مع التفريق بين القيود الاستثنائية المشروعة وإسقاط ضمان العيوب أو التعديل المنفرد).
  - حاسبة مُهَل الـ **`30 يوماً`** للعيوب بدون ضمان/الضمان المتعارض (المادة `25`) وحقوق اختيار الإصلاح/الاستبدال/الاسترداد وتكرار العيب مرتين فأكثر (المادة `27`).
  - مقيّم مُهَل قطع الغيار بموجب **المادة `14`** (`7 أيام` دورية / `14 يوماً` غير دورية / `30 يوماً` استيراد موازٍ) والسلعة البديلة المجانية عند تجاوز صيانة الضمان **`7 أيام`**، وحق فرق السعر عند التخفيض خلال **`7 أيام`** والمطالبة حتى **`30 يوماً`**.
  - التحقق من إفصاحات التجارة الإلكترونية بالعربية (**المادة `40`**)، والنطاق الإماراتي (حماية المشتري المؤسسي النهائي مقابل استثناء البيع التجاري بالجملة لإعادة البيع فقط)، والتحقق من `TRN` (`100` من `15` خانة).
  - سُلّم الجزاءات (`100k د.إ` -> `250k د.إ` -> مضاعفة `2x` حتى سقف `1,000,000 د.إ` إدارياً / `2,000,000 د.إ` جنائياً ومخاطر الإغلاق `24 ساعة – 90 يوماً` وإلغاء الرخصة)، ومدقق الدفعات `CSV CWE-1236 UTF-8 BOM + CRLF`، وبصمة `SHA-256`.
