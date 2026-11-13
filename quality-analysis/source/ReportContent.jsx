import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  DataComponent, MetricCard, ReportSection, RichNarrative, useDataApp,
} from "../../data-app-public.jsx";

const pct = (n, d) => d ? `${(n / d * 100).toFixed(1)}%` : "—";

function Stars({ value }) {
  return <span className="stars" aria-label={`${value}星`}>{"★".repeat(value)}{"☆".repeat(5 - value)}</span>;
}

function priorityMarkdown(productKey, safetyCount) {
  if (productKey === "syndr") return `## SYNDR建议优先复核

1. **加热输出链路**：统一花材含水率、研磨度、装载量和档位，记录腔体温度、升温时间、气流压降及蒸汽输出，区分“温度不足”“花材变褐但无蒸汽”和“气路受阻”。
2. **早期失效与红灯报码**：把到货即坏、数小时/数天/数周后失效分开，结合报码、充电状态和保护逻辑复现。
3. **电池与充电**：分别验证无法充电、续航偏短、反复插拔后才能开机等现象，避免合并为单一根因。
4. **热安全优先复核**：当前筛选有${safetyCount}条差评涉及烫手、桌面受热或热变形；先核对样品、连续使用/充电条件和外壳测温。`;
  if (productKey === "delta-3in1") return `## Delta 3-in-1建议优先复核

1. **模块识别与连接耐久**：分别验证干草、蜡和510模块在拧紧、松动、热循环及重复切换后的识别状态、接触电阻和连接保持力。
2. **早期失效与白灯报码**：按首次、数次及数天使用分层复现“三次白灯后关机”，保留失效样品和模块组合。
3. **热液入口与泄漏安全**：当前筛选有${safetyCount}条差评涉及熔融树脂入口、硅胶盖热膨胀或烫伤；应独立进入安全优先复核，不等待重复数量增加。
4. **材料与结构**：验证陶瓷碗、510连接部件和内部电池组件在拆装、热循环与跌落后的完整性。
5. **续航口径**：在三种模块和统一温度档位下分别记录预热次数、可用循环和充电时间。`;
  if (productKey === "voyager") return `## Voyager建议优先复核

1. **先补齐换货原因**：2条差评中有1条只说明等待替换机，未披露原设备故障；应回溯售后记录或样品，不能直接推定根因。
2. **吸入体验复现**：另一条只描述“Bad hits”，建议在统一花材、装载量、档位和抽吸曲线下复核输出、温度、气流与口感。
3. **小样本限制**：当前仅7条公开评论、2条差评，适合形成待验证信号，不适合做趋势、故障率或批次结论。`;
  return `## 跨型号建议优先复核

1. **Delta模块识别与早期失效**：把模块不识别、白灯报码和结构松脱拆成独立验证路径，不用“不能工作”概括根因。
2. **SYNDR输出与气流链路**：统一花材、装载、档位及抽吸条件，测量腔体温度、气流压降和有效输出。
3. **安全反馈单独排队**：三型号合计${safetyCount}条差评涉及过热、烫伤、热液入口、泄漏或热变形；出现一次也应复核，不以频次决定是否处理。
4. **电池与充电分层**：区分无法充电、续航偏短、预热耗电和保护关机，并绑定模块、适配器和使用条件。
5. **Voyager补证据**：当前样本很小，应优先追溯换货原因和复现“吸入体验差”，暂不做趋势判断。`;
}

export function ReportContent() {
  const { snapshot, visible, canEdit, mode, appTitle, setAppTitle } = useDataApp();
  const rows = snapshot.queries?.["multi-model-review-snapshot"]?.rows || [];
  const [productKey, setProductKey] = useState("all");
  const [issue, setIssue] = useState("all");
  const [rating, setRating] = useState("all");
  const [query, setQuery] = useState("");
  const [evidenceJump, setEvidenceJump] = useState(0);
  const evidenceRef = useRef(null);
  useEffect(() => {
    if (!evidenceJump || !evidenceRef.current) return;
    evidenceRef.current.scrollIntoView({ behavior: "auto", block: "start" });
    evidenceRef.current.focus({ preventScroll: true });
  }, [evidenceJump]);

  const activeModel = productKey === "all" ? null : snapshot.models.find((model) => model.key === productKey);
  const activeRows = activeModel?.reviews || rows;
  const negativeRows = activeRows.filter((review) => review.rating <= 2);
  const summary = activeModel?.summary || snapshot.summary;
  const distribution = activeModel?.summary.distribution || snapshot.summary.distribution;
  const issueSummary = useMemo(() => snapshot.issueDefinitions
    .map((item) => ({ ...item, count: negativeRows.filter((review) => review.issues.includes(item.id)).length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.zh.localeCompare(b.zh)), [snapshot.issueDefinitions, negativeRows]);
  const issueById = useMemo(() => new Map(snapshot.issueDefinitions.map((item) => [item.id, item])), [snapshot.issueDefinitions]);
  const safetyCount = negativeRows.filter((review) => review.issues.includes("thermal-safety")).length;
  const filtered = useMemo(() => negativeRows.filter((review) =>
    (issue === "all" || review.issues.includes(issue)) &&
    (rating === "all" || String(review.rating) === rating) &&
    (!query.trim() || [review.title, review.body, review.translationZh, review.name, review.uuid, review.model]
      .join(" ").toLowerCase().includes(query.trim().toLowerCase()))
  ), [negativeRows, issue, rating, query]);

  const sourcePreview = Object.fromEntries(snapshot.models.map((model) => [model.productUrl, {
    title: model.productTitle,
    summary: `Pulsar Shop产品页及其公开Judge.me评论；${model.summary.total}条评论。`,
    source: "Pulsar Shop",
    date: model.fetchedAt.slice(0, 10),
    approvedForReport: true,
  }]));
  const sourceLinks = activeModel
    ? `[查看${activeModel.internalCode}产品页](${activeModel.productUrl})`
    : snapshot.models.map((model) => `[${model.internalCode} · ${model.model}](${model.productUrl})`).join("　");
  const topIssues = issueSummary.slice(0, 2);
  const filterName = activeModel ? `${activeModel.internalCode} · ${activeModel.model}` : "全部三个型号";
  const safetySentence = safetyCount > 0
    ? `当前筛选有 **${safetyCount}条** 差评涉及过热、烫伤、热液入口、泄漏或热变形，属于安全优先复核信号，但不直接证明产品存在安全缺陷。`
    : "当前公开差评中未提取到明确安全相关描述；这只是当前样本结果，不代表产品不存在安全风险。";
  const resetDetailFilters = () => { setIssue("all"); setRating("all"); setQuery(""); };
  const switchProduct = (key) => { setProductKey(key); resetDetailFilters(); };
  const openIssueEvidence = (id) => {
    setIssue(id);
    setRating("all");
    setQuery("");
    setEvidenceJump((value) => value + 1);
  };

  return <article className="report-content" aria-label="Pulsar三型号公开评论品质分析">
    <header className="report-hero">
      <div className="hero-code">{activeModel ? `${activeModel.internalCode} / ${activeModel.model.toUpperCase()}` : "3 MODELS / FIELD QUALITY SIGNAL REVIEW"}</div>
      <h1 data-data-app-title contentEditable={canEdit && mode === "edit"} suppressContentEditableWarning
        onBlur={canEdit && mode === "edit" ? (event) => setAppTitle(event.currentTarget.textContent.trim() || appTitle) : undefined}>{appTitle}</h1>
      <RichNarrative id="report:description" className="report-deck"
        value={`截至 **${snapshot.source.fetchedAt.slice(0, 10)}**，三型号官网共抓取 **${snapshot.summary.total}条** 公开评论。当前选择 **${filterName}**：${summary.total}条评论，${activeModel ? "官网快照评分" : "评论加权平均"} **${summary.average.toFixed(2)}/5**。1–2星作为差评样本，逐条保留英文原文和中文翻译；自动归类只形成品质复核线索，不认定技术根因。\n\n${sourceLinks}`}
        sourcePreviews={sourcePreview} label="编辑报告说明" />
    </header>

    <nav className="model-switcher" aria-label="型号筛选">
      <button type="button" className={productKey === "all" ? "active" : ""} onClick={() => switchProduct("all")} aria-pressed={productKey === "all"}>
        <span>全部型号</span><strong>{snapshot.summary.total}</strong><small>三型号合计</small>
      </button>
      {snapshot.models.map((model) => <button type="button" key={model.key} className={productKey === model.key ? "active" : ""}
        onClick={() => switchProduct(model.key)} aria-pressed={productKey === model.key}>
        <span>{model.internalCode}</span><strong>{model.model}</strong><small>{model.summary.total}条 · 差评{model.summary.negative}条</small>
      </button>)}
    </nav>

    {visible("executive-summary") && <ReportSection id="executive-summary" title="结论摘要"
      queryId="multi-model-review-snapshot" sourceRows={activeRows} showHeading={false}>
      <RichNarrative id="executive-summary:body" className="report-summary-lead" label="编辑结论摘要"
        value={`## ${activeModel ? `${activeModel.model}当前差评信号` : "三型号差评信号集中在早期失效、输出与电源链路"}\n\n- **${summary.negative}条差评（${pct(summary.negative, summary.total)}）**，另有${summary.positive}条好评；这是公开评论构成，不是产品故障率。\n- ${topIssues.map((item) => `“${item.zh}”命中 **${item.count}条（分母${summary.negative}条差评）**`).join("；")}。\n- ${safetySentence}\n- ${activeModel?.key === "voyager" ? "Voyager公开评论样本仅7条，任何占比都应视为小样本观察。" : "同一评论可命中多个问题，问题数量不可相加。"}`} />
    </ReportSection>}

    <div className="metric-grid" id="summary-metrics">
      <MetricCard id="metric-total" title="公开评论总数" queryId="multi-model-review-snapshot" sourceRows={activeRows}
        value={String(summary.total)} description={`${activeModel ? "官网快照评分" : "评论加权平均"} ${summary.average.toFixed(2)}/5`} />
      <MetricCard id="metric-positive" title="好评数" queryId="multi-model-review-snapshot" sourceRows={activeRows.filter((r) => r.rating >= 4)}
        value={String(summary.positive)} description={`4–5星 · ${pct(summary.positive, summary.total)}`} />
      <MetricCard id="metric-negative" title="差评数" queryId="multi-model-review-snapshot" sourceRows={negativeRows}
        value={String(summary.negative)} description={`1–2星 · ${pct(summary.negative, summary.total)}`} negative />
      <MetricCard id="metric-neutral" title="中性/混合" queryId="multi-model-review-snapshot" sourceRows={activeRows.filter((r) => r.rating === 3)}
        value={String(summary.neutral)} description={`3星 · ${pct(summary.neutral, summary.total)}`} />
    </div>

    {visible("rating-distribution") && <DataComponent id="rating-distribution" title={`${filterName} · 星级分布`}
      queryId="multi-model-review-snapshot" kind="chart" sourceRows={activeRows}
      description="每个条形代表当前型号筛选范围内该星级的公开评论数。">
      <div className="rating-chart" data-reviewed-rows>
        {[...distribution].reverse().map((item) => <div className="rating-row" key={item.rating}>
          <span>{item.rating}星</span>
          <div className="bar-track"><div className={`bar-fill rating-${item.rating}`} style={{ width: `${item.count / Math.max(1, ...distribution.map((d) => d.count)) * 100}%` }} /></div>
          <strong>{item.count}</strong>
        </div>)}
      </div>
    </DataComponent>}

    {visible("issue-summary") && <DataComponent id="issue-summary" title={`${filterName} · 差评问题汇总`}
      queryId="multi-model-review-snapshot" kind="chart" sourceRows={negativeRows}
      description={`分母为${summary.negative}条1–2星评论；同一评论可命中多个问题，因此数量不可相加。点击问题可联动筛选档案。`}>
      <div className="issue-matrix" data-reviewed-rows>
        {issueSummary.map((item, index) => <button type="button" className={`issue-line ${issue === item.id ? "active" : ""}`}
          key={item.id} onClick={() => openIssueEvidence(item.id)} aria-pressed={issue === item.id} aria-controls="issue-evidence-results"
          title={`查看“${item.zh}”关联的全部${item.count}条原评论`}>
          <span className="rank">{String(index + 1).padStart(2, "0")}</span>
          <span className="issue-name"><strong>{item.zh}</strong><small>{item.en}</small></span>
          <span className="issue-bar"><i style={{ width: `${item.count / Math.max(1, summary.negative) * 100}%` }} /></span>
          <span className="issue-count"><strong>{item.count}</strong><small>{pct(item.count, summary.negative)}</small></span>
        </button>)}
      </div>
    </DataComponent>}

    {visible("quality-priorities") && <ReportSection id="quality-priorities" title="建议优先复核什么"
      queryId="multi-model-review-snapshot" sourceRows={negativeRows} showHeading={false}>
      <RichNarrative id="quality-priorities:body" className="report-analysis" label="编辑品质建议"
        value={priorityMarkdown(productKey, safetyCount)} />
    </ReportSection>}

    {visible("negative-archive") && <DataComponent id="negative-archive" title={`${filterName} · ${summary.negative}条差评逐条中英文对照`}
      queryId="multi-model-review-snapshot" kind="custom" sourceRows={filtered}
      description={`当前显示${filtered.length}/${summary.negative}条；型号切换会同步刷新全部统计，问题/星级/关键词只筛选当前型号的差评档案。`}>
      <div className="evidence-location" id="issue-evidence-results" ref={evidenceRef} tabIndex={-1}>
        <strong>{issue === "all" ? "当前型号全部差评原文" : `关联原评论：${issueById.get(issue)?.zh || issue}`}</strong>
        <span role="status">{filterName} · 当前显示{filtered.length}条{issue !== "all" ? ` / 该问题共${negativeRows.filter((review) => review.issues.includes(issue)).length}条` : ` / 全部差评${summary.negative}条`}</span>
      </div>
      <div className="archive-controls" aria-label="差评筛选">
        <label>问题类型<select value={issue} onChange={(e) => setIssue(e.target.value)}>
          <option value="all">全部问题类型</option>
          {issueSummary.map((item) => <option key={item.id} value={item.id}>{item.zh}（{item.count}）</option>)}
        </select></label>
        <label>星级<select value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="all">1星和2星</option><option value="1">仅1星</option><option value="2">仅2星</option>
        </select></label>
        <label className="search-label">关键词<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索原文、中文、用户名或UUID" /></label>
        <button type="button" onClick={resetDetailFilters}>清空筛选</button>
      </div>
      <div className="review-list" data-reviewed-rows>
        {filtered.map((review, index) => <article className="review-card" key={review.uuid} id={`review-${review.uuid}`}>
          <div className="review-head">
            <span className="review-index">{String(index + 1).padStart(2, "0")}</span>
            <div><Stars value={review.rating} /><strong>{review.title || "无标题"}</strong></div>
            <div className="review-meta">{productKey === "all" && <span className="model-badge">{review.internalCode} · {review.model}</span>}<span>{review.date}</span><span>{review.name}</span><span>{review.country}</span>{review.verified && <span>Verified</span>}</div>
          </div>
          <div className="review-tags">{review.issues.map((id) => <span key={id}>{issueById.get(id)?.zh || id}</span>)}</div>
          <div className="bilingual-grid">
            <section><h3>EN · Original</h3><p>{review.body || review.title}</p></section>
            <section><h3>中文 · 翻译</h3><p>{review.translationZh}</p></section>
          </div>
          <footer><span>UUID {review.uuid}</span><a href={review.sourceUrl} target="_blank" rel="noreferrer">产品页来源</a><span>直接评论链接：源站未提供</span></footer>
        </article>)}
        {!filtered.length && <div className="empty-state">当前条件没有匹配差评。请清空筛选或切换型号后重试。</div>}
      </div>
    </DataComponent>}

    <ReportSection id="scope-boundary" title="数据口径与证据边界" queryId="multi-model-review-snapshot" sourceRows={activeRows} showHeading={false}>
      <RichNarrative id="scope-boundary:body" className="report-disclosure" label="编辑数据边界"
        value={`## 数据口径与证据边界\n\n- ${snapshot.summary.definition}\n- 当前筛选为${filterName}：抓取到${summary.fetched}条，与官网报告总数${summary.total}条一致；按UUID保留公开评论。\n- 单型号显示该产品官网快照评分；“全部型号”显示117条评论的实际星级加权平均，不冒充任一产品的官网实时评分。\n- 官网评论没有销量、退货、维修或独立故障事件分母；差评占比及问题提及占比**不是故障率**。\n- 同一评论可包含多个问题；用户报告的“短路、烫伤、无法识别”等属于待验证现象，不能由自动摘要直接认定根因。\n- 中文为便于内部讨论的忠实翻译；技术判断应回看英文原文、产品型号和UUID。`} />
    </ReportSection>
  </article>;
}
