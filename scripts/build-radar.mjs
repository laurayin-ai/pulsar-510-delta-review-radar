import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "dist/index.html");
const SHOP = "pulsar-vaporizers.myshopify.com";
const API = "https://api.judge.me/reviews/reviews_for_widget";

const products = [
  {
    key: "syndr",
    internalCode: "G-069",
    model: "SYNDR",
    title: "Pulsar SYNDR Dry Herb Vaporizer",
    productId: "7344082387059",
    handle: "syndr-dry-herb-vaporizer",
    aliases: ["SYNDR THERMO DISP", "SYNDR THERMO DISPLAY"],
  },
  {
    key: "hall-pass",
    internalCode: "D-153",
    model: "Hall Pass",
    title: "Pulsar 510 Hall Pass Vaporizer",
    productId: "8151305748595",
    handle: "510-hall-pass-vaporizer",
    aliases: ["Hall Pass DISP", "Hall Pass BL", "Hall Pass GR", "Hall Pass YL"],
  },
  {
    key: "dl-wax",
    internalCode: "G-077",
    model: "DL wax box",
    title: "Pulsar DL Wax Vape Bar",
    productId: "7449570705523",
    handle: "dl-wax-vape-bar",
    aliases: ["DL Wax Box Display", "DL Wax Box Black DISP"],
  },
  {
    key: "dl-6",
    internalCode: "D-148A",
    model: "DL 6.0",
    title: "Pulsar 510 DL 6.0 Auto-Draw Vape Bar",
    productId: "8150619029619",
    handle: "510-dl-6-vape-bar",
    aliases: ["DL 6.0 GR", "DL 6.0 BL", "DL 6.0 PU", "DL 6.0 BK", "DL 6.0 DISP"],
  },
  {
    key: "delta-3in1",
    internalCode: "G-151",
    model: "Delta 3-in-1",
    title: "Pulsar 510 Delta 3-in-1 Vaporizer Kit",
    productId: "8151119200371",
    handle: "510-delta-3-in-1-vaporizer-kit",
    aliases: ["3 in 1 BK", "3 in 1 BL", "3 in 1 PU", "3 in 1 DISP", "DELTA BOX DISP"],
  },
  {
    key: "chorus",
    internalCode: "G-103",
    model: "Chorus",
    title: "Pulsar Chorus Concentrate Vaporizer",
    productId: "8130909896819",
    handle: "chorus-concentrate-vaporizer",
    aliases: ["Chorus", "G103-Coil"],
  },
  {
    key: "dabtron-2",
    internalCode: "G-132",
    model: "Dabtron 2.0",
    title: "Pulsar Dabtron 2.0 Electric Dab Rig",
    productId: "8037489442931",
    handle: "dabtron-2-electric-dab-rig",
    aliases: ["Dabtron 2.0"],
  },
  {
    key: "510-daily",
    internalCode: "D-176",
    model: "510 Daily",
    title: "SeshGear 510 Daily Auto-Draw Vape Bar",
    productId: "8409116115059",
    handle: "seshgear-510-daily-vape-bar",
    aliases: ["510 Daily", "SeshGear 510 Daily"],
  },
  {
    key: "relay",
    internalCode: "D-170",
    model: "Relay",
    title: "Pulsar 510 Relay Power Bank Vaporizer",
    productId: "8408961187955",
    handle: "pulsar-510-relay-power-bank-vaporizer",
    aliases: ["Relay"],
  },
  {
    key: "voyager",
    internalCode: "G-158",
    model: "Voyager",
    title: "Pulsar Voyager Dry Herb Vape Bar",
    productId: "8407509106803",
    handle: "pulsar-voyager-dry-herb-pod-vape-bar",
    aliases: ["Voyager"],
  },
];

const monitoring = [
  { internalCode: "D-026A", model: "CORE 510 Battery", aliases: ["D-026A", "CORE 510 Battery"] },
  { internalCode: "D-173", model: "Delta SMART BOX", aliases: ["D-173", "Delta SMART BOX"] },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function textFromHtml(value = "") {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchPage(productId, page) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    product_id: productId,
    page: String(page),
    per_page: "30",
    shop_domain: SHOP,
    platform: "shopify",
  });
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Judge.me ${response.status}: ${url}`);
  return response.json();
}

async function fetchProduct(product) {
  const first = await fetchPage(product.productId, 1);
  const total = Number(first.number_of_reviews || 0);
  const pages = Math.max(1, Math.ceil(total / 30));
  const reviews = [...(first.reviews || [])];
  for (let page = 2; page <= pages; page += 1) {
    await sleep(180);
    const data = await fetchPage(product.productId, page);
    reviews.push(...(data.reviews || []));
  }
  return {
    ...product,
    sourceUrl: `https://www.pulsarshop.com/products/${product.handle}`,
    reportedCount: total,
    reportedAverage: Number(first.average_rating || 0),
    reviews: reviews.map((review) => ({
      uuid: review.uuid,
      rating: Number(review.rating || 0),
      title: textFromHtml(review.title || ""),
      body: textFromHtml(review.body_html || ""),
      name: review.reviewer_name || "Anonymous",
      initial: review.reviewer_initial || (review.reviewer_name || "?").slice(0, 1).toUpperCase(),
      country: review.location_country || "",
      countryCode: review.location_country_code || "",
      date: String(review.created_at || "").slice(0, 10),
      verified: Boolean(review.verified_buyer),
      avatar: review.avatar_image_url || "",
      variant: review.product_variant_title || "",
      pictures: review.pictures_urls || [],
    })),
  };
}

const collected = [];
for (const product of products) {
  collected.push(await fetchProduct(product));
  await sleep(220);
}

const seen = new Set();
const reviews = [];
for (const product of collected) {
  for (const review of product.reviews) {
    if (!review.uuid || seen.has(review.uuid)) continue;
    seen.add(review.uuid);
    reviews.push({
      ...review,
      productKey: product.key,
      internalCode: product.internalCode,
      model: product.model,
      productTitle: product.title,
      sourceUrl: product.sourceUrl,
    });
  }
}
reviews.sort((a, b) => b.date.localeCompare(a.date) || b.rating - a.rating);

const modelData = collected.map(({ reviews: productReviews, ...product }) => ({
  ...product,
  fetchedCount: productReviews.length,
}));
const generatedAt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date());

const payload = JSON.stringify({ models: modelData, monitoring, reviews, generatedAt }).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Pulsar 12 组内部型号与客户型号官网评论雷达：按已上线型号筛选、检索和复核用户反馈。">
  <title>Pulsar 多型号用户评论雷达</title>
  <style>
    :root{--bg:#0b0e10;--panel:#12171a;--panel2:#182025;--ink:#eef2f3;--muted:#8b9aa2;--line:#28343a;--cyan:#63d6df;--green:#7bd89a;--yellow:#f3c85c;--red:#ff7770;--orange:#ff9b50}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:1240px;margin:auto;padding:0 24px}.hero{padding:70px 0 42px;background:radial-gradient(circle at 80% 12%,rgba(99,214,223,.15),transparent 34%),linear-gradient(180deg,#11181c 0,var(--bg) 100%);border-bottom:1px solid var(--line)}.eyebrow{font:700 11px/1.4 ui-monospace,monospace;letter-spacing:.18em;color:var(--cyan);text-transform:uppercase}h1{font-size:clamp(38px,7vw,78px);line-height:.93;letter-spacing:-.055em;margin:18px 0 20px;max-width:980px}.hero p{max-width:760px;color:#b7c2c7;font-size:17px;line-height:1.7}.scope{margin-top:22px;border-left:3px solid var(--orange);padding:10px 14px;background:rgba(255,155,80,.08);color:#c9d0d3;font-size:13px;max-width:900px}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:28px 0 54px}.metric{min-height:112px;padding:17px;background:var(--panel);border:1px solid var(--line);border-radius:12px}.metric strong{display:block;font-size:28px;margin-bottom:12px}.metric span{color:var(--muted);font-size:12px}.metric.good strong{color:var(--green)}.metric.bad strong{color:var(--red)}section{margin:46px 0}.section-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:16px}.section-head h2{font-size:24px;margin:0}.section-head p{margin:0;color:var(--muted);font-size:12px}.coverage{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.model-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}.model-top{display:flex;justify-content:space-between;gap:12px}.model-card h3{font-size:15px;margin:0}.status{font-size:10px;border:1px solid #315a41;color:var(--green);border-radius:999px;padding:4px 7px;white-space:nowrap}.status.watch{color:var(--yellow);border-color:#66582d}.model-card p{margin:10px 0 0;color:var(--muted);font-size:11px;line-height:1.55}.model-card a{color:var(--cyan)}.issues{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.issue{padding:16px;background:var(--panel);border:1px solid var(--line);border-radius:12px}.issue strong{font-size:27px;color:var(--orange)}.issue h3{font-size:14px;margin:8px 0}.issue p{font-size:12px;color:var(--muted);line-height:1.55;margin:0}.toolbar{position:sticky;top:0;z-index:8;background:rgba(11,14,16,.94);backdrop-filter:blur(16px);border-block:1px solid var(--line);padding:12px 0}.toolbar-inner{max-width:1240px;margin:auto;padding:0 24px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.select,.search{background:#101619;border:1px solid var(--line);color:var(--ink);padding:9px 11px;border-radius:7px}.select{min-width:245px}.search{margin-left:auto;min-width:280px}.filter{border:1px solid var(--line);background:var(--panel);color:#c5d0d4;padding:8px 10px;border-radius:7px;cursor:pointer}.filter.active{background:var(--cyan);border-color:var(--cyan);color:#071114}.select:focus-visible,.search:focus-visible,.filter:focus-visible{outline:3px solid rgba(99,214,223,.3);outline-offset:2px}.results{display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:12px;margin:18px 0 12px}.reviews{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.review{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;display:grid;grid-template-columns:46px 1fr;gap:14px}.avatar{width:44px;height:44px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,#28464e,#17272d);border:1px solid #35535b;color:var(--cyan);font-weight:850;font-size:18px;overflow:hidden}.avatar img{width:100%;height:100%;object-fit:cover}.who{display:flex;justify-content:space-between;gap:12px}.name{font-weight:750}.meta{color:var(--muted);font-size:11px;line-height:1.6}.stars{color:var(--yellow);letter-spacing:1px;white-space:nowrap}.quote{white-space:pre-line;margin:14px 0 12px;line-height:1.58;color:#e1e7e9}.badges{display:flex;gap:6px;flex-wrap:wrap}.badge{font-size:10px;line-height:1;border-radius:999px;padding:5px 7px;background:#202a30;color:#adbac0;border:1px solid #2b373e}.badge.model{color:var(--cyan);border-color:#315861}.badge.verified{color:var(--green);border-color:#315a41}.badge.alert{color:#ffaaa4;border-color:#67413e}.uuid{margin-top:12px;color:#65747b;font:10px ui-monospace,monospace;word-break:break-all}.empty{display:none;text-align:center;border:1px dashed var(--line);color:var(--muted);padding:42px;border-radius:12px}.method{background:#11171b;border:1px solid var(--line);border-radius:12px;padding:20px;color:#aeb9bf;font-size:12px}.method-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.method strong{color:#e7ecee}.method p{margin:5px 0;line-height:1.55}.method a{color:var(--cyan)}footer{border-top:1px solid var(--line);margin-top:18px;padding-top:16px;color:#718089;font-size:11px}.source-list{padding-left:18px;margin:8px 0}.source-list li{margin:5px 0}@media(max-width:900px){.metrics{grid-template-columns:repeat(2,1fr)}.coverage,.issues{grid-template-columns:1fr 1fr}.reviews{grid-template-columns:1fr}.search{margin-left:0;flex:1}.method-grid{grid-template-columns:1fr}}@media(max-width:620px){.shell,.toolbar-inner{padding-inline:16px}.hero{padding-top:48px}.metrics,.coverage,.issues{grid-template-columns:1fr}.select,.search{width:100%;min-width:0}.review{grid-template-columns:38px 1fr;padding:14px}.avatar{width:36px;height:36px}.section-head{align-items:start;flex-direction:column}}
    .metrics{margin-bottom:24px}.filter-panel{position:sticky;top:0;z-index:8;background:rgba(11,14,16,.96);backdrop-filter:blur(16px);border:1px solid var(--line);border-radius:12px;padding:16px}.filter-panel .toolbar-inner{padding:0;max-width:none}.filter-panel .results{margin:14px 0 0}.code{color:var(--cyan);font:700 11px ui-monospace,monospace;margin-bottom:6px}@media(max-width:620px){.filter-panel{position:static}}
  </style>
</head>
<body>
  <header class="hero"><div class="shell"><div class="eyebrow">Official review archive · 12-model monitor</div><h1>PULSAR MULTI-MODEL<br>REVIEW RADAR</h1><p>按已确认的“内部型号 → 客户型号”关系映射 Pulsar Shop 已上线产品，集中展示公开评论。支持按型号、评分和关键词筛选；未上线或无法可靠确认的新品继续进入每周监测。</p><div class="scope">证据边界：评论是官网用户反馈，不等于销量、退货率或总体故障率；“未上线 / 待确认”表示当前公开目录中没有足够证据，不代表产品不存在。</div></div></header>
  <main class="shell">
    <section class="metrics" aria-label="评论数据概览">
      <div class="metric"><strong id="mReviews">—</strong><span>已去重公开评论</span></div>
      <div class="metric"><strong id="mAverage">—</strong><span>当前筛选平均评分</span></div>
      <div class="metric good"><strong id="mPositive">—</strong><span>4–5 星评论</span></div>
      <div class="metric bad"><strong id="mNegative">—</strong><span>1–3 星评论</span></div>
      <div class="metric"><strong>${products.length} / 12</strong><span>已上线可确认 / 总监测型号</span></div>
    </section>
    <section class="filter-panel" aria-label="全部已上线型号筛选框"><div class="section-head"><h2>全部已上线型号筛选框</h2><p>先选型号，再查看对应问题信号和评论原文</p></div><div class="toolbar-inner">
      <select class="select" id="productFilter" aria-label="按型号筛选"></select>
      <button class="filter active" data-rating="all">全部</button><button class="filter" data-rating="5">5星</button><button class="filter" data-rating="4">4星</button><button class="filter" data-rating="3">3星</button><button class="filter" data-rating="2">2星</button><button class="filter" data-rating="1">1星</button>
      <input class="search" id="search" type="search" placeholder="搜索用户、国家、型号或评论原文…" aria-label="搜索评论">
    </div><div class="results"><span id="resultCount"></span><span id="updatedAt"></span></div></section>
    <section><div class="section-head"><h2>当前筛选问题信号</h2><p>关键词归类可重叠，仅用于研发讨论线索</p></div><div class="issues" id="issues"></div></section>
    <section><div class="section-head"><h2>具体评论内容</h2><p>保留用户、国家、头像、日期、评分、变体与原文</p></div><div class="reviews" id="reviews" aria-live="polite"></div><div class="empty" id="empty">当前条件下没有评论。</div></section>
    <section><div class="section-head"><h2>型号映射与上线状态</h2><p>评论区之后的监测附录；每周一复核全部 12 个型号</p></div><div class="coverage" id="coverage"></div></section>
    <section class="method"><div class="method-grid"><div><strong>抓取口径</strong><p>逐型号读取 Judge.me 公开接口全部分页；按 review UUID 全局去重，并保留型号、变体、国家、日期、评分、Verified 与头像字段。</p></div><div><strong>型号映射</strong><p>图片中的 12 组内部型号与客户型号为权威映射。只有官网名称或产品页可明确核验时才标记“已上线”；歧义结果不强行关联。</p></div><div><strong>头像与证据边界</strong><p>仅展示官网返回的真实头像 URL；缺失时显示姓名首字母。评论量、评分和关键词数量不能推算销量或缺陷率。</p></div></div><footer><strong>已匹配官网源页</strong><ul class="source-list" id="sources"></ul><p>生成时间：<span id="generated"></span>（Asia/Shanghai）。本页为公开评论证据存档，不会修改源网站。</p></footer></section>
  </main>
  <script id="radar-data" type="application/json">${payload}</script>
  <script>
    const data=JSON.parse(document.getElementById('radar-data').textContent);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const flags={US:'🇺🇸',CA:'🇨🇦',CL:'🇨🇱',NL:'🇳🇱',GB:'🇬🇧',AU:'🇦🇺',DE:'🇩🇪',FR:'🇫🇷',MX:'🇲🇽'};let activeRating='all';
    const productFilter=document.getElementById('productFilter'),search=document.getElementById('search'),container=document.getElementById('reviews'),empty=document.getElementById('empty');
    productFilter.innerHTML='<option value="all">全部已上线型号</option>'+data.models.map(m=>'<option value="'+esc(m.key)+'">'+esc(m.internalCode)+' · '+esc(m.model)+' · '+m.fetchedCount+'条</option>').join('');
    document.getElementById('coverage').innerHTML=data.models.map(m=>'<article class="model-card"><div class="model-top"><div><div class="code">'+esc(m.internalCode)+'</div><h3>'+esc(m.model)+'</h3></div><span class="status">已上线 · '+m.fetchedCount+'条</span></div><p>'+m.aliases.map(esc).join(' / ')+'</p><p><a href="'+esc(m.sourceUrl)+'" target="_blank" rel="noreferrer">'+esc(m.title)+'</a></p></article>').join('')+data.monitoring.map(m=>'<article class="model-card"><div class="model-top"><div><div class="code">'+esc(m.internalCode)+'</div><h3>'+esc(m.model)+'</h3></div><span class="status watch">未上线 / 待确认</span></div><p>'+m.aliases.map(esc).join(' / ')+'</p><p>官网当前没有唯一、可可靠确认的产品页或评论源；每周继续检索。</p></article>').join('');
    document.getElementById('sources').innerHTML=data.models.map(m=>'<li><strong>'+esc(m.internalCode)+' · '+esc(m.model)+'</strong> — <a href="'+esc(m.sourceUrl)+'">'+esc(m.title)+'</a> · '+m.fetchedCount+' 条</li>').join('');document.getElementById('generated').textContent=data.generatedAt;document.getElementById('updatedAt').textContent='更新 '+data.generatedAt;
    const issueDefs=[['连接 / 识别 / 无法工作',/(connect|connection|recogn|detect|not work|stopped working|won.?t work|doesn.?t work|dead|flash|blink|atomizer|contact)/i,'重点复核接点、识别阈值、装配公差与短期失效。'],['电池 / 充电 / 续航',/(battery|charge|charging|usb|power|drain|lasts? only|die[sd]? quickly)/i,'复核充放电、待机功耗、端口与电量指示。'],['温度 / 过热 / 烫伤',/(hot|heat|burn|melt|temperature|overheat|scorch)/i,'低频高严重度内容需优先做热安全复现。'],['堵塞 / 吸阻 / 气道',/(clog|draw|pull|airflow|air flow|hard to hit|restrict)/i,'复核气道阻力、冷凝与油液黏度容差。'],['耐久 / 破损 / 材料',/(broke|broken|crack|wear|durab|cheap|plastic|material|fell apart|leak)/i,'复核跌落、循环、材料与连接结构寿命。'],['说明 / 包装 / 学习成本',/(instruction|manual|packag|case|learning curve|confus|figure out)/i,'区分包装工艺与使用信息设计问题。']];
    function baseList(){const key=productFilter.value,q=search.value.trim().toLowerCase();return data.reviews.filter(r=>(key==='all'||r.productKey===key)&&(!q||[r.name,r.country,r.internalCode,r.model,r.productTitle,r.variant,r.title,r.body].join(' ').toLowerCase().includes(q)));}
    function updateIssues(list){const low=list.filter(r=>r.rating<=3);document.getElementById('issues').innerHTML=issueDefs.map(([name,re,note])=>{const count=low.filter(r=>re.test(r.title+' '+r.body)).length;return '<article class="issue"><strong>'+count+'</strong><h3>'+name+'</h3><p>'+note+'</p></article>'}).join('');}
    function render(){
      const base=baseList(),list=base.filter(r=>activeRating==='all'||String(r.rating)===activeRating);
      const avg=base.length?base.reduce((s,r)=>s+r.rating,0)/base.length:0,pos=base.filter(r=>r.rating>=4).length,neg=base.length-pos;
      document.getElementById('mReviews').textContent=base.length;document.getElementById('mAverage').textContent=base.length?avg.toFixed(2)+' / 5':'—';document.getElementById('mPositive').textContent=pos;document.getElementById('mNegative').textContent=neg;
      document.querySelectorAll('.filter').forEach(b=>{const n=b.dataset.rating==='all'?base.length:base.filter(r=>String(r.rating)===b.dataset.rating).length;b.textContent=(b.dataset.rating==='all'?'全部':b.dataset.rating+'星')+' '+n});updateIssues(base);
      container.innerHTML=list.map(r=>{const issue=r.rating<=3&&issueDefs.some(([,re])=>re.test(r.title+' '+r.body));const avatar=r.avatar?'<img src="'+esc(r.avatar)+'" alt="'+esc(r.name)+' 用户头像" loading="lazy">':esc(r.initial||'?');return '<article class="review"><div class="avatar">'+avatar+'</div><div><div class="who"><div><div class="name">'+esc(r.name)+'</div><div class="meta">'+(flags[r.countryCode]||'🌐')+' '+esc(r.country||'国家未显示')+' · '+esc(r.date)+'<br>'+esc(r.productTitle)+(r.variant?' · '+esc(r.variant):'')+'</div></div><div class="stars" aria-label="'+r.rating+' out of 5 stars">'+'★'.repeat(r.rating)+'☆'.repeat(5-r.rating)+'</div></div>'+(r.title?'<strong>'+esc(r.title)+'</strong>':'')+'<p class="quote">'+esc(r.body||'（评论正文为空）')+'</p><div class="badges"><span class="badge model">'+esc(r.internalCode)+' · '+esc(r.model)+'</span><span class="badge">'+r.rating+' / 5</span>'+(r.verified?'<span class="badge verified">Verified</span>':'<span class="badge">未显示 Verified</span>')+(issue?'<span class="badge alert">问题信号</span>':'')+(r.avatar?'':'<span class="badge">头像：官网首字母</span>')+'</div><div class="uuid">REVIEW UUID · '+esc(r.uuid)+'</div></div></article>'}).join('');
      document.getElementById('resultCount').textContent='当前显示 '+list.length+' / '+base.length+' 条';empty.style.display=list.length?'none':'block';
    }
    document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeRating=btn.dataset.rating;render()}));productFilter.addEventListener('change',render);search.addEventListener('input',render);render();
  </script>
</body>
</html>`;

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, html, "utf8");
console.log(JSON.stringify({ output: OUTPUT, models: modelData.length, monitoring: monitoring.length, reviews: reviews.length, generatedAt }, null, 2));
