import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const API = "https://api.judge.me/reviews/reviews_for_widget";
const SHOP = "pulsar-vaporizers.myshopify.com";
const args = process.argv.slice(2);
const arg = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; };
const SYND_R_SOURCE = arg("--prior", fileURLToPath(new URL("./source/data.json", import.meta.url)));
const OUTPUT = arg("--output", SYND_R_SOURCE);

const products = [
  { key: "syndr", internalCode: "G-069", model: "SYNDR", productTitle: "Pulsar SYNDR Dry Herb Vaporizer", productId: "7344082387059", productUrl: "https://www.pulsarshop.com/products/syndr-dry-herb-vaporizer" },
  { key: "delta-3in1", internalCode: "G-151", model: "Delta 3-in-1", productTitle: "Pulsar 510 Delta 3-in-1 Vaporizer Kit", productId: "8151119200371", productUrl: "https://www.pulsarshop.com/products/510-delta-3-in-1-vaporizer-kit" },
  { key: "voyager", internalCode: "G-158", model: "Voyager", productTitle: "Pulsar Voyager Dry Herb Vape Bar", productId: "8407509106803", productUrl: "https://www.pulsarshop.com/products/pulsar-voyager-dry-herb-pod-vape-bar" },
];

const translations = {
  "055eeef0-f9fd-44d2-9ff5-d1fba0658b38": "不推荐这款产品。使用不到两周，干草雾化器就无法连接；更换后不到一个月，拧下雾化器时内部电池组件也开始被带出。尚未使用的蜡雾化器内还有不明污物。包装开箱后也无法正常使用，这笔钱更适合花在别处。",
  "fca5f9b0-1daa-4232-98cb-c0e3dc813b71": "不确定是否拿到次品。切换到陶瓷蜡雾化器时，电池无法识别；不能完全拧紧，必须松动并在电池与雾化器之间留出小缝才能工作。",
  "9486c091-8502-447f-a258-b2ebef41c4c4": "设备不能工作。按说明连续按键五次后会亮灯，但几秒后立即关机，非常失望。",
  "940235d9-331b-41bc-9c70-32c16a547d1f": "设备使用几天后就停止工作，我不得不提交售后申请。",
  "aea03104-92cd-4d88-9775-90d4de6674dc": "前三次用于花材时工作正常，第四次开始没有震动反馈，只会白灯闪三次后关机，完全浪费钱。",
  "a67f08ec-6072-453a-befd-56493ee6d0be": "刚收到设备，只用了两次就一直闪白灯。不确定哪里出了问题，希望得到帮助。",
  "f1effec2-ed37-48a6-ad6b-542c47944df5": "第一次使用过程中就停止工作。",
  "74be91f1-b627-4d5a-9dd5-fd7fae0b4f6a": "使用浓缩物线圈时口腔被严重烫伤：吸嘴与线圈底座间距太小，吸入时很容易把熔融树脂带入口中。硅胶线圈盖冷态下尚可，但连续使用后受热膨胀，树脂会沿底座泄漏。底部充电口也很不方便，尤其在线圈内仍有热树脂时。尚未测试干草附件；以该价格而言，整体明显不如Pulsar 510 Digital。",
  "fabd1b6c-4c04-4fa6-b686-cbf3222baa4a": "最初很期待能随身使用花材和浓缩物，但隔日使用约三个月后，设备变得非常不稳定且不可预测。花材雾化器有时需要吸两三次才有输出，有时轻吸却突然产生很大一口；续航只能支持约10至15次轻吸，相当于一碗花材或约5次浓缩物。浓缩物雾化器的预热不足以产生蒸汽，外壳却会变得烫手。",
  "6ad03296-1a98-4e1c-8bc6-a69167ee5862": "这是第三次购买。我喜欢外观和产品理念，但它就是不能可靠工作。陶瓷碗几天内就损坏，看起来像被熔穿。产品需要重新设计并使用更好的材料，尤其是陶瓷碗。",
  "1f84879e-cefe-40ea-9bf6-156555e9678f": "不到24小时就坏了，不建议购买Delta。",
  "9505149d-bc6a-46f3-96ce-4455803888b1": "干草附件只用了两次，电池就不再识别；蜡功能的表现充其量也只是时好时坏。请不要浪费钱，其他用户列出的那些问题我几乎都遇到了。",
  "67b559b9-0a14-4d00-ab68-8663e0f3f9e4": "购买了Pulsar Delta 3-in-1。干草仓可以工作，但蜡仓从未正常工作。退回销售点后，对方要求直接联系制造商。",
  "314a7fe4-368e-40f9-aa24-084e4c9ccedd": "干草模式只完成一次使用，之后设备便不再识别干草附件，整机无法使用。新设备出现这种情况令人失望。",
  "c65377a2-1a20-4b25-8ea3-6dc537709786": "干草模式完成第一仓后，第二仓时突然停止加热，只会白灯或透明灯闪三次后熄灭。电池切换模式正常；空载测试蜡附件似乎可以工作。",
  "07192df6-0d35-463a-b203-0217fd34bef7": "这支设备的电池很差。理念不错，但预热几次后就没电，几乎每次使用后都必须充电。",
  "ab8674d4-56f1-4ab5-a6ae-6075d33525e5": "拧下蜡雾化器时，510连接部件从电池上分离，之后设备无法工作。我已发邮件并得到回复；虽然知道是自己弄坏的，但希望确认能否单独购买智能电池。",
  "204f0d76-3be6-4b3c-ba08-c98862019944": "别买。评论只表达强烈不满，未提供可验证的具体故障现象。",
  "076b0479-2bb2-44fc-a005-2dc6eebd673a": "吸入体验很差。",
  "bb2362a7-f7b6-4fed-859d-95ff440a4508": "等替换机到货后再回来补充评价；当前没有说明原设备的具体故障。",
};

const issueDefinitions = [
  { id: "module-connection", zh: "模块连接、识别或接触异常", en: "Module connection, recognition, or contact issue", pattern: /atomizer.*(?:stopped connecting|does not recognize|not recognize|no longer be recognized)|attachment.*(?:no longer be recognized|not recognize)|stopped recognizing|doesn.?t recognize|fitting.*unusable|small gap.*work|wax chamber never functioned/i },
  { id: "early-failure", zh: "到货即坏、报码关机或早期失效", en: "DOA, fault-code shutdown, or early failure", pattern: /stopped working|does not work|doesn.?t work|quit working|died|dead upon arrival|broke|first use|first 2 weeks|not even 24 hours|blink(?:s|ing)? (?:white|red)|flashes? (?:white|red)|turns? right off|powering off|short circuit/i },
  { id: "output", zh: "无蒸汽、输出弱、温度不足或吸入体验差", en: "No vapor, weak output, insufficient temperature, or poor hit", pattern: /no (?:vapor|smoke)|barely (?:puts out|any vapor)|doesn.?t hit very strong|not heat.*enough|doesn.?t heat|won.?t heat|stopped heating|don.?t get up to temp|burns? flower.*no vapor|roasts? your herb|preheat doesn.?t heat enough|bad hits|inconsistent|unreliable|unpredictable|flower doesn.?t burn/i },
  { id: "battery", zh: "充电、续航或电源管理异常", en: "Charging, battery-life, or power-management issue", pattern: /charg(?:e|ing)|dies quickly|dead after|recharging port|battery (?:is trash|dies)|couple of preheats|charged after every use|powering off/i },
  { id: "airflow", zh: "气流受阻、吸阻大或无法抽吸", en: "Restricted airflow, hard draw, or no draw", pattern: /no air ?flow|hard to (?:draw|pull)|doesn.?t pull|wouldn.?t pull|no draw|air through it|like there is no airflow/i },
  { id: "thermal-safety", zh: "过热、烫伤、热液入口或泄漏风险", en: "Overheating, burn, hot-material ingestion, or leakage risk", pattern: /burn(?:ed)? my mouth|molten resin|resin starts leaking|hot to the touch|burn you|meltingly hot|melted a hole|warped|heats up.*expands/i },
  { id: "structure", zh: "结构件、材料耐久或固定不良", en: "Structural, material-durability, or retention issue", pattern: /internal battery unit.*come out|bowl broke|melted through|bottom (?:piece|tray).*fall|mouthpiece wouldn.?t stay|warped|510 .*apart from the battery|silicone.*expands/i },
  { id: "contamination", zh: "开箱污染物或清洁状态异常", en: "Contamination or cleanliness concern at opening", pattern: /something gross.*atomizer|dirty|contaminat/i },
  { id: "support", zh: "客服、保修、换货或回复体验", en: "Support, warranty, replacement, or response experience", pattern: /support|customer service|warranty|claim|replacement|contact the manufacturer|sent an email|heard back|no response|did not respond|don.?t answer|point of sale/i },
  { id: "instructions", zh: "说明书、按键、震动或灯光反馈不清", en: "Unclear instructions, controls, haptics, or light feedback", pattern: /directions|instructions?|manual|button|haptic|blink(?:s|ing)? (?:white|red)|flashes? (?:white|red)|re-select your temp/i },
  { id: "taste", zh: "异味、化学味或口感差", en: "Off taste, chemical taste, or poor flavor", pattern: /bad taste|bad-tasting|chemical-like|taste bad|taste had an .off/i },
  { id: "packaging-claims", zh: "包装不可用或宣传与体验不一致", en: "Unusable packaging or claims mismatch", pattern: /packag(?:e|ing)|advertise|color chang/i },
  { id: "unspecified", zh: "不满意或换货，但缺少可验证故障描述", en: "Dissatisfaction or replacement without a testable failure description", pattern: /\bsmh\b|bad hits|replacement gets here|medical patient.*wasted|extreme dissatisfaction/i },
];

function clean(value = "") {
  return value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\n{3,}/g, "\n\n").trim();
}

async function fetchProduct(product) {
  const all = [];
  let first;
  for (let page = 1; page <= 1000; page += 1) {
    const url = new URL(API);
    url.search = new URLSearchParams({ product_id: product.productId, per_page: "30", shop_domain: SHOP, platform: "shopify", page: String(page) });
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${product.key}: Judge.me ${response.status}`);
    const payload = await response.json();
    if (page === 1) first = payload;
    all.push(...(payload.reviews || []));
    if ((payload.reviews || []).length < 30 || all.length >= Number(first.number_of_reviews)) break;
  }
  const unique = [...new Map(all.map((review) => [review.uuid, review])).values()];
  if (unique.length !== Number(first.number_of_reviews)) throw new Error(`${product.key}: 分页不完整，保留上一成功快照；${unique.length}/${first.number_of_reviews}`);
  return { first, all: unique };
}

function summarize(reviews, reportedCount, reportedAverage) {
  const distribution = [1, 2, 3, 4, 5].map((rating) => ({ rating, count: reviews.filter((r) => r.rating === rating).length }));
  return {
    total: Number(reportedCount ?? reviews.length), fetched: reviews.length, average: Number(reportedAverage || 0),
    positive: reviews.filter((r) => r.rating >= 4).length,
    neutral: reviews.filter((r) => r.rating === 3).length,
    negative: reviews.filter((r) => r.rating <= 2).length,
    distribution,
  };
}

const prior = JSON.parse(await readFile(SYND_R_SOURCE, "utf8"));
const priorSyndrRows = prior.queries?.["multi-model-review-snapshot"]?.rows || prior.queries?.["syndr-review-snapshot"]?.rows || [];
const generatedAt = new Date().toISOString();
const modelData = [];

for (const product of products) {
  const { first, all } = await fetchProduct(product);
  const priorById = new Map(priorSyndrRows.map((r) => [r.uuid, r]));
  const reviews = all.map((r) => {
    const body = clean(r.body_html || "");
    const title = clean(r.title || "");
    const text = `${title} ${body}`;
    const old = priorById.get(r.uuid);
    const issues = product.key === "syndr" && old?.issues?.length
      ? old.issues.map((id) => ({ claims: "packaging-claims" }[id] || id))
      : issueDefinitions.filter((d) => d.pattern.test(text)).map((d) => d.id);
    return {
      uuid: r.uuid, rating: Number(r.rating || 0), title, body,
      translationZh: old?.body === body ? old.translationZh || translations[r.uuid] || "" : translations[r.uuid] || "",
      name: r.reviewer_name || "Anonymous", country: r.location_country || "未显示",
      date: String(r.created_at || "").slice(0, 10), verified: Boolean(r.verified_buyer),
      avatar: r.avatar_image_url || "", variant: r.product_variant_title || "", pictures: r.pictures_urls || [],
      issues: issues.length ? issues : Number(r.rating) <= 2 ? ["unspecified"] : [], productKey: product.key, internalCode: product.internalCode, model: product.model, sourceUrl: product.productUrl,
    };
  });
  const negative = reviews.filter((r) => r.rating <= 2);
  if (negative.some((r) => !r.issues.length)) throw new Error(`${product.key}: 存在未归类差评 ${negative.filter((r) => !r.issues.length).map((r) => r.uuid).join(",")}`);
  modelData.push({ ...product, fetchedAt: generatedAt, reviews, summary: summarize(reviews, first.number_of_reviews, first.average_rating) });
}

const allReviews = modelData.flatMap((m) => m.reviews);
const totalStars = allReviews.reduce((sum, r) => sum + r.rating, 0);
const allSummary = summarize(allReviews, allReviews.length, totalStars / allReviews.length);
const snapshot = {
  id: prior.id || "report:3d8839fc-c68b-4823-b939-64037bc478bf",
  surface: "report",
  title: "Pulsar三型号公开评论品质分析",
  generatedAt,
  status: "observed",
  artifact: { title: "Pulsar三型号公开评论品质分析", surface: "report", asOf: generatedAt, timezone: "Asia/Shanghai" },
  buildStatus: "creating",
  report: { asOf: generatedAt.slice(0, 10) },
  exportPreferences: { selected: [], destinations: [] },
  summary: { ...allSummary, definition: "好评=4–5星；中性/混合=3星；差评=1–2星。" },
  models: modelData,
  issueDefinitions: issueDefinitions.map(({ pattern, ...item }) => item),
  source: {
    provider: "Judge.me public review widget on Pulsar Shop",
    fetchedAt: generatedAt,
    directReviewLinksAvailable: false,
    caveat: "官网公开评论属于自愿发表的用户反馈，没有销量、退货或故障事件分母；问题提及率不是故障率。自动归类为品质复核线索，不认定根因。",
  },
  queries: {
    "multi-model-review-snapshot": {
      rows: allReviews,
      source: {
        provider: "Judge.me",
        urls: products.map((p) => p.productUrl),
        evidenceFlow: modelData.map((m) => ({ title: `${m.internalCode} · ${m.model}`, detail: `${m.productUrl}; product_id=${m.productId}; fetched=${m.reviews.length}` })),
        metricDefinitions: [
          { label: "好评数", definition: "评分为4星或5星的去重公开评论数。", componentIds: ["metric-positive"] },
          { label: "差评数", definition: "评分为1星或2星的去重公开评论数。", componentIds: ["metric-negative", "negative-archive"] },
          { label: "问题提及数", definition: "在1–2星评论中命中对应可复核问题标签的评论数；同一评论可命中多个问题。", componentIds: ["issue-summary"] },
        ],
      },
      methods: [{ language: "JavaScript", code: "按UUID保留公开评论；4–5星为好评、3星为中性/混合、1–2星为差评；问题标签为自动初筛并保留原文与中文翻译供人工复核。" }],
    },
  },
};

const sourceSignature = (data) => JSON.stringify((data.models || []).map((model) => ({ key: model.key, count: model.summary.total, average: model.summary.average, reviews: model.reviews.map(({ translationZh, issues, ...review }) => review).sort((a, b) => a.uuid.localeCompare(b.uuid)) })));
const changed = sourceSignature(snapshot) !== sourceSignature(prior);
const pendingTranslations = allReviews.filter((review) => review.rating <= 2 && !review.translationZh).map(({ uuid, model, body }) => ({ uuid, model, body }));
await writeFile(resolve(OUTPUT), JSON.stringify(changed ? snapshot : prior, null, 2));
console.log(JSON.stringify({ output: resolve(OUTPUT), changed, generatedAt, pendingTranslations, models: modelData.map((m) => ({ key: m.key, summary: m.summary })), all: allSummary }, null, 2));
