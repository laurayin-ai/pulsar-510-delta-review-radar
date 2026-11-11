(() => {
  const data = JSON.parse(document.getElementById("radar-data").textContent);
  const LOCAL_KEY = "pulsar-oem-collaboration-v2";
  const statusOptions = ["待复核","待验证","验证中","待决策","改进中","验证通过","已导入","效果跟踪","已关闭","未复现","证据不足","暂缓"];
  const teamOptions = ["待指定","产品","研发","品质","业务","供应链","制造","包装","跨团队"];
  const severityOptions = ["全部严重程度","安全优先复核","高","中","低","待评估"];
  const journeySteps = ["开箱与理解","装载与连接","启动与预热","吸入体验","连续使用","清洁维护","充电","长期耐久"];
  const flags = {US:"🇺🇸",CA:"🇨🇦",CL:"🇨🇱",NL:"🇳🇱",GB:"🇬🇧",AU:"🇦🇺",DE:"🇩🇪",FR:"🇫🇷",MX:"🇲🇽"};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safe = (fn, fallback = {}) => { try { return fn(); } catch { return fallback; } };
  let local = safe(() => JSON.parse(localStorage.getItem(LOCAL_KEY)), null) || { version:2, issues:{}, opportunities:{}, evidenceExclusions:{} };
  local.issues ||= {}; local.opportunities ||= {}; local.evidenceExclusions ||= {};
  let visibleReviewLimit = 80;

  const els = {
    product:$("productFilter"), category:$("categoryFilter"), rating:$("ratingFilter"), time:$("timeFilter"),
    from:$("dateFrom"), to:$("dateTo"), search:$("searchInput"), dialog:$("issueDialog"), toast:$("toast")
  };

  function saveLocal() {
    local.updatedAt = new Date().toISOString();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
  }
  function toast(message) {
    els.toast.textContent = message; els.toast.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function options(items, selected) { return items.map((v) => `<option value="${esc(v)}"${v===selected?" selected":""}>${esc(v)}</option>`).join(""); }

  function initControls() {
    els.product.innerHTML = '<option value="all">全部已上线型号</option>' + data.models.map((m) => `<option value="${esc(m.key)}">${esc(m.internalCode)} · ${esc(m.model)} · ${m.fetchedCount}条</option>`).join("");
    const categories = [...new Set(data.models.map((m) => m.category))];
    els.category.innerHTML = '<option value="all">全部产品类别</option>' + categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    $("issueStatusFilter").innerHTML = options(["全部状态",...statusOptions], "全部状态");
    $("teamFilter").innerHTML = options(["全部团队",...teamOptions], "全部团队");
    $("severityFilter").innerHTML = options(severityOptions, "全部严重程度");
    $("issueTypeFilter").innerHTML = options(["全部问题类型",...new Set(data.issueDefinitions.map((d)=>d.type))], "全部问题类型");
    $("componentFilter").innerHTML = options(["全部涉及部件",...new Set(data.issueDefinitions.flatMap((d)=>d.components))], "全部涉及部件");
    const params = new URLSearchParams(location.search);
    if ([...els.product.options].some((o) => o.value === params.get("product"))) els.product.value = params.get("product");
    if ([...els.category.options].some((o) => o.value === params.get("category"))) els.category.value = params.get("category");
    if ([...els.rating.options].some((o) => o.value === params.get("rating"))) els.rating.value = params.get("rating");
    if ([...els.time.options].some((o) => o.value === params.get("time"))) els.time.value = params.get("time");
    if (params.get("from")) els.from.value = params.get("from");
    if (params.get("to")) els.to.value = params.get("to");
    if (params.get("q")) els.search.value = params.get("q");
    setView(params.get("view") || "focus", false);
  }

  function getDateBounds() {
    const today = new Date();
    if (els.time.value === "custom") return {from:els.from.value, to:els.to.value};
    if (els.time.value === "all") return {from:"",to:""};
    const from = new Date(today); from.setDate(today.getDate() - Number(els.time.value));
    return {from:from.toISOString().slice(0,10),to:today.toISOString().slice(0,10)};
  }
  function currentReviews() {
    const {from,to} = getDateBounds(), q = els.search.value.trim().toLowerCase();
    return data.reviews.filter((r) =>
      (els.product.value === "all" || r.productKey === els.product.value) &&
      (els.category.value === "all" || r.category === els.category.value) &&
      (els.rating.value === "all" || String(r.rating) === els.rating.value) &&
      (!from || r.date >= from) && (!to || r.date <= to) &&
      (!q || [r.name,r.country,r.internalCode,r.model,r.category,r.productTitle,r.variant,r.title,r.body,...r.analysis.issues,...r.analysis.strengths,...r.analysis.components,...r.analysis.journey].join(" ").toLowerCase().includes(q))
    );
  }
  function modelFullReviews() {
    return data.reviews.filter((r) => els.product.value === "all" || r.productKey === els.product.value);
  }
  const average = (rows) => rows.length ? rows.reduce((s,r) => s + r.rating, 0) / rows.length : null;
  const issueDef = (id) => data.issueDefinitions.find((d) => d.id === id);
  const issueLocal = (id) => ({status:"待复核",team:"待指定",owner:"",due:"",severity:issueDef(id)?.severity || "待评估",notes:"",hypothesis:"",result:"",version:"",batch:"",acceptance:"",next:"",...local.issues[id]});
  const isExcluded = (issueId, uuid) => Boolean(local.evidenceExclusions[issueId]?.[uuid]);
  function issueEvidence(def, rows = currentReviews()) { return rows.filter((r) => r.analysis.issues.includes(def.id) && !isExcluded(def.id,r.uuid)); }
  const uniqueEvents = (rows) => new Set(rows.map((r) => r.eventKey)).size;
  const modelNames = (rows) => [...new Set(rows.map((r) => `${r.internalCode} · ${r.model}`))];

  function syncUrl(extra = {}) {
    const p = new URLSearchParams();
    const active = document.querySelector(".view-tab.active")?.dataset.view || "focus";
    if (active !== "focus") p.set("view", active);
    if (els.product.value !== "all") p.set("product", els.product.value);
    if (els.category.value !== "all") p.set("category", els.category.value);
    if (els.rating.value !== "all") p.set("rating", els.rating.value);
    if (els.time.value !== "all") p.set("time", els.time.value);
    if (els.time.value === "custom" && els.from.value) p.set("from", els.from.value);
    if (els.time.value === "custom" && els.to.value) p.set("to", els.to.value);
    if (els.search.value.trim()) p.set("q", els.search.value.trim());
    Object.entries(extra).forEach(([k,v]) => v ? p.set(k,v) : p.delete(k));
    history.replaceState(null,"",location.pathname+(p.toString()?`?${p}`:""));
  }
  function setView(view, update = true) {
    if (!document.querySelector(`[data-view-panel="${CSS.escape(view)}"]`)) view = "focus";
    document.querySelectorAll(".view-tab").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    document.querySelectorAll("[data-view-panel]").forEach((p) => p.classList.toggle("active", p.dataset.viewPanel === view));
    if (update) syncUrl();
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function renderMetrics(rows) {
    const full = modelFullReviews(), avg = average(rows), modelAvg = average(full);
    $("mFilteredCount").textContent = rows.length;
    $("mFilteredAverage").textContent = avg == null ? "无匹配结果" : `${avg.toFixed(2)} / 5`;
    $("mFilteredScope").textContent = rows.length ? "严格应用当前全部筛选条件" : "当前条件下没有评论";
    $("mModelAverage").textContent = modelAvg == null ? "零评论" : `${modelAvg.toFixed(2)} / 5 · ${full.length}条`;
    const successes = data.models.filter((m) => m.fetchStatus === "success").length;
    $("mCoverage").textContent = `${data.models.length} / ${data.models.length + data.monitoring.length}`;
    $("mCoverage").nextElementSibling?.setAttribute("data-success",successes);
  }

  function renderFocus(rows) {
    const newRows = data.history.hasComparableSnapshot ? rows.filter((r) => data.history.newIds.includes(r.uuid)) : [];
    $("newFeedback").innerHTML = data.history.hasComparableSnapshot
      ? (newRows.length ? signalRows(newRows.slice(0,5).map((r) => ({count:r.rating,title:r.analysis.chineseSummary,meta:`${r.internalCode} · ${r.date}`,action:"review",id:r.uuid}))) : '<p class="empty-copy">与上一可比快照相比，当前筛选范围没有新增评论。</p>')
      : `<p class="status-copy">开始积累历史数据</p><p class="empty-copy">基线开始于 ${esc(new Date(data.history.baselineStartedAt).toLocaleString("zh-CN"))}；首次快照不计算新增、趋势或环比。</p>`;
    const safety = rows.filter((r) => r.analysis.safety);
    $("safetyQueue").innerHTML = safety.length ? signalRows(safety.slice(0,5).map((r) => ({count:"!",title:r.analysis.chineseSummary,meta:`${r.internalCode} · ${r.date} · ${r.rating}星`,action:"issue",id:"SAF-THERM-001"}))) : '<p class="empty-copy">当前筛选范围未命中明确安全关键词；这不是“已证明无安全问题”。</p>';
    const issueRows = data.issueDefinitions.map((d) => ({def:d,rows:issueEvidence(d,rows)})).filter((x) => x.rows.length).sort((a,b) => uniqueEvents(b.rows)-uniqueEvents(a.rows));
    $("recurringIssues").innerHTML = issueRows.length ? signalRows(issueRows.slice(0,5).map((x) => ({count:uniqueEvents(x.rows),title:x.def.title,meta:`${x.rows.length}/${rows.length}条评论提及 · ${modelNames(x.rows).join("、")}`,action:"issue",id:x.def.id}))) : '<p class="empty-copy">当前筛选范围没有命中预设问题信号。</p>';
    const locals = Object.entries(local.issues).map(([id,v]) => ({id,...v}));
    const overdue = locals.filter((v) => v.due && v.due < new Date().toISOString().slice(0,10) && !["已关闭","已导入","验证通过"].includes(v.status));
    const pending = locals.filter((v) => ["待验证","验证中"].includes(v.status));
    const decisions = locals.filter((v) => v.status === "待决策");
    $("taskQueue").innerHTML = `<div class="signal-list"><div class="signal-row"><span class="signal-count">${pending.length}</span><div><strong>待验证 / 验证中</strong><small>仅统计当前浏览器保存的协作记录</small></div></div><div class="signal-row"><span class="signal-count">${decisions.length}</span><div><strong>待决策</strong><small>未设置的状态不会被自动推断</small></div></div><div class="signal-row"><span class="signal-count">${overdue.length}</span><div><strong>逾期</strong><small>仅按本地录入的截止日期判断</small></div></div></div>`;
    const opps = opportunityRows(rows).sort((a,b)=>b.rows.length-a.rows.length);
    $("opportunityFocus").innerHTML = opps.length ? signalRows(opps.slice(0,4).map((x)=>({count:x.rows.length,title:x.def.title,meta:`${x.rows.length}/${rows.length}条相关评论 · 状态：${local.opportunities[x.def.id]?.status||"待验证"}`,action:"opportunity",id:x.def.id}))) : '<p class="empty-copy">当前筛选范围没有匹配到预设机会方向。</p>';
  }
  function signalRows(items) {
    return '<div class="signal-list">'+items.map((x)=>`<div class="signal-row"><span class="signal-count">${esc(x.count)}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.meta)}</small></div><button class="mini-link" data-open-${x.action}="${esc(x.id)}">查看证据</button></div>`).join("")+"</div>";
  }

  function renderExperience(rows) {
    $("journeyBoard").innerHTML = journeySteps.map((step) => {
      const matched = rows.filter((r) => r.analysis.journey.includes(step));
      return `<article class="journey-card"><h3>${esc(step)}</h3><strong>${matched.length}</strong><p>${rows.length ? `${matched.length}/${rows.length}条评论提及（可重叠）` : "无匹配评论"}</p><p>${esc(modelNames(matched).slice(0,4).join("、") || "暂无涉及型号")}</p></article>`;
    }).join("");
    const strengths = {};
    rows.forEach((r) => r.analysis.strengths.forEach((s) => strengths[s] = (strengths[s]||0)+1));
    const max = Math.max(1,...Object.values(strengths));
    $("strengthDenominator").textContent = `分母：当前筛选 ${rows.length} 条评论；标签可重叠`;
    $("strengths").innerHTML = Object.entries(strengths).sort((a,b)=>b[1]-a[1]).map(([name,n]) => `<div class="bar-row"><span>${esc(name)}</span><div class="bar"><i style="width:${(n/max)*100}%"></i></div><strong>${n}/${rows.length}</strong></div>`).join("") || '<p class="empty-copy">没有命中预设优点标签。</p>';
    const mixed = rows.filter((r) => r.rating >= 4 && r.analysis.mixed);
    $("mixedReviews").innerHTML = mixed.slice(0,8).map((r) => `<div class="review-snippet"><strong>${esc(r.internalCode)} · ${esc(r.model)} · ${r.rating}星</strong><p>${esc(r.analysis.chineseSummary)}</p><small>${esc((r.body||r.title).slice(0,180))}</small> <button class="mini-link" data-open-review="${esc(r.uuid)}">查看完整证据</button></div>`).join("") || '<p class="empty-copy">当前筛选范围没有高星混合评价。</p>';
  }

  function renderIssues(rows) {
    const statusFilter = $("issueStatusFilter").value, teamFilter = $("teamFilter").value, severityFilter = $("severityFilter").value, typeFilter = $("issueTypeFilter").value, componentFilter = $("componentFilter").value;
    const cards = data.issueDefinitions.map((def) => ({def, ev:issueEvidence(def,rows), local:issueLocal(def.id)}))
      .filter((x) => x.ev.length || local.issues[x.def.id])
      .filter((x) => statusFilter==="全部状态" || x.local.status===statusFilter)
      .filter((x) => teamFilter==="全部团队" || x.local.team===teamFilter)
      .filter((x) => severityFilter==="全部严重程度" || x.local.severity===severityFilter)
      .filter((x) => typeFilter==="全部问题类型" || x.def.type===typeFilter)
      .filter((x) => componentFilter==="全部涉及部件" || x.def.components.includes(componentFilter))
      .sort((a,b) => Number(b.def.id.startsWith("SAF"))-Number(a.def.id.startsWith("SAF")) || uniqueEvents(b.ev)-uniqueEvents(a.ev));
    $("issueCards").innerHTML = cards.map(({def,ev,local:l}) => {
      const models = modelNames(ev), first = ev.at(-1)?.date || "—", last = ev[0]?.date || "—";
      return `<article class="issue-card ${def.id.startsWith("SAF")?"safety":""}" id="issue-${esc(def.id)}">
        <header><div><span class="issue-id">${esc(def.id)}</span><h2>${esc(def.title)}</h2></div><span class="status-pill">${esc(l.status)}</span></header>
        <p class="issue-meta">${esc(def.type)} · ${esc(def.journey.join(" / "))} · 部件：${esc(def.components.join("、"))}</p>
        <div class="issue-kpis"><div><strong>${ev.length}</strong><span>关联评论 / 分母${rows.length}</span></div><div><strong>${uniqueEvents(ev)}</strong><span>去重事件（同名追评串联）</span></div><div><strong>${models.length}</strong><span>涉及型号</span></div></div>
        <div class="issue-section"><b>涉及型号与日期范围</b><p>${esc(models.join("、")||"当前筛选无关联评论")} · ${first} — ${last}</p></div>
        <div class="issue-section"><b>用户期望</b><p>${esc(def.expectation)}</p></div>
        <div class="issue-section"><b>用户报告的现象</b><p>${ev.length ? `${ev.length}/${rows.length}条当前筛选评论提及；这是评论提及占比，不是故障率。` : "当前筛选无关联证据。"}</p></div>
        <div class="issue-section"><b>使用条件与影响</b><p>条件：${esc([...new Set(ev.flatMap((r)=>r.analysis.conditions))].join("、")||"待补")}；影响：需逐条复核原文，当前未量化。</p></div>
        <div class="issue-section"><b>待验证技术假设</b><p>${esc(l.hypothesis || "待确认；自动摘要不认定根因。")}</p></div>
        <div class="issue-section"><b>建议验证方法 / 结果</b><p>${esc(def.validation)}</p><p>验证结果：${esc(l.result || "待确认")}</p></div>
        <p class="missing">产品图片：待补 · 部件定位：待确认 · 证据截图：待补（不使用宣传图替代）</p>
        <div class="card-actions"><button data-open-issue="${esc(def.id)}">查看 / 管理 ${ev.length} 条证据</button><button data-copy-issue="${esc(def.id)}">复制会议问题卡</button><button data-copy-link="${esc(def.id)}">复制固定链接</button></div>
        ${localForm(def,l)}
      </article>`;
    }).join("") || '<div class="empty-state">当前条件下没有符合状态、团队或严重程度筛选的问题卡。</div>';
  }
  function localForm(def,l) {
    return `<div class="local-form" data-local-form="${esc(def.id)}"><label>状态<select name="status">${options(statusOptions,l.status)}</select></label><label>严重程度<select name="severity">${options(severityOptions.slice(1),l.severity)}</select></label><label>责任团队<select name="team">${options(teamOptions,l.team)}</select></label><label>协作团队<input name="collab" value="${esc(l.collab||"")}" placeholder="待指定"></label><label>主责任人（仅本浏览器）<input name="owner" value="${esc(l.owner)}" placeholder="待指定"></label><label>截止日期<input name="due" type="date" value="${esc(l.due)}"></label><label>下一步<input name="next" value="${esc(l.next)}" placeholder="待确认"></label><label>硬件/固件版本<input name="version" value="${esc(l.version)}" placeholder="待确认"></label><label>生效批次<input name="batch" value="${esc(l.batch)}" placeholder="待确认"></label><label class="wide">缺失信息<input name="missingInfo" value="${esc(l.missingInfo||"")}" placeholder="待补"></label><label class="wide">技术假设（必须标注待验证）<textarea name="hypothesis" placeholder="待确认">${esc(l.hypothesis)}</textarea></label><label class="wide">验证结果<textarea name="result" placeholder="待确认">${esc(l.result)}</textarea></label><label class="wide">改进措施<textarea name="measure" placeholder="待确认">${esc(l.measure||"")}</textarea></label><label class="wide">验收标准<textarea name="acceptance" placeholder="待确认">${esc(l.acceptance)}</textarea></label><label class="wide">后续观察<textarea name="observation" placeholder="待确认">${esc(l.observation||"")}</textarea></label><label class="wide">备注 / 暂缓或证据不足原因<textarea name="notes" placeholder="待确认">${esc(l.notes)}</textarea></label><button class="local-save wide" data-save-local="${esc(def.id)}">保存到当前浏览器</button></div>`;
  }

  function opportunityRows(rows) {
    return data.opportunities.map((def) => ({def, rows:rows.filter((r) => new RegExp(def.pattern,"i").test(`${r.title} ${r.body}`))}));
  }
  function renderOpportunities(rows) {
    $("opportunityCards").innerHTML = opportunityRows(rows).map(({def,rows:ev}) => {
      const state = local.opportunities[def.id]?.status || "待验证";
      return `<article class="opportunity-card" id="opportunity-${esc(def.id)}"><span class="issue-id">${esc(def.id)}</span><h2>${esc(def.title)}</h2><div class="opportunity-flow"><div><b>用户场景</b><p>${esc(def.scene)}</p></div><div><b>已认可价值</b><p>${esc(def.value)}</p></div><div><b>当前不足</b><p>${esc(def.gap)}</p></div><div><b>机会假设</b><p>${esc(def.hypothesis)}</p></div><div><b>下一步验证</b><p>${esc(def.next)}</p></div></div><div class="opp-footer"><small>关联证据 ${ev.length}/${rows.length} 条评论；涉及 ${esc(modelNames(ev).join("、")||"暂无")}</small><label>决策状态 <select data-opportunity-state="${esc(def.id)}">${options(["待验证","保留","验证","暂缓","立项","否决"],state)}</select></label></div><div class="card-actions"><button data-open-opportunity="${esc(def.id)}">查看关联评论</button></div></article>`;
    }).join("");
  }

  function reviewCard(r) {
    const avatar = r.avatar ? `<img src="${esc(r.avatar)}" alt="${esc(r.name)} 用户头像" loading="lazy">` : esc(r.initial||"?");
    const issues = r.analysis.issues.map((id) => issueDef(id)).filter(Boolean);
    const opportunities = opportunityRows([r]).filter((x)=>x.rows.length).map((x)=>x.def);
    return `<article class="review-card ${r.analysis.mixed?"mixed":""}" id="review-${esc(r.uuid)}"><div class="review-summary"><div class="avatar">${avatar}</div><div><h3>${esc(r.internalCode)} · ${esc(r.model)} · ${esc(r.date)}</h3><p>${esc(r.analysis.chineseSummary)}</p><div class="badges">${r.analysis.strengths.map((x)=>`<span class="badge strength">优点 · ${esc(x)}</span>`).join("")}${issues.map((x)=>`<button class="badge issue" data-open-issue="${esc(x.id)}">问题 · ${esc(x.title)}</button>`).join("")}${opportunities.map((x)=>`<button class="badge request" data-open-opportunity="${esc(x.id)}">机会 · ${esc(x.title)}</button>`).join("")}${r.analysis.requests.map((x)=>`<span class="badge request">${esc(x)}</span>`).join("")}${r.analysis.safety?'<span class="badge issue">安全优先复核</span>':""}${r.analysis.mixed?'<span class="badge request">混合评价</span>':""}</div></div><div class="stars" aria-label="${r.rating}星">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</div></div><details><summary>展开完整原文与证据字段</summary>${r.title?`<h4>${esc(r.title)}</h4>`:""}<p class="original">${esc(r.body||"（评论正文为空）")}</p><div class="evidence-meta"><span>用户：${esc(r.name)}</span><span>国家：${flags[r.countryCode]||"🌐"} ${esc(r.country||"未显示")}</span><span>Verified：${r.verified?"是":"未显示"}</span><span>变体：${esc(r.variant||"未显示")}</span><span>客服：${esc(r.analysis.customerService)}</span><span>使用条件：${esc(r.analysis.conditions.join("、")||"待补")}</span><span>语言：${esc(r.analysis.languageNote||"未判定")}</span></div><p><a href="${esc(r.sourceUrl)}" target="_blank" rel="noreferrer">产品页来源</a> · UUID <code>${esc(r.uuid)}</code> · 直接评论链接：源站未提供 · 证据截图：待补</p><small>${esc(r.analysis.classification)}</small></details></article>`;
  }
  function renderArchive(rows) {
    const empty = $("emptyState");
    if (!rows.length) {
      empty.hidden = false;
      const product = data.models.find((m)=>m.key===els.product.value);
      empty.textContent = product && product.fetchStatus==="success" && product.reportedCount===0 ? "该型号官网当前为零评论；不是抓取失败。" : "当前筛选条件没有匹配结果。可清空星级、关键词或时间范围恢复。";
    } else empty.hidden = true;
    $("reviewList").innerHTML = rows.slice(0,visibleReviewLimit).map(reviewCard).join("") + (rows.length>visibleReviewLimit?`<button class="quiet-button" id="loadMoreReviews">继续加载（已显示 ${visibleReviewLimit}/${rows.length}）</button>`:"");
    renderCoverage();
    renderMethod();
  }
  function renderCoverage() {
    $("modelCoverage").innerHTML = data.models.map((m) => {
      let status,label;
      if (m.fetchStatus==="failed_no_data") {status="failed";label="抓取失败 · 无可用缓存";}
      else if (m.fetchStatus==="failed_cached") {status="failed";label=`抓取失败 · 回退缓存 ${m.cacheTimestamp||""}`;}
      else if (m.reportedCount===0) {status="zero";label="已上线 · 官网零评论";}
      else {status="success";label=`已上线 · ${m.fetchedCount}条`;}
      return `<article class="coverage-card"><span class="issue-id">${esc(m.internalCode)}</span><h3>${esc(m.model)}</h3><span class="status-${status}">${esc(label)}</span><p>${esc(m.aliases.join(" / "))}</p><a href="${esc(m.sourceUrl)}" target="_blank" rel="noreferrer">官网产品页</a></article>`;
    }).join("") + data.monitoring.map((m)=>`<article class="coverage-card"><span class="issue-id">${esc(m.internalCode)}</span><h3>${esc(m.model)}</h3><span class="status-pending">未上线 / 待确认</span><p>当前没有唯一、可可靠确认的公开产品页或评论源；每周继续检索。</p></article>`).join("");
  }
  function renderMethod() {
    $("methodContent").innerHTML = `<div class="method-grid"><div><h3>评论与事件</h3><p>逐型号读取 Judge.me 全部分页，按评论 UUID 全局去重。同一非匿名公开用户名在同一型号的追评/换货经历按一个事件串联；匿名评论无法可靠串联。</p></div><div><h3>问题占比</h3><p>所有问题数量均显示“命中评论数 / 当前筛选评论数”，标签可重叠，只代表评论提及占比，不是故障率。</p></div><div><h3>自动分析边界</h3><p>优点、痛点、场景、部件、诉求、客服与安全标签基于可复核规则；自动摘要不翻译或认定根因。非英语或规则未命中内容保留完整原文，需人工复核。</p></div><div><h3>协作记录</h3><p>保存在浏览器 localStorage，键与评论数据分离；更新评论不会覆盖本地任务，但清除浏览器数据会删除记录。当前不是共享任务系统。</p></div><div><h3>快照与实时评分</h3><p>评论快照生成于 ${esc(data.generatedAt)}（${esc(data.timezone)}）。实时评分失败时明确回退到该快照；首次历史基线不计算趋势。</p></div><div><h3>来源</h3><ul class="source-list">${data.models.map((m)=>`<li><a href="${esc(m.sourceUrl)}">${esc(m.internalCode)} · ${esc(m.model)}</a></li>`).join("")}</ul></div></div>`;
  }

  async function refreshLiveScore() {
    const selected = els.product.value === "all" ? data.models : data.models.filter((m)=>m.key===els.product.value);
    const rows = await Promise.all(selected.map(async (m) => {
      try {
        const url = new URL("https://api.judge.me/reviews/reviews_for_widget");
        url.search = new URLSearchParams({product_id:m.productId,page:"1",per_page:"1",shop_domain:"pulsar-vaporizers.myshopify.com",platform:"shopify"});
        const response = await fetch(url,{headers:{Accept:"application/json"}});
        if (!response.ok) throw new Error();
        const current = await response.json();
        return {...m,reportedCount:Number(current.number_of_reviews||0),reportedAverage:Number(current.average_rating||0),live:true};
      } catch { return {...m,live:false}; }
    }));
    const liveCount = rows.filter((r)=>r.live).length, usable = rows.filter((r)=>Number.isFinite(Number(r.reportedCount)) && Number.isFinite(Number(r.reportedAverage)));
    const total = usable.reduce((s,m)=>s+Number(m.reportedCount||0),0);
    const score = total ? usable.reduce((s,m)=>s+Number(m.reportedAverage||0)*Number(m.reportedCount||0),0)/total : null;
    $("mLiveAverage").textContent = score==null ? (total===0?"暂无评分":"不可用") : `${score.toFixed(2)} / 5`;
    const modelLabel = els.product.value==="all" ? "全部上线型号按官网评论数加权" : `${selected[0]?.internalCode} · ${selected[0]?.model}`;
    if (liveCount===rows.length) {
      $("mLiveLabel").textContent = "客户官网当前评分";
      $("mLiveMeta").textContent = `实时读取成功 · ${modelLabel} · ${total}条官网评论 · ${new Date().toLocaleString("zh-CN")}`;
    } else if (liveCount>0) {
      $("mLiveLabel").textContent = "客户官网评分（部分回退）";
      $("mLiveMeta").textContent = `${liveCount}/${rows.length}个型号实时；其余回退 ${data.generatedAt} 快照 · ${modelLabel}`;
    } else {
      $("mLiveLabel").textContent = "客户官网评分快照（实时读取失败）";
      $("mLiveMeta").textContent = `回退快照时间 ${data.generatedAt} · ${modelLabel}`;
    }
  }

  function renderAll({refreshLive=false}={}) {
    const custom = els.time.value === "custom";
    els.from.closest("label").hidden = !custom; els.to.closest("label").hidden = !custom;
    const rows = currentReviews();
    $("scopeText").textContent = `当前范围：${els.product.options[els.product.selectedIndex].text} · ${els.category.options[els.category.selectedIndex].text} · ${els.rating.options[els.rating.selectedIndex].text} · ${els.time.options[els.time.selectedIndex].text}`;
    $("resultText").textContent = `显示 ${rows.length} / ${data.reviews.length} 条去重公开评论`;
    $("generatedAt").textContent = `数据快照 ${data.generatedAt} · ${data.timezone}`;
    renderMetrics(rows); renderFocus(rows); renderExperience(rows); renderIssues(rows); renderOpportunities(rows); renderArchive(rows);
    syncUrl();
    if (refreshLive) refreshLiveScore();
  }

  function openIssue(id) {
    const def = issueDef(id); if (!def) return;
    const rows = currentReviews().filter((r)=>r.analysis.issues.includes(id));
    els.dialog.dataset.issueId = id;
    $("issueDialogContent").innerHTML = `<div class="dialog-evidence"><span class="issue-id">${esc(id)}</span><h2>${esc(def.title)}</h2><p>当前筛选下 ${rows.filter((r)=>!isExcluded(id,r.uuid)).length}/${currentReviews().length} 条评论计入；取消计入只保存在当前浏览器。</p>${rows.map((r)=>`<div class="evidence-row"><input type="checkbox" data-evidence-toggle="${esc(r.uuid)}" ${isExcluded(id,r.uuid)?"":"checked"} aria-label="是否计入问题"><div><strong>${esc(r.internalCode)} · ${esc(r.model)} · ${r.rating}星 · ${esc(r.date)}</strong><p>${esc(r.analysis.chineseSummary)}</p><small>${esc((r.body||r.title).slice(0,260))}</small></div><button data-open-review="${esc(r.uuid)}">定位原评论</button></div>`).join("") || '<p class="empty-copy">当前筛选范围没有关联评论。</p>'}</div>`;
    els.dialog.showModal(); syncUrl({issue:id});
  }
  function openOpportunity(id) {
    const entry=opportunityRows(currentReviews()).find((x)=>x.def.id===id); if(!entry)return;
    $("issueDialogContent").innerHTML=`<div class="dialog-evidence"><span class="issue-id">${esc(id)}</span><h2>${esc(entry.def.title)}</h2><p>当前筛选下关联 ${entry.rows.length}/${currentReviews().length} 条评论。机会仍为待验证，不等于批准立项。</p>${entry.rows.map((r)=>`<div class="evidence-row"><span class="stars">${r.rating}星</span><div><strong>${esc(r.internalCode)} · ${esc(r.model)} · ${esc(r.date)}</strong><p>${esc(r.analysis.chineseSummary)}</p><small>${esc((r.body||r.title).slice(0,260))}</small></div><button data-open-review="${esc(r.uuid)}">定位原评论</button></div>`).join("")||'<p class="empty-copy">当前筛选无关联评论。</p>'}</div>`;
    els.dialog.showModal(); syncUrl();
  }
  function openReview(uuid) {
    setView("archive"); visibleReviewLimit = data.reviews.length; renderArchive(currentReviews());
    els.dialog.close(); setTimeout(()=>document.getElementById(`review-${CSS.escape(uuid)}`)?.scrollIntoView({behavior:"smooth",block:"center"}),50);
  }
  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(()=>toast("已复制"));
    const ta=document.createElement("textarea");ta.value=text;document.body.append(ta);ta.select();document.execCommand("copy");ta.remove();toast("已复制");
  }
  function issueText(id) {
    const d=issueDef(id), rows=issueEvidence(d), l=issueLocal(id);
    return [`[${id}] ${d.title}`,`状态：${l.status}；严重程度：${l.severity}`,`涉及型号：${modelNames(rows).join("、")||"待确认"}`,`评论提及：${rows.length}/${currentReviews().length}（不是故障率）；去重事件：${uniqueEvents(rows)}`,`用户期望：${d.expectation}`,`缺失信息：${l.missingInfo||"待确认"}`,`待验证技术假设：${l.hypothesis||"待确认"}`,`建议验证：${d.validation}`,`验证结果：${l.result||"待确认"}`,`责任团队：${l.team}；协作团队：${l.collab||"待指定"}；负责人：${l.owner||"待指定"}；截止：${l.due||"待确认"}`,`下一步：${l.next||"待确认"}`,`改进措施：${l.measure||"待确认"}`,`版本/批次：${l.version||"待确认"} / ${l.batch||"待确认"}`,`验收标准：${l.acceptance||"待确认"}`,`后续观察：${l.observation||"待确认"}`,`备注：${l.notes||"无"}`,`证据：${rows.map((r)=>`${r.sourceUrl} · UUID ${r.uuid}`).join("\n")||"待补"}`].join("\n");
  }

  document.addEventListener("click",(e)=>{
    const tab=e.target.closest("[data-view]"); if(tab){setView(tab.dataset.view);return;}
    const issue=e.target.closest("[data-open-issue]"); if(issue){openIssue(issue.dataset.openIssue);return;}
    const review=e.target.closest("[data-open-review]"); if(review){openReview(review.dataset.openReview);return;}
    const opp=e.target.closest("[data-open-opportunity]"); if(opp){openOpportunity(opp.dataset.openOpportunity);return;}
    const copy=e.target.closest("[data-copy-issue]"); if(copy){copyText(issueText(copy.dataset.copyIssue));return;}
    const link=e.target.closest("[data-copy-link]"); if(link){syncUrl({view:"improvement",issue:link.dataset.copyLink});copyText(location.href);return;}
    const save=e.target.closest("[data-save-local]"); if(save){
      const form=save.closest("[data-local-form]"), values={}; form.querySelectorAll("[name]").forEach((el)=>values[el.name]=el.value.trim());
      local.issues[save.dataset.saveLocal]=values; saveLocal(); toast("已保存到当前浏览器"); renderAll(); return;
    }
    if(e.target.id==="loadMoreReviews"){visibleReviewLimit+=80;renderArchive(currentReviews());return;}
    if(e.target.classList.contains("dialog-close")){els.dialog.close();syncUrl({issue:""});return;}
  });
  document.addEventListener("change",(e)=>{
    if(e.target.matches("#productFilter,#categoryFilter,#ratingFilter,#timeFilter,#dateFrom,#dateTo")){visibleReviewLimit=80;renderAll({refreshLive:e.target.id==="productFilter"});}
    if(e.target.matches("#issueStatusFilter,#teamFilter,#severityFilter,#issueTypeFilter,#componentFilter")) renderIssues(currentReviews());
    if(e.target.matches("[data-opportunity-state]")){local.opportunities[e.target.dataset.opportunityState]={status:e.target.value,updatedAt:new Date().toISOString()};saveLocal();toast("机会状态已保存到当前浏览器");renderFocus(currentReviews());}
    if(e.target.matches("[data-evidence-toggle]")){const id=els.dialog.dataset.issueId,uuid=e.target.dataset.evidenceToggle;local.evidenceExclusions[id]||={};local.evidenceExclusions[id][uuid]=!e.target.checked;saveLocal();renderAll();openIssue(id);}
  });
  els.search.addEventListener("input",()=>{visibleReviewLimit=80;renderAll();});
  $("resetFilters").addEventListener("click",()=>{els.product.value=els.category.value=els.rating.value=els.time.value="all";els.from.value=els.to.value=els.search.value="";visibleReviewLimit=80;renderAll({refreshLive:true});});
  $("exportLocal").addEventListener("click",()=>download(`pulsar-local-collaboration-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(local,null,2),"application/json"));
  $("exportIssues").addEventListener("click",()=>{
    const rows=currentReviews(),head=["问题编号","标题","状态","严重程度","责任团队","协作团队","负责人","截止日期","涉及型号","关联评论","当前筛选分母","去重事件","缺失信息","待验证假设","验证结果","改进措施","版本","批次","验收标准","下一步","后续观察","备注"];
    const csv=[head,...data.issueDefinitions.map((d)=>{const ev=issueEvidence(d,rows),l=issueLocal(d.id);return[d.id,d.title,l.status,l.severity,l.team,l.collab||"待指定",l.owner||"待指定",l.due||"待确认",modelNames(ev).join("、"),ev.length,rows.length,uniqueEvents(ev),l.missingInfo||"待确认",l.hypothesis||"待确认",l.result||"待确认",l.measure||"待确认",l.version||"待确认",l.batch||"待确认",l.acceptance||"待确认",l.next||"待确认",l.observation||"待确认",l.notes||""]})].map((r)=>r.map((v)=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    download(`pulsar-issue-cards-${new Date().toISOString().slice(0,10)}.csv`,"\ufeff"+csv,"text/csv;charset=utf-8");
  });
  els.dialog.addEventListener("close",()=>syncUrl({issue:""}));

  initControls();
  const initialIssue=new URLSearchParams(location.search).get("issue");
  $("sourceState").textContent = data.models.some((m)=>m.fetchStatus.startsWith("failed")) ? "部分来源回退" : "评论快照已更新";
  renderAll({refreshLive:true});
  if(initialIssue) setTimeout(()=>openIssue(initialIssue),50);
})();
