import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");
const DATA_DIR = resolve(ROOT, "data");
const OUTPUT = resolve(DIST, "index.html");
const CACHE_PATH = resolve(DATA_DIR, "source-cache.json");
const HISTORY_PATH = resolve(DATA_DIR, "snapshot-history.json");
const SHOP = "pulsar-vaporizers.myshopify.com";
const API = "https://api.judge.me/reviews/reviews_for_widget";

const products = [
  { key: "syndr", internalCode: "G-069", model: "SYNDR", category: "干草设备", title: "Pulsar SYNDR Dry Herb Vaporizer", productId: "7344082387059", handle: "syndr-dry-herb-vaporizer", aliases: ["SYNDR THERMO DISP", "SYNDR THERMO DISPLAY"] },
  { key: "hall-pass", internalCode: "D-153", model: "Hall Pass", category: "510电池", title: "Pulsar 510 Hall Pass Vaporizer", productId: "8151305748595", handle: "510-hall-pass-vaporizer", aliases: ["Hall Pass DISP", "Hall Pass BL", "Hall Pass GR", "Hall Pass YL"] },
  { key: "dl-wax", internalCode: "G-077", model: "DL wax box", category: "浓缩物设备", title: "Pulsar DL Wax Vape Bar", productId: "7449570705523", handle: "dl-wax-vape-bar", aliases: ["DL Wax Box Display", "DL Wax Box Black DISP"] },
  { key: "dl-6", internalCode: "D-148A", model: "DL 6.0", category: "510电池", title: "Pulsar 510 DL 6.0 Auto-Draw Vape Bar", productId: "8150619029619", handle: "510-dl-6-vape-bar", aliases: ["DL 6.0 GR", "DL 6.0 BL", "DL 6.0 PU", "DL 6.0 BK", "DL 6.0 DISP"] },
  { key: "delta-3in1", internalCode: "G-151", model: "Delta 3-in-1", category: "多合一设备", title: "Pulsar 510 Delta 3-in-1 Vaporizer Kit", productId: "8151119200371", handle: "510-delta-3-in-1-vaporizer-kit", aliases: ["3 in 1 BK", "3 in 1 BL", "3 in 1 PU", "3 in 1 DISP", "DELTA BOX DISP"] },
  { key: "chorus", internalCode: "G-103", model: "Chorus", category: "浓缩物设备", title: "Pulsar Chorus Concentrate Vaporizer", productId: "8130909896819", handle: "chorus-concentrate-vaporizer", aliases: ["Chorus", "G103-Coil"] },
  { key: "dabtron-2", internalCode: "G-132", model: "Dabtron 2.0", category: "浓缩物设备", title: "Pulsar Dabtron 2.0 Electric Dab Rig", productId: "8037489442931", handle: "dabtron-2-electric-dab-rig", aliases: ["Dabtron 2.0"] },
  { key: "510-daily", internalCode: "D-176", model: "510 Daily", category: "510电池", title: "SeshGear 510 Daily Auto-Draw Vape Bar", productId: "8409116115059", handle: "seshgear-510-daily-vape-bar", aliases: ["510 Daily", "SeshGear 510 Daily"] },
  { key: "relay", internalCode: "D-170", model: "Relay", category: "510电池", title: "Pulsar 510 Relay Power Bank Vaporizer", productId: "8408961187955", handle: "pulsar-510-relay-power-bank-vaporizer", aliases: ["Relay"] },
  { key: "voyager", internalCode: "G-158", model: "Voyager", category: "干草设备", title: "Pulsar Voyager Dry Herb Vape Bar", productId: "8407509106803", handle: "pulsar-voyager-dry-herb-pod-vape-bar", aliases: ["Voyager"] },
];

const monitoring = [
  { internalCode: "D-026A", model: "CORE 510 Battery", category: "510电池", aliases: ["D-026A", "CORE 510 Battery"], sourceStatus: "pending_confirmation" },
  { internalCode: "D-173", model: "Delta SMART BOX", category: "多合一设备", aliases: ["D-173", "Delta SMART BOX"], sourceStatus: "pending_confirmation" },
];

const issueDefinitions = [
  { id: "SAF-THERM-001", title: "热接触或热液安全反馈", type: "安全反馈", severity: "安全优先复核", journey: ["启动与预热", "吸入体验", "连续使用"], components: ["外壳", "吸嘴", "加热腔", "气道"], pattern: "burn(?:ed|ing)? (?:my|me|mouth|lip|hand)|too hot to touch|extremely hot|melt(?:ed|ing)?|caught fire|hot oil|scald|hurt my", expectation: "正常使用时，用户可安全接触和吸入，不发生烫伤、熔化或热液入口。", validation: "建议先人工核对原文与使用条件，再由品质/研发制定安全复核方法；未确认前不认定为安全缺陷。" },
  { id: "UX-HEAT-001", title: "预热时间过长", type: "体验问题", severity: "待评估", journey: ["启动与预热"], components: ["加热系统", "控制逻辑"], pattern: "heat.?up time.*(?:long|slow)|slow(?:ly)? (?:to )?heat|takes? (?:a )?(?:long|while).*heat|preheat.*(?:slow|long)", expectation: "在用户可接受的等待时间内进入可用状态，并提供清晰反馈。", validation: "建议按型号、环境温度、负载和电量记录启动至可用状态的时间；参数与标准待确认。" },
  { id: "UX-TEMP-001", title: "温度不足或无蒸汽", type: "体验问题", severity: "待评估", journey: ["启动与预热", "吸入体验"], components: ["加热系统", "温控", "气道"], pattern: "no vapor|doesn.?t heat|didn.?t heat|not hot enough|up to temp|barely (?:hits?|pulls?)|weak hits?|does not produce vapor|won.?t heat", expectation: "设定档位下能形成与产品定位一致的加热与输出体验。", validation: "建议先分离装载量、含水率、档位、气道与加热输出条件进行复现；根因待验证。" },
  { id: "REL-CONN-001", title: "模块连接、识别或接触不稳定", type: "可靠性问题", severity: "待评估", journey: ["装载与连接", "启动与预热"], components: ["连接器", "接点", "雾化器", "识别逻辑"], pattern: "not recogn|doesn.?t recogn|won.?t recogn|refuses to recogn|atomizer.*(?:stopped|not |won.?t|doesn.?t|refuses|fail)|connect(?:ion|ing)?.*(?:fail|stop|problem)|short circuit|only works.*loos|contact.*(?:problem|fail|intermitt)", expectation: "模块安装到位后能稳定识别并工作，不需要松动、反复安装或特殊角度。", validation: "建议保留样品，记录模块、接点状态、装配位置和报错，再验证接触与识别链路；不预设根因。" },
  { id: "PWR-BAT-001", title: "电池、充电或续航不符合预期", type: "性能问题", severity: "待评估", journey: ["连续使用", "充电"], components: ["电芯", "充电端口", "电源管理", "电量显示"], pattern: "battery (?:life )?(?:is )?(?:horrid|poor|short|bad)|battery.*(?:drain|die|dead|problem|only lasts|lasts only|20%|won.?t|doesn.?t|not charging)|drain(?:s|ed)?.*battery|takes ages to charge|charg(?:e|ing).*(?:slow|problem|won.?t|doesn.?t|not |fail)|battery light.*stuck|longer battery life|wish.*battery|\\d+% power|power per cycle", expectation: "续航、充电和电量显示与产品定位及用户预期一致。", validation: "建议按电量、档位、负载和循环次数记录续航与充电表现；规格和验收线待确认。" },
  { id: "UX-AIR-001", title: "堵塞、吸阻或气道体验", type: "体验问题", severity: "待评估", journey: ["吸入体验", "连续使用", "清洁维护"], components: ["气道", "吸嘴", "冷凝区", "雾化腔"], pattern: "clog|air ?flow|hard to (?:draw|pull|hit)|barely pulls?|restrict(?:ed|ion)|doesn.?t pull|wouldn.?t pull", expectation: "在正常装载和维护条件下保持可接受的吸阻与气流。", validation: "建议记录装载物、黏度、使用次数、清洁状态与气道压降；问题条件待补。" },
  { id: "REL-DUR-001", title: "早期失效、破损或材料耐久", type: "可靠性问题", severity: "待评估", journey: ["长期耐久"], components: ["结构件", "外壳", "吸嘴", "连接结构"], pattern: "broke|broken|crack(?:ed)?|died|dead|fell apart|stopped working|lasted only|failed after|within.*(?:stopped|broke|died|failed|crack)", expectation: "在目标寿命和正常使用条件内保持结构与功能完整。", validation: "建议补充购买时间、使用频次、跌落/清洁/环境条件及样品状态，再制定寿命复现；目标寿命待确认。" },
  { id: "UX-CLEAN-001", title: "清洁困难、残留或维护成本高", type: "维护问题", severity: "待评估", journey: ["清洁维护"], components: ["加热腔", "气道", "吸嘴", "可拆结构"], pattern: "hard to clean|difficult to clean|cleaning terrible|dirty quick|gunk|residue|unburned concentrate|can.?t be cleaned", expectation: "日常维护路径清晰，关键残留区域可达且可清洁。", validation: "建议记录残留位置、使用物料、循环次数、拆装工具和清洁时间；部件设计原因待验证。" },
  { id: "PKG-USE-001", title: "包装、说明或学习成本", type: "使用问题", severity: "待评估", journey: ["开箱与理解", "装载与连接"], components: ["包装", "说明书", "操作流程"], pattern: "packag.*(?:terrible|bad|unusable|sucks|peel|sticky)|instruction.*(?:wrong|incorrect|confus|unclear|missing)|manual.*(?:confus|wrong|missing)|learning curve|can.?t figure|figure it out|case sucks|foam.*(?:sticky|peel)", expectation: "开箱后能快速理解、保存和正确使用产品，包装不妨碍后续收纳。", validation: "建议区分包装结构、说明信息和产品操作问题，进行新用户可用性走查；结论待确认。" },
  { id: "UI-FEED-001", title: "调节、档位与信息反馈不足", type: "功能诉求", severity: "待评估", journey: ["启动与预热", "连续使用"], components: ["按键", "显示屏", "档位", "指示灯"], pattern: "wish.*variable voltage|would be nice.*variable voltage|allow for variable voltage|rather than (?:four|4) settings|doesn.?t have.*puff counter|no puff counter|screen.*(?:silly|no information)|indicator.*(?:stuck|problem)|light is stuck|only (?:four|4) settings", expectation: "用户能准确调节并理解当前状态，关键反馈不缺失。", validation: "建议对照现有规格和旧代体验，确认用户需要的调节范围、状态信息和优先级；不等同于已批准需求。" },
];

const strengthDefinitions = [
  ["便携/隐蔽", "portable|compact|discreet|easy to carry|pocket"], ["易用", "easy to use|straightforward|convenient|works like a charm"], ["设计/外观", "design|looks good|sleek|cute|pretty"], ["输出/口感", "great hits?|good pull|flavor|clouds?|works very well|hits like"], ["续航", "battery life.*(?:great|good|long)|charge lasts"], ["易清洁", "easy to clean"], ["价格价值", "great price|worth the money|for the price|affordable"], ["客服体验", "customer service.*(?:excellent|great|helpful|prompt)|support.*helpful"],
];

const opportunityDefinitions = [
  { id: "OPP-PORT-CLEAN", title: "便携性与易清洁兼顾", scene: "外出携带、快速使用后需要低负担维护", value: "用户认可便携、隐蔽和一体化体验。", gap: "部分评论同时提到残留、气道或清洁可达性。", hypothesis: "在不显著增加体积的前提下，优化可拆卸和残留路径可能提升持续使用体验。", pattern: "portable|compact|discreet|easy to carry|easy to clean|hard to clean|dirty quick|gunk|residue", next: "对便携性与清洁相关评论做场景访谈，并比较拆装步骤、清洁时间和体积取舍。" },
  { id: "OPP-MODULE", title: "多合一模块切换、识别与可靠性", scene: "在干草、浓缩物和510模块之间切换", value: "用户认可多合一带来的便利与性价比。", gap: "部分评论报告模块识别、连接和早期失效。", hypothesis: "明确的装配反馈、连接容差和识别策略可能降低切换摩擦。", pattern: "3-in-1|atomizer|module|recogn|connect|dry herb attachment|wax atomizer|ceramic", next: "按模块建立切换任务测试，记录首次成功率、接触状态、错误提示与循环后表现。" },
  { id: "OPP-CONTROL", title: "调节精度、档位跨度与信息反馈", scene: "用户根据物料和偏好调节电压/温度并判断设备状态", value: "用户认可可调节能力和屏幕反馈。", gap: "部分评论希望更细调节、可变电压、计数或更清晰状态。", hypothesis: "更清楚的状态反馈与合理档位跨度可能提升控制感，但需评估复杂度和成本。", pattern: "variable voltage|adjustable|setting|temperature|screen|display|indicator|puff counter|four settings|4 settings", next: "把功能诉求按场景和频次分组，验证用户能否理解并使用更多调节与反馈。" },
  { id: "OPP-GEN", title: "新旧代应保留的功能与体验", scene: "老用户从上一代迁移到新一代产品", value: "用户认可升级后的续航、外观或调节能力。", gap: "个别评论明确指出旧代计数、可拆吸嘴或信息密度更好。", hypothesis: "代际升级前建立关键体验保留清单，可减少已验证价值的意外流失。", pattern: "5\\.0|previous|last vape|older|puff counter|mouthpiece.*remov|less functional", next: "建立新旧代任务对照与保留项清单，由产品、研发和业务共同确认取舍。" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readJson = async (path, fallback) => { try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; } };

function textFromHtml(value = "") {
  return value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
}

async function fetchPage(productId, page) {
  const url = new URL(API);
  url.search = new URLSearchParams({ product_id: productId, page: String(page), per_page: "30", shop_domain: SHOP, platform: "shopify" });
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Judge.me ${response.status}`);
  return response.json();
}

async function fetchProduct(product) {
  const first = await fetchPage(product.productId, 1);
  const total = Number(first.number_of_reviews || 0);
  const pages = Math.max(1, Math.ceil(total / 30));
  const rows = [...(first.reviews || [])];
  for (let page = 2; page <= pages; page += 1) { await sleep(120); rows.push(...((await fetchPage(product.productId, page)).reviews || [])); }
  return {
    ...product, sourceUrl: `https://www.pulsarshop.com/products/${product.handle}`, reportedCount: total, reportedAverage: Number(first.average_rating || 0), fetchStatus: "success", fetchedAt: new Date().toISOString(),
    reviews: rows.map((review) => ({ uuid: review.uuid, rating: Number(review.rating || 0), title: textFromHtml(review.title || ""), body: textFromHtml(review.body_html || ""), name: review.reviewer_name || "Anonymous", initial: review.reviewer_initial || (review.reviewer_name || "?").slice(0, 1).toUpperCase(), country: review.location_country || "", countryCode: review.location_country_code || "", date: String(review.created_at || "").slice(0, 10), verified: Boolean(review.verified_buyer), avatar: review.avatar_image_url || "", variant: review.product_variant_title || "", pictures: review.pictures_urls || [] })),
  };
}

function analyzeReview(review) {
  const text = `${review.title} ${review.body}`;
  const issues = issueDefinitions.filter((d) => new RegExp(d.pattern, "i").test(text)).map((d) => d.id);
  const strengths = strengthDefinitions.filter(([, pattern]) => new RegExp(pattern, "i").test(text)).map(([label]) => label);
  const requests = [];
  if (/wish|would be nice|should (?:have|be)|want|need|allow for|recommend.*(?:add|change)|puff counter|variable voltage/i.test(text)) requests.push("功能或改善诉求");
  const customerService = /customer service|support|replacement|refund|warranty/i.test(text) ? (/excellent|helpful|prompt|kindly|great service|most excellent/i.test(text) ? "正向客服体验" : "客服/换货经历待复核") : "未提及";
  const conditions = [];
  for (const [label, pattern] of [["短期使用后", "within.*(?:days?|weeks?|months?)|first day|under.*months?|after.*weeks?"], ["充电/电量条件", "charg|battery|power"], ["清洁/残留条件", "clean|dirty|gunk|residue"], ["模块切换", "atomizer|attachment|module|cart"], ["连续使用", "cycle|session|everyday|daily"]]) if (new RegExp(pattern, "i").test(text)) conditions.push(label);
  const journey = [...new Set(issueDefinitions.filter((d) => issues.includes(d.id)).flatMap((d) => d.journey))];
  const components = [...new Set(issueDefinitions.filter((d) => issues.includes(d.id)).flatMap((d) => d.components))];
  const safety = issues.includes("SAF-THERM-001");
  const mixed = strengths.length > 0 && (issues.length > 0 || requests.length > 0);
  const summaryParts = [];
  if (strengths.length) summaryParts.push(`认可：${strengths.join("、")}`);
  if (issues.length) summaryParts.push(`报告：${issues.map((id) => issueDefinitions.find((d) => d.id === id)?.title).join("、")}`);
  if (requests.length) summaryParts.push("包含功能或改善诉求");
  if (!summaryParts.length) summaryParts.push("自动规则未识别明确优点或问题，请人工复核原文");
  const languageNote = /[^\u0000-\u007f]/.test(text) ? "可能包含非英语内容，保留原文并需人工复核" : "英语/未判定";
  return { issues, strengths, requests, customerService, conditions, journey, components, safety, mixed, languageNote, chineseSummary: summaryParts.join("；") + "。", classification: "自动初筛，可在问题卡中排除或恢复关联；不构成根因结论。" };
}

await mkdir(DIST, { recursive: true });
await mkdir(DATA_DIR, { recursive: true });
const cache = await readJson(CACHE_PATH, { version: 1, products: {} });
const collected = [];
for (const product of products) {
  try {
    const current = await fetchProduct(product);
    collected.push(current);
    cache.products[product.key] = current;
  } catch (error) {
    const prior = cache.products[product.key];
    if (prior) collected.push({ ...prior, ...product, sourceUrl: `https://www.pulsarshop.com/products/${product.handle}`, fetchStatus: "failed_cached", fetchError: String(error.message || error), cacheTimestamp: prior.fetchedAt || "未知" });
    else collected.push({ ...product, sourceUrl: `https://www.pulsarshop.com/products/${product.handle}`, reportedCount: null, reportedAverage: null, reviews: [], fetchStatus: "failed_no_data", fetchError: String(error.message || error) });
  }
  await sleep(180);
}
cache.updatedAt = new Date().toISOString();
await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");

const seen = new Set();
const reviews = [];
for (const product of collected) {
  for (const raw of product.reviews || []) {
    if (!raw.uuid || seen.has(raw.uuid)) continue;
    seen.add(raw.uuid);
    const review = { ...raw, productKey: product.key, internalCode: product.internalCode, model: product.model, category: product.category, productTitle: product.title, sourceUrl: product.sourceUrl };
    review.analysis = analyzeReview(review);
    review.eventKey = review.name && review.name !== "Anonymous" ? `${review.productKey}|${review.name.toLowerCase()}` : review.uuid;
    reviews.push(review);
  }
}
reviews.sort((a, b) => b.date.localeCompare(a.date) || b.rating - a.rating);

const priorHistory = await readJson(HISTORY_PATH, null);
const currentIds = reviews.map((r) => r.uuid).sort();
let history;
if (!priorHistory) {
  history = { version: 1, hasComparableSnapshot: false, baselineStartedAt: new Date().toISOString(), previousIds: [], currentIds, newIds: [], removedIds: [] };
} else if (JSON.stringify(priorHistory.currentIds || []) !== JSON.stringify(currentIds)) {
  const before = new Set(priorHistory.currentIds || []), now = new Set(currentIds);
  history = { ...priorHistory, hasComparableSnapshot: true, previousIds: priorHistory.currentIds || [], currentIds, newIds: currentIds.filter((id) => !before.has(id)), removedIds: [...before].filter((id) => !now.has(id)), lastChangedAt: new Date().toISOString() };
} else history = priorHistory;
await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2), "utf8");

const modelData = collected.map(({ reviews: productReviews, ...product }) => ({ ...product, fetchedCount: productReviews?.length ?? 0 }));
const generatedAt = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
const payloadObject = { schemaVersion: 2, generatedAt, timezone: "Asia/Shanghai", models: modelData, monitoring, reviews, issueDefinitions: issueDefinitions.map(({ pattern, ...rest }) => rest), opportunities: opportunityDefinitions, history: { hasComparableSnapshot: history.hasComparableSnapshot, baselineStartedAt: history.baselineStartedAt, lastChangedAt: history.lastChangedAt || null, newIds: history.newIds || [], removedIds: history.removedIds || [] }, evidenceBoundary: "官网评论是用户报告，不代表销量、总体故障率或退货率。自动归类是待复核信号，不认定根因。" };
const payload = JSON.stringify(payloadObject).replace(/</g, "\\u003c");
const template = await readFile(resolve(ROOT, "src/index.html"), "utf8");
await writeFile(OUTPUT, template.replace("__RADAR_DATA__", payload), "utf8");
await copyFile(resolve(ROOT, "src/app.js"), resolve(DIST, "app.js"));
await copyFile(resolve(ROOT, "src/styles.css"), resolve(DIST, "styles.css"));
await writeFile(resolve(DIST, "radar-data.json"), JSON.stringify(payloadObject, null, 2), "utf8");
console.log(JSON.stringify({ output: OUTPUT, models: modelData.length, monitoring: monitoring.length, reviews: reviews.length, newReviews: history.newIds?.length || 0, historyComparable: history.hasComparableSnapshot, generatedAt, fetchStates: Object.fromEntries(modelData.map((m) => [m.internalCode, m.fetchStatus])) }, null, 2));
