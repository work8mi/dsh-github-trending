# Changelog

## [v0.9.17] - 2026-11-11

### Features

- **run timeout**: 新增「单次运行超时」（`run.timeoutMs`，设置 → 核心 → 单次运行超时，默认 300 秒，范围 60–1800 秒）。此前单次运行超时是编译期常量 120 秒、无法调整，慢网络下容易被提前杀掉。榜单与发版两条运行路径都按此值生效。
- **timeout 归因**: `CORE_TIMEOUT` 改用单调时钟判断，墙钟远大于进程活跃时长时，文案会写明「疑似系统挂起/睡眠」，不再把每次超时都记成同一个「120 s 超时」。

### Chores

- **core**: `dsh.core.version` 0.12.3 → **0.12.4**（首次运行自动下载/校验的核心版本）。带上游修复：核心 HTTP 库 `ghttp` 的 `Transport` 未设置 `Proxy`，导致注入的 `HTTP(S)_PROXY` 被静默忽略、抓 GitHub 强制直连——在需要代理的网络下表现为直连超时或撞 GitHub 403；这正是「设置里填了代理却仍超时/403」的根因。0.12.4 起 `Transport.Proxy` 默认 `ProxyFromEnvironment`，代理真正生效（[golib#132](https://github.com/morehao/golib/pull/132) → [trendradar#61](https://github.com/morehao/trendradar/pull/61) #62）。**注意：代理要对核心生效需核心 ≥ 0.12.4**；最低核心要求仍为 0.12.0。
- 版本号 `0.9.16` → `0.9.17`。

## [v0.9.16] - 2026-11-11

### Fixes

- **settings**: 仓库路径改为可编辑输入框；在浏览型宿主上目录选择器不可用时优雅降级。（#158）

## [v0.9.15] - 2026-11-07

### Chores

- **core**: `dsh.core.version` 0.12.2 → **0.12.3**（首次运行自动下载/校验的核心版本）。带上游修复：多周补发的发版文档改按最新版本所在周标注周段，跨周补发不再把文档段头/「最近更新」落到最早那一周（[trendradar#59](https://github.com/morehao/trendradar/pull/59)）。最低核心要求仍为 0.12.0。
- 版本号 `0.9.14` → `0.9.15`。

## [v0.9.14] - 2026-11-07

### Chores

- **core**: `dsh.core.version` 0.12.0 → **0.12.2**（首次运行自动下载/校验的核心版本）。带上游两个修复：发版订阅的 legacy 游标被滚动 tag 卡死、导致「变更分析」从不落盘（[trendradar#55](https://github.com/morehao/trendradar/pull/55)）；补发改按发布日期选取，滚动预发布不再混入并把发版文档的最新周段拉回旧日期（[trendradar#57](https://github.com/morehao/trendradar/pull/57)）。最低核心要求仍为 0.12.0。
- 版本号 `0.9.13` → `0.9.14`。

## [v0.9.13] - 2026-11-06

### Features

- **summary language**: 新增「摘要语言」（`settings.outputLanguage`）设置，控制日报 / 订阅摘要的输出语言。默认 `''` = **跟随宿主**（读宿主 locale 的 `preference`：`zh`→中文、`en`→英文；**中英之外一律回落中文**）；也可显式选 **中文 / English**。解析顺序为「显式设置 > 宿主语言 > 中文兜底」，每次运行现读宿主偏好（改宿主语言无需重启）。运行时把解析结果写入核心 YAML 的 `language: { outputLanguage: <resolved> }`。设置页「摘要与用量」tab 提供下拉（首项「跟随宿主({hostLang})」），核心过旧时提示升级但下拉仍可用。
- **state**: `/state` 增 `language: { hostLanguage, resolvedLanguage, outputLanguageSource }`（`explicit` / `host` / `fallback`）。

### Chores / Breaking

- **core**: 最低核心版本要求抬到 **0.12.0**，`dsh.core.version` 0.11.0 → 0.12.0。核心低于 0.12.0 判 `CORE_INCOMPATIBLE` 并给下载引导。核心 0.12.0 起支持 `language.outputLanguage` 与 `digest.summary`/`summaryLang`。
- **contract**: `@morehao/trendradar-contract` 升级到 **0.7.0**（wire：`ipcSchema=4` / `digestSchema=3` / `contractVersion=0.7.0`）。摘要字段 `summaryZh` → `summary` + `summaryLang`。
- 版本号 `0.9.12` → `0.9.13`。

## [v0.9.12] - 2026-11-06

### Fixes

- **release**: 新增 `scripts/make-tag-notes.mjs`，在**打 tag 之前**组装并校验发版注记正文（首行 `release: <tag>`、body 非空、拒绝「正文是单行文件路径」），与 `scripts/release-notes.mjs` 互为镜像；配 `scripts/smoke-tag-notes.mjs`（`check:tag-notes`）纳入 `npm run check`。此前注记正文若为空/首行不对，要等 CI「Create GitHub Release from tag annotation」失败才暴露，而 tag 已推送、不可改正文。v0.9.11 的 Release 因该问题缺失，由本版重新发版补齐。

### Chores

- 版本号 `0.9.11` → `0.9.12`（v0.9.11 的 tag 注记正文异常、无法修改，按约定以新版本重发）。

## [v0.9.11] - 2026-11-06

### Features

- **releases**: 映射核心 `releases.backfillLatest`，修复「订阅仓库首次变更分析为空」——新订阅的仓库第一次检查时默认把最近 3 个版本摘要进文档作为起点（此前该字段未透传，核心恒收到 0，基线只记状态、不产文档）。之后每次照常增量；补发版本进入游标不重复总结。设为 0 可回到旧行为。
- **subscriptions**: 订阅页单仓按钮文案「触发分析」改为「变更分析」（en `Analyze` → `Change analysis`），与其产出「变更分析」保持一致。

## [v0.9.10] - 2026-11-06

### Chores

- **core**: 内置核心版本 `dsh.core.version` 0.10.0 → 0.11.0。核心 0.11.0 把发版订阅改为 **tag 级增量总结**（每条 Release 独立摘要、按发布日归周、周门仅调度生效、手动「触发分析/重新生成」不再被本周去重挡成 `checked=0`，并修复 baseline 吞掉订阅后发布版本的问题）。wire 不变（`ipcSchema=3` / `digestSchema=2` / 契约 `0.6.0`），插件侧无需改代码——发版文档仍由核心渲染 markdown、插件原样展示。
  - 一次性迁移提示：有文档但从未记录「已总结」的旧仓，升级后首次发版运行会把基线页历史重总结一遍（修复漏录的代价）；有游标的常规仓不受影响。

## [v0.9.9] - 2026-11-05

### Fixes

- **tools**: `trending_run` / `trending_history` 的 `output.schema` 改用宿主 `dsh-tools` 的 author DSL 写法（必填内联为属性上的 `required: true`，根对象不再使用 `required: string[]`）。此前 `defineTool` 抛错被 `try/catch` 吞掉，两个工具实际从未注册；现在会正常注册，注册失败也改为 `error` 级别日志。
- **i18n**: 适配 dsh 0.2.2 新增的 ja / es / fr / de / ru / pt；`activeLang` 改为「`zh*` → 中文，其余 → 英文」，不再把所有非 en 语言当成中文；拿不到 locale 时仍默认中文。

### Chores

- README 截图改为绝对 URL，`locale/*.json` 增加 `meta.detail`，适配 0.2.2 的 Plugins 长描述页。
- 升级 `@morehao/dsh-plugin-kit` 到 0.5.1（自更新复用宿主 `listVersions` / `updateBundle`）。

## [v0.9.8] - 2026-11-05

### Features

- **subscriptions**: 订阅页三点体验改进。
  - **变更记录排版**：抽屉渲染的每周变更记录支持结构化——正文有标题时生成「本册目录（TOC）」并可点击跳转，版本号 / `owner/repo` 做等宽高亮（纯表现，不改写原文）。治本由核心 `trendradar v0.10.0` 的发版摘要 prompt 结构化完成（加粗短标签分段 + 列表）。
  - **重新生成**：抽屉内「重新生成」按 `POST /releases/run {force:true}` 忽略摘要缓存、强制重跑该仓库这一卷，带成本提示（会重新调用模型、可能产生新提交/PR），调度触发永不 force。
  - **去掉多选模式**：多选原本只有「批量移除」，与行内删除重复且容易误解，已移除；删除走行内 hover，「触发分析 / 重新生成」保持逐仓库粒度。

### Chores

- **core**: 升级 `dsh.core.version` 0.9.3 → 0.10.0。核心 v0.10.0 把发版订阅摘要改为轻量结构化（prompt v3 + sanitize 保留行结构），订阅抽屉里的「变更记录」由一大段密文变为分小节可读。非破坏：`summaryZh` 仍为字符串，wire 仍 ipc=3 / digest=2。

## [v0.9.7] - 2026-11-05

### Chores

- **core**: 升级 `dsh.core.version` 0.9.2 → 0.9.3。核心侧修复了 `branchGrouping: per-date` 下发版订阅（release-only）运行整次失败的问题：release-only 无 digest、`d.Date` 为空，per-date 分支名退化成裸前缀 `trending/`，被 git 拒绝（`fatal: 'trending/' is not a valid branch name`）。0.9.3 为 per-date 覆盖增加 `d.Date != ""` 守卫，release-only 保持 per-period 分支名（`trending/weekly/<date>`）。插件侧无行为变更（wire 仍 ipc=3 / digest=2）。

## [v0.9.5] - 2026-11-04

### Fixes

- **plugin-update**: 版本判定改为以**磁盘已安装版本**为唯一真相（升级 `@morehao/dsh-plugin-kit@^0.5.0`）。修复「一键更新写入磁盘后、进程未重启时，身份条持续提示有新版本」及重复重装同一版本的问题；`restartRequired` 由 Host 视图透传，待重启状态由 `deriveUpdateUiState` 正确落定为 settled。

## [v0.9.3] - 2026-11-04

### Tests

- 新增 `apply()` 裸 ctx 守卫测试（`test/apply-guard.test.mjs`）：用 `@morehao/dsh-plugin-kit/test` 的 `createUndeclaredContext()` / `createAbsentContext()` 断言 `apply` 在服务未就绪时降级不抛，复现「读未声明服务 → 红点无面板」事故；含自检防假绿。

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.9.2...v0.9.3

## [v0.9.2] - 2026-11-04

### Fixes

- **client**: auto-dismiss transient success notices (#129)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.9.1...v0.9.2

## [v0.9.1] - 2026-11-04

### Chores

- **core**: 升级 `dsh.core.version` 0.9.0 → 0.9.1。核心侧本版为自动化 PR 流程修复（base 同步、manual 重建、PR 不可合并降噪），插件侧无行为变更。

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.9.0...v0.9.1

## [v0.8.16] - 2026-11-03

### Fixes

- **update**: surface restart notice right after in-panel update (#109)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.15...v0.8.16

## [v0.8.12] - 2026-11-02

### Refactors

- **client**: 恢复提示改为居中弹层并统一页面内容框 (#99)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.11...v0.8.12

## [v0.8.11] - 2026-11-02

### Fixes

- **client**: 自更新恢复提示改为顶部常驻横条 (#96)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.10...v0.8.11

## [v0.8.10] - 2026-11-02

### Features

- **about**: redesign dialog with compact gradient hero header (#93)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.9...v0.8.10

## [v0.8.9] - 2026-11-02

### Fixes

- **client**: 修复宽屏自适应、运行记录筛选与关于弹层 (#90)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.8...v0.8.9

## [v0.8.7] - 2026-11-02

### Features

- **ui**: polish identity bar tabs and about dialog (#84)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.6...v0.8.7

## [v0.8.6] - 2026-11-02

### Features

- **auth**: device-code sign-in modal with prominent code (#82)

### Refactors

- **auth**: drop loopback web flow, keep device flow only (#81)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.5...v0.8.6

## [v0.8.5] - 2026-11-02

### Fixes

- **auth**: show device code with one-click copy

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.4...v0.8.5

## [v0.8.4] - 2026-11-02

### Features

- **auth**: open device-code page with prefilled code
- **auth**: 美化 GitHub OAuth 回调落地页 (#78)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.3...v0.8.4

## [v0.8.3] - 2026-11-02

### Fixes

- **auth**: fall back to device flow when client_secret is missing (#75)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.2...v0.8.3

## [v0.8.2] - 2026-11-02

### Fixes

- **auth**: register github flow after service is ready (#72)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.8.1...v0.8.2

## [v0.7.11] - 2026-11-01

### Refactors

- **settings**: merge schedule into scope card and link subscription repos (#65)

### Docs

- 新增英文版 README.en.md，中文 README 默认并加语言切换 (#64)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.7.10...v0.7.11

## [v0.7.10] - 2026-11-01

> 修复 peer / engine 版本区间漏掉 `0.2.2-*` 预发布的问题，让插件在宿主升到 `0.2.2` 线后仍能正常安装。

### 修复 — 预发布版本被静默排除

- `package.json` 的 `peerDependencies["@deepseek-ai/dsh-tools"]` 与 `engines.dsh` 由 `>=0.2.1-rc.3 <0.3.0-0` 改为 `>=0.2.1-rc.3 <0.3.0-0 || >=0.2.2-alpha.0 <0.3.0-0`。
- 原因：node-semver 只有在范围的某个比较符与版本的 `major.minor.patch` 元组一致、且该比较符自身带预发布标签时才放行预发布版。原范围只在 `0.2.1` 元组上带预发布标签，于是 `0.2.2-alpha.2`、`0.2.9-rc.1` 等非 `0.2.1` 元组的预发布版会被静默排除，用户 `npm install` 时撞上 `ERESOLVE`。
- 补一条 `0.2.2` 元组的显式预发布分支后，已发布的 `0.2.2-alpha.2` 与后续 `0.2.2-*` 均可正常匹配；`0.3.0-*` 仍被排除。

## [v0.7.9] - 2026-11-01

> 内部重构：把重复的通用实现收敛到共享底座 `@morehao/dsh-plugin-kit@^0.3.1`。对外接口与业务语义保持不变。

### 改进 — 迁移到 dsh-plugin-kit 0.3.1

- **子进程执行**：`src/core/exec.ts` 收敛到 kit `./exec` 的 `spawnCollect` / `sanitizedEnv`，删除本地实现；握手阶段改为判 `result.error` 抛 `CORE_SPAWN_FAILED`（kit 的 `spawnCollect` 永不 reject）。
- **插件身份**：`plugin-info.ts` 的仓库地址规范化与读包改用 kit `./github` + `./meta`（`createPluginMeta`），保留 `readPluginInfo` / `normalizeRepositoryUrl` 导出面与返回形状。
- **HTTP 路由**：`routes.ts` 的 `sendJson` / `readBody` / 头校验改用 kit `./http` 的 `createRouteHandler`；业务 `dispatch`、`IpcError` 错误码与 `PluginUpdateError→409` 映射保持不变，错误码翻译仍留在插件侧。
- 对外路由响应形状、读包字段、错误码/映射均无变化（行为等价）。

## [v0.7.8] - 2026-11-01

> 统一「订阅」口径：这个功能不再叫「发版」，运行记录、概览、设置、订阅页与提示文案一致；顺带修好运行记录里的类型胶囊样式。

### 改进 — 全站口径统一为「订阅」

- **运行记录**：类型胶囊与筛选由「发版」改为「订阅」；空态改为「还没有订阅运行记录」，展开说明改为「订阅运行只做订阅检查与变更文档渲染」。
- **概览 / 设置 / 订阅页**：「发版订阅」统一为「订阅」（速览卡、设置分区、用量卡、分区跳转）；速览 KPI「新发版」改为「新版本」，与运行记录里的「新版本」计数一致。
- **订阅抽屉**：「发版记录」改为「变更记录」，加载与空态文案同步。
- **英文**：`Releases` 口径统一为 `Subscriptions`；运行记录胶囊用 `Subs`（列宽 56px，完整单词会挤压右侧列）。
- **Host 提示**：`SUBSCRIBE_FAILED` 的「发版文档」改为「变更文档」；`trending_run` 输出「发版 N 个新版本」改为「订阅 N 个新版本」；配置校验「发版日」改为「订阅检查日」。
- `README.md` / `docs/dsh-plugin-summary.md` 同步口径；「发布插件到 npm」语义的「发版」保持不变。

### 修复 — 运行记录类型胶囊样式

- 订阅行此前只带 `.dshgt-pchip` 基础类，渲染成灰描边小盒子，和日报的「日榜」胶囊不是一套。现补上 `release` 变体，与日/周/月同高、同圆角、同字重，只差色相（暖橙 `#b45309`）。
- 四个变体的颜色改为从 `--tone` 派生到宿主 token（文字 82% / 描边 30% / 填充 12%），深色主题下不再出现「亮色贴纸」。
- 胶囊统一由 `kindChip()` 渲染，避免以后新增类型再漏类名。

## [v0.7.7] - 2026-11-01

> 升级核心 `dsh.core.version` 0.8.2 → 0.8.3：修复「英文占比高的仓库被误判为摘要无效、降级为原文」；订阅抽屉遮罩背景色对齐 dsh-skills-console。

### 修复 — 摘要降级（核心 0.8.3）

- 现象：运行日志出现 `1/65 仓库摘要降级为英文原文（模型不可用或返回无效结果）`，预览里对应条目
  显示为 `[原文] …`，`summarySource=original`。实际模型正常，是核心的摘要校验把这类条目误判无效。
- 根因：核心 `validSummary` 要求「摘要汉字占比 ≥ 40%」。仓库名/描述几乎全是英文专有名词
  （如 `AI Studio Playground` / `OpenAI` / `Gemini` / `API`）时，即便写出通顺中文摘要汉字占比也只有
  0.14~0.24，被判无效、重试救不回，整条降级为 `[原文]`。
- 核心 0.8.3 改为「至少含一个汉字且不等于原文描述」：纯英文照抄仍拒绝，但英文占比高不再是降级理由。

### 改进 — 订阅抽屉背景色

- 遮罩由 `color-mix(var(--gt-fg) 34%, transparent)` + 模糊，改为固定深色 `rgba(4,6,9,.55)`、去模糊。
  旧写法以文字色作遮罩底色，深色主题下文字是浅色，遮罩变成一层浅灰白雾把背后页面刷白；现对齐
  `dsh-skills-console` 的观感。
- 抽屉面改用 `--gt-card`（bg-layer-1，与 skills-console 同层），正文纸面升到 bg-layer-2，
  阴影改为 `-30px 0 70px rgba(0,0,0,.38)`，关闭按钮 hover 同步到 layer-2。

## [v0.7.6] - 2026-11-01

> 升级核心 `dsh.core.version` 0.8.1 → 0.8.2：修正核心握手自报的 `contractVersion`（0.4.0 → 0.5.0），与契约包版本对齐。对插件行为无影响，仅版本自检更准确。

### 升级

- **核心 0.8.2**：`dsh.core.version` 由 `scripts/set-core-version.mjs` 写入为 `0.8.2`。核心修正了
  `internal/ipc/version.go` 的 `ContractVersion` 常量（此前自报 0.4.0，实际契约包为 0.5.0），并新增
  单测锁定其与 `contract/package.json` 一致。`ipcSchema`/`digestSchema` 仍为 2，wire 与解析逻辑不变。

## [v0.7.5] - 2026-11-01

> 升级核心 `dsh.core.version` 0.8.0 → 0.8.1：发版订阅在周期分支缺 `subscriptions.yaml` 时回退基准分支读取，「生成变更分析」不再因 0 订阅而 skipped。

### 升级

- **核心 0.8.1**：`dsh.core.version` 由 `scripts/set-core-version.mjs` 写入为 `0.8.1`。核心修复了
  `ReadRepoWithFallback`——按周期分支（如 `trending/weekly/2026-W44`）读取 `subscriptions.yaml`
  时，若该分支或文件不存在，回退到基准分支（`repo.baseBranch`，默认 `main`）再读一次，两者都缺才空。
  此前周期分支缺文件会解析成 0 订阅，release-only 运行被 skipped，界面表现为「生成变更分析」跑不出内容。
- 契约 wire 不变（`ipcSchema/digestSchema=2`），无需改动插件解析逻辑；`REPO_MIN_CORE_VERSION`
  （0.8.0）已满足，单仓触发无需降级。

## [v0.7.4] - 2026-11-01

> 修复「生成变更分析」一闪而过、却看不到发生了什么：解析兼容 + 跳过原因说明。

### 修复

- **skipped 运行被误判为失败**：核心在「`--stages releases` 但订阅为空 / 内容无变化」时退出码 0、输出
  `files:null`（契约 `RunResult.files` 必填为数组），插件按契约严格校验会抛 `IPC_INVALID`，界面表现为
  「生成变更分析」一闪而过报错。现在解析前把 `files:null/undefined` 归一成 `[]`，不再整次判错。

### 改进

- **跳过原因说清楚**：核心判定跳过时，若该周期分支上解析到的订阅数为 0（`subscriptions.yaml` 未落到该分支 /
  基准分支），明确提示「当前周期分支没有订阅列表，请确认订阅已提交到基准分支」并带上分支名；有订阅但无变化时
  提示「无变化」。不再显示误导性的「已生成 · 0 个仓库有更新」，也不再一闪而过、不明所以。
- 发版运行记录新增 `subscribed`（该周期分支订阅数），用于区分「没订阅」与「无变化」。

## [v0.7.3] - 2026-11-01

> 订阅页三处修复：待首次分析的仓库不再点出必败请求、添加订阅改弹窗、变更预览抽屉改紧凑 md 预览。

### 修复

- **单仓「触发分析」必败请求**：新添加、尚未跑过发版检查的仓库（`status=baseline`）在列表里也可点击「触发分析」，
  但单仓分析走 `--stages releases` 不合并 pending，核心会报 `repo ... is not in the subscription list` 后立即失败。
  现在 `baseline` 行的「触发分析」禁用并提示「待首次分析后才能触发」；分析失败时把核心「未纳入订阅 / 无发版记录」
  类错误翻成一句人话，错误条稳定可见，不再一闪而过。

### 变更

- **添加订阅改为居中模态弹窗**：工具条内联输入框改为弹窗（输入 owner/repo + 实时校验 + 回车提交 + Esc/遮罩关闭）；
  添加失败就地显示错误。

### 改进

- **变更预览抽屉**：正文包一层纸面卡（不再直接贴页面底色），移植原型紧凑 markdown 排版（h1 15 / h2 13 带强调左边框），
  不再复用日报的大号样式；抽屉遮罩加深 + 模糊、阴影加强，观感与设计原型一致。

## [v0.7.2] - 2026-11-01

> 依赖升级：`@morehao/dsh-plugin-kit` 0.1.0 → **0.2.1**。

### 改进 — 依赖

- 升级共用工具包 `@morehao/dsh-plugin-kit` 到 `0.2.1`（自更新引擎复用宿主原生 registryPlan）。
  0.2.1 保留插件使用的 `createPluginUpdater` / `normalizeProfile` / `PluginUpdateError` 等导出，行为兼容。

## [v0.7.1] - 2026-11-01

> 依赖升级：`dsh.core.version` 0.7.1 → **0.8.0**，`@morehao/trendradar-contract` 0.4.0 → **0.5.0**。
> 两者均已发布（核心 `v0.8.0` / 契约 `0.5.0`）。wire 仍 `ipcSchema=2` / `digestSchema=2`。

### 新增 — 发版单仓分析

- **订阅页重做**：一个列表 + 上方工具条（搜索 / ＋添加仓库 / 选择 / **生成变更分析**）；
  去掉 ⌘K 命令栏、底部快捷键行与冗长说明。
- **行操作**：「触发分析」（只分析该仓）· 「查看变更」（原「变更」改名）· 「移除」。
- **生成变更分析**：`POST /releases/run`——不传 repo 跑全部，传 repo 只跑该仓；单仓按行显示
  「分析中…」，全局给结果横幅；完成后刷新列表。
- 单仓触发**不推进 `lastReleaseWeek`**（避免把本周误标已检查、导致周调度跳过），全量仍推进；
  旧核心（< 0.8.0）单仓触发降级为全量、不传 `--repo`。
- 发版运行记录新增 `scopeRepo`；并发触发由后端拒绝（409）。
- 文档抽屉（发版记录 markdown）保持不变。

## [v0.6.1] - 2026-11-01

### 变更

- 契约依赖 `@morehao/trendradar-contract` 0.3.0 → 0.4.0：`SubscriptionStatus` / `SubscriptionItem` /
  `SubscriptionVolume` / `SubscriptionDoc` 改为从契约包 `import type`，删除 `src/ipc.ts` 与
  `client/api.ts` 里的本地兜底声明（0.6.0 的临时载体）。
- **无行为变化**：wire 仍 `ipcSchema=2` / `digestSchema=2`，`dsh.core.version` 仍为 `0.7.0`；
  运行时守卫与错误文案保持原样（契约包的 `subscriptionDoc` 校验比本地守卫更严，换用会改变对旧核心
  的接受范围，故不动）。

## [v0.6.0] - 2026-11-01

> **发版顺序**：先发布核心 `0.7.0`（含契约 0.4.0 的字段），再发布本插件——本版
> `dsh.core.version` 已指向 `0.7.0`，核心未发布前首次运行会下载失败。
> 契约包 `@morehao/trendradar-contract` 仍锁 `0.3.0`：0.4.0 的新类型（`SubscriptionItem` /
> `SubscriptionDoc` 等）先按本地声明落地（`src/ipc.ts`），契约包发布后切回包导入。

### 新增

- **订阅页重设计**：命令栏（输入即筛选，完整 `owner/repo` 出现添加建议、回车添加）+ 四列表格
  （仓库 / 最近版本 / 最近总结 / 状态，表头可排序）+ 常驻「变更」+ 批量选择（已选 N / 全选匹配 /
  取消 / 移除所选，确认框列出前 6 个）+ 空态与「无匹配」分开 + 键盘操作。
  列表只拉判断所需的最小字段，40 仓首次请求约 5 KB。
- **文档抽屉**：按仓拉取该仓库的发版记录 markdown（核心返回的是数据仓里的原文，面板只渲染、
  不二次总结），支持多卷切换（第 N 册 / 共 M 册）、加载/失败/空文档三态，限流或失败时顶部提示
  「本周未更新」。
- **发版周定时**：与日报调度独立（周几 + HH:MM + IANA 时区，60 s tick），错过时刻 6 h 内补跑，
  超窗跳过下周并入；同一 ISO 周不重复。设置页「发版订阅」新增定时与并发（自动/指定）。
- **发版运行记录**：每次发版运行落一条 `releaseRuns`（status / checked / changed / newTags /
  failed / tokens / duration / commit / prUrl / error），保留最近 30 条；运行记录页新增
  「全部 / 日报 / 发版」筛选与发版明细。
- 订阅页 meta 行显示周期、下次触发与上次发版检查时间、上周有变化的仓库数。

### 变更

- **发版检查改为每周一次**：核心每仓每周一次模型调用、一仓一份 `releases/<owner>/<repo>.md`
  文档（按周 prepend，超 600 行下一次写入开 `.02.md`）。因此 `releases.period` 只接受
  `weekly`（旧的 `daily`/`monthly` 会被校验拦下并提示改成 weekly），`perRepoLimit` 默认
  5 → 10（只影响文档里列出的版本数）。
- 新增设置项：`releases.summaryMaxChars`（1200）、`releases.docMaxLines`（600）、
  `releases.concurrency`（`auto` → `clamp(4, ceil(N/10), 8)`）、`releases.budgetSeconds`
  （`auto` → `min(300, 30+3N)`）、`releases.schedule.*`。**发版调度只写 settings.json，
  不进核心 YAML**。
- 插件经核心 `run --stages releases` 触发发版运行：不合并 pending 订阅、不改
  `subscriptions.yaml`，与日报共用单运行锁与当日分支/PR。
- `GET /subscriptions` 现在返回 `{ repos, items }`，新增
  `GET /subscriptions/releases?repo=&volume=`（只读镜像核心 IPC）。

### 修复

- 取消后的发版运行记录现在带 `errorCode=CORE_CANCELLED`，不再出现「已取消但没有原因」的记录。

## [v0.5.2] - 2026-10-31

### 修复

- **代理模式下订阅页无法增删仓库**：`mode=proxy` 的设置里 `baseURL` 为空（运行期由回环代理注入），但核心 `config.Load` 仍按必填校验，订阅命令直接报 `config invalid: baseURL为必填字段`。现在生成订阅临时配置时补一个回环占位端点（订阅命令不调用模型），`list` / `add` / `remove` 恢复正常。
- **概览 Token 用量 / 发版订阅速览块排版错乱**：v0.5.0 新增的 `.dshgt-glance-*` 等类名没有对应样式，标签与数值挤成一行。补齐两张速览卡的布局；无用量 / 无发版数据时整卡隐藏，不再铺一排「—」。
- **运行记录 token 列错位**：行网格未给 token 列预留宽度，有 token 的记录会把文件数、耗时挤到错误列。按有无 token 切换列模板，窄屏同步适配；顺带补上发版明细与订阅页缺失的样式。

## [v0.5.1] - 2026-10-31

### 变更

- **设置页字段改用 `?` 悬浮说明**：「摘要与用量」「发版订阅」两个分区的每个字段旁加问号（鼠标悬停或键盘聚焦展开），并移除两张卡片底部的整段说明文字。
- **发版订阅常开**：移除 `releases.enabled` 开关（设置页不再有「启用发版订阅」），写入核心配置时恒为 `true`；是否有产出只由订阅列表决定，列表为空时不产出、榜单产物不变。「订阅」页同步去掉开关状态提示。

### 修复

- **设置页操作回执自动收起**：保存 / 导入成功提示 5 秒后自动消失；失败提示保留到下一次操作。

## [v0.5.0] - 2026-10-31

### 新增

- **总用量（token）**：每次运行记录 token 总量与历史累计总量，**只展示总用量、不拆维度**。本次任务总量 = 榜单摘要阶段（`usage.totalTokens`）+ 发版订阅阶段（`releases.usage.totalTokens`），订阅消耗计入总量；累计读时求和、不落盘。概览速览块、运行记录（本次 tokens / 发版明细卡 / 页脚累计）与两个工具均展示；旧核心无数据时显示「—」。插件不做费用估算、不内置定价表。
- **发版订阅（releases）**：订阅一组仓库，每次运行把每个仓库新增的 Release（无 Release 时回退 Tag）写成中文 changelog，渲染到 `<output.dir>/releases/`，与榜单同分支同 PR。订阅列表随数据仓版本化（`<output.dir>/subscriptions.yaml`），经核心 `subscribe` IPC 读改（插件不直接写仓，`add/remove` 只写 `.git/pending`，`run` 落盘随 PR）。新增「订阅」视图与设置页「摘要与用量」「发版订阅」两分区；`releases.enabled=false` 时既有榜单产物逐字节不变。

### 变更

- **升级核心与契约**：`dsh.core.version` 0.4.0 → 0.6.0，`@morehao/trendradar-contract` 0.2.0 → 0.3.0（wire 仍 ipc=2 / digest=2，纯增量）。
- **新增错误码**：`SUBSCRIBE_FAILED`（订阅命令失败）；不改已有错误码名。
- **预览排除 releases/**：运行结束后挑 digest 预览时排除 `releases/` 前缀，保持「唯一 digest 预览」语义。

## [v0.4.4] - 2026-10-31

### 变更

- **概览榜单支持日/周/月三周期切换**：概览页「最近榜单」区块此前只展示日榜，现在按日榜 / 周榜 / 月榜分段展示，每个周期各自显示最近若干期，点格子可直接跳到榜单页对应期数；分段按钮上显示各周期期数。仅在调度启用多个周期时出现分段控件。
- **精简空日期展示**：不再把没有记录的日期逐个铺成「无记录」卡片，只渲染真正有记录的期数；完全无记录时显示空状态提示。今天尚未运行且调度开启时，日榜末尾保留一个「等待 {时间}」状态位。

### 修复

- **时间格式统一为 24 小时制**：`localTime` / `shortTime` / 下次运行时间等展示改用 `hourCycle: 'h23'`，避免不同环境下出现 12 小时制与 24 小时制混用。

## [v0.4.3] - 2026-10-31

### 变更

- **默认三周期全产出，无需勾选**：`schedule.periods` 固定收敛为 `daily,weekly,monthly`，定时运行默认产出日榜、周榜、月榜；设置页移除周期多选框，改为静态说明。旧配置（只有 `daily` 或空数组）在归一化时自动升级为三周期。相应地移除了「调度开启却未选周期」的校验（周期已恒为三项）。
- **手动/工具运行也默认三榜**：新增 `Runner.runMany()`，`POST /run` 与 `trending_run` 在省略 `period` 时按顺序依次跑日/周/月三个周期（各自独立 id、日志、历史记录、`periodSuccess`），响应新增 `summaries` 数组；显式传 `period` 时仍只跑单周期。批次期间由 `batching` 标志挡住外部并发触发。

## [v0.4.2] - 2026-10-31

### Features

- **榜单视图按周期分段**：工作台的「日报」tab 更名为「榜单」，视图顶部用「日榜 / 周榜 / 月榜」分段切换，每个周期各自一条独立时间线（日按天、周按 ISO 周、月按月），互不吞并。同一期多次运行只保留一条（优先成功且有预览），分段上显示各周期有预览的期数。
- **运行记录体现周期**：每条记录加周期标签，并新增「全部 / 日榜 / 周榜 / 月榜」筛选；展开详情显示周期。概览「上次交付」加周期标签。
- **回看窗口扩到 90 条**：`HISTORY_LIMIT` / `PREVIEW_LIMIT` 从 30 提到 90，三周期共用历史时不再挤掉日榜的最近 30 天窗口。

### 修复

- **同一天多周期只显示一条**：此前榜单视图按日期分组，月末日榜与月榜同日各跑一次会互相吞并，周日日榜与周榜同日也会被藏起一条；现在按「周期 + 期数桶」分组，三个周期都完整保留。

### 变更

- **精简「关于」卡片**：更新区去掉标题与说明句，压缩成与顶部身份条同构的一行（状态 + 按钮）。
- **「关于」包名行更简洁**：移除「复制完整包名」文字与复制图标，点击整行或手动选中即可复制，复制成功后整行边框短暂转绿。
- **「核心」增加 GitHub 跳转**：核心版本号链接到 core 仓库并附 GitHub 图标；仓库地址由 `package.json` 的 `dsh.core.repo` 经 `/state.core` 暴露，解析不到时降级为纯文本。
- **概览页移除「插件更新」卡片**：更新入口只保留顶部身份条与「关于」弹层。

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.4.1...v0.4.2

## [v0.4.1] - 2026-10-31

### Features

- **ui**: move navigation to top with identity bar (#25)

**Full Changelog**: https://github.com/morehao/dsh-github-trending/compare/v0.4.0...v0.4.1

## 0.4.0 - 2026-10-31

### 变更

- **适配核心 0.4.0 的三周期产物布局**：`dsh.core.version` 升到 `0.4.0`。核心产物改为 `trending/<period>/<bucket>/<name>.{md,json}`（daily/weekly/monthly），分支为 `trending/<period>/<name>`；插件每次运行按标的周期传 `run --period daily|weekly|monthly`，保证「抓取窗口 = 标注周期」。
- **预览按周期选取**：从本次 artifact 里挑本期 digest 的 `.md`（daily=`YYYY-MM-DD.md`、weekly=`YYYY-Wnn.md`、monthly=`YYYY-MM.md`），并排除 `index.md`；日榜预览行为不变。
- **调度按周期**：新增 `schedule.periods`（日/周/月多选，默认 `daily`）。日榜每天、周榜周日（ISO 周末）、月榜月末触发；去重键含周期与本地日期，同一周期当天只成功一次；「下次运行」取所有已启用周期里最近的一次。
- `trending_run` 工具与 `POST /run` 增加可选 `period` 参数（缺省用 `trending.since`）。

## 0.3.2 - 2026-10-31

### 改进

- **更新入口更显眼**：概览页新增「插件更新」卡片——当前 / 最新版本、检查更新、更新到 vX、本地安装时的手动命令都在这里；侧栏包名在有新版时显示红点。关于弹层与概览共用同一个 controller（模块级单例），打开多个位置不会重复请求。
- 关于弹层的更新区块改为复用同一组件（`client/update-panel.ts`），行为不变。

## 0.3.1 - 2026-10-31

### 新增

- **插件自更新**：关于弹层显示当前版本与 npm 最新版，打开时静默检查（Host 侧 5 分钟缓存），也可手动「检查更新」（`GET /update?fresh=1`）。确认后经宿主 `pluginManager` 重装本插件：`installBundle` 返回 `already-installed` 时走 `removeBundle → installBundle`，remove 之后安装失败会尝试装回原版本，成功后提示重启 DSH 生效。`link:` / `file:` / `workspace:` 安装不提供一键更新，只给 `dsh plugin --profile <name> add ...@latest` 供复制；没有 `pluginManager` 时同样退化为手动命令。
- **共享引擎 `@morehao/dsh-plugin-kit`**：更新引擎（查版本 / semver / registry 计划 / 安装路径 / 事件）与客户端状态机放进共享包，本仓新增 `src/host/update.ts` 只做 `ctx.get` 与 `execCapture` 接线；`POST /update` 的业务失败返回 409 + `UPDATE_FAILED` + `updateCode`，不占 500。
- 客户端构建守卫允许依赖包源码进入 bundle（`link:` / `file:` 依赖会解析到仓库外），本仓 `src/`、`lib/` 仍禁止进客户端产物。

### 修复

- **关于弹层拿不到主题变量**：`AboutDialog` 挂在 `.dshgt-root` 之外，`--gt-*` 没定义，弹层背景/边框退化成透明、文字对比度极低。现在弹层外面包一层 `.dshgt-root` 再进 mask。
- **日报里的表格不再被拍平成一个段落**：`client/markdown-core.ts` 补上 GFM 管道表解析——表头 + 分隔行（`---` / `:---` / `:---:` / `---:` 决定列对齐）+ 数据行，单元格按行内规则解析（链接、粗体、行内代码），支持反引号里的 `|` 与 `\|` 转义；表头/分隔行列数不一致或缺少分隔行时退回段落，不丢内容。`client/markdown.ts` 渲染 `table` / `thead` / `tbody` / `th` / `td` 并按对齐写 `text-align`；此前整张表会被当成「一行满是 `|` 的文字」。
- 表格样式随附：表头浅底、行分隔线、偶数行斑马纹、窄容器横向滚动；单元格内 `word-break: normal`，避免 `185,423` 这类数字被拆成两行。

## 0.3.0 - 2026-10-31

### 变更（含破坏性）

- **契约改用独立 npm 包**：类型与运行时校验全部来自 `@morehao/trendradar-contract@0.2.0`（`dependencies` 精确锁定），删除仓库内 `contract/` 快照、`scripts/sync-contract.mjs`、`scripts/gen-ipc-types.mjs` 与 `src/ipc.gen.ts`。契约升级从此只改依赖版本。
- **wire 升级到 v2**：`ipcSchema=2` / `digestSchema=2`，握手额外校验 `contractVersion` 主版本（0）。与核心 0.3.0 配套；混搭旧核心会被 `CORE_INCOMPATIBLE` 明确拦下。
- **单一 RunResult 解析**：`parseRunResult` 只接受契约 v2 `RunResult`（用契约包自带 ajv 校验器），删除对旧核心 `runOutput` 的兼容分支；`branch` / `commit` / `prUrl` / `contentHash` 为可选字段。
- **旧状态迁移**：读取时若 `lastDigest` 缺 `contentHashAlgo` 或 `coreVersion` 早于 0.3.0，判定为 legacy，清空 `lastDigest` 与绑定的 `pendingPr`；旧历史记录打 `legacy` 标。插件启动时（`migrateLegacyState`）把清洗结果落盘。
- 新增 `scripts/set-core-version.mjs` 写 `dsh.core.version`（本版为 `0.3.1`）；`check:naming` 改为校验契约包依赖与 wire 版本。
- **核心版本锁定 `0.3.1`**（`dsh.core.version`）：首次运行下载带 append-only 推送与 `TRENDRADAR_TRIGGER` 支持的核心。

### 变更（运行与调度）

- **推送失败可自愈**：核心改为日期分支追加提交 + 普通推送，`stale info` / `non-fast-forward` 不再需要人工进仓库处理；插件把 push 失败细分为 `stale-lease` / `non-fast-forward` / `auth` / `protected` / `hook` / `pathspec`，并按原因给出下一步（zh/en）。
- **跳过原因可见**：结果与历史记录新增 `skipReason`（`merged` / `pr-closed` / `unchanged`），运行页直接说明为什么没跑或没提交。
- **定时运行尊重已关闭的 PR**：插件经 `TRENDRADAR_TRIGGER` 把触发来源传给核心；定时运行遇到 closed-unmerged 的 PR 会跳过，手动运行才会重建并重开。
- **调度改为「成功才锁当天」**：失败不再吃掉一整天；同一 catch-up 窗口内最多重试 2 次、间隔至少 5 分钟。
- 历史记录保存 `errorReason` / `skipReason`，重开界面仍能看到原因。

### 新增（工作台 / 日报预览 / 最近 30 天）

- **01 工作台**：侧栏入口进入「概览 / 日报 / 运行记录 / 设置」四视图；概览回答下次运行、就绪检查（核心 / 模型 / 仓库 / GitHub）、上次交付与最近 7 天；运行记录支持筛选、展开交付物、pendingPr/legacy 状态与只读日志抽屉；设置继续沿用 #13 的六个 tab，本轮不重排。
- **日报预览**：运行成功后只读核心本次 `outcome.files` 里的当天 `.md`（优先 `YYYY-MM-DD.md`，否则只有一个 `.md` 时用它），路径必须在 `repo.path` 内（词法 + realpath）、≤512 KB、无 NUL、sha256 与契约一致，才复制到 `$DSH_HOME/github-trending/previews/<runId>.md`；0600、临时文件 + rename、最多 30 份。预览失败只记日志，不阻断运行；`state.json` / `history.json` 只存元数据。
- **最近 30 天日期切换**：日报按调度时区把 history 按日期分组，每天一条（优先当天成功且有预览的最近一条）；默认打开最近一期有预览的日期；失败 / 无变更 / 试跑 / 旧记录 / 副本缺失各有空状态；切换用 React state + AbortController，不写 URL hash。
- **渲染安全**：Markdown 子集（标题 / 段落 / 列表 / 引用 / 粗体 / 行内代码 / 链接 / 分隔线 / frontmatter 元信息），只生成 React 文本节点，链接仅 http(s)，不渲染 HTML / 图片；可切「原文」。
- **关于与仓库入口**：`/state.plugin` 增加 `repository`（由 `package.json.repository` 规范化），左轨包名点击打开关于弹层；完整包名可复制，外链 `target=_blank rel=noreferrer`。
- **Host 数据**：`RunRecord` / `RunSummary` 补 `date` / `commit` / `preview`，`/state` history 从 10 条改为 30；新增 `GET /preview?id=<runId>`（只接受历史里出现过的 id、不接路径、自定义头鉴权、`no-store`）。
- **测试**：新增 state / runner / routes / plugin-info / markdown-core / digest-core 用例；`npm run check` 145 条单测 + AC-P 11 条全绿。

### 修复

- **删掉「高级设置」开关**：它是设置页底部的全局按钮，只在「内容来源 / 模型」两个 tab 插入字段，且插在卡片顶部——用户滚到底部点它看不到任何变化（4 个 tab 更是完全无反应）。现在移除该按钮与两个仅它能编辑的字段（`TRENDING_DIGEST_CORE`、手动 `凭据引用`；前者继续支持环境变量与 `settings.json`，后者由「沿用 DSH 配置」自动带入）。「内容来源」没有可编辑项，因此该 tab 不再显示「保存本页」。
- **凭据状态按密钥来源判断**：回环代理模式下密钥由宿主自己带上（已经复用 DSH 凭据），不再显示红色的「未配置」，改为「沿用 DSH 凭据」并说明本页无需填写；直传模式仍如实区分「已配置 · 来源」与「未配置（引用为空 / 解析不到）」。设置页、概览就绪检查与外壳就绪数统一走同一套判定。

## 0.2.0 - 2026-10-31

### 变更

- **设置页只出现在左侧菜单栏**：不再同时注册 `settings.section`，改为左侧栏一个入口、内含「设置 / 运行」两个 tab，避免同一插件在左侧栏与设置里各出现一份。
- **跟随宿主明暗主题**：样式表从宿主并不存在的 `--dsh-fg / --dsh-bg / ...` 换成设计系统 token `--dsw-alias-*`，暗色桌面端不再强行渲染亮色。
- **设置页改为左侧纵向 tab + 右侧滚动**：六个分区（内容来源 / 模型 / 仓库 / 认证 / 榜单 / 调度）纵向排列，右栏独立滚动；面板根补上 `height/overflow`，修复宿主 `main` 面板裁掉内容且不出纵向滚动条的问题（运行页同样受益）。
- **沿用 DSH 配置更省心**：改为读取宿主 `ctx.agentDefaultModel.currentSelection()` 的当前默认模型一键带入（默认置顶），并只列**实际生效路由**（`listProviders`）及其模型目录（`listModels`）供按需展开选择；不再把 `listConfigurableProviders` 的能力目录当成「已配置」，也不会再把「支持 OAuth」误判为可用。`凭据引用` 默认隐藏、随选择自动带入。
- **首屏只留普通用户字段**：`TRENDING_DIGEST_CORE` 与手动 `凭据引用` 收进「高级设置」；仓库路径改为目录选择；目标分支只读展示仓库默认分支（`git symbolic-ref` 读 `origin/HEAD`，只读不写仓库）；`远端`、`PR 标题模板` 不再露出，用默认规则。
- **GitHub 认证收敛**：只保留真正可用的「本机 gh」与「PAT」两种，各自给出可操作步骤，并新增「测试认证」按钮（`POST /github/test` 调 `api.github.com/user` 验证并回显账号）。删除从未实现的 Device Flow（旧配置里的 `device` 自动迁移为 `gh`）。
- **侧栏入口不再是一整张卡片**：`sidebar.panellist` 只渲染 16–18px 图标（`SidebarPanelIcon`），状态摘要与「立即运行 / 试跑」留在面板页。
- **设置按 tab 分段保存**：每个 tab 独立提交与校验（`POST /config` 新增 `section`），保存某个分区不会顺带提交或覆盖其它 tab 里尚未保存的改动；左栏 tab 用黄点标记未保存改动。

### 修复

- **运行日志写到真实 `~/.dsh`**：`Store.logsPath` 之前忽略 `dir` 选项，测试/自定义数据目录也会把 `runs/*.log` 写进默认数据目录；改为跟随 `this.dir`。
- **代理模式下保存被 baseURL 校验误拦**：`mode=proxy` 的端点由运行时回环代理注入、quickfill 也会清空 `baseURL`，但 `/config` 仍强制其非空，导致「模型预检通过、保存却报 `model.baseURL：该 provider 需要显式 baseURL`」。现在代理模式豁免该必填校验（仍校验非空时的 http(s) 格式）。

## 0.1.4 - 2026-10-30

> 0.1.3 从未发布到 npm（tag 推上去后 `release.yml` 在「发布前校验」失败）。0.1.4 是这批改动的第一次真实发布，内容 = 0.1.3 小节 + 本节的修复。

### 修复

- `check-pack` 不再假设 `npm pack --dry-run --json` 是单段干净 JSON：改为扫描顶层平衡 JSON 值、取第一个含 `files` 的数组，兼容 CI 上「两段 JSON 以逗号相连」的输出形态（release run 41083620340 实测）；新增 `test/pack-json.test.mjs` 6 条回归。

## 0.1.3 - 2026-10-30

### 工程（CI / 工具链）

- **门禁补齐为单一入口**：`npm run check` 现在串起语法 → host/client 类型 → lockfile → 契约 → 构建 → 命名/接线 → 打包白名单 → Release 正文冒烟 → 单测 → AC-P；`check.yml` 只调用它，本地与 CI 跑同一串脚本。
- 新增四道检查：`check-syntax.mjs`（`scripts/`、`test/` 语法 + `locale/`、`contract/` JSON 可解析）、`check-naming.mjs`（包名 / patch `name` / `export const name` 三处一致，`dsh.core` 与 `UPSTREAM.json` 同源，`exports`/`files` 接线）、`check-pack.mjs`（tarball 白名单 + 必备文件）、`smoke-release-notes.mjs`（投影与 git-kit 读回管道逐字一致）。
- release 链路不再重复校验：`prepublishOnly: npm run check` 改为 `prepack: npm run build`，发布时只构建、不再跑第二遍测试。
- **actions 升 v7**：此前的两条 CI warning（`Node.js 20 is deprecated`、`package-manager-cache` 非法输入——v4 不认识该输入，等于「关依赖缓存」一直空转）来自 actions v4，升 v7 后消失；Node 保持 22（CI 与发布），`engines` 为 `^22.20.0 || >=24.0.0`，新增 `.nvmrc`，构建依赖精确锁版本。

## 0.1.2

> 0.1.1 从未发布到 npm（tag 推上去后 CI 在 `npm ci` 就失败），0.1.2 是它的第一次真实发布。

### 修复

- lockfile 里 57 个 `resolved` 指向 `registry.npmmirror.com`，npm 11 在 CI 拒绝拉取（`EALLOWREMOTE`）；统一为 `registry.npmjs.org`，并加 `scripts/check-lockfile.mjs`（`npm run check` 会跑），把这类只在发版暴露的错误前移到 PR。

### 发布链路

- 新增 tag 触发的发布：`.github/workflows/release.yml`（OIDC Trusted Publishing，无 NPM_TOKEN）+ `scripts/ci-publish.sh`（版本守卫 / 幂等 / 失败回读后重试）+ `scripts/release-notes.mjs`（只投影注记 tag 正文）+ `docs/publishing.md`。
- `check.yml` 在 PR/main 上跑 `npm run check` 与 AC 机械检查。

## 0.1.1

分发方式变更：核心二进制不再走 npm 平台分包，改为 **GitHub Release 下载 + sha256 校验 + 本地缓存**（2026-10-30 决策 B）。

### 变更

- **获取核心**：`TRENDING_DIGEST_CORE` / 设置里的 `corePath`（覆盖，仅排障）→ 缓存 `$DSH_HOME/github-trending/core/v<version>/` → 按 `os/arch` 下载 `trendradar_<goos>_<goarch>`，用同目录 `checksums.txt` 校验（流式写入 + 原子 rename + 0755），失败不留半个文件；缓存命中后完全离线。
- **版本来源**：`package.json` 的 `dsh.core.{repo,version}`；`scripts/sync-contract.mjs --ref vX.Y.Z` 会同步写入，保证「契约来源 tag」与「下载的核心版本」是同一个值。
- **新增配置**：`coreAutoDownload`（默认 `true`）；关掉后只报 `CORE_NOT_DOWNLOADED`，由设置页显式下载。
- **设置页**：显示 Release 版本 / 资产名 / 缓存状态 / 下载 URL，并提供「下载核心 / 重新下载」按钮（`POST /core/download`）。
- **新增错误码**：`CORE_NOT_DOWNLOADED`（未下载，附下载地址）、`CORE_CHECKSUM_MISMATCH`（校验失败且已丢弃）；`CORE_UNAVAILABLE` 现在覆盖 404（版本未发布）、网络失败与平台不在矩阵。
- **移除**：`optionalDependencies` 里的 6 个 `@morehao/trendradar-core-*`（从未发布，安装时只是 6 次无效探测）。

### 修复（实测 v0.1.0 Release 后发现）

- Windows 资产名带 `.exe`（goreleaser `formats: [binary]` 保留后缀）：`assetName()` 按平台补后缀，避免 Windows 上下载 404。

### 测试

- 新增 `test/release.test.mjs`（命名映射 / 下载校验 / 缓存复用 / 篡改重下 / 校验失败无残留 / 404 提示 / force）与 `test/core-status.test.mjs`（未下载 / 已缓存 / 覆盖路径三种状态）。
- AC 脚本 AC-P-11 判据改为「环境变量优先 / 未设走 Release」，全套 71 条测试、11 条 AC 机械检查通过。

## 0.1.0

首个可用版本：插件侧完整落地，内容仍全部由 `trendradar` 核心产出。

### 新增

- **核心客户端**：`TRENDING_DIGEST_CORE` → 平台包（`@morehao/trendradar-core-<os>-<cpu>`）定位；`version --json` 握手比对 `ipcSchema`/`digestSchema`；一次 `run` 一次性进程，120 s 超时、`SIGTERM`→`SIGKILL` 取消；stdout 单信封解析，同时兼容契约 `RunResult` 与核心当前 `run --json` 形状。
- **密钥不落盘**：核心配置经 POSIX FIFO 传入（文件系统里不出现明文），Windows 退化为 0600 临时文件并立即删除；GitHub token 只走子进程环境；日志统一脱敏。
- **契约快照**：`contract/` 随包分发（schema + fixtures + `CONTRACT.sha256` + `UPSTREAM.json`），`scripts/sync-contract.mjs --ref <sha>` 从核心仓库同步并校验 aggregate；`src/ipc.gen.ts` 由 schema 生成，`npm run check:contract` 校验两者。
- **设置页**：内容来源与核心状态、模型（快速填充 + 连通性预检）、归档仓库、GitHub 认证、榜单范围、调度；从本机 CLI 一次性导入非敏感字段（密钥不导入）。
- **快速填充**：读宿主 `listProviders`/`listConfigurableProviders`/`listModels` 与 `ctx.credentials.describe/resolve`，按三种凭据形态落到 `direct` / `proxy` / 手填。
- **回环代理**：OAuth 类 provider 由插件在 `127.0.0.1` 起一次性 OpenAI 兼容端点，转发 `ctx.llm.stream`；随机端口 + 一次性 token，运行结束即关闭。
- **运行页与侧栏卡片**：本次（运行/试跑/取消、9 步、最近结果、错误卡）与历史（最近 30 条）；侧栏卡片显示状态、下次运行、上次结果与一键运行。
- **两个工具**：`trending_run`、`trending_history`（稳定对外名）。
- **调度**：插件自己的 60 s tick，按 IANA 时区判当日、6 小时补跑、同日不重复。
- **共存检测**：`PATH` 上的 `trendradar` 只提示不切换。
- **错误码映射**：17 个核心码 + 插件码（`CORE_*`、`IPC_INVALID`、`MODEL_KEY_MISSING`、`GITHUB_AUTH`、`PUSH_FAILED` 等），带落点与「下一步」。
- **locale**：`locale/zh.json` / `locale/en.json`（市场卡片标题与描述）。

### 已知偏差

- 核心暂未实现 stdin 信封，插件按其现有 `run --config <path> --json` 传参；`RunResult` 已兼容。
- 宿主 `schedule` 是会话本地提醒，插件改用自有 tick 覆盖无人值守场景。
- 平台包（`@morehao/trendradar-core-*`）尚未发布：缺失时明确报 `CORE_UNAVAILABLE`，不降级。
- 版式只支持 `canonical`；`template` 字段映射留待二期。

## 0.0.1

- 初始化包结构：TypeScript + tsup 构建、Cordis 插件入口、市场元数据。
