/**
 * Customer-facing portal calculator.
 *
 * IMPORTANT:
 * - Manufacturer/system names stay internal and are never required by the UI.
 * - Geometry/load checks are a conservative PRE-CHECK, not a fabrication certificate.
 * - Commercial coefficients are business settings, not manufacturer prices.
 * - Final BOM, glass composition, wind/static calculation and hardware selection
 * must be confirmed by the fabricator after measurement.
 *
 * BUSINESS RULE (recommendation engine):
 * - Among technically valid production routes for a given customer layout, the
 * engine picks the cheapest one that still passes the pre-check. Manufacturer
 * choice is a fabrication decision, not a lever to inflate the customer price.
 * - Structural safety is never negotiable: a layout whose load ratio exceeds
 * SAFE_LOAD_RATIO is never recommended, no matter how attractive its price
 * or opening size look.
 * - Among the layouts that stay in the safe zone, the engine recommends the
 * one that opens the largest share of the opening (openRatio) — a real,
 * honest customer benefit (more usable space, better view). When several
 * safe layouts open an equally large share, the highest-priced one is
 * preferred, because it is also the most profitable for the business and
 * there is no customer downside to breaking the tie that way.
 */

const PORTAL_TYPES = Object.freeze({
 HS: {
 label: "HS-портал",
 shortLabel: "Раздвижной",
 description: "Подъёмно-раздвижная система для больших проёмов и ежедневного выхода на террасу.",
 },
 FS: {
 label: "FS-портал",
 shortLabel: "FS-портал",
 description: "Складные створки освобождают большую часть проёма между домом и террасой.",
 },
});

/**
 * Glass package (стеклопакет): what the panes themselves are made of. This
 * is independent of THERMAL_CONTOURS below — that's the profile/system
 * tier (heated vs unheated space), this is the glass composition (safety,
 * acoustics, solar/thermal coating). Both affect glassLayersMm-driven
 * weight the same way the old two-tier "comfort/energy" package did; this
 * is that same mechanism split into three real, named tiers instead of two.
 */
const GLAZING_PACKAGES = Object.freeze({
 tempered: {
 label: "Закалённое",
 customerText: "Базовая безопасность — закалённое стекло по периметру.",
 glassLayersMm: [6, 4],
 fillThicknessMm: 34,
 priceFactor: 1.0,
 },
 triplex: {
 label: "Триплекс",
 customerText: "Защита и акустика — многослойное безопасное стекло.",
 glassLayersMm: [6, 4, 4],
 fillThicknessMm: 40,
 priceFactor: 1.14,
 },
 multifunctional: {
 label: "Мультифункция",
 customerText: "Тепло зимой, меньше нагрева летом — энергосберегающее покрытие.",
 glassLayersMm: [6, 6, 4],
 fillThicknessMm: 44,
 priceFactor: 1.26,
 },
});

/**
 * Thermal contour (тепловой контур): whether the profile system is built
 * for a heated, year-round space or an unheated seasonal one. This is a
 * commercial/comfort choice layered on top of whichever glass package is
 * selected — same mechanism as FRAME_COLORS (a price multiplier plus
 * customer-facing copy), not a new engineering gate. We don't have sourced
 * geometry/load data for a distinct "cold" variant of each INTERNAL_FRAMEWORKS
 * entry, so — consistent with this file's rule of never inventing
 * engineering facts we can't back — it never changes which production
 * routes are technically valid, only the price and the note shown.
 */
const THERMAL_CONTOURS = Object.freeze({
 warm: {
 label: "Теплое остекление",
 customerText: "Для жилого дома и круглогодичного использования — профиль с терморазрывом и контур с терморазрывом.",
 priceFactor: 1.08,
 },
 cold: {
 label: "Холодное остекление",
 customerText: "Для террас, веранд и сезонных помещений, где не требуется контур с терморазрывом.",
 priceFactor: 0.94,
 },
});

const FRAME_COLORS = Object.freeze({
 white: {
 label: "Белый",
 customerText: "RAL 9016, классическое решение.",
 hex: "#f5f6f2",
 priceFactor: 1.0,
 },
 anthracite: {
 label: "Антрацит",
 customerText: "RAL 7016, самый популярный цвет для панорамных фасадов.",
 hex: "#2c302e",
 priceFactor: 1.04,
 },
 ral: {
 label: "Индивидуальный RAL",
 customerText: "Любой цвет палитры RAL под фасад или интерьер.",
 hex: "#6b4a33",
 priceFactor: 1.09,
 },
});

const ADDONS = Object.freeze({
 mosquitoNet: {
 id: "mosquitoNet",
 label: "Москитная сетка",
 customerText: "Сетка на весь проём: раздвижная для HS, складная плиссе для FS.",
 appliesTo: ["HS", "FS"],
 flatPrice: 12000,
 },
 lowThreshold: {
 id: "lowThreshold",
 label: "Низкий порог",
 customerText: "Безбарьерный переход на террасу, без порога-ступени.",
 appliesTo: ["HS", "FS"],
 flatPrice: 15000,
 },
});

const SAFE_LOAD_RATIO = 0.8;

const CUSTOMER_PRESETS = Object.freeze({
 HS: [
 {
 id: "hs-panorama",
 count: 2,
 title: "Панорама",
 subtitle: "Максимум цельного стекла",
 openRatio: 0.5,
 layoutFactor: 1.0,
 movingLeaves: 1,
 premiumRank: 1,
 },
 {
 id: "hs-wide",
 count: 3,
 title: "Широкий проход",
 subtitle: "Больше открытого пространства",
 openRatio: 2 / 3,
 layoutFactor: 1.26,
 movingLeaves: 2,
 premiumRank: 2,
 },
 {
 id: "hs-center",
 count: 4,
 title: "Центральный проход",
 subtitle: "Симметричное открывание",
 openRatio: 0.5,
 layoutFactor: 1.48,
 movingLeaves: 2,
 premiumRank: 3,
 },
 {
 id: "hs-grand",
 count: 6,
 title: "Премиум панорама",
 subtitle: "Для больших фасадов",
 openRatio: 2 / 3,
 layoutFactor: 1.92,
 movingLeaves: 4,
 premiumRank: 4,
 },
 ],
 FS: [
 {
 id: "fs-compact",
 count: 3,
 title: "Компактная",
 subtitle: "Три складные секции",
 // Folding leaves stack near one jamb; the stack pocket takes roughly
 // one leaf width, so the clear opening is approximately (count-1)/count
 // of the full width.
 openRatio: 2 / 3,
 layoutFactor: 1.18,
 movingLeaves: 3,
 premiumRank: 1,
 },
 {
 id: "fs-comfort",
 count: 4,
 title: "Комфорт",
 subtitle: "Удобное деление проёма",
 openRatio: 3 / 4,
 layoutFactor: 1.4,
 movingLeaves: 4,
 premiumRank: 2,
 },
 {
 id: "fs-panorama",
 count: 6,
 title: "Панорама",
 subtitle: "Больше секций — легче створки",
 openRatio: 5 / 6,
 layoutFactor: 1.82,
 movingLeaves: 6,
 premiumRank: 3,
 },
 {
 id: "fs-max",
 count: 7,
 title: "Максимум открытия",
 subtitle: "Премиальная складная стена",
 openRatio: 6 / 7,
 layoutFactor: 2.08,
 movingLeaves: 7,
 premiumRank: 4,
 },
 ],
});

/**
 * Internal production frameworks.
 * Customer UI must not render title/brand/system identifiers.
 */
const INTERNAL_FRAMEWORKS = Object.freeze([
 {
 id: "alumark_s158_roto_lift",
 type: "HS",
 internalTitle: "ALUMARK S158 + Roto Patio Lift",
 supportedCounts: [2, 3, 4, 6],
 minLeafWidthMm: 720,
 maxLeafWidthMm: 3000,
 maxLeafHeightMm: 3100,
 maxLeafWeightKg: 400,
 maxFillThicknessMm: 50,
 maxFrameWidthMm: 18000,
 frameMassReserveRatio: 0.14,
 salesIndex: 1.05,
 },
 {
 id: "alutech_alt_sl160",
 type: "HS",
 internalTitle: "ALUTECH ALT SL160",
 supportedCounts: [2, 3, 4, 6],
 minLeafWidthMm: 720,
 maxLeafWidthMm: 3235,
 maxLeafHeightMm: 3385,
 maxLeafWeightKg: 440,
 maxFillThicknessMm: 54,
 maxFrameWidthMm: 19500,
 frameMassReserveRatio: 0.14,
 salesIndex: 1.12,
 },
 {
 id: "alumark_s70_roto_fold",
 type: "FS",
 internalTitle: "ALUMARK S70 + Roto Patio Fold",
 supportedCounts: [3, 4, 6, 7],
 minLeafWidthMm: 480,
 maxLeafWidthMm: 930,
 maxLeafHeightMm: 2700,
 maxLeafWeightKg: 100,
 maxFillThicknessMm: 44,
 maxFrameWidthMm: 6000,
 frameMassReserveRatio: 0.18,
 salesIndex: 1.04,
 },
 {
 id: "alutech_alt_bf73",
 type: "FS",
 internalTitle: "ALUTECH ALT BF73",
 supportedCounts: [3, 4, 6, 7],
 minLeafWidthMm: 480,
 maxLeafWidthMm: 1200,
 maxLeafHeightMm: 3000,
 maxLeafWeightKg: 120,
 maxFillThicknessMm: 44,
 maxFrameWidthMm: 8400,
 frameMassReserveRatio: 0.18,
 salesIndex: 1.14,
 },
]);

const COMMERCIAL = Object.freeze({
 defaultWidthMm: 3000,
 defaultHeightMm: 2300,
 defaultType: "HS",
 defaultGlazing: "multifunctional",
 defaultThermalContour: "warm",
 defaultColor: "white",
 areaRate: { HS: 6950, FS: 4000 },
 marginGuardFactor: 1.18,
 hardwareUnit: { HS: 39500, FS: 22000 },
 highLoadReserve: { HS: 65000, FS: 30000 },
 complexProjectReserve: { HS: 25000, FS: 35000 },
});

function formatMoney(value) {
 if (!Number.isFinite(value)) return "—";
 return new Intl.NumberFormat("ru-RU", {
 style: "currency",
 currency: "RUB",
 maximumFractionDigits: 0,
 }).format(value);
}

function roundPrice(value) {
 return Math.ceil(value / 1000) * 1000;
}

function glassMassKgPerM2(glazing) {
 const totalGlassThickness = glazing.glassLayersMm.reduce(
 (sum, thickness) => sum + thickness,
 0
 );

 // Approximate physical mass of soda-lime glass: ~2.5 kg / mm / m².
 return totalGlassThickness * 2.5;
}

function customerError(message) {
 return {
 status: "error",
 code: "INDIVIDUAL_PROJECT",
 message,
 showLeadCta: true,
 };
}

function validateInput(type, width, height, glazingId) {
 if (!PORTAL_TYPES[type]) {
 return customerError("Выберите тип открывания.");
 }

 if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
 return {
 status: "error",
 code: "EMPTY_FIELDS",
 message: "Укажите ширину и высоту проёма.",
 showLeadCta: false,
 };
 }

 if (!GLAZING_PACKAGES[glazingId]) {
 return {
 status: "error",
 code: "GLAZING_REQUIRED",
 message: "Выберите вариант стеклопакета.",
 showLeadCta: false,
 };
 }

 // Business scope: the calculator is for full-height portals, not small windows.
 if (width < 1400 || height < 1800) {
 return customerError(
 "Для такого формата лучше сделать индивидуальный подбор — оставьте заявку."
 );
 }

 return null;
}

function estimateLeafWeightKg({
 leafWidthMm,
 heightMm,
 glazing,
 framework,
}) {
 const leafAreaM2 = (leafWidthMm * heightMm) / 1_000_000;
 const glassKgM2 = glassMassKgPerM2(glazing);
 const glassWeightKg = leafAreaM2 * glassKgM2;

 // Conservative reserve for aluminium perimeter, hardware and seals.
 const frameHardwareReserveKg = Math.max(
 18,
 glassWeightKg * framework.frameMassReserveRatio
 );

 return {
 leafAreaM2,
 glassKgM2,
 glassWeightKg,
 frameHardwareReserveKg,
 estimatedLeafWeightKg: glassWeightKg + frameHardwareReserveKg,
 };
}

function evaluateFramework({
 type,
 width,
 height,
 glazing,
 colorFactor,
 thermalFactor,
 preset,
 framework,
}) {
 if (framework.type !== type) return null;
 if (!framework.supportedCounts.includes(preset.count)) return null;
 if (width > framework.maxFrameWidthMm) return null;
 if (height > framework.maxLeafHeightMm) return null;
 if (glazing.fillThicknessMm > framework.maxFillThicknessMm) return null;

 const leafWidthMm = width / preset.count;

 if (
 leafWidthMm < framework.minLeafWidthMm ||
 leafWidthMm > framework.maxLeafWidthMm
 ) {
 return null;
 }

 const mass = estimateLeafWeightKg({
 leafWidthMm,
 heightMm: height,
 glazing,
 framework,
 });

 if (mass.estimatedLeafWeightKg > framework.maxLeafWeightKg) {
 return null;
 }

 const totalAreaM2 = (width * height) / 1_000_000;
 const loadRatio =
 mass.estimatedLeafWeightKg / framework.maxLeafWeightKg;

 let commercialExtra = preset.movingLeaves * COMMERCIAL.hardwareUnit[type];

 if (loadRatio >= 0.75) {
 commercialExtra += COMMERCIAL.highLoadReserve[type];
 }

 if (preset.count >= 6) {
 commercialExtra += COMMERCIAL.complexProjectReserve[type];
 }

 const rawPrice =
 totalAreaM2 *
 COMMERCIAL.areaRate[type] *
 glazing.priceFactor *
 colorFactor *
 thermalFactor *
 preset.layoutFactor *
 framework.salesIndex +
 commercialExtra;

 const price = roundPrice(rawPrice * COMMERCIAL.marginGuardFactor);

 return {
 frameworkId: framework.id,
 internalTitle: framework.internalTitle,
 price,
 loadRatio,
 leafWidthMm,
 leafAreaM2: mass.leafAreaM2,
 estimatedLeafWeightKg: mass.estimatedLeafWeightKg,
 glassKgM2: mass.glassKgM2,
 commercialExtra,
 };
}

function evaluatePreset({
 type,
 width,
 height,
 glazing,
 colorFactor,
 thermalFactor,
 preset,
}) {
 const candidates = INTERNAL_FRAMEWORKS.map((framework) =>
 evaluateFramework({
 type,
 width,
 height,
 glazing,
 colorFactor,
 thermalFactor,
 preset,
 framework,
 })
 ).filter(Boolean);

 if (candidates.length === 0) {
 return {
 ...preset,
 available: false,
 price: null,
 internal: null,
 };
 }

 // Business rule: among technically valid production routes, use the
 // cheapest one that still passes the pre-check. The manufacturer/system
 // choice is a fabrication decision — it must never be used to inflate the
 // price the customer sees, so we never pick the most expensive route here.
 const sortedByPrice = [...candidates].sort((a, b) => a.price - b.price);
 const selected = sortedByPrice[0];

 const approxOpeningWidthMm = Math.round(width * preset.openRatio);

 const customerNote =
 selected.loadRatio >= 0.75
 ? "Для выбранных размеров потребуется усиленная комплектация. Точные параметры подтвердит инженер после замера."
 : "Предварительная конфигурация проходит расчётные ограничения. Точные параметры подтвердит инженер после замера.";

 return {
 ...preset,
 available: true,
 price: selected.price,
 leafWidthMm: Math.round(selected.leafWidthMm),
 estimatedLeafWeightKg: Math.round(selected.estimatedLeafWeightKg),
 approxOpeningWidthMm,
 openingLabel: `≈ ${Math.round(preset.openRatio * 100)}% проёма`,
 customerNote,
 isRecommended: false,
 internal: {
 productionSystem: selected.frameworkId,
 productionTitle: selected.internalTitle,
 loadRatio: Number(selected.loadRatio.toFixed(3)),
 leafAreaM2: Number(selected.leafAreaM2.toFixed(2)),
 glassKgM2: selected.glassKgM2,
 alternatives: sortedByPrice.map((candidate) => ({
 frameworkId: candidate.frameworkId,
 price: candidate.price,
 loadRatio: Number(candidate.loadRatio.toFixed(3)),
 })),
 },
 };
}

/**
 * Business rule: structural safety first, then the biggest honest customer
 * benefit, then business margin as the tiebreaker.
 *
 * 1. Only layouts whose load ratio stays within SAFE_LOAD_RATIO are eligible
 * to be recommended — a layout that fails the engineering pre-check is
 * never recommended regardless of price or opening size.
 * 2. Among the safe layouts, recommend the one that opens the largest share
 * of the opening (openRatio) — more usable space and a better view are a
 * real benefit the customer sees immediately, not a manufactured excuse.
 * 3. If several safe layouts tie on opening share, prefer the highest price:
 * it is the most profitable outcome for the business and, since the
 * customer already gets the same best-in-class opening, there is no
 * honesty cost to preferring it.
 * 4. If no layout is safe, fall back to the lowest load ratio available —
 * engineering safety still outranks everything else.
 */
function pickRecommendedOption(availableOptions) {
 const safeOptions = availableOptions.filter(
 (option) => option.internal.loadRatio <= SAFE_LOAD_RATIO
 );

 if (safeOptions.length > 0) {
 const [best] = [...safeOptions].sort((a, b) => {
 if (a.openRatio !== b.openRatio) return b.openRatio - a.openRatio;
 if (a.count !== b.count) return a.count - b.count;
 if (a.internal.loadRatio !== b.internal.loadRatio) return a.internal.loadRatio - b.internal.loadRatio;
 return a.price - b.price;
 });
 return { option: best, isSafePick: true };
 }

 const [safestAvailable] = [...availableOptions].sort(
 (a, b) => a.internal.loadRatio - b.internal.loadRatio
 );
 return { option: safestAvailable, isSafePick: false };
}

function computeAddonsTotal(type, addonIds) {
 const uniqueIds = [...new Set(addonIds)];
 let total = 0;
 const applied = [];

 for (const id of uniqueIds) {
 const addon = ADDONS[id];
 if (!addon || !addon.appliesTo.includes(type)) continue;
 total += addon.flatPrice;
 applied.push(id);
 }

 return { total, applied };
}

function calculatePortal({
 type = COMMERCIAL.defaultType,
 width = COMMERCIAL.defaultWidthMm,
 height = COMMERCIAL.defaultHeightMm,
 glazing = COMMERCIAL.defaultGlazing,
 thermalContour = COMMERCIAL.defaultThermalContour,
 color = COMMERCIAL.defaultColor,
 addons = [],
} = {}) {
 const normalizedWidth = Number(width);
 const normalizedHeight = Number(height);
 const validationError = validateInput(
 type,
 normalizedWidth,
 normalizedHeight,
 glazing
 );

 if (validationError) return validationError;

 const glazingPackage = GLAZING_PACKAGES[glazing];
 const colorPackage = FRAME_COLORS[color] ?? FRAME_COLORS[COMMERCIAL.defaultColor];
 const thermalPackage =
 THERMAL_CONTOURS[thermalContour] ??
 THERMAL_CONTOURS[COMMERCIAL.defaultThermalContour];
 const presets = CUSTOMER_PRESETS[type];

 const options = presets.map((preset) =>
 evaluatePreset({
 type,
 width: normalizedWidth,
 height: normalizedHeight,
 glazing: glazingPackage,
 colorFactor: colorPackage.priceFactor,
 thermalFactor: thermalPackage.priceFactor,
 preset,
 })
 );

 const availableOptions = options.filter((option) => option.available);

 if (availableOptions.length === 0) {
 return customerError(
 "Для такого проёма нужен индивидуальный проект. Оставьте заявку — инженер подберёт решение."
 );
 }

 const { total: addonsTotal, applied: appliedAddons } = computeAddonsTotal(
 type,
 addons
 );

 for (const option of options) {
 if (!option.available) continue;
 option.basePrice = option.price;
 option.addonsTotal = addonsTotal;
 option.price = option.basePrice + addonsTotal;
 }

 const { option: recommended, isSafePick } = pickRecommendedOption(
 availableOptions
 );

 for (const option of options) {
 option.isRecommended =
 isSafePick && option.available && option.id === recommended.id;
 }

 return {
 status: "success",
 type,
 width: normalizedWidth,
 height: normalizedHeight,
 glazing,
 color: colorPackage === FRAME_COLORS[color] ? color : COMMERCIAL.defaultColor,
 thermalContour:
 thermalPackage === THERMAL_CONTOURS[thermalContour]
 ? thermalContour
 : COMMERCIAL.defaultThermalContour,
 addons: appliedAddons,
 addonsTotal,
 recommendationIsSafe: isSafePick,
 totalAreaM2: Number(
 ((normalizedWidth * normalizedHeight) / 1_000_000).toFixed(2)
 ),
 recommendedId: recommended.id,
 options,
 };
}

// Backward-compatible wrapper for existing integrations/tests.
function calculateHsPortal(
 width,
 height,
 glassType = "warm"
) {
 return calculatePortal({
 type: "HS",
 width,
 height,
 glazing: glassType === "cold" ? "tempered" : "multifunctional",
 });
}
/**
 * Shared SVG schematic renderer for HS (sliding) and FS (folding) portals.
 * Used by the calculator preview and by project/gallery thumbnails so every
 * page draws the same visual language for a given sash count.
 *
 * A page can render many of these at once (an 8-card gallery plus the
 * calculator preview, all on the homepage at the same time), so the shared
 * gradient/marker <defs> are injected into the document exactly once and
 * referenced by every instance — rather than each SVG carrying its own
 * copy of the same id, which would leave the DOM with duplicate ids.
 */

let defsInjected = false;

function ensurePortalDefs() {
 if (defsInjected || document.getElementById("portalSvgDefs")) {
 defsInjected = true;
 return;
 }

 const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
 sprite.setAttribute("id", "portalSvgDefs");
 sprite.setAttribute("aria-hidden", "true");
 sprite.style.position = "absolute";
 sprite.style.width = "0";
 sprite.style.height = "0";
 sprite.style.overflow = "hidden";
 sprite.innerHTML = `
 <defs>
 <linearGradient id="glassGradient" x1="0" x2="1" y1="0" y2="1">
 <stop offset="0%" stop-color="#f8fbfc"/>
 <stop offset="100%" stop-color="#dfe9e7"/>
 </linearGradient>
 <marker id="arrowHead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
 <path d="M0,0 L0,6 L6,3 z" class="portal-svg__arrow-head"/>
 </marker>
 <marker id="foldArrowHead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
 <path d="M0,0 L0,6 L6,3 z" class="portal-svg__arrow-head"/>
 </marker>
 </defs>
 `;

 document.body.prepend(sprite);
 defsInjected = true;
}

function hsMotion(count, index) {
 if (count === 2) {
 return index === 1 ? -1 : 0;
 }

 if (count === 3) {
 return index > 0 ? -1 : 0;
 }

 if (count === 4) {
 if (index === 1) return -1;
 if (index === 2) return 1;
 return 0;
 }

 if (count === 6) {
 if (index === 1 || index === 2) return -1;
 if (index === 3 || index === 4) return 1;
 return 0;
 }

 return 0;
}

function buildHsSvg(count) {
 ensurePortalDefs();

 const svgWidth = 720;
 const frameX = 78;
 const frameY = 58;
 const frameWidth = 560;
 const frameHeight = 206;
 const gap = 5;
 const innerWidth = frameWidth - 20;
 const paneWidth = (innerWidth - gap * (count - 1)) / count;
 const paneTop = frameY + 10;
 const paneHeight = frameHeight - 20;

 let panes = "";
 let arrows = "";

 for (let index = 0; index < count; index += 1) {
 const x = frameX + 10 + index * (paneWidth + gap);
 const motion = hsMotion(count, index);
 const fixed = motion === 0;

 panes += `
 <rect
 x="${x.toFixed(1)}"
 y="${paneTop}"
 width="${paneWidth.toFixed(1)}"
 height="${paneHeight}"
 rx="2"
 class="portal-svg__pane ${fixed ? "portal-svg__pane--fixed" : ""}"
 />
 `;

 if (motion !== 0) {
 const center = x + paneWidth / 2;
 const x1 = motion < 0 ? center + 24 : center - 24;
 const x2 = motion < 0 ? center - 24 : center + 24;

 arrows += `
 <line
 x1="${x1.toFixed(1)}"
 y1="${(frameY + frameHeight / 2).toFixed(1)}"
 x2="${x2.toFixed(1)}"
 y2="${(frameY + frameHeight / 2).toFixed(1)}"
 class="portal-svg__arrow"
 marker-end="url(#arrowHead)"
 />
 `;
 }
 }

 return `
 <svg viewBox="0 0 720 330" class="portal-svg" role="img" aria-label="Схема раздвижного портала">
 <line x1="${frameX}" y1="32" x2="${frameX + frameWidth}" y2="32" class="portal-svg__dim"/>
 <line x1="${frameX}" y1="24" x2="${frameX}" y2="40" class="portal-svg__dim-tick"/>
 <line x1="${frameX + frameWidth}" y1="24" x2="${frameX + frameWidth}" y2="40" class="portal-svg__dim-tick"/>
 <text x="${frameX + frameWidth / 2}" y="26" text-anchor="middle" class="portal-svg__dim-text">Ширина проёма</text>

 <line x1="42" y1="${frameY}" x2="42" y2="${frameY + frameHeight}" class="portal-svg__dim"/>
 <line x1="34" y1="${frameY}" x2="50" y2="${frameY}" class="portal-svg__dim-tick"/>
 <line x1="34" y1="${frameY + frameHeight}" x2="50" y2="${frameY + frameHeight}" class="portal-svg__dim-tick"/>
 <text x="24" y="${frameY + frameHeight / 2}" text-anchor="middle" class="portal-svg__dim-text" transform="rotate(-90 24 ${frameY + frameHeight / 2})">Высота</text>

 <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" rx="2" class="portal-svg__frame"/>
 ${panes}
 ${arrows}
 <line x1="${frameX + 8}" y1="${frameY + frameHeight + 10}" x2="${frameX + frameWidth - 8}" y2="${frameY + frameHeight + 10}" class="portal-svg__threshold"/>
 </svg>
 `;
}

function buildFsSvg(count) {
 ensurePortalDefs();

 const frameX = 78;
 const frameY = 58;
 const frameWidth = 560;
 const frameHeight = 196;
 const gap = 4;
 const innerWidth = frameWidth - 20;
 const paneWidth = (innerWidth - gap * (count - 1)) / count;

 let panes = "";
 const foldPoints = [];

 for (let index = 0; index < count; index += 1) {
 const x = frameX + 10 + index * (paneWidth + gap);

 panes += `
 <rect
 x="${x.toFixed(1)}"
 y="${frameY + 10}"
 width="${paneWidth.toFixed(1)}"
 height="${frameHeight - 20}"
 rx="2"
 class="portal-svg__pane portal-svg__pane--fold"
 />
 `;

 const jointX = x + paneWidth / 2;
 const jointY = index % 2 === 0 ? 284 : 262;
 foldPoints.push(`${jointX.toFixed(1)},${jointY}`);
 }

 return `
 <svg viewBox="0 0 720 330" class="portal-svg" role="img" aria-label="Схема складного портала">
 <line x1="${frameX}" y1="32" x2="${frameX + frameWidth}" y2="32" class="portal-svg__dim"/>
 <line x1="${frameX}" y1="24" x2="${frameX}" y2="40" class="portal-svg__dim-tick"/>
 <line x1="${frameX + frameWidth}" y1="24" x2="${frameX + frameWidth}" y2="40" class="portal-svg__dim-tick"/>
 <text x="${frameX + frameWidth / 2}" y="26" text-anchor="middle" class="portal-svg__dim-text">Ширина проёма</text>

 <line x1="42" y1="${frameY}" x2="42" y2="${frameY + frameHeight}" class="portal-svg__dim"/>
 <line x1="34" y1="${frameY}" x2="50" y2="${frameY}" class="portal-svg__dim-tick"/>
 <line x1="34" y1="${frameY + frameHeight}" x2="50" y2="${frameY + frameHeight}" class="portal-svg__dim-tick"/>
 <text x="24" y="${frameY + frameHeight / 2}" text-anchor="middle" class="portal-svg__dim-text" transform="rotate(-90 24 ${frameY + frameHeight / 2})">Высота</text>

 <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" rx="2" class="portal-svg__frame"/>
 ${panes}
 <polyline points="${foldPoints.join(" ")}" class="portal-svg__fold-line"/>
 <line x1="${frameX + frameWidth - 160}" y1="${frameY + frameHeight + 24}" x2="${frameX + frameWidth - 24}" y2="${frameY + frameHeight + 24}" class="portal-svg__arrow" marker-end="url(#foldArrowHead)"/>
 </svg>
 `;
}

function buildPortalSvg(type, count) {
 return type === "HS" ? buildHsSvg(count) : buildFsSvg(count);
}
const els = {
 width: document.querySelector("#widthInput"),
 height: document.querySelector("#heightInput"),
 typeCards: [...document.querySelectorAll("[data-portal-type]")],
 thermalCards: [...document.querySelectorAll("[data-thermal]")],
 glazingCards: [...document.querySelectorAll("[data-glazing]")],
 colorSwatches: [...document.querySelectorAll("[data-color]")],
 addonRows: [...document.querySelectorAll("[data-addon]")],
 errorBox: document.querySelector("#errorBox"),
 errorMessage: document.querySelector("#errorMessage"),
 errorLeadButton: document.querySelector("#errorLeadButton"),
 sashHint: document.querySelector("#sashHint"),
 sashGrid: document.querySelector("#sashGrid"),
 description: document.querySelector("#optionDescription"),
 portalPreview: document.querySelector("#portalPreview"),
 summaryType: document.querySelector("#summaryType"),
 summarySize: document.querySelector("#summarySize"),
 summaryConfiguration: document.querySelector("#summaryConfiguration"),
 summaryOpening: document.querySelector("#summaryOpening"),
 priceBreakdown: document.querySelector("#priceBreakdown"),
 summaryPrice: document.querySelector("#summaryPrice"),
 customerNotice: document.querySelector("#customerNotice"),
 leadButton: document.querySelector("#leadButton"),
 leadDialog: document.querySelector("#leadDialog"),
 leadSummary: document.querySelector("#leadSummary"),
 leadName: document.querySelector("#calcV18LeadName"),
 leadPhone: document.querySelector("#calcV18LeadPhone"),
 leadConsent: document.querySelector("#calcV18Consent"),
 copyRequestButton: document.querySelector("#copyRequestButton"),
 wizardSteps: [...document.querySelectorAll("[data-wizard-step]")],
 wizardStepperButtons: [...document.querySelectorAll("[data-wizard-nav]")],
 wizardBackButton: document.querySelector("[data-wizard-back]"),
 wizardNextButton: document.querySelector("[data-wizard-next]"),
 wizardRecap: document.querySelector("#wizardRecap"),
 mobileResultPreview3: document.querySelector("#mobileResultPreview3"),
 mobileResultPreview4: document.querySelector("#mobileResultPreview4"),
 mobileResultPrice3: document.querySelector("#mobileResultPrice3"),
 mobileResultPrice4: document.querySelector("#mobileResultPrice4"),
 mobileResultMeta3: document.querySelector("#mobileResultMeta3"),
 mobileResultMeta4: document.querySelector("#mobileResultMeta4"),
};

const TOTAL_STEPS = els.wizardSteps.length;

const state = {
 type: COMMERCIAL.defaultType,
 glazing: COMMERCIAL.defaultGlazing,
 thermalContour: COMMERCIAL.defaultThermalContour,
 color: COMMERCIAL.defaultColor,
 addons: new Set(),
 selectedId: null,
 result: null,
 step: 1,
 isInitialLoad: true,
};

function pluralizeSash(count) {
 const mod10 = count % 10;
 const mod100 = count % 100;
 if (mod10 === 1 && mod100 !== 11) return "створка";
 if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "створки";
 return "створок";
}

function syncAddonAvailability() {
 for (const row of els.addonRows) {
 const addonId = row.dataset.addon;
 const addon = ADDONS[addonId];
 const applies = !addon || addon.appliesTo.includes(state.type);
 row.hidden = !applies;

 if (!applies) {
 state.addons.delete(addonId);
 const input = row.querySelector("input");
 if (input) input.checked = false;
 }
 }
}

function readDimensions() {
 return {
 width: Number(els.width.value),
 height: Number(els.height.value),
 };
}

function getSelectedOption() {
 if (!state.result || state.result.status !== "success") return null;
 return state.result.options.find(
 (option) => option.available && option.id === state.selectedId
 );
}

function syncChoiceStates() {
 for (const card of els.typeCards) {
 const active = card.dataset.portalType === state.type;
 card.classList.toggle("is-active", active);
 card.setAttribute("aria-checked", String(active));
 }

 for (const card of els.thermalCards) {
 const active = card.dataset.thermal === state.thermalContour;
 card.classList.toggle("is-active", active);
 card.setAttribute("aria-checked", String(active));
 }

 for (const card of els.glazingCards) {
 const active = card.dataset.glazing === state.glazing;
 card.classList.toggle("is-active", active);
 card.setAttribute("aria-checked", String(active));
 }

 for (const swatch of els.colorSwatches) {
 const active = swatch.dataset.color === state.color;
 swatch.classList.toggle("is-active", active);
 swatch.setAttribute("aria-checked", String(active));
 }
}

const WIZARD_NEXT_LABEL = {
 1: "К комплектации →",
 2: "Показать результат →",
 3: "Получить точную смету →",
};

function goToStep(step, { scroll = true } = {}) {
 const clamped = Math.min(TOTAL_STEPS, Math.max(1, step));
 state.step = clamped;
 document.querySelector(".calculator")?.setAttribute("data-step", String(clamped));

 for (const panel of els.wizardSteps) {
 panel.classList.toggle(
 "is-active",
 Number(panel.dataset.wizardStep) === clamped
 );
 }

 for (const button of els.wizardStepperButtons) {
 const buttonStep = Number(button.dataset.wizardNav);
 const isDone = buttonStep < clamped;
 button.classList.toggle("is-active", buttonStep === clamped);
 button.classList.toggle("is-done", isDone);

 const num = button.querySelector(".wizard-stepper__num");
 num.textContent = isDone ? "✓" : String(buttonStep);
 }

 els.wizardBackButton.disabled = clamped === 1;
 els.wizardNextButton.textContent = WIZARD_NEXT_LABEL[clamped] || "Продолжить →";
 els.wizardNextButton.disabled = clamped === 1 && state.result?.status !== "success";
 if (clamped === 3 && els.leadSummary) {
  const option = getSelectedOption();
  els.leadSummary.textContent = option && state.result?.status === "success"
   ? `${PORTAL_TYPES[state.type].label} · ${state.result.width.toLocaleString("ru-RU")} × ${state.result.height.toLocaleString("ru-RU")} мм · ${option.title} · ${formatMoney(option.price)}`
   : "Ваш проект из калькулятора";
 }

 if (scroll) {
 document
 .querySelector(".wizard-stepper")
 ?.scrollIntoView({ behavior: "smooth", block: "start" });
 }
}

function handleWizardNext() {
 if (state.step === 1 && state.result?.status !== "success") {
 const widthMissing = !els.width.value.trim();
 const heightMissing = !els.height.value.trim();
 if (widthMissing || heightMissing) {
 document.querySelector(".dimension-wrap")?.classList.add("needs-input");
 (widthMissing ? els.width : els.height).focus({ preventScroll: true });
 return;
 }
 return;
 }

 if (state.step === TOTAL_STEPS) { copyRequest(); return; }

 goToStep(state.step + 1);
}

function clearSummary() {
 els.portalPreview.innerHTML = `<div class="portal-empty portal-empty--product"><div><span class="portal-empty__kicker">ВАШ ПОРТАЛ</span><strong>Начните с размера проёма</strong><span>Укажите ширину и высоту — схема построится автоматически.</span></div></div>`;
 els.summaryType.textContent = "—";
 els.summarySize.textContent = "—";
 els.summaryConfiguration.textContent = "—";
 els.summaryOpening.textContent = "—";
 const summaryArea = document.querySelector("#summaryArea");
 const measureWidth = document.querySelector("#summaryMeasureWidth");
 const measureHeight = document.querySelector("#summaryMeasureHeight");
 const measureArea = document.querySelector("#summaryMeasureArea");
 const mobileSummaryPrice = document.querySelector("#mobileSummaryPrice");
 if (summaryArea) summaryArea.textContent = "—";
 if (measureWidth) measureWidth.textContent = "—";
 if (measureHeight) measureHeight.textContent = "—";
 if (measureArea) measureArea.textContent = "—";
 if (mobileSummaryPrice) { mobileSummaryPrice.textContent = "—"; mobileSummaryPrice.parentElement.hidden = true; }
 els.priceBreakdown.replaceChildren();
 els.summaryPrice.textContent = "—";
 els.customerNotice.textContent = "Введите приблизительные размеры — точные значения инженер подтвердит на замере.";
 els.leadButton.disabled = true;
 els.wizardRecap.replaceChildren();
 syncMobileProjectVisuals(null);
 els.sashHint.hidden = true;
}

function setStep1PreviewIdle() {
 const preview = document.querySelector("#step1LivePreview");
 const configGroup = document.querySelector("#configurationFieldGroup");
 const dimensionWrap = document.querySelector(".dimension-wrap");
 if (preview) {
  preview.classList.remove("is-ready");
  preview.replaceChildren();
 }
 configGroup?.classList.add("is-locked");
 dimensionWrap?.classList.remove("has-result");
}

function setStep1PreviewReady(option) {
 const preview = document.querySelector("#step1LivePreview");
 const configGroup = document.querySelector("#configurationFieldGroup");
 const dimensionWrap = document.querySelector(".dimension-wrap");
 if (!preview || !option || !state.result || state.result.status !== "success") return;
 preview.classList.add("is-ready");
 preview.innerHTML = `
  <div class="step1-live-preview__top">
   <span>Ваш портал</span>
   <strong>${state.result.width.toLocaleString("ru-RU")} × ${state.result.height.toLocaleString("ru-RU")} мм</strong>
  </div>
  <div class="step1-live-preview__drawing">${buildPortalIllustration(state.type, option.count)}</div>
  <div class="step1-live-preview__bottom">
   <span>${PORTAL_TYPES[state.type].shortLabel}</span>
   <span>${formatAreaSqM(state.result.width, state.result.height)}</span>
   <span>${option.count} ${pluralizeSash(option.count)}</span>
  </div>`;
 configGroup?.classList.remove("is-locked");
 dimensionWrap?.classList.add("has-result");
}

function renderIdleState() {
 hideError();
 setStep1PreviewIdle();
 state.result = null;
 state.selectedId = null;
 updateOpeningArea(0, 0);
 const dimensionWrap = document.querySelector(".dimension-wrap");
 dimensionWrap?.classList.add("is-awaiting");
 els.sashGrid.classList.add("is-empty");
 els.sashGrid.innerHTML = `<div class="calc-empty-state"><span class="calc-empty-state__arrow">→</span><div><strong>Укажите ширину и высоту</strong><span>После этого здесь появятся только подходящие для проёма варианты.</span></div></div>`;
 els.description.innerHTML = "";
 clearSummary();
 if (state.step === 1) els.wizardNextButton.disabled = true;
}

function renderError(result) {
 setStep1PreviewIdle();
 els.sashGrid.classList.remove("is-empty");
 els.errorBox.hidden = false;
 els.errorMessage.textContent = result.message;
 els.errorLeadButton.hidden = !result.showLeadCta;
 els.sashGrid.replaceChildren();
 els.description.innerHTML =
 "<p>Оставьте заявку — подберём решение вручную под архитектуру вашего проёма.</p>";
 clearSummary();
 if (state.step === 1) els.wizardNextButton.disabled = true;
}

function hideError() {
 els.errorBox.hidden = true;
 els.errorMessage.textContent = "";
}

function renderSashHint(result) {
 const recommended = result.options.find(
 (option) => option.id === result.recommendedId
 );
 if (!recommended) {
 els.sashHint.hidden = true;
 return;
 }

 els.sashHint.hidden = false;
 const isDefaultHero = state.isInitialLoad && state.type === "HS" && result.width === COMMERCIAL.defaultWidthMm && result.height === COMMERCIAL.defaultHeightMm;
 if (isDefaultHero) {
 els.sashHint.textContent = "Стартовый вариант — «Панорама»: минимум рам и максимум цельного стекла. Для более широкого прохода выберите «Широкий проход».";
 return;
 }
 if (!result.recommendationIsSafe) {
 els.sashHint.textContent = "Проём требует инженерной проверки — показываем самый щадящий из доступных вариантов.";
 return;
 }
 els.sashHint.textContent = `Для этого проёма рекомендуем сценарий «${recommended.title}»: свободный проход около ${recommended.approxOpeningWidthMm.toLocaleString("ru-RU")} мм.`;
}

function buildMiniSashSvg(type, count) {
 const w = 84, h = 40, pad = 3, gap = 2;
 const innerW = w - pad * 2;
 const paneW = (innerW - gap * (count - 1)) / count;
 let panes = "";
 for (let i = 0; i < count; i += 1) {
 const x = pad + i * (paneW + gap);
 if (type === "HS") {
 const motion = hsMotion(count, i);
 const fixed = motion === 0;
 panes += `<rect x="${x.toFixed(1)}" y="${pad}" width="${paneW.toFixed(1)}" height="${h - pad * 2}" class="mini-sash-svg__pane${fixed ? " mini-sash-svg__pane--fixed" : ""}"/>`;
 } else {
 panes += `<rect x="${x.toFixed(1)}" y="${pad}" width="${paneW.toFixed(1)}" height="${h - pad * 2}" class="mini-sash-svg__pane mini-sash-svg__pane--fold"/>`;
 if (i > 0) {
 panes += `<line x1="${x.toFixed(1)}" y1="${pad}" x2="${x.toFixed(1)}" y2="${h - pad}" class="mini-sash-svg__fold-line"/>`;
 }
 }
 }
 return `<svg class="mini-sash-svg" viewBox="0 0 ${w} ${h}" role="img" aria-hidden="true">${panes}</svg>`;
}

function renderTiles(options) {
 els.sashGrid.classList.remove("is-empty");
 els.sashGrid.replaceChildren();

 for (const option of options.filter((item) => item.available)) {
 const button = document.createElement("button");
 button.type = "button";
 button.className = "sash-card";
 button.setAttribute("role", "radio");
 button.setAttribute("aria-checked", String(option.id === state.selectedId));

 if (option.id === state.selectedId) button.classList.add("is-active");

 const badge = option.isRecommended
 ? '<span class="sash-card__badge">Рекомендуем</span>'
 : "";

 button.innerHTML = `
 ${badge}
 ${buildMiniSashSvg(state.type, option.count)}
 <span class="sash-card__number">${option.count} секции</span>
 <span class="sash-card__label">${option.title}</span>
 <span class="sash-card__meta">${option.subtitle}</span>
 <span class="sash-card__opening">≈ ${Math.round(option.openRatio * 100)}% свободно</span>
 <span class="sash-card__price">≈ ${formatMoney(option.price)}</span>
 `;

 button.addEventListener("click", () => {
 state.isInitialLoad = false;
 state.selectedId = option.id;
 renderSuccess(state.result);
 });

 els.sashGrid.append(button);
 }
}

function renderOptionDescription(option) {
 const typeText = state.type === "HS"
 ? "Створки сдвигаются вдоль проёма и не занимают полезное пространство внутри помещения."
 : "Секции складываются у края проёма и обеспечивают широкое открывание.";
 els.description.innerHTML = `
 <div class="option-description__top">
 <strong>${option.title}</strong>
 <span>${Math.round(option.openRatio * 100)}% проёма открывается</span>
 </div>
 <p>${typeText} ${option.subtitle}. В конструкции будет ${option.count} ${pluralizeSash(option.count)}.</p>
 `;
}

function buildPortalIllustration(type, count) {
 const safeCount = Math.max(2, Math.min(Number(count) || 2, 7));
 const panes = [];

 for (let index = 0; index < safeCount; index += 1) {
 if (type === "HS") {
 const motion = hsMotion(safeCount, index);
 const fixed = motion === 0;
 const arrow = motion < 0 ? "←" : motion > 0 ? "→" : "";
 const motionClass = motion < 0 ? " motion-left" : motion > 0 ? " motion-right" : "";
 panes.push(`<div class="portal-visual__pane ${fixed ? "is-fixed" : "is-moving"}${motionClass}">${arrow ? `<span class="portal-visual__arrow">${arrow}</span>` : ""}</div>`);
 } else {
 panes.push(`<div class="portal-visual__pane portal-visual__pane--fold"><span class="portal-visual__fold-mark">${index % 2 === 0 ? "╲" : "╱"}</span></div>`);
 }
 }

 return `
 <div class="portal-visual portal-visual--${type.toLowerCase()} portal-visual--${safeCount}" role="img" aria-label="${type === "HS" ? "Раздвижной HS-портал" : "FS-портал"}, ${safeCount} секций">
 <div class="portal-visual__width"><span>Ширина проёма</span></div>
 <div class="portal-visual__height"><span>Высота</span></div>
 <div class="portal-visual__frame" style="--pane-count:${safeCount}">${panes.join("")}</div>
 <div class="portal-visual__threshold"></div>
 </div>`;
}

function renderPreview(option) {
 els.portalPreview.innerHTML = buildPortalIllustration(state.type, option.count);
}

function renderPriceBreakdown(option) {
 const rows = [
 { label: "Портал, стекло и контур", value: option.basePrice },
 ];

 for (const addonId of state.result.addons) {
 const addon = ADDONS[addonId];
 if (!addon) continue;
 rows.push({ label: addon.label, value: addon.flatPrice });
 }

 els.priceBreakdown.replaceChildren();

 if (rows.length <= 1) return;

 for (const row of rows) {
 const line = document.createElement("div");
 line.className = "price-breakdown__row";
 line.innerHTML = `<span>${row.label}</span><span>${formatMoney(row.value)}</span>`;
 els.priceBreakdown.append(line);
 }
}

function formatAreaSqM(widthMm, heightMm) {
 const width = Number(widthMm);
 const height = Number(heightMm);
 if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "—";
 return `${((width * height) / 1000000).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} м²`;
}

function updateOpeningArea(widthMm, heightMm) {
 const value = formatAreaSqM(widthMm, heightMm);
 const inline = document.querySelector("#openingAreaInline");
 const measure = document.querySelector("#summaryMeasureArea");
 const summary = document.querySelector("#summaryArea");
 if (inline) inline.textContent = value;
 if (measure) measure.textContent = value;
 if (summary) summary.textContent = value;
}

function renderWizardRecap(option) {
 const type = PORTAL_TYPES[state.type];
 const thermal = THERMAL_CONTOURS[state.result.thermalContour];
 const glazing = GLAZING_PACKAGES[state.glazing];
 const color = FRAME_COLORS[state.result.color];
 const addonLabels = state.result.addons
 .map((id) => ADDONS[id]?.label)
 .filter(Boolean);

 const packageValue = [thermal.label, glazing.label, color.label]
 .filter(Boolean)
 .join(" · ") + (addonLabels.length ? ` · +${addonLabels.length} опц.` : "");

 const rows = [
 ["Система", type.label],
 ["Проём", `${state.result.width.toLocaleString("ru-RU")} × ${state.result.height.toLocaleString("ru-RU")} мм · ${formatAreaSqM(state.result.width, state.result.height)}`],
 ["Конфигурация", `${option.title} · ${option.count} ${pluralizeSash(option.count)}`],
 ["Комплектация", packageValue],
 ];

 els.wizardRecap.replaceChildren();

 for (const [label, value] of rows) {
 const row = document.createElement("div");
 row.className = "wizard-recap__row";
 row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
 els.wizardRecap.append(row);
 }
}

function syncMobileProjectVisuals(option) {
 const previews = [els.mobileResultPreview3, els.mobileResultPreview4].filter(Boolean);
 const prices = [els.mobileResultPrice3, els.mobileResultPrice4].filter(Boolean);
 const metas = [els.mobileResultMeta3, els.mobileResultMeta4].filter(Boolean);
 if (!option || !state.result || state.result.status !== "success") {
  for (const preview of previews) preview.innerHTML = '<div class="mobile-project-visual__empty">Эскиз появится после расчёта</div>';
  for (const price of prices) price.textContent = '—';
  for (const meta of metas) meta.textContent = 'Параметры появятся после расчёта.';
  return;
 }
 const drawing = buildPortalIllustration(state.type, option.count);
 const meta = `${PORTAL_TYPES[state.type].shortLabel} · ${state.result.width.toLocaleString("ru-RU")} × ${state.result.height.toLocaleString("ru-RU")} мм · ${option.title}`;
 for (const preview of previews) preview.innerHTML = drawing;
 for (const price of prices) price.textContent = `≈ ${formatMoney(option.price)}`;
 for (const node of metas) node.textContent = meta;
}

function renderSummary(option) {
 const type = PORTAL_TYPES[state.type];
 const color = FRAME_COLORS[state.result.color];

 els.summaryType.textContent = type.shortLabel;
 els.summarySize.textContent =
 `${state.result.width.toLocaleString("ru-RU")} × ${state.result.height.toLocaleString("ru-RU")} мм`;
 const measureWidth = document.querySelector("#summaryMeasureWidth");
 const measureHeight = document.querySelector("#summaryMeasureHeight");
 if (measureWidth) measureWidth.textContent = `${state.result.width.toLocaleString("ru-RU")} мм`;
 if (measureHeight) measureHeight.textContent = `${state.result.height.toLocaleString("ru-RU")} мм`;
 updateOpeningArea(state.result.width, state.result.height);
 els.summaryConfiguration.textContent =
 `${option.title} · ${option.count} створок · ${color.label.toLowerCase()}`;

 els.summaryOpening.textContent =
 `≈ ${option.approxOpeningWidthMm.toLocaleString("ru-RU")} мм · ${Math.round(option.openRatio * 100)}% проёма`;

 renderPriceBreakdown(option);
 els.summaryPrice.textContent = `≈ ${formatMoney(option.price)}`;
 const mobileSummaryPrice = document.querySelector("#mobileSummaryPrice");
 if (mobileSummaryPrice) { mobileSummaryPrice.textContent = `≈ ${formatMoney(option.price)}`; mobileSummaryPrice.parentElement.hidden = false; }
 els.customerNotice.textContent = option.customerNote;
 els.leadButton.disabled = false;

 renderPreview(option);
 renderWizardRecap(option);
 syncMobileProjectVisuals(option);
}

function renderSuccess(result) {
 hideError();
 document.querySelector(".dimension-wrap")?.classList.remove("is-awaiting", "needs-input");
 if (state.step === 1) els.wizardNextButton.disabled = false;
 renderSashHint(result);

 const available = result.options.filter((option) => option.available);
 const selectedStillAvailable = available.some(
 (option) => option.id === state.selectedId
 );

 if (!selectedStillAvailable) {
 const isDefaultHero =
 state.isInitialLoad &&
 state.type === "HS" &&
 result.width === COMMERCIAL.defaultWidthMm &&
 result.height === COMMERCIAL.defaultHeightMm;
 const initialOption = isDefaultHero
 ? available.find((option) => option.id === "hs-panorama")
 : null;
 state.selectedId = initialOption?.id ?? result.recommendedId;
 }

 renderTiles(result.options);

 const option = getSelectedOption();
 if (!option) return;

 renderOptionDescription(option);
 renderSummary(option);
 setStep1PreviewReady(option);
}

function recalculate({ resetSelection = false } = {}) {
 if (resetSelection) {
 state.selectedId = null;
 }

 const widthRaw = els.width.value.trim();
 const heightRaw = els.height.value.trim();
 if (!widthRaw || !heightRaw) {
 renderIdleState();
 return;
 }

 const { width, height } = readDimensions();
 updateOpeningArea(width, height);
 const result = calculatePortal({
 type: state.type,
 width,
 height,
 glazing: state.glazing,
 thermalContour: state.thermalContour,
 color: state.color,
 addons: [...state.addons],
 });

 state.result = result;

 if (result.status === "error") {
 renderError(result);
 return;
 }

 renderSuccess(result);
}

function setPortalType(type) {
 if (!PORTAL_TYPES[type]) return;

 state.isInitialLoad = false;
 state.type = type;
 syncChoiceStates();
 syncAddonAvailability();
 recalculate({ resetSelection: true });
}

function setThermalContour(thermalContour) {
 if (!THERMAL_CONTOURS[thermalContour]) return;

 state.isInitialLoad = false;
 state.thermalContour = thermalContour;
 syncChoiceStates();
 recalculate();
}

function setGlazing(glazing) {
 if (!GLAZING_PACKAGES[glazing]) return;

 state.isInitialLoad = false;
 state.glazing = glazing;
 syncChoiceStates();
 recalculate({ resetSelection: true });
}

function setColor(color) {
 if (!FRAME_COLORS[color]) return;

 state.isInitialLoad = false;
 state.color = color;
 syncChoiceStates();
 recalculate();
}

function toggleAddon(addonId, checked) {
 if (!ADDONS[addonId]) return;
 state.isInitialLoad = false;

 if (checked) {
 state.addons.add(addonId);
 } else {
 state.addons.delete(addonId);
 }

 recalculate();
}

function buildRequestText() {
 const option = getSelectedOption();
 const { width, height } = readDimensions();

 if (!option || !state.result || state.result.status !== "success") {
 return [
 "Заявка на индивидуальный проект панорамного остекления",
 `Проём: ${width || "—"} × ${height || "—"} мм`,
 `Площадь: ${formatAreaSqM(width, height)}`,
 ].join("\n");
 }

 const name = els.leadName.value.trim();
 const phone = els.leadPhone.value.trim();
 const type = PORTAL_TYPES[state.type];
 const thermal = THERMAL_CONTOURS[state.result.thermalContour];
 const glazing = GLAZING_PACKAGES[state.glazing];
 const color = FRAME_COLORS[state.result.color];
 const addonLabels = state.result.addons
 .map((id) => ADDONS[id]?.label)
 .filter(Boolean);

 return [
 "Заявка на панорамный портал",
 name ? `Имя: ${name}` : null,
 phone ? `Телефон: ${phone}` : null,
 `Тип: ${type.label}`,
 `Проём: ${state.result.width} × ${state.result.height} мм`,
 `Площадь проёма: ${formatAreaSqM(state.result.width, state.result.height)}`,
 `Конфигурация: ${option.title}, ${option.count} створок`,
 `Тип остекления: ${thermal.label}`,
 `Стеклопакет: ${glazing.label}`,
 `Цвет: ${color.label}`,
 addonLabels.length ? `Опции: ${addonLabels.join(", ")}` : null,
 `Открывание: ${option.openingLabel}`,
 `Предварительная стоимость: ${formatMoney(option.price)}`,
 ]
 .filter(Boolean)
 .join("\n");
}

function openLeadDialog() {
 goToStep(3);
 setTimeout(() => els.leadPhone?.focus({ preventScroll: false }), 260);
}

async function copyRequest() {
 const name = String(els.leadName?.value || "").trim();
 const phone = String(els.leadPhone?.value || "").trim();
 if (!name || phone.replace(/\D/g, "").length < 10) {
  alert("Проверьте имя и номер телефона.");
  return;
 }
 if (!els.leadConsent?.checked) {
  alert("Подтвердите согласие с политикой конфиденциальности.");
  return;
 }
 const project = buildRequestText();
 const feedbackButton = state.step === 3 ? els.wizardNextButton : els.copyRequestButton;
 const initialText = feedbackButton?.textContent || "Получить точную смету →";
 if (feedbackButton) { feedbackButton.disabled = true; feedbackButton.textContent = "Отправляем…"; }
 try {
  const fd = new FormData();
  fd.append("source", "calculator");
  fd.append("name", name);
  fd.append("phone", phone);
  fd.append("project", project);
  const response = await fetch("forms/send.php", { method: "POST", body: fd, headers: {"X-Requested-With":"XMLHttpRequest"} });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.message || "Ошибка отправки");
  if (feedbackButton) feedbackButton.textContent = "Заявка отправлена ✓";
  setTimeout(() => { if (feedbackButton) { feedbackButton.textContent = initialText; feedbackButton.disabled = false; } }, 2200);
 } catch (error) {
  if (feedbackButton) { feedbackButton.textContent = "Не удалось отправить"; feedbackButton.disabled = false; }
  alert("Не удалось отправить заявку. Позвоните нам: ");
 }
}

for (const card of els.typeCards) {
 card.addEventListener("click", () => {
 setPortalType(card.dataset.portalType);
 });
}

for (const card of els.thermalCards) {
 card.addEventListener("click", () => {
 setThermalContour(card.dataset.thermal);
 });
}

for (const card of els.glazingCards) {
 card.addEventListener("click", () => {
 setGlazing(card.dataset.glazing);
 });
}

for (const swatch of els.colorSwatches) {
 swatch.addEventListener("click", () => {
 setColor(swatch.dataset.color);
 });
}

for (const row of els.addonRows) {
 const input = row.querySelector("input[type='checkbox']");
 if (!input) continue;

 input.addEventListener("change", () => {
 toggleAddon(row.dataset.addon, input.checked);
 });
}

els.width.addEventListener("input", () => {
 document.querySelector(".dimension-wrap")?.classList.remove("needs-input");
 state.isInitialLoad = false;
 recalculate({ resetSelection: true });
});

els.height.addEventListener("input", () => {
 document.querySelector(".dimension-wrap")?.classList.remove("needs-input");
 state.isInitialLoad = false;
 recalculate({ resetSelection: true });
});

for (const presetButton of document.querySelectorAll("[data-size]")) {
 presetButton.addEventListener("click", () => {
 const [width, height] = presetButton.dataset.size.split("x").map(Number);
 if (!Number.isFinite(width) || !Number.isFinite(height)) return;
 state.isInitialLoad = false;
 els.width.value = String(width);
 els.height.value = String(height);
 recalculate({ resetSelection: true });
 });
}

els.leadButton.addEventListener("click", openLeadDialog);
els.errorLeadButton.addEventListener("click", openLeadDialog);
els.copyRequestButton.addEventListener("click", copyRequest);

for (const button of els.wizardStepperButtons) {
 button.addEventListener("click", () => {
 const targetStep = Number(button.dataset.wizardNav);
 if (targetStep > 1 && state.result?.status !== "success") return;
 goToStep(targetStep);
 });
}

els.wizardBackButton.addEventListener("click", () => {
 goToStep(state.step - 1);
});

els.wizardNextButton.addEventListener("click", handleWizardNext);

for (const link of document.querySelectorAll("[data-jump-type]")) {
 link.addEventListener("click", () => {
 setPortalType(link.dataset.jumpType);
 });
}

/**
 * Same-page remote control for the calculator: other components on a page
 * that embeds this calculator (the hero quick form, the house diagram
 * hotspots, inline gallery cards) dispatch this instead of navigating to
 * another page, so the calculator updates in place.
 */
window.addEventListener("calculator:set", (event) => {
 const { width, height, type } = event.detail ?? {};

 if (Number.isFinite(width) && width > 0) els.width.value = String(width);
 if (Number.isFinite(height) && height > 0) els.height.value = String(height);
 if (PORTAL_TYPES[type]) state.type = type;

 syncChoiceStates();
 goToStep(1);
 recalculate({ resetSelection: true });
});

function applyStateFromQuery() {
 const params = new URLSearchParams(location.search);
 const width = Number(params.get("w"));
 const height = Number(params.get("h"));
 const type = params.get("type");

 if (Number.isFinite(width) && width > 0) els.width.value = String(width);
 if (Number.isFinite(height) && height > 0) els.height.value = String(height);
 if (PORTAL_TYPES[type]) state.type = type;
}

applyStateFromQuery();
syncChoiceStates();
syncAddonAvailability();
goToStep(1, { scroll: false });
recalculate({ resetSelection: true });



(function () {
 function isMobile() { return window.matchMedia('(max-width:720px)').matches; }

 // "Шаг X из 3" plain-text label
 var label = document.getElementById('mobileStepLabel');
 var calcEl = document.querySelector('.calculator');
 if (label && calcEl) {
 var TOTAL = 3;
 function syncStep() {
 var step = calcEl.getAttribute('data-step') || '1';
 label.textContent = 'Шаг ' + step + ' из ' + TOTAL;
 }
 syncStep();
 new MutationObserver(syncStep).observe(calcEl, { attributes: true, attributeFilter: ['data-step'] });
 }

 // Mobile-only placement of the dark project block.
 // Steps 1–2: it stays inside the hidden step 3 and therefore is not rendered below.
 // Step 3: it appears immediately after the project heading.
 // Desktop: restore the original v18 two-column placement as the second calculator child.
 var step3 = document.querySelector('.wizard-step[data-wizard-step="3"]');
 var summaryAside = document.querySelector('.summary');
 var heading = document.getElementById('step3Heading');
 var step3Intro = document.getElementById('step3Intro');
 var calculatorRoot = document.querySelector('.calculator');
 var calculatorMain = document.querySelector('.calculator__main');
 var wizardNav = document.querySelector('.wizard-nav');

 function syncMobileNavVisibility() {
 if (!wizardNav || !calculatorRoot) return;
 if (!isMobile()) {
 wizardNav.classList.remove('is-mobile-visible');
 return;
 }
 var rect = calculatorRoot.getBoundingClientRect();
 var visible = rect.top < window.innerHeight - 90 && rect.bottom > 120;
 wizardNav.classList.toggle('is-mobile-visible', visible);
 }
 function relocateSummaryForMobile() {
 if (!step3 || !summaryAside || !heading || !calculatorRoot || !calculatorMain) return;
 if (isMobile()) {
 if (summaryAside.parentElement !== step3 || step3Intro?.nextElementSibling !== summaryAside) {
 (step3Intro || heading).insertAdjacentElement('afterend', summaryAside);
 }
 } else {
 if (summaryAside.parentElement !== calculatorRoot || calculatorMain.nextElementSibling !== summaryAside) {
 calculatorMain.insertAdjacentElement('afterend', summaryAside);
 }
 }
 }
 relocateSummaryForMobile();
 syncMobileNavVisibility();
 window.addEventListener('resize', function () {
 relocateSummaryForMobile();
 syncMobileNavVisibility();
 });
 window.addEventListener('scroll', syncMobileNavVisibility, { passive: true });

 // Закрыто / Открыто — same behaviour as the attached calculator-embed.html.
 // The mode is stored separately and reapplied whenever the preview is rebuilt.
 var previewEl = document.getElementById('portalPreview');
 var closedBtn = document.getElementById('portalStateClosedBtn');
 var openBtn = document.getElementById('portalStateOpenBtn');
 var previewMode = 'closed';

 function applyPortalPreviewMode() {
 if (!previewEl) return;
 var visual = previewEl.querySelector('.portal-visual');
 if (!visual) return;
 visual.classList.toggle('is-open-view', previewMode === 'open');
 }

 function setPortalState(isOpen) {
 previewMode = isOpen ? 'open' : 'closed';
 if (closedBtn) {
 closedBtn.classList.toggle('is-active', !isOpen);
 closedBtn.setAttribute('aria-pressed', String(!isOpen));
 }
 if (openBtn) {
 openBtn.classList.toggle('is-active', isOpen);
 openBtn.setAttribute('aria-pressed', String(isOpen));
 }
 applyPortalPreviewMode();
 }

 if (closedBtn) closedBtn.addEventListener('click', function () { setPortalState(false); });
 if (openBtn) openBtn.addEventListener('click', function () { setPortalState(true); });

 if (previewEl) {
 new MutationObserver(function () {
 applyPortalPreviewMode();
 }).observe(previewEl, { childList:true, subtree:true });
 }

 setPortalState(false);

 // Tooltip icons. Desktop keeps the original v18 pseudo-tooltip.
 // Mobile uses a viewport-level popover so it is never clipped by calculator overflow.
 var mobileTip = document.createElement('div');
 mobileTip.className = 'calc-mobile-tooltip';
 mobileTip.setAttribute('role', 'tooltip');
 document.body.appendChild(mobileTip);
 var mobileTipOwner = null;

 function closeMobileTip() {
 mobileTip.classList.remove('is-open');
 mobileTipOwner = null;
 }
 function placeMobileTip(icon) {
 mobileTip.textContent = icon.getAttribute('data-tooltip') || '';
 mobileTip.classList.add('is-open');
 mobileTip.style.left = '14px';
 mobileTip.style.top = '14px';
 var r = icon.getBoundingClientRect();
 var tr = mobileTip.getBoundingClientRect();
 var margin = 14;
 var gap = 8;
 var left = Math.min(Math.max(margin, r.left + r.width / 2 - tr.width / 2), window.innerWidth - tr.width - margin);
 var top = r.bottom + gap;
 if (top + tr.height > window.innerHeight - margin) top = Math.max(margin, r.top - tr.height - gap);
 mobileTip.style.left = Math.round(left) + 'px';
 mobileTip.style.top = Math.round(top) + 'px';
 }

 function openViewportTip(icon) {
 document.querySelectorAll('.info-icon.is-open').forEach(function (i) { i.classList.remove('is-open'); });
 icon.classList.add('is-open');
 mobileTipOwner = icon;
 placeMobileTip(icon);
 }

 document.querySelectorAll('.info-icon').forEach(function (icon) {
 icon.addEventListener('click', function (e) {
 e.stopPropagation();
 var sameOpen = mobileTipOwner === icon && mobileTip.classList.contains('is-open');
 if (sameOpen) {
 closeMobileTip();
 icon.classList.remove('is-open');
 } else {
 openViewportTip(icon);
 }
 });

 });
 document.addEventListener('click', function () {
 closeMobileTip();
 document.querySelectorAll('.info-icon.is-open').forEach(function (i) { i.classList.remove('is-open'); });
 });
 window.addEventListener('resize', function () {
 if (mobileTipOwner && mobileTip.classList.contains('is-open')) placeMobileTip(mobileTipOwner);
 });
 window.addEventListener('scroll', function () { if (mobileTipOwner && mobileTip.classList.contains('is-open')) placeMobileTip(mobileTipOwner); }, { passive: true });
})();
