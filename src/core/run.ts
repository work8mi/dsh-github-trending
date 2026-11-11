/**
 * 一次核心运行（FR-P-08 / AC-P-05 / AC-P-09）。
 *
 * 时序：建配置通道 → spawn `run --config <通道> --json` → 写入配置 → 收集 stdout/stderr
 * → 等退出 → 归一化结果。任何一步失败都不产生「半个成功」：
 * 只有拿到可解析的结果信封才返回 `ok: true`，否则返回带错误码的结果或抛 `IpcError`。
 */
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

import { toCoreConfig, toYaml, type Period, type Settings } from '../config.js';
import { classifyStderr, redact } from '../errors.js';
import {
  IpcError,
  parseRunResult,
  type RunError,
  type RunOutcome,
  type VersionInfo,
} from '../ipc.js';
import type { CoreLocation } from './locate.js';
import { openConfigChannel, removeChannelDir, type ChannelKind } from './channel.js';
import { sanitizedEnv } from '@morehao/dsh-plugin-kit/exec';

export const DEFAULT_RUN_TIMEOUT_MS = 120_000;
const MAX_STDOUT = 16 * 1024 * 1024;
const MAX_STDERR = 2 * 1024 * 1024;
/** 取消/超时后给核心多少时间体面退出，再 SIGKILL。 */
const KILL_GRACE_MS = 3000;

export interface RunCoreOptions {
  core: CoreLocation;
  version: VersionInfo;
  settings: Settings;
  /** 模型密钥；只进配置通道，不进 argv/env/日志。 */
  apiKey: string;
  /** GitHub token；核心只从 env 读（GITHUB_TOKEN/GH_TOKEN）。 */
  token?: string;
  date?: string;
  /** 本次运行的标的周期（daily|weekly|monthly）；核心 `--period` 覆盖抓取 since。 */
  period: Period;
  dryRun: boolean;
  /** 谁触发的运行：核心用它在定时运行时尊重「人工关闭的 PR」。 */
  trigger?: 'manual' | 'schedule';
  /** 忽略摘要缓存、强制重新生成（核心 `run --force`）；不影响 append-only 提交判断。 */
  force?: boolean;
  /** 回环代理地址：覆盖配置里的 model.baseURL（代理模式专用）。 */
  baseURLOverride?: string;
  /**
   * 只跑指定阶段（核心 `run --stages`）。缺省 = 跑所有已启用阶段；
   * `['releases']` 就是「只跑发版订阅」——不抓榜单、不渲染 digest、也不合并订阅 pending。
   */
  stages?: string[];
  /** 单仓发版分析（核心 `run --stages releases --repo owner/repo`）：只处理该仓库；须与 stages=['releases'] 搭配。 */
  repo?: string;
  /** 订阅仓库数：用于把配置里的 `auto` 并发/预算解析成数字（发版运行传入）。 */
  repoCount?: number;
  /** 解析后的摘要输出语言（显式 > 宿主 > zh，见 host-language.ts）；写进核心 `language.outputLanguage`。 */
  resolvedOutputLanguage?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onStderr?: (line: string) => void;
  /** 已知明文，用于日志脱敏。 */
  secrets?: Array<string | undefined>;
}

export interface RunCoreResult {
  outcome: RunOutcome;
  channelKind: ChannelKind;
  stderr: string;
  exitCode: number | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** stderr → 结构化错误；`inferred` 表示码是插件按文本推出来的。 */
function errorFrom(stderr: string, exitCode: number | null): RunError {
  const classified = classifyStderr(stderr);
  return {
    code: classified.code,
    message: classified.message,
    retriable: classified.retriable,
    details: { inferred: classified.inferred, exitCode },
  };
}

export function buildCoreArgs(
  channelPath: string,
  options: { dryRun: boolean; date?: string; period?: Period; stages?: string[]; force?: boolean; repo?: string },
): string[] {
  const args = ['run', '--config', channelPath, '--json'];
  if (options.dryRun) args.push('--dry-run');
  if (options.date !== undefined && options.date !== '') args.push('--date', options.date);
  if (options.period !== undefined) args.push('--period', options.period);
  // 核心的 --stages 是逗号分隔；缺省时完全不传，旧核心不会因未知参数失败。
  if (options.stages !== undefined && options.stages.length > 0) args.push('--stages', options.stages.join(','));
  // --force 只在显式请求时传；插件侧已按核心版本闸门（runner）判定过是否支持。
  if (options.force === true) args.push('--force');
  // --repo 只在单仓发版分析时传；须与 --stages releases 搭配（runner 已按版本闸门判定核心支持）。
  if (options.repo !== undefined && options.repo !== '') args.push('--repo', options.repo);
  return args;
}

/**
 * 把设置里的代理地址展开成核心子进程需要的环境变量。返回空对象表示不注入代理。
 * 同时给大小写两份：Go 的 `http.ProxyFromEnvironment` 等实现只认大写，不少工具
 * 只认小写，两份都放最稳。
 */
export function proxyEnv(proxy: string | undefined): Record<string, string> {
  const p = (proxy ?? '').trim();
  if (p === '') return {};
  return {
    HTTP_PROXY: p,
    HTTPS_PROXY: p,
    ALL_PROXY: p,
    http_proxy: p,
    https_proxy: p,
    all_proxy: p,
  };
}

export async function runCore(options: RunCoreOptions): Promise<RunCoreResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
  const startedAt = nowIso();
  const started = Date.now();
  // 单调时钟：不受系统睡眠/改表影响，用来判断「超时到底是真跑满了，还是进程被挂起」。
  const startedMono = performance.now();
  const channel = await openConfigChannel();
  const yaml = `${toYaml(toCoreConfig(options.settings, options.apiKey, options.baseURLOverride, options.period, options.repoCount, options.resolvedOutputLanguage))}\n`;
  const secrets = [options.apiKey, options.token, ...(options.secrets ?? [])];

  const args = buildCoreArgs(channel.path, {
    dryRun: options.dryRun,
    date: options.date,
    period: options.period,
    stages: options.stages,
    force: options.force,
    ...(options.repo === undefined ? {} : { repo: options.repo }),
  });

  const child = spawn(options.core.path, args, {
    env: sanitizedEnv(process.env, {
      GITHUB_TOKEN: options.token,
      GH_TOKEN: options.token,
      // 环境变量通道：旧核心会忽略它，不会因为多一个未知参数而失败。
      TRENDRADAR_TRIGGER: options.trigger ?? 'manual',
      // 出站代理：GUI 宿主往往不继承 shell 的 http(s)_proxy，国内直连 GitHub 会
      // 超时。设置里填了就显式注入（大小写两份，Go 的 ProxyFromEnvironment 与多数
      // 工具都能识别）。空/未设时不注入任何键，保持原有环境透传行为。
      ...proxyEnv(options.settings.network?.proxy),
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stdout = '';
  let stdoutBytes = 0;
  let stderr = '';
  let timedOut = false;
  let aborted = false;
  let channelError: Error | undefined;
  /** 超时触发那一刻的两种时长（毫秒）：墙钟 Date.now 与单调 performance.now 的差额。 */
  let timeoutWallMs = 0;
  let timeoutMonoMs = 0;

  // 配置写入在 spawn 之后：FIFO 的写端必须等读端打开。
  const publish = channel.publish(yaml).catch((error: unknown) => {
    channelError = error instanceof Error ? error : new Error(String(error));
  });

  const escalate = (): NodeJS.Timeout =>
    setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // 已退出
      }
    }, KILL_GRACE_MS);
  let escalations: NodeJS.Timeout[] = [];

  const timer = setTimeout(() => {
    timedOut = true;
    timeoutWallMs = Date.now() - started;
    timeoutMonoMs = performance.now() - startedMono;
    try {
      child.kill('SIGTERM');
    } catch {
      // 已退出
    }
    escalations.push(escalate());
  }, timeoutMs);

  const onAbort = (): void => {
    aborted = true;
    try {
      child.kill('SIGTERM');
    } catch {
      // 已退出
    }
    escalations.push(escalate());
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    stdoutBytes += Buffer.byteLength(chunk);
    if (stdoutBytes <= MAX_STDOUT) stdout += chunk;
  });

  let stderrBuffer = '';
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => {
    if (stderr.length < MAX_STDERR) stderr += chunk;
    stderrBuffer += chunk;
    let index = stderrBuffer.indexOf('\n');
    while (index >= 0) {
      const line = redact(stderrBuffer.slice(0, index), secrets);
      stderrBuffer = stderrBuffer.slice(index + 1);
      if (line.trim() !== '') options.onStderr?.(line);
      index = stderrBuffer.indexOf('\n');
    }
  });

  const closed = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal }));
  }).catch((error: unknown) => {
    throw new IpcError('CORE_SPAWN_FAILED', `无法启动核心 ${options.core.path}：${error instanceof Error ? error.message : String(error)}`);
  });

  clearTimeout(timer);
  for (const handle of escalations) clearTimeout(handle);
  escalations = [];
  options.signal?.removeEventListener('abort', onAbort);
  if (stderrBuffer.trim() !== '') options.onStderr?.(redact(stderrBuffer, secrets));
  await publish;
  await channel.dispose();
  await removeChannelDir(channel);

  const finishedAt = nowIso();
  const durationMs = Date.now() - started;
  const tail = stderr.trim().split('\n').slice(-20).join('\n');

  if (aborted) {
    throw new IpcError('CORE_CANCELLED', '运行已取消：核心进程已终止，未提交任何状态');
  }
  if (timedOut) {
    // 墙钟明显长于单调时钟 → 进程被系统挂起（睡眠/待机）过，而不是核心真的跑满这么久。
    // 给用户一个能对上的解释，避免每次都像同一个「超时」。
    const driftMs = timeoutWallMs - timeoutMonoMs;
    const wallS = Math.round(timeoutWallMs / 1000);
    const monoTag = `${Math.round(timeoutMonoMs / 1000)} s`;
    const suspended = driftMs > Math.max(30_000, timeoutMonoMs);
    const detail = suspended
      ? `；实际墙钟耗时 ${wallS} s，但进程活跃仅 ${monoTag}——差额主要来自系统挂起/睡眠，并非核心真的跑超时`
      : '';
    throw new IpcError(
      'CORE_TIMEOUT',
      `核心运行超时（${Math.round(timeoutMs / 1000)} s）已终止${detail}${tail === '' ? '' : `；最后输出：${tail}`}`,
    );
  }
  if (channelError !== undefined) {
    throw new IpcError('CORE_CONFIG_CHANNEL_FAILED', `配置通道写入失败：${channelError.message}`);
  }
  if (stdoutBytes > MAX_STDOUT) {
    throw new IpcError('PAYLOAD_TOO_LARGE', `核心输出超过 ${MAX_STDOUT} 字节上限`);
  }

  const timing = { coreVersion: options.version.version, startedAt, finishedAt, durationMs, dryRun: options.dryRun };

  if (stdout.trim() === '') {
    if (closed.code === 0) {
      throw new IpcError('IPC_INVALID', '核心正常退出但没有输出结果信封');
    }
    return {
      outcome: { ok: false, skipped: false, files: [], warnings: [], error: errorFrom(stderr, closed.code), ...timing },
      channelKind: channel.kind,
      stderr,
      exitCode: closed.code,
    };
  }

  let outcome: RunOutcome;
  try {
    outcome = parseRunResult(stdout, timing);
  } catch (error) {
    if (closed.code !== 0) {
      return {
        outcome: { ok: false, skipped: false, files: [], warnings: [], error: errorFrom(stderr, closed.code), ...timing },
        channelKind: channel.kind,
        stderr,
        exitCode: closed.code,
      };
    }
    throw error;
  }

  if (closed.code !== 0) {
    return {
      outcome: { ...outcome, ok: false, error: errorFrom(stderr, closed.code) },
      channelKind: channel.kind,
      stderr,
      exitCode: closed.code,
    };
  }

  return { outcome, channelKind: channel.kind, stderr, exitCode: closed.code };
}
