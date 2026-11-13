# 三型号公开评论品质分析

公开入口：https://laurayin-ai.github.io/pulsar-510-delta-review-radar/quality-analysis/

保留 G-069 SYNDR、G-151 Delta 3-in-1、G-158 Voyager 的真实公开评论和逐条中文译文。型号筛选联动评分、星级分布、问题汇总与原评论。点击问题会清除档案的星级/关键词限制，定位该问题的全部原评论。

`source/` 保存报告源文件及已复核数据；`refresh-reviews.mjs` 完整读取每个产品的分页，校验数量并比较评论内容。读取失败不会覆盖旧快照；无变化时保留原快照时间。评论占比属于自愿评论构成，并非故障率。

## 每周一更新

使用既有 Codex 本地任务 `pulsar-510-delta-github`，每周一北京时间08:15运行，同步原看板与此报告。该本地任务依赖电脑及Codex可运行；GitHub Actions负责提交后的线上发布，不负责自动中文翻译。

1. 在远端main最新的干净检出中运行 `node quality-analysis/refresh-reviews.mjs`。
2. 如存在 `pendingTranslations`，逐条补齐忠实中文翻译，并同时更新 `source/data.json` 内对应model.reviews和queries rows；原文修改时重新复核译文。
3. 复核问题标签；不能仅因出现battery、support等部件/服务名就断定存在故障或负面客服体验。
4. 在这台电脑运行 `node scripts/publish-quality-report.mjs`。可通过 `--project-dir` 和 `--data-plugin` 指定完整Data authoring项目和已安装插件。完整原项目保留在本地；此仓库保存 authored 源文件、快照与可直接部署的离线HTML。
5. 验证型号、问题点击定位和原文数，提交源文件与 `dist/quality-analysis/index.html` 到main；现有GitHub Pages流程发布整个dist。
6. 无变化则不提交、不部署；发布失败时保留旧线上版本并报告。

本报告是公开证据页面；不添加内部负责人、批次或未公开技术记录。团队协作记录仍遵循原看板保存边界。
