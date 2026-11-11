/**
 * 客户端唯一的数据入口：统一前缀、CSRF 头、错误码透出。
 *
 * 所有请求都打到 Host half 的 `/api/morehao/github-trending/*`；客户端不直接碰核心、
 * 不读本地文件、不持有任何密钥。
 */
import type {
  SubscriptionDoc,
  SubscriptionItem,
  SubscriptionList,
  SubscriptionStatus,
  SubscriptionVolume,
} from '@morehao/trendradar-contract';

// 订阅相关类型直接来自契约包（type-only：运行时不加载契约包，bundle 仍只依赖 react）。
export type { SubscriptionDoc, SubscriptionItem, SubscriptionList, SubscriptionStatus, SubscriptionVolume };

export const API = '/api/morehao/github-trending';
export const HEADER = 'x-dsh-github-trending';

/** 榜单周期（与 core 0.4.0 的 `--period` 一致）。 */
export type Period = 'daily' | 'weekly' | 'monthly';

/** 日报视图的定位：某个周期的某一期（期数桶由 `digest-core.periodBucket` 计算）。 */
export interface DigestTarget {
  period: Period;
  bucket: string;
}

export interface ApiFailure extends Error {
  code?: string;
}

export async function apiCall<T = Record<string, any>>(
  method: string,
  path: string,
  body?: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', [HEADER]: '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  let json: Record<string, any> = {};
  try {
    json = (await response.json()) as Record<string, any>;
  } catch {
    json = {};
  }
  if (!response.ok || json.ok === false) {
    const error = new Error(typeof json.message === 'string' ? json.message : `HTTP ${response.status}`) as ApiFailure;
    error.code = typeof json.code === 'string' ? json.code : undefined;
    throw error;
  }
  return json as T;
}

export interface PreviewMeta {
  file: string;
  bytes: number;
  sha256: string;
  truncated?: boolean;
}

/** 发版订阅阶段摘要（历史/运行记录展示用）。 */
export interface ReleasesSummary {
  enabled: boolean;
  repos: number;
  newReleases: number;
  summarized?: number;
  degraded?: number;
  failed?: number;
  skipped?: number;
}

export interface RunSummary {
  id: string;
  ok: boolean;
  skipped: boolean;
  dryRun: boolean;
  date?: string;
  durationMs: number;
  coreVersion: string;
  files: number;
  contentHash?: string;
  branch?: string;
  commit?: string;
  prUrl?: string;
  preview?: PreviewMeta;
  skipReason?: string;
  /** 本次是显式「强制重跑（忽略缓存）」。 */
  forced?: boolean;
  /** 本次任务 token 总量（榜单 + 订阅阶段，含订阅）；缺省表示无数据。 */
  tokens?: number;
  /** 发版订阅阶段摘要；未启用/旧核心则缺省。 */
  releases?: ReleasesSummary;
  error?: {
    code: string;
    message: string;
    hint: string;
    area: string;
    retriable: boolean;
    inferred?: boolean;
    reason?: string;
  };
  warnings: string[];
  channel?: 'fifo' | 'tmpfile';
  proxy?: boolean;
  logFile?: string;
}

export interface RunRecord {
  id: string;
  at: string;
  kind: 'run' | 'dry-run';
  ok: boolean;
  skipped: boolean;
  errorCode?: string;
  errorMessage?: string;
  errorReason?: string;
  skipReason?: string;
  /** 本次是显式「强制重跑（忽略缓存）」。 */
  forced?: boolean;
  durationMs: number;
  files: number;
  date?: string;
  period?: Period;
  contentHash?: string;
  branch?: string;
  commit?: string;
  prUrl?: string;
  preview?: PreviewMeta;
  coreVersion: string;
  model: { provider: string; model: string };
  languages: string[];
  warnings: string[];
  /** 本次任务 token 总量（榜单 + 订阅阶段，含订阅）；缺省表示无数据。 */
  tokens?: number;
  /** 发版订阅阶段摘要；未启用/旧核心则缺省。 */
  releases?: ReleasesSummary;
  legacy?: boolean;
}

export interface CoreReleaseStatus {
  repo: string;
  tag: string;
  asset: string;
  url: string;
  checksumsUrl: string;
  cacheDir: string;
  binaryPath: string;
  cached: boolean;
}

export interface CoreStatus {
  state: 'ready' | 'unavailable' | 'incompatible';
  path?: string;
  source?: 'settings' | 'env' | 'cache' | 'download';
  release?: CoreReleaseStatus;
  override?: { path: string; source: 'settings' | 'env' };
  download: { state: 'cached' | 'missing' | 'override'; reason?: string };
  version?: string;
  commit?: string;
  ipcSchema?: number;
  digestSchema?: number;
  supportedProviders: string[];
  /** 核心开源仓库（`https://github.com/<owner>/<repo>`）；缺失时界面隐藏外链。 */
  repository?: string;
  code?: string;
  message?: string;
  checkedAt: string;
  durationMs?: number;
}

export interface CoexistenceStatus {
  found: boolean;
  path?: string;
  version?: string;
  ipcSchema?: number;
  compatible?: boolean;
  message?: string;
}

/** 发版运行记录（`state.releaseRuns`，最多 30 条）；旧状态文件没有该字段。 */
export interface ReleaseRunRecord {
  id: string;
  startedAt: string;
  finishedAt: string;
  status: 'ok' | 'failed' | 'skipped' | 'cancelled';
  checked: number;
  /** 该周期分支上解析到的订阅仓库总数；缺省表示旧核心/旧记录未提供。 */
  subscribed?: number;
  changed: number;
  newTags: number;
  summarized: number;
  degraded: number;
  failed: number;
  rateLimited: number;
  durationMs: number;
  tokens?: number;
  commit?: string;
  prUrl?: string;
  branch?: string;
  errorCode?: string;
  errorMessage?: string;
  coreVersion?: string;
  scopeRepo?: string;
  /** 本次是否为强制重新生成（忽略缓存、重新调模型）。 */
  forced?: boolean;
}

/** 插件侧每周发版节奏；与榜单调度（`schedule.*`）互相独立。 */
export interface ReleaseScheduleSettings {
  enabled: boolean;
  /** ISO 星期：1=周一 … 7=周日。 */
  weekday: number;
  /** `HH:MM[:SS]`，按 `timezone` 解释的本地墙钟。 */
  time: string;
  timezone: string;
}

export interface SettingsShape {
  model: {
    provider: string;
    mode: 'direct' | 'proxy';
    hostProvider: string;
    baseURL: string;
    model: string;
    apiKeyRef: string;
    temperature: number;
    maxTokens: number;
    allowDegraded: boolean;
  };
  repo: { path: string; baseBranch: string; remote: string; commitMode: 'branch' | 'direct'; authorName: string; authorEmail: string };
  pr: { enabled: boolean; titleTemplate: string; autoMerge: boolean; labels: string[] };
  github: { authMode: 'pat' | 'gh' | 'browser'; tokenRef: string };
  trending: { since: Period; languages: string[] };
  summarize: {
    batchSize: number;
    maxRetries: number;
    enrich: 'none' | 'repo' | 'readme';
    readmeChars: number;
    enrichCacheTTLHours: number;
    enrichConcurrency: number;
    enrichTimeoutSeconds: number;
    enrichBudgetSeconds: number;
  };
  /** 本地 star 观测库（核心 `observe.*`）；旧设置可能没有该字段，缺省按默认处理。 */
  observe?: { enabled: boolean; backfillDays: number; maxCandidates: number };
  releases: {
    includePrerelease: boolean;
    includeDrafts: boolean;
    fallbackToTags: boolean;
    baselineOnFirstRun: boolean;
    /** 首次订阅仓库基线补发最近 N 个版本；`0` = 不补发。缺省按 3 处理。 */
    backfillLatest?: number;
    perRepoLimit: number;
    maxNotesChars: number;
    period: Period;
    /** 订阅检查并发；`auto` 由 Host 按订阅数解析成 1–8（核心只认数字）。缺省按 `auto` 处理。 */
    concurrency?: 'auto' | number;
    /** 订阅阶段的模型预算秒数；`auto` 同理。缺省按 `auto` 处理。 */
    budgetSeconds?: 'auto' | number;
    /** 插件侧每周发版节奏（不进核心 YAML）；旧设置没有该字段。 */
    schedule?: ReleaseScheduleSettings;
  };
  output: { dir: string };
  schedule: { enabled: boolean; time: string; timezone: string; periods: Period[] };
  corePath: string;
  /** 摘要输出语言；`''` = 跟随宿主（宿主 locale → 中英外回落 zh）。缺省按 '' 处理。 */
  outputLanguage?: string;
  /** 核心出站网络代理；空串 = 不使用。旧设置可能没有该字段。 */
  network?: { proxy: string };
  /** 单次运行硬超时（毫秒，插件编排参数，不进核心 YAML）；旧设置可能没有该字段。 */
  run?: { timeoutMs: number };
}

export interface StatePayload {
  plugin: { name: string; version: string; repository?: string };
  settings: SettingsShape;
  core: CoreStatus;
  coexistence: CoexistenceStatus;
  /** 摘要输出语言解析结果；Host 尚未提供时缺省（设置页用 settings.outputLanguage 兜底）。 */
  language?: {
    /** 宿主偏好的归一标签（如 `zh` / `en`；未知时为空串）。 */
    hostLanguage: string;
    /** 最终下发给核心的语言（支持集内，如 zh / en）。 */
    resolvedLanguage: string;
    /** 该值的来源：显式设置 / 宿主 locale / 兜底 zh。 */
    outputLanguageSource: 'explicit' | 'host' | 'fallback';
  };
  schedule: {
    enabled: boolean;
    time: string;
    timezone: string;
    periods: Period[];
    nextRunAt?: string;
    lastRunDate?: string;
    source: 'timer';
    /** 发版周调度；Host 尚未提供时缺省（读 `settings.releases.schedule` 兜底）。 */
    releaseEnabled?: boolean;
    releaseWeekday?: number;
    releaseTime?: string;
    releaseTimezone?: string;
    nextReleaseAt?: string;
  };
  status: {
    running: { id: string; startedAt: string } | null;
    lastRunAt: string | null;
    lastDigest: { date: string; contentHash: string; contentHashAlgo?: string; coreVersion: string } | null;
    lastResult: RunRecord | null;
    pendingPr: { url: string; createdAt: string; date?: string } | null;
    pendingPrState?: 'open' | 'closed' | 'merged' | 'unknown';
    history: RunRecord[];
    /** 发版运行记录（最多 30 条）；旧状态文件没有该字段。 */
    releaseRuns?: ReleaseRunRecord[];
    /** 最近一次发版运行结束时间（失败也算）；旧状态文件没有该字段。 */
    lastReleaseAt?: string | null;
    /** 历史全部运行的 token 累计（读时求和）；全无数据则缺省。 */
    totalTokens?: number;
  };
  model: {
    mode: 'direct' | 'proxy';
    credential: { ref: string; configured: boolean; source: string | null; writable: boolean };
    effectiveBaseURL: string;
  };
  github: {
    authMode: string;
    configured: boolean;
    source: string;
    /** GitHub 登录 attempt 视图。 */
    attempt?: GithubAttemptView;
    /** authorization 服务可用且 GitHub 授权流程注册成功（登录按钮是否可点）。 */
    browserAvailable?: boolean;
  };
  /** 发版运行记录的另一种挂载位置；与 `status.releaseRuns` 二者读其一即可。 */
  releaseRuns?: ReleaseRunRecord[];
  lastReleaseAt?: string | null;
}

/** GitHub 登录 attempt 视图（与 Host `github-auth.attemptView` 同构）。 */
export type GithubAttemptPhase = 'idle' | 'waiting-device' | 'exchanging' | 'done' | 'error';

export interface GithubAttemptView {
  phase: GithubAttemptPhase;
  verificationUri?: string;
  userCode?: string;
  expiresAt?: number;
  login?: string;
  error?: string;
}

/** 启动 GitHub 登录（设备码）。 */
export async function beginGithubSignIn(): Promise<GithubAttemptView> {
  const payload = await apiCall<{ attempt: GithubAttemptView }>('POST', '/github/browser/begin', {});
  return payload.attempt;
}

/** 轮询登录 attempt 视图。 */
export async function getGithubSignInStatus(signal?: AbortSignal): Promise<GithubAttemptView> {
  const payload = await apiCall<{ attempt: GithubAttemptView }>(
    'GET',
    '/github/browser/status',
    undefined,
    signal === undefined ? {} : { signal },
  );
  return payload.attempt;
}

/** 取消进行中的登录 attempt。 */
export async function cancelGithubSignIn(): Promise<GithubAttemptView> {
  const payload = await apiCall<{ attempt: GithubAttemptView }>('POST', '/github/browser/cancel', {});
  return payload.attempt;
}

/** 发版运行记录：根与 `status` 两处都可能带，取第一个存在的数组。 */
export function releaseRunsOf(state: StatePayload | null | undefined): ReleaseRunRecord[] {
  if (state === null || state === undefined) return [];
  const root = Array.isArray(state.releaseRuns) ? state.releaseRuns : undefined;
  const nested = Array.isArray(state.status?.releaseRuns) ? state.status.releaseRuns : undefined;
  return root ?? nested ?? [];
}

/** 最近一次发版运行时间：根与 `status` 两处都认。 */
export function lastReleaseAtOf(state: StatePayload | null | undefined): string | undefined {
  if (state === null || state === undefined) return undefined;
  const value = state.lastReleaseAt ?? state.status?.lastReleaseAt;
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export interface ProviderCandidate {
  id: string;
  name: string;
  baseURL: string;
  models: Array<{ id: string; name: string }>;
  credential: { ref?: string; env: string[]; configured: boolean; oauth: boolean; mode: 'direct' | 'proxy' | 'missing'; source?: string };
  coreProvider: string;
}

/** 宿主默认模型（`ctx.agentDefaultModel.currentSelection()`）。 */
export interface DefaultSelection {
  provider: string;
  model: string;
  reasoningEffort?: string;
}

export interface QuickfillResponse {
  providers: ProviderCandidate[];
  defaultSelection: DefaultSelection | null;
}

export interface PreflightResult {
  ok: boolean;
  code?: string;
  message?: string;
  hint?: string;
  durationMs: number;
  endpoint?: string;
  mode: 'direct' | 'proxy';
}

export interface Problem {
  field: string;
  code: string;
  message: string;
}

export interface RepoBranchResult {
  branch?: string;
  source: 'origin-head' | 'head' | 'none';
  message?: string;
}

export interface GithubProbeResult {
  ok: boolean;
  login?: string;
  source?: string;
  code?: string;
  message?: string;
}

export interface PreviewPayload {
  id: string;
  preview: { text: string; truncated: boolean };
}

export interface LogPayload {
  id: string;
  exists: boolean;
  text: string;
}

/** 读一次运行的预览副本；只接受 runId，路径永远由 Host 决定。 */
export function getPreview(runId: string, signal?: AbortSignal): Promise<PreviewPayload> {
  return apiCall<PreviewPayload>('GET', `/preview?id=${encodeURIComponent(runId)}`, undefined, signal === undefined ? {} : { signal });
}

/** 读一次运行的事后日志（Host 只回最后 64 KB，不是实时流）。 */
export function getLog(runId: string, signal?: AbortSignal): Promise<LogPayload> {
  return apiCall<LogPayload>('GET', `/log?id=${encodeURIComponent(runId)}`, undefined, signal === undefined ? {} : { signal });
}

export type PluginInstallKind = 'registry' | 'link' | 'file' | 'workspace' | 'unknown';
export type PluginUpdateApplication = 'applied' | 'restart-required' | 'overridden';

export interface PluginUpdateView {
  packageName: string;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  /** 磁盘已是最新、但需重启生效（Host 按磁盘版本判定后透传）。 */
  restartRequired?: boolean;
  /** 本进程加载的代码版本（诊断用）。 */
  runtimeVersion?: string;
  checkFailed: boolean;
  canApply: boolean;
  installKind: PluginInstallKind;
  installSpec?: string;
  manualCommand: string;
  applying: boolean;
  checkedAt?: string;
}

export interface PluginUpdateResult {
  application: PluginUpdateApplication;
  restartRequired?: boolean;
  updatedVersion: string;
  steps?: string[];
}

/** 检查插件自身的 npm 最新版；`fresh` 绕过 Host 侧 5 分钟缓存。 */
export async function getPluginUpdate(options: { fresh?: boolean; signal?: AbortSignal } = {}): Promise<PluginUpdateView> {
  const query = options.fresh === true ? '?fresh=1' : '';
  const payload = await apiCall<{ update: PluginUpdateView }>('GET', `/update${query}`, undefined, {
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  return payload.update;
}

/** 经宿主 pluginManager 重装本插件；失败时 Host 返回 409 + UPDATE_FAILED。 */
export async function applyPluginUpdate(): Promise<PluginUpdateResult> {
  const payload = await apiCall<{ result: PluginUpdateResult }>('POST', '/update', {});
  return payload.result;
}

const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ['baseline', 'ok', 'no_change', 'rate_limited', 'failed'];

function normalizeItem(raw: any): SubscriptionItem | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  if (typeof raw.fullName !== 'string' || raw.fullName.trim() === '') return undefined;
  const status: SubscriptionStatus = SUBSCRIPTION_STATUSES.includes(raw.status) ? raw.status : 'baseline';
  const optional = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);
  const item: SubscriptionItem = { fullName: raw.fullName.trim(), status };
  const url = optional(raw.url);
  const latestTag = optional(raw.latestTag);
  const latestSummaryAt = optional(raw.latestSummaryAt);
  const lastCheckedAt = optional(raw.lastCheckedAt);
  if (url !== undefined) item.url = url;
  if (latestTag !== undefined) item.latestTag = latestTag;
  if (latestSummaryAt !== undefined) item.latestSummaryAt = latestSummaryAt;
  if (lastCheckedAt !== undefined) item.lastCheckedAt = lastCheckedAt;
  return item;
}

/** 核心/旧版本回包归一：`repos` 与 `items` 一律是数组，`items` 缺失时为空数组。 */
export function normalizeSubscriptionList(payload: any): SubscriptionList {
  const repos = Array.isArray(payload?.repos)
    ? payload.repos.filter((item: unknown): item is string => typeof item === 'string' && item.trim() !== '').map((item: string) => item.trim())
    : [];
  const items = Array.isArray(payload?.items)
    ? payload.items.map(normalizeItem).filter((item: SubscriptionItem | undefined): item is SubscriptionItem => item !== undefined)
    : [];
  return { repos, items };
}

/** 读订阅列表（数据仓版本化的 subscriptions.yaml，经核心 subscribe list）。 */
export async function getSubscriptions(signal?: AbortSignal): Promise<SubscriptionList> {
  const payload = await apiCall<{ repos?: unknown; items?: unknown }>('GET', '/subscriptions', undefined, signal === undefined ? {} : { signal });
  return normalizeSubscriptionList(payload);
}

/** 增删订阅（经核心 subscribe add/remove，只写 .git/pending）。返回最新列表。 */
export async function postSubscriptions(action: 'add' | 'remove', repos: string[]): Promise<SubscriptionList> {
  const payload = await apiCall<{ repos?: unknown; items?: unknown }>('POST', '/subscriptions', { action, repos });
  return normalizeSubscriptionList(payload);
}

/**
 * 触发生成变更分析（发版订阅阶段）。不给 `repo` = 跑全部订阅；给了 = 只跑该仓库的单仓分析。
 * `opts.force=true` = 忽略摘要缓存、强制重新生成（用户显式点「重新生成」时用）。
 * 返回本次发版运行记录（含 scopeRepo、状态与计数），前端据此刷新列表/提示结果。
 */
export async function postReleasesRun(repo?: string, opts?: { force?: boolean }): Promise<ReleaseRunRecord> {
  const body: Record<string, unknown> = {};
  if (repo !== undefined) body.repo = repo;
  if (opts?.force === true) body.force = true;
  const payload = await apiCall<{ release?: unknown }>('POST', '/releases/run', body);
  return normalizeReleaseRun(payload.release);
}

function normalizeReleaseRun(raw: unknown): ReleaseRunRecord {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const opt = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
  const status: ReleaseRunRecord['status'] =
    r.status === 'ok' || r.status === 'failed' || r.status === 'skipped' || r.status === 'cancelled' ? r.status : 'failed';
  const record: ReleaseRunRecord = {
    id: str(r.id),
    startedAt: str(r.startedAt),
    finishedAt: str(r.finishedAt),
    status,
    checked: num(r.checked),
    changed: num(r.changed),
    newTags: num(r.newTags),
    summarized: num(r.summarized),
    degraded: num(r.degraded),
    failed: num(r.failed),
    rateLimited: num(r.rateLimited),
    durationMs: num(r.durationMs),
  };
  const maybe = {
    tokens: typeof r.tokens === 'number' ? r.tokens : undefined,
    subscribed: typeof r.subscribed === 'number' ? r.subscribed : undefined,
    commit: opt(r.commit),
    prUrl: opt(r.prUrl),
    branch: opt(r.branch),
    errorCode: opt(r.errorCode),
    errorMessage: opt(r.errorMessage),
    coreVersion: opt(r.coreVersion),
    scopeRepo: opt(r.scopeRepo),
    forced: r.forced === true ? true : undefined,
  };
  for (const [k, v] of Object.entries(maybe)) {
    if (v !== undefined) (record as unknown as Record<string, unknown>)[k] = v;
  }
  return record;
}

/**
 * 读某个仓库的发版记录（数据仓 `releases/<owner>/<repo>-0N.md` 的原文）。
 *
 * 不传 `volume` 时由核心给当前册；传了就按册取（抽屉切册时重新请求，不做跨周缓存，
 * 保证面板看到的永远是文件当前内容）。
 */
export async function getSubscriptionDoc(repo: string, volume?: number, signal?: AbortSignal): Promise<SubscriptionDoc> {
  const query = `?repo=${encodeURIComponent(repo)}${volume === undefined ? '' : `&volume=${encodeURIComponent(String(volume))}`}`;
  const payload = await apiCall<{ fullName?: unknown; volume?: unknown; volumes?: unknown; updatedAt?: unknown; markdown?: unknown }>(
    'GET',
    `/subscriptions/releases${query}`,
    undefined,
    signal === undefined ? {} : { signal },
  );
  const volumes = Array.isArray(payload.volumes)
    ? payload.volumes
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item): SubscriptionVolume => ({
          index: typeof item.index === 'number' ? item.index : 1,
          file: typeof item.file === 'string' ? item.file : '',
          ...(typeof item.from === 'string' ? { from: item.from } : {}),
          ...(typeof item.to === 'string' ? { to: item.to } : {}),
          ...(typeof item.lines === 'number' ? { lines: item.lines } : {}),
        }))
    : [];
  const doc: SubscriptionDoc = {
    fullName: typeof payload.fullName === 'string' && payload.fullName !== '' ? payload.fullName : repo,
    volume: typeof payload.volume === 'number' ? payload.volume : volume ?? 1,
    markdown: typeof payload.markdown === 'string' ? payload.markdown : '',
  };
  if (volumes.length > 0) doc.volumes = volumes;
  if (typeof payload.updatedAt === 'string' && payload.updatedAt !== '') doc.updatedAt = payload.updatedAt;
  return doc;
}
