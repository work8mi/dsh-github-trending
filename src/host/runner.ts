/**
 * 一次运行的编排：校验 → 定位 → 握手 → 取密钥/起代理 → spawn 核心 → 记状态。
 *
 * 这里是「谁在跑」的唯一入口：HTTP 路由、工具、定时器都走 `Runner.run()` /
 * `Runner.runReleases()`，因此**同一时刻最多一个运行**（两条路径共用 `active` 锁）。
 * 榜单运行写 history.json；发版运行只写 `state.releaseRuns`，两者节奏完全不同。
 */
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import type { Period, Settings } from '../config.js';
import { PERIODS, validateSettings } from '../config.js';
import { areaOf, hintOf, reasonOf, redact } from '../errors.js';
import { IpcError, type RunOutcome } from '../ipc.js';
import { handshake, type HandshakeResult } from '../core/handshake.js';
import { locateCore } from '../core/locate.js';
import { runCore } from '../core/run.js';
import {
  CONTENT_HASH_ALGO_V2,
  newRunId,
  PREVIEW_MAX_BYTES,
  type PreviewMeta,
  type ReleaseRunRecord,
  type ReleasesSummary,
  type RunRecord,
  type Store,
} from '../state.js';
import { inspectCore, type CoreStatus } from './core.js';
import { resolveOutputLanguage, type ResolvedOutputLanguage } from './host-language.js';
import type { HostLanguageReader } from './host-locale.js';
import { credentialServices, resolveGithubToken } from './credentials.js';
import { resolveModelKey } from './quickfill.js';
import { startProxy, type ProxyHandle } from './proxy.js';
import { isoWeekKey, zonedDateString } from './schedule.js';
import { runSubscribe } from './subscribe.js';

export interface RunSummary {
  id: string;
  ok: boolean;
  skipped: boolean;
  dryRun: boolean;
  date?: string;
  /** 本次产出周期（daily|weekly|monthly）。 */
  period?: Period;
  durationMs: number;
  coreVersion: string;
  files: number;
  contentHash?: string;
  branch?: string;
  commit?: string;
  prUrl?: string;
  preview?: PreviewMeta;
  /** 核心给出的跳过原因（merged / pr-closed / unchanged）。 */
  skipReason?: string;
  /** 本次是显式「强制重跑（忽略缓存）」；调度永不置位。 */
  forced?: boolean;
  error?: {
    code: string;
    message: string;
    hint: string;
    area: string;
    retriable: boolean;
    inferred?: boolean;
    /** 机器可判定的细分原因（push 失败时由核心给出）。 */
    reason?: string;
  };
  warnings: string[];
  logFile?: string;
  channel?: 'fifo' | 'tmpfile';
  proxy?: boolean;
  /** 本次任务 token 总量（榜单 + 订阅阶段，含订阅）；两者都缺省则缺省。 */
  tokens?: number;
  /** 发版订阅阶段摘要；未启用/旧核心则缺省。 */
  releases?: ReleasesSummary;
  /** 核心从哪来：env/settings 覆盖、缓存、还是本次下载。 */
  coreSource?: 'settings' | 'env' | 'cache' | 'download';
  coreTag?: string;
}

export interface RunRequestOptions {
  dryRun?: boolean;
  date?: string;
  /** 标的周期；缺省取 settings.trending.since（手动/工具运行）。 */
  period?: Period;
  /** 强制重跑：忽略摘要缓存、重新生成（核心 `run --force`）；仅手动/工具触发，调度永不设置。 */
  force?: boolean;
  trigger: 'manual' | 'schedule' | 'tool';
}

export interface RunnerDeps {
  store: Store;
  get: (name: string) => unknown;
  env?: NodeJS.ProcessEnv;
  /** 宿主语言偏好读取器（读 namespace 'locale' 的 preference）；缺省/读不到 → 回落 zh。 */
  hostLanguage?: HostLanguageReader;
  /** 运行结束（成功或失败）后回调，用于刷新调度/界面缓存。 */
  onFinished?: (summary: RunSummary) => void;
  /** 预览副本这类「可失败但不阻断运行」的事件走这里，不写进 warnings。 */
  logger?: (event: string, data?: Record<string, unknown>) => void;
}

function repoProblem(repoPath: string): { code: string; message: string } | undefined {
  if (repoPath.trim() === '') return { code: 'CONFIG_INVALID', message: '还没有选择归档仓库' };
  if (!existsSync(repoPath)) return { code: 'REPO_NOT_GIT', message: `目录不存在：${repoPath}` };
  try {
    if (!statSync(repoPath).isDirectory()) return { code: 'REPO_NOT_GIT', message: `不是目录：${repoPath}` };
  } catch {
    return { code: 'REPO_NOT_GIT', message: `无法访问：${repoPath}` };
  }
  if (!existsSync(path.join(repoPath, '.git'))) {
    return { code: 'REPO_NOT_GIT', message: `不是 git 仓库：${repoPath}（插件不会替你 git init）` };
  }
  return undefined;
}

/**
 * 运行用哪一天：默认按调度时区算「今天」，而不是宿主机本地日期。
 * 核心 `run` 的 `--date` 默认取机器本地日期；宿主机时区与调度时区不一致时
 * 会生成错误日期/分支名，所以这里显式算好再透传。
 */
function runDate(settings: Settings, now: Date = new Date()): string {
  try {
    return zonedDateString(now, settings.schedule.timezone);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * 契约计数/时长取值：缺失或非数字一律按 0（旧核心没有 checked/changed）。
 * 入参是 unknown 是因为本地契约包还是 0.3.0，`ReleasesReport` 的索引签名认不出新字段。
 */
function counterOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * 从契约 `RunOutcome` 投影出「token 总量」与「发版摘要」：
 * - `tokens` = usage.totalTokens + releases.usage.totalTokens（含订阅阶段）；
 *   两个来源都缺省则 `tokens` 缺省（历史显示 `—`）。
 * - `releases` 只在 outcome 带 `releases` 块时才有（旧核心或 enabled=false 都无）。
 */
export function projectUsage(outcome: RunOutcome): { tokens?: number; releases?: ReleasesSummary } {
  const usageTokens = outcome.usage?.totalTokens;
  const releasesTokens = outcome.releases?.usage?.totalTokens;
  let tokens: number | undefined;
  if (typeof usageTokens === 'number' || typeof releasesTokens === 'number') {
    tokens = (typeof usageTokens === 'number' ? usageTokens : 0) + (typeof releasesTokens === 'number' ? releasesTokens : 0);
  }
  const releases: ReleasesSummary | undefined =
    outcome.releases === undefined
      ? undefined
      : {
          enabled: outcome.releases.enabled,
          repos: outcome.releases.repos,
          newReleases: outcome.releases.newReleases,
          ...(outcome.releases.summarized === undefined ? {} : { summarized: outcome.releases.summarized }),
          ...(outcome.releases.degraded === undefined ? {} : { degraded: outcome.releases.degraded }),
          ...(outcome.releases.failed === undefined ? {} : { failed: outcome.releases.failed }),
          ...(outcome.releases.skipped === undefined ? {} : { skipped: outcome.releases.skipped }),
        };
  return {
    ...(tokens === undefined ? {} : { tokens }),
    ...(releases === undefined ? {} : { releases }),
  };
}

export class Runner {
  private active: { id: string; controller: AbortController; startedAt: string } | undefined;
  /** 批量运行（一次触发跑多个周期）期间为 true，挡住外部并发触发。 */
  private batching = false;
  private readonly deps: RunnerDeps;
  /** 宿主语言偏好读取器（可被 setHostLanguage 在 settings 服务就绪后替换）。 */
  private hostLanguageReader: HostLanguageReader;

  constructor(deps: RunnerDeps) {
    this.deps = deps;
    this.hostLanguageReader = deps.hostLanguage ?? (() => undefined);
  }

  /** settings 服务晚到时替换语言偏好读取器（幂等，懒注册）。 */
  setHostLanguage(reader: HostLanguageReader): void {
    this.hostLanguageReader = reader;
  }

  /**
   * 解析本次运行的输出语言：显式 settings > 宿主 locale > zh（中英外回落 zh）。
   * 每次运行都现读宿主偏好，用户改宿主语言后无需重启插件。
   */
  resolveOutputLanguage(settings: Settings): ResolvedOutputLanguage {
    let hostPref: string | undefined;
    try {
      hostPref = this.hostLanguageReader();
    } catch {
      hostPref = undefined;
    }
    return resolveOutputLanguage(settings.outputLanguage, hostPref);
  }

  get running(): { id: string; startedAt: string } | undefined {
    return this.active === undefined ? undefined : { id: this.active.id, startedAt: this.active.startedAt };
  }

  cancel(): boolean {
    if (this.active === undefined) return false;
    this.active.controller.abort();
    return true;
  }

  async run(options: RunRequestOptions, _internal = false): Promise<RunSummary> {
    const env = this.deps.env ?? process.env;
    const store = this.deps.store;
    const settings = store.readSettings();
    const credentials = credentialServices(this.deps.get);

    if (!_internal && (this.active !== undefined || this.batching)) {
      throw new IpcError('CONFIG_INVALID', `已有一次运行在进行中（${this.active?.id ?? '批量运行'}），请先等待或取消`);
    }

    const problems = validateSettings(settings);
    if (problems.length > 0) {
      const first = problems[0];
      throw new IpcError(first?.code ?? 'CONFIG_INVALID', `配置不完整：${first?.message ?? '未知问题'}`);
    }
    const repoIssue = repoProblem(settings.repo.path);
    if (repoIssue !== undefined) throw new IpcError(repoIssue.code, repoIssue.message);

    const dryRun = options.dryRun === true;
    const date = options.date !== undefined && options.date !== '' ? options.date : runDate(settings);
    const period: Period = options.period ?? settings.trending.since;

    const id = newRunId();
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    this.active = { id, controller, startedAt };
    const logFile = store.newLogPath(id);
    const startedMs = Date.now();
    let proxy: ProxyHandle | undefined;

    try {
      const core = await locateCore({ settings, env, allowDownload: settings.coreAutoDownload });
      if (core.downloaded === true) {
        store.appendLog(logFile, `[core] 已下载核心 ${core.tag ?? ''} → ${core.path}`);
      }
      const handshakeResult: HandshakeResult = await handshake(core, { signal: controller.signal });
      if (!handshakeResult.supportedProviders.includes(settings.model.provider)) {
        throw new IpcError(
          'MODEL_PROVIDER_UNSUPPORTED',
          `核心不支持 provider「${settings.model.provider}」；可用：${handshakeResult.supportedProviders.join(' / ')}`,
        );
      }

      // `--force` 随 ipc v3 一起成为无条件下限（握手已要求核心 0.9.0+），不再按版本降级。
      const effectiveForce = options.force === true;

      const model = await this.openModelChannel({ settings, credentials, env, logFile });
      const apiKey = model.apiKey;
      proxy = model.proxy;

      const github = await resolveGithubToken(credentials, settings.github.authMode, settings.github.tokenRef, { env });
      if (github.token === undefined) {
        store.appendLog(logFile, '[github] 未找到 token：push/PR 会失败并返回 GITHUB_AUTH（dryRun 不受影响）');
      }

      const result = await runCore({
        core,
        version: handshakeResult.version,
        settings,
        apiKey,
        ...(github.token === undefined ? {} : { token: github.token }),
        date,
        period,
        dryRun,
        trigger: options.trigger === 'schedule' ? 'schedule' : 'manual',
        resolvedOutputLanguage: this.resolveOutputLanguage(settings).language,
        ...(effectiveForce ? { force: true } : {}),
        ...(model.baseURLOverride === undefined ? {} : { baseURLOverride: model.baseURLOverride }),
        signal: controller.signal,
        timeoutMs: settings.run.timeoutMs,
        secrets: [apiKey, github.token],
        onStderr: (line) => store.appendLog(logFile, line),
      });
      const outcome: RunOutcome = result.outcome;
      const summary = this.summarize({
        id,
        outcome,
        dryRun,
        date,
        period,
        logFile,
        channel: result.channelKind,
        proxy: proxy !== undefined,
        coreSource: core.source,
        ...(core.tag === undefined ? {} : { coreTag: core.tag }),
        ...(effectiveForce ? { forced: true } : {}),
      });
      // 预览直接来自 RunResult.digest（ipc v3）：不再读用户仓库，合并后切 base / 删分支都不影响。
      const preview = this.capturePreview({ id, outcome, secrets: [apiKey, github.token] });
      if (preview !== undefined) summary.preview = preview;
      this.record(summary, settings);
      return summary;
    } catch (error) {
      const cancelled = controller.signal.aborted || (error instanceof IpcError && error.code === 'CORE_CANCELLED');
      const summary = this.failureSummary({
        id,
        error: cancelled && !(error instanceof IpcError && error.code === 'CORE_CANCELLED')
          ? new IpcError('CORE_CANCELLED', '运行已取消：核心进程已终止，未提交任何状态')
          : error,
        dryRun,
        date,
        period,
        logFile,
        durationMs: Date.now() - startedMs,
      });
      this.record(summary, settings);
      return summary;
    } finally {
      if (proxy !== undefined) {
        const port = proxy.port;
        await proxy.close().catch(() => undefined);
        this.deps.store.appendLog(logFile, `[proxy] 已关闭 127.0.0.1:${port}`);
      }
      this.active = undefined;
    }
  }

  /**
   * 批量运行：按顺序对多个周期各跑一次（手动/工具触发时默认产出日/周/月三榜）。
   * 每次内部独享 id / 日志 / 摘要；整个批次期间置 `batching`，挡住外部并发触发。
   * 取消只中止当前周期，批次继续跑后续周期（用户取消单次即可）。
   */
  async runMany(options: RunRequestOptions & { periods?: Period[] }): Promise<RunSummary[]> {
    if (this.active !== undefined || this.batching) {
      throw new IpcError('CONFIG_INVALID', `已有一次运行在进行中（${this.active?.id ?? '批量运行'}），请先等待或取消`);
    }
    const periods = options.periods !== undefined && options.periods.length > 0 ? options.periods : [...PERIODS];
    this.batching = true;
    const summaries: RunSummary[] = [];
    try {
      for (const period of periods) {
        summaries.push(await this.run({ ...options, period }, true));
      }
    } finally {
      this.batching = false;
      this.active = undefined;
    }
    return summaries;
  }

  /**
   * 只跑发版订阅阶段（`run --stages releases`）。
   *
   * 与榜单运行共用同一把 `active` 锁：两条路径都会写同一份产物、读同一份订阅，
   * 并发跑会互相踩分支。和 `run()` 的区别只有三点：不带 dryRun、写完只落
   * `state.releaseRuns`（不碰 history.json）、自己**不**合并订阅 pending 队列
   * （`--stages releases` 让核心跳过那一步，合并只在完整 run 里发生）。
   */
  async runReleases(options: { trigger: 'manual' | 'schedule'; repo?: string; force?: boolean }): Promise<ReleaseRunRecord> {
    const env = this.deps.env ?? process.env;
    const store = this.deps.store;
    const settings = store.readSettings();
    const credentials = credentialServices(this.deps.get);

    if (this.active !== undefined || this.batching) {
      throw new IpcError('CONFIG_INVALID', '已有一次运行在进行中');
    }
    // 与 run() 同样的前置校验：配置/仓库不可用时直接抛，不落一条「假失败」记录。
    const problems = validateSettings(settings);
    if (problems.length > 0) {
      const first = problems[0];
      throw new IpcError(first?.code ?? 'CONFIG_INVALID', `配置不完整：${first?.message ?? '未知问题'}`);
    }
    const repoIssue = repoProblem(settings.repo.path);
    if (repoIssue !== undefined) throw new IpcError(repoIssue.code, repoIssue.message);

    const id = newRunId();
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    this.active = { id, controller, startedAt };
    const logFile = store.newLogPath(id);
    let proxy: ProxyHandle | undefined;
    // 单仓意图（options.repo）在 try/catch 都要用到：catch 里记录失败也要带上 scopeRepo。
    // 实际是否传 --repo 取决于核心版本闸门（见 try 内 effectiveRepo）。
    const requestedRepo = options.repo !== undefined && options.repo !== '' ? options.repo : undefined;
    // force 只允许手动触发（显式「重新生成」）；调度路径永不 force，避免定时任务反复重调模型。
    const effectiveForce = options.trigger === 'manual' && options.force === true;

    try {
      const core = await locateCore({ settings, env, allowDownload: settings.coreAutoDownload });
      if (core.downloaded === true) {
        store.appendLog(logFile, `[core] 已下载核心 ${core.tag ?? ''} → ${core.path}`);
      }
      const handshakeResult: HandshakeResult = await handshake(core, { signal: controller.signal });
      if (!handshakeResult.supportedProviders.includes(settings.model.provider)) {
        throw new IpcError(
          'MODEL_PROVIDER_UNSUPPORTED',
          `核心不支持 provider「${settings.model.provider}」；可用：${handshakeResult.supportedProviders.join(' / ')}`,
        );
      }

      // `--repo` 同样随 ipc v3 成为无条件下限（握手已要求核心 0.9.0+）。
      const effectiveRepo = requestedRepo;

      const model = await this.openModelChannel({ settings, credentials, env, logFile });
      proxy = model.proxy;

      const github = await resolveGithubToken(credentials, settings.github.authMode, settings.github.tokenRef, { env });
      if (github.token === undefined) {
        store.appendLog(logFile, '[github] 未找到 token：拉取 Release 会失败并返回 GITHUB_AUTH');
      }

      // 订阅数只服务于把 `auto` 并发/预算解析成数字；读不到按 0（最保守的并发），
      // 绝不因为「数不清订阅」而让整次发版运行失败。
      const repoCount = await this.subscriptionCount(core.path, env);
      const result = await runCore({
        core,
        version: handshakeResult.version,
        settings,
        apiKey: model.apiKey,
        ...(github.token === undefined ? {} : { token: github.token }),
        // 按发版调度时区算「今天」：与 lastReleaseWeek 的去重口径必须是同一天历。
        date: this.releaseDate(settings),
        period: settings.trending.since,
        dryRun: false,
        trigger: options.trigger === 'schedule' ? 'schedule' : 'manual',
        stages: ['releases'],
        ...(effectiveRepo === undefined ? {} : { repo: effectiveRepo }),
        ...(effectiveForce ? { force: true } : {}),
        repoCount,
        ...(model.baseURLOverride === undefined ? {} : { baseURLOverride: model.baseURLOverride }),
        signal: controller.signal,
        timeoutMs: settings.run.timeoutMs,
        secrets: [model.apiKey, github.token],
        onStderr: (line) => store.appendLog(logFile, line),
      });
      return this.recordReleaseRun({
        id,
        outcome: result.outcome,
        settings,
        startedAt,
        logFile,
        cancelled: controller.signal.aborted,
        ...(requestedRepo === undefined ? {} : { scopeRepo: requestedRepo }),
        ...(effectiveForce ? { forced: true } : {}),
      });
    } catch (error) {
      const aborted = controller.signal.aborted || (error instanceof IpcError && error.code === 'CORE_CANCELLED');
      return this.recordReleaseFailure({ id, error, aborted, settings, startedAt, startedMs, logFile, ...(requestedRepo === undefined ? {} : { scopeRepo: requestedRepo }) });
    } finally {
      if (proxy !== undefined) {
        const port = proxy.port;
        await proxy.close().catch(() => undefined);
        this.deps.store.appendLog(logFile, `[proxy] 已关闭 127.0.0.1:${port}`);
      }
      this.active = undefined;
    }
  }

  /** 发版运行用哪一天：发版调度时区下的「今天」（不是榜单调度时区，两者可独立配置）。 */
  private releaseDate(settings: Settings, now: Date = new Date()): string {
    try {
      return zonedDateString(now, settings.releases.schedule.timezone);
    } catch {
      return now.toISOString().slice(0, 10);
    }
  }

  /** 订阅仓库数（best-effort，只影响 auto 解析）：任何失败都当 0，不阻塞发版运行。 */
  private async subscriptionCount(corePath: string, env: NodeJS.ProcessEnv): Promise<number> {
    try {
      const result = await runSubscribe({ action: 'list' }, { store: this.deps.store, env, corePath });
      return result.ok ? result.repos.length : 0;
    } catch {
      return 0;
    }
  }

  /**
   * 解析模型钥匙并（代理模式下）起回环代理。
   *
   * 榜单运行与发版运行共用这一段：代理的一次性 token 语义（空 key 会让核心静默降级成
   * 英文/离线假模型）只写一次，避免两份实现漂移。
   */
  private async openModelChannel(input: {
    settings: Settings;
    credentials: ReturnType<typeof credentialServices>;
    env: NodeJS.ProcessEnv;
    logFile: string;
  }): Promise<{ apiKey: string; baseURLOverride?: string; proxy?: ProxyHandle }> {
    const { settings, env, logFile } = input;
    const modelKey = await resolveModelKey(settings, input.credentials, env);
    if (modelKey.mode === 'direct' && (modelKey.apiKey === undefined || modelKey.apiKey === '')) {
      throw new IpcError('MODEL_KEY_MISSING', `没有解析到模型密钥（引用 ${settings.model.apiKeyRef}）`);
    }
    if (modelKey.mode !== 'proxy') return { apiKey: modelKey.apiKey ?? '' };

    const llm = this.deps.get('llm') as { stream?: unknown } | undefined;
    if (llm === undefined || typeof llm.stream !== 'function') {
      throw new IpcError('MODEL_KEY_MISSING', '该模型需要回环代理，但宿主没有可用的 ctx.llm 服务');
    }
    const proxy = await startProxy({
      llm: llm as unknown as Parameters<typeof startProxy>[0]['llm'],
      provider: settings.model.hostProvider !== '' ? settings.model.hostProvider : settings.model.provider,
      model: settings.model.model,
      temperature: settings.model.temperature,
      maxTokens: settings.model.maxTokens,
      timeoutMs: 120_000,
    });
    this.deps.store.appendLog(logFile, `[proxy] 回环代理已启动：127.0.0.1:${proxy.port}（一次性 token，运行结束即关闭）`);
    // 非空 key 是必须的：核心把空 key 当「没有凭据」，allowDegraded 时直接降级成假模型，
    // 永远不会打到代理。用代理的 token——它接受 `Authorization: Bearer <token>` 并带宿主
    // 真实凭据转发。没有这一步，摘要会静默变成英文。
    return { apiKey: proxy.token, baseURLOverride: proxy.url, proxy };
  }

  /** 把 `run --json` 的发版阶段结果投影成一条发版运行记录并落盘。 */
  private recordReleaseRun(input: {
    id: string;
    outcome: RunOutcome;
    settings: Settings;
    startedAt: string;
    logFile: string;
    cancelled: boolean;
    scopeRepo?: string;
    forced?: boolean;
  }): ReleaseRunRecord {
    const { outcome, settings } = input;
    // 契约里 skipped 的信封 ok 也是 true，所以 skipped 必须先于 ok 判断，否则永远判不出「跳过」。
    const status: ReleaseRunRecord['status'] = input.cancelled
      ? 'cancelled'
      : outcome.skipped
        ? 'skipped'
        : outcome.ok
          ? 'ok'
          : 'failed';
    const releases = outcome.releases;
    const record: ReleaseRunRecord = {
      id: input.id,
      startedAt: input.startedAt,
      finishedAt: new Date().toISOString(),
      status,
      checked: counterOf(releases?.checked),
      ...(releases === undefined ? {} : { subscribed: counterOf(releases.repos) }),
      changed: counterOf(releases?.changed),
      newTags: counterOf(releases?.newReleases),
      summarized: counterOf(releases?.summarized),
      degraded: counterOf(releases?.degraded),
      failed: counterOf(releases?.failed),
      rateLimited: counterOf(releases?.rateLimited),
      durationMs: counterOf(releases?.durationMs),
      ...(releases?.usage === undefined ? {} : { tokens: releases.usage.totalTokens }),
      ...(outcome.commit === undefined ? {} : { commit: outcome.commit }),
      ...(outcome.prUrl === undefined ? {} : { prUrl: outcome.prUrl }),
      ...(outcome.branch === undefined ? {} : { branch: outcome.branch }),
      ...(outcome.error === undefined
        ? input.cancelled
          // 取消发生在信封解析之后（例如 SIGTERM 与正常返回撞车）：记录仍要说清
          // 为什么 cancelled，否则面板只能显示一个没有原因的「已取消」。
          ? { errorCode: 'CORE_CANCELLED', errorMessage: '运行已取消：核心进程已终止，未提交任何状态' }
          : {}
        : { errorCode: outcome.error.code, errorMessage: redact(outcome.error.message) }),
      ...(outcome.coreVersion === '' ? {} : { coreVersion: outcome.coreVersion }),
      ...(input.scopeRepo === undefined ? {} : { scopeRepo: input.scopeRepo }),
      ...(input.forced === true ? { forced: true } : {}),
    };
    this.persistReleaseRun(record, settings, input.logFile, { advanceWeek: input.scopeRepo === undefined });
    return record;
  }

  /** 运行在拿到信封之前就失败（定位/握手/模型/代理/超时/取消）：也要留一条可复盘记录。 */
  private recordReleaseFailure(input: {
    id: string;
    error: unknown;
    aborted: boolean;
    settings: Settings;
    startedAt: string;
    startedMs: number;
    logFile: string;
    scopeRepo?: string;
  }): ReleaseRunRecord {
    const code = input.aborted ? 'CORE_CANCELLED' : input.error instanceof IpcError ? input.error.code : 'INTERNAL';
    const message = redact(input.error instanceof Error ? input.error.message : String(input.error));
    const record: ReleaseRunRecord = {
      id: input.id,
      startedAt: input.startedAt,
      finishedAt: new Date().toISOString(),
      status: input.aborted ? 'cancelled' : 'failed',
      checked: 0,
      changed: 0,
      newTags: 0,
      summarized: 0,
      degraded: 0,
      failed: 0,
      rateLimited: 0,
      durationMs: Date.now() - input.startedMs,
      errorCode: code,
      errorMessage: message,
      ...(input.scopeRepo === undefined ? {} : { scopeRepo: input.scopeRepo }),
    };
    // 单仓失败同样不推进 lastReleaseWeek（避免把本周标记成已跑），但仍记一条可复盘的失败。
    this.persistReleaseRun(record, input.settings, input.logFile, { advanceWeek: input.scopeRepo === undefined });
    return record;
  }

  /**
   * 落盘发版运行：只写 state（history.json 是榜单的），顺带推进 lastReleaseAt；
   * 只有 ok/skipped 才锁 `lastReleaseWeek`——失败不锁，调度下一 tick 才有机会重试。
   * `advanceWeek=false`（单仓手动触发）时：仍写 releaseRuns 与 lastReleaseAt，但**不**锁
   * lastReleaseWeek——否则会把本周标记为已检查，导致周调度跳过本周真正的检查。
   */
  private persistReleaseRun(record: ReleaseRunRecord, settings: Settings, logFile: string, opts: { advanceWeek?: boolean } = {}): void {
    const store = this.deps.store;
    const advanceWeek = opts.advanceWeek !== false;
    const succeeded = record.status === 'ok' || record.status === 'skipped';
    let week: string | undefined;
    if (succeeded && advanceWeek) {
      try {
        week = isoWeekKey(new Date(record.finishedAt), settings.releases.schedule.timezone);
      } catch {
        // 时区非法时 validateSettings 已经拦过；这里只是不让写状态这一步反过来炸掉。
        week = undefined;
      }
    }
    store.appendReleaseRun(record, {
      lastReleaseAt: record.finishedAt,
      ...(week === undefined ? {} : { lastReleaseWeek: week }),
    });
    store.appendLog(
      logFile,
      `[release] ${record.status} checked=${record.checked} changed=${record.changed} newTags=${record.newTags} ` +
        `summarized=${record.summarized} degraded=${record.degraded} failed=${record.failed} ` +
        `rateLimited=${record.rateLimited} durationMs=${record.durationMs}`,
    );
    this.deps.logger?.('release.finished', {
      id: record.id,
      status: record.status,
      checked: record.checked,
      changed: record.changed,
      coreVersion: record.coreVersion ?? null,
    });
  }

  private summarize(input: {
    id: string;
    outcome: RunOutcome;
    dryRun: boolean;
    date?: string;
    period?: Period;
    logFile: string;
    channel?: 'fifo' | 'tmpfile';
    proxy: boolean;
    coreSource?: RunSummary['coreSource'];
    coreTag?: string;
    forced?: boolean;
  }): RunSummary {
    const { outcome } = input;
    const error =
      outcome.error === undefined
        ? undefined
        : (() => {
            const message = redact(outcome.error.message);
            const reason = reasonOf(outcome.error.code, message, outcome.error.details);
            return {
              code: outcome.error.code,
              message,
              ...(reason === undefined ? {} : { reason }),
              hint: hintOf(outcome.error.code, message, reason),
              area: areaOf(outcome.error.code),
              retriable: outcome.error.retriable,
              inferred: outcome.error.details?.inferred === true,
            };
          })();
    return {
      id: input.id,
      ok: outcome.ok,
      skipped: outcome.skipped,
      dryRun: input.dryRun,
      ...(input.date === undefined ? {} : { date: input.date }),
      ...(input.period === undefined ? {} : { period: input.period }),
      durationMs: outcome.durationMs,
      coreVersion: outcome.coreVersion,
      files: outcome.files.length,
      ...(outcome.contentHash === undefined ? {} : { contentHash: outcome.contentHash }),
      ...(outcome.branch === undefined ? {} : { branch: outcome.branch }),
      ...(outcome.commit === undefined ? {} : { commit: outcome.commit }),
      ...(outcome.prUrl === undefined ? {} : { prUrl: outcome.prUrl }),
      ...(outcome.skipReason === undefined ? {} : { skipReason: outcome.skipReason }),
      ...(error === undefined ? {} : { error }),
      ...projectUsage(outcome),
      warnings: outcome.warnings,
      logFile: input.logFile,
      ...(input.channel === undefined ? {} : { channel: input.channel }),
      proxy: input.proxy,
      ...(input.coreSource === undefined ? {} : { coreSource: input.coreSource }),
      ...(input.coreTag === undefined ? {} : { coreTag: input.coreTag }),
      ...(input.forced === true ? { forced: true } : {}),
    };
  }

  private failureSummary(input: { id: string; error: unknown; dryRun: boolean; date?: string; period?: Period; logFile: string; durationMs?: number }): RunSummary {
    const code = input.error instanceof IpcError ? input.error.code : 'INTERNAL';
    const message = redact(input.error instanceof Error ? input.error.message : String(input.error));
    return {
      id: input.id,
      ok: false,
      skipped: false,
      dryRun: input.dryRun,
      ...(input.date === undefined ? {} : { date: input.date }),
      ...(input.period === undefined ? {} : { period: input.period }),
      durationMs: input.durationMs ?? 0,
      coreVersion: '',
      files: 0,
      error: { code, message, hint: hintOf(code, message), area: areaOf(code), retriable: false },
      warnings: [],
      logFile: input.logFile,
    };
  }

  /**
   * 把本次运行渲染的 digest 原文写进 previews/（ipc v3 起由核心随 RunResult 回传）。
   *
   * 这里**不再读用户仓库**：分支可能在运行结束前就被合并、切回 base 并删除，
   * 任何「事后去工作树里找文件」的做法都会读到旧版或空。文本、字节数与 sha256
   * 的跨字段一致性已在 `parseRunResult` 里校验过；这里只做展示侧的防御：
   * - 上限 512 KB（与预览读取上限一致）、拒绝 NUL；
   * - 落盘前统一 `redact()`，避免把密钥写进预览文件；
   * - 任何一步失败都只记日志，返回 undefined；运行结果不受影响。
   */
  private capturePreview(input: {
    id: string;
    outcome: RunOutcome;
    secrets: Array<string | undefined>;
  }): PreviewMeta | undefined {
    const { outcome, id } = input;
    if (!outcome.ok || outcome.dryRun) return undefined;
    const skip = (reason: string, extra: Record<string, unknown> = {}): undefined => {
      this.deps.logger?.('preview.skip', { id, reason, ...extra });
      return undefined;
    };
    const digest = outcome.digest;
    if (digest === undefined) return skip('no-digest');

    const buffer = Buffer.from(digest.text, 'utf8');
    if (buffer.length > PREVIEW_MAX_BYTES) return skip('too-large', { path: digest.path, bytes: buffer.length });
    if (buffer.includes(0)) return skip('contains-nul', { path: digest.path });

    const text = redact(digest.text, input.secrets);
    const stored = Buffer.from(text, 'utf8');
    try {
      this.deps.store.writePreview(id, text);
    } catch {
      return skip('write-failed', { path: digest.path });
    }
    return {
      file: digest.path,
      bytes: stored.length,
      sha256: createHash('sha256').update(stored).digest('hex'),
    };
  }

  /** 写历史与状态；同一天的 skipped 运行不覆盖 lastDigest。 */
  private record(summary: RunSummary, settings: Settings): void {
    const store = this.deps.store;
    const record: RunRecord = {
      id: summary.id,
      at: new Date().toISOString(),
      kind: summary.dryRun ? 'dry-run' : 'run',
      ok: summary.ok,
      skipped: summary.skipped,
      ...(summary.error === undefined
        ? {}
        : {
            errorCode: summary.error.code,
            errorMessage: summary.error.message,
            ...(summary.error.reason === undefined ? {} : { errorReason: summary.error.reason }),
          }),
      ...(summary.skipReason === undefined ? {} : { skipReason: summary.skipReason }),
      ...(summary.forced === true ? { forced: true } : {}),
      durationMs: summary.durationMs,
      files: summary.files,
      ...(summary.date === undefined ? {} : { date: summary.date }),
      ...(summary.period === undefined ? {} : { period: summary.period }),
      ...(summary.contentHash === undefined ? {} : { contentHash: summary.contentHash }),
      ...(summary.branch === undefined ? {} : { branch: summary.branch }),
      ...(summary.commit === undefined ? {} : { commit: summary.commit }),
      ...(summary.prUrl === undefined ? {} : { prUrl: summary.prUrl }),
      ...(summary.preview === undefined ? {} : { preview: summary.preview }),
      ...(summary.tokens === undefined ? {} : { tokens: summary.tokens }),
      ...(summary.releases === undefined ? {} : { releases: summary.releases }),
      coreVersion: summary.coreVersion,
      model: { provider: settings.model.provider, model: settings.model.model },
      languages: settings.trending.languages,
      warnings: summary.warnings,
      logFile: summary.logFile,
    };
    const state = store.readState();
    const periodSuccess = { ...(state.periodSuccess ?? {}) };
    if (summary.ok && summary.period !== undefined) periodSuccess[summary.period] = record.at;
    const next: Parameters<Store['recordRun']>[1] = {
      lastRunAt: record.at,
      ...(summary.ok ? { lastSuccessAt: record.at } : {}),
      ...(summary.ok && summary.period !== undefined ? { periodSuccess } : {}),
      ...(summary.ok && summary.prUrl !== undefined
        ? { pendingPr: { url: summary.prUrl, createdAt: record.at, ...(summary.date === undefined ? {} : { date: summary.date }) } }
        : {}),
      // 幂等：内容未变（skipped）通常不刷新 lastDigest；但显式 force 时即便 core 判定
      // unchanged，也要把本次作为最新展示（contentHash 仍是真实 hash，不伪造）。
      ...(summary.ok && summary.contentHash !== undefined && (!summary.skipped || summary.forced === true)
        ? {
            lastDigest: {
              date: summary.date ?? new Date().toISOString().slice(0, 10),
              contentHash: summary.contentHash,
              contentHashAlgo: CONTENT_HASH_ALGO_V2,
              coreVersion: summary.coreVersion,
            },
            ...(state.pendingPr !== undefined && summary.prUrl === undefined ? { pendingPr: state.pendingPr } : {}),
          }
        : {}),
    };
    store.recordRun(record, next);
    this.deps.onFinished?.(summary);
  }

  /** 给设置页/工具用的「核心现在什么状态」。 */
  async coreStatus(fresh = false): Promise<CoreStatus> {
    const settings = this.deps.store.readSettings();
    return inspectCore(settings, { env: this.deps.env ?? process.env, fresh });
  }
}
