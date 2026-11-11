/**
 * 设置页：核心 / 模型 / 仓库 / 认证 / 榜单 / 调度。
 *
 * 版式是「左侧纵向 tab + 右侧可滚动分区」，避免整页一长条、宿主裁掉且不出滚动条。
 * 编辑在本地 `draft` 里进行，只有点「保存设置」才 POST /config —— 与规格
 * 「禁止静默复制」「保存前预检」一致；快速填充也要用户再点一次确认。
 *
 * 只暴露普通用户需要的字段：「核心」是状态与核心操作（重新检查 / 下载），
 * 没有可编辑项，因此不出现「保存」按钮；`TRENDING_DIGEST_CORE` 不提供界面入口
 * （需要时用环境变量或直接改 settings.json），手动 `凭据引用` 也不露出（由快速
 * 填充自动带入）。避免把开发/排障概念摊在首屏，也避免出现「点了没反应」的开关。
 */
import { Alert, Btn, Card, Chips, Input, KV, Pill, Row, Select, Toggle, copyText, duration, h, localTime, React } from './ui.js';
import type { Translate } from './i18n.js';
import {
  apiCall,
  beginGithubSignIn,
  cancelGithubSignIn,
  getGithubSignInStatus,
  type DefaultSelection,
  type GithubAttemptView,
  type GithubProbeResult,
  type Period,
  type PreflightResult,
  type QuickfillResponse,
  type RepoBranchResult,
  type SettingsShape,
} from './api.js';
import type { StoreValue } from './store.js';
import { credentialView } from './credential.js';

const LANGUAGES = ['all', 'typescript', 'python', 'go', 'rust', 'java', 'c', 'cpp', 'javascript', 'csharp'];

export type SectionId = 'source' | 'model' | 'repo' | 'auth' | 'scope' | 'releases';
/** 概览的「查看 / 去补」按分区深链到设置页，与设置页分区是同一套标识。 */
export type SettingsSection = SectionId;

/** 分区顺序，与左侧 tab 一致；用于「是否还有未保存改动」的判定。 */
const SECTIONS: SectionId[] = ['source', 'model', 'repo', 'auth', 'scope', 'releases'];

const EMPTY_DIRTY: Record<SectionId, boolean> = { source: false, model: false, repo: false, auth: false, scope: false, releases: false };

function cloneSettings(settings: SettingsShape): SettingsShape {
  return JSON.parse(JSON.stringify(settings)) as SettingsShape;
}

/** 一个分区实际包含的设置字段（repo 分区同时承载输出目录与 PR 自动合并开关）。 */
function sectionSlice(settings: SettingsShape, section: SectionId): Record<string, unknown> {
  switch (section) {
    case 'source':
      return { corePath: settings.corePath, network: settings.network, run: settings.run };
    case 'model':
      return { model: settings.model };
    case 'repo':
      return { repo: settings.repo, pr: settings.pr, output: settings.output };
    case 'auth':
      return { github: settings.github };
    case 'scope':
      return {
        trending: settings.trending,
        schedule: settings.schedule,
        summarize: settings.summarize,
        observe: settings.observe,
        outputLanguage: settings.outputLanguage,
      };
    case 'releases':
      return { releases: settings.releases };
  }
}

/** 操作回执：成功只是「刚才那步成功了」，到时自动收起；失败要留到用户下一次操作。 */
type Notice = { kind: 'ok' | 'err'; text: string };

const NOTICE_TTL_MS = 5000;

/** 目录选择后端探测结果：客户端拿不到 capability().kind，只能靠一次 pick 失败判定。 */
export type PickerKind = 'unknown' | 'native' | 'browse';

/** 宿主在 browse 组合下拒绝 pick 的错误码（见 dsh-api-workspace-controller requireCapability）。 */
const DIRECTORY_PICKER_UNAVAILABLE = 'directory-picker/unavailable';
/**
 * 判定「当前宿主无系统目录选择」的文本片段。注意：宿主 `RemoteError` 的 code 在
 * ui-workspace 的 `pickDirectory()` 里被丢掉了——它只 `throw new Error('directory picker
 * failed: ' + result.error.message)`，客户端拿到的是**纯 message**。所以必须认这段
 * capability 文本，而不能只认错误码（错误码只在未来宿主透传时作为兜底）。
 */
const UNAVAILABLE_MARKERS = ['needs the native capability', 'the composed picker serves "browse"'];

/** 从 pick 失败里认出「当前宿主无系统目录选择」——先认错误码（若有），再认 message 文本。 */
export function isPickerUnavailable(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return typeof error === 'string' && matchesUnavailableText(error);
  }
  const e = error as { code?: unknown; message?: unknown; rpcError?: { code?: unknown; message?: unknown } };
  const code = e.code ?? e.rpcError?.code;
  if (code === DIRECTORY_PICKER_UNAVAILABLE) return true;
  const message = typeof e.message === 'string' ? e.message : typeof e.rpcError?.message === 'string' ? e.rpcError.message : '';
  return matchesUnavailableText(message);
}

function matchesUnavailableText(text: string): boolean {
  if (text.includes(DIRECTORY_PICKER_UNAVAILABLE)) return true;
  return UNAVAILABLE_MARKERS.some((marker) => text.includes(marker));
}

/** 把 pick 失败归一到用户可读文案：无系统目录选择 → 专门提示；其余回退原始 message。 */
export function pickErrorText(error: unknown, t: Translate): string {
  if (isPickerUnavailable(error)) return t('repo.pick.unavailable');
  if (error instanceof Error) return error.message;
  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message !== '' ? message : String(error);
}

function sectionEquals(a: SettingsShape, b: SettingsShape, section: SectionId): boolean {
  return JSON.stringify(sectionSlice(a, section)) === JSON.stringify(sectionSlice(b, section));
}

/** 只把 `section` 的字段从 `source` 覆盖到 `target`，保留其它分区里尚未保存的编辑。 */
function applySection(target: SettingsShape, source: SettingsShape, section: SectionId): SettingsShape {
  const next = cloneSettings(target);
  Object.assign(next, sectionSlice(source, section));
  return next;
}

export function SettingsView(props: { t: Translate; store: StoreValue; onClose?: () => void; pickDirectory?: () => Promise<string | undefined>; initialSection?: SectionId; onOpenSubscriptions?: () => void }): any {
  const { t, store } = props;
  const state = store.state;
  // 摘要输出语言解析结果（Host /state.language）；缺失时设置页用 settings.outputLanguage 兜底。
  const language = state?.language;
  const [draft, setDraft] = React.useState<SettingsShape | null>(null);
  const [dirtySections, setDirtySections] = React.useState<Record<SectionId, boolean>>({ ...EMPTY_DIRTY });
  const [savingSection, setSavingSection] = React.useState<SectionId | null>(null);
  const [savedSection, setSavedSection] = React.useState<SectionId | null>(null);
  const [problems, setProblems] = React.useState<Array<{ field: string; message: string }>>([]);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [preflight, setPreflight] = React.useState<PreflightResult | null>(null);
  const [preflighting, setPreflighting] = React.useState(false);
  const [rechecking, setRechecking] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [section, setSection] = React.useState<SectionId>(props.initialSection ?? 'source');
  const [branchInfo, setBranchInfo] = React.useState<RepoBranchResult | null>(null);
  const [branchLoading, setBranchLoading] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [githubTest, setGithubTest] = React.useState<GithubProbeResult | null>(null);
  const [signIn, setSignIn] = React.useState<GithubAttemptView>({ phase: 'idle' });
  const [signInModal, setSignInModal] = React.useState(false);
  // 目录选择后端探测结果。客户端拿不到 capability().kind（只有 pick/list/createDirectory
  // 三个 verb），只能靠一次 pick 失败来判定：'unknown' 未探测 / 'native' 可用 / 'browse' 不可用。
  const [pickerKind, setPickerKind] = React.useState<PickerKind>('unknown');

  const anyDirty = SECTIONS.some((id) => dirtySections[id]);
  // 「核心」分区有唯一可保存字段：出站网络代理（network.proxy）。核心状态与下载
  // 仍是即时操作，不受「保存」按钮影响。
  const sectionEditable = true;

  React.useEffect(() => {
    if (state !== null && !anyDirty) setDraft(state.settings);
  }, [state, anyDirty]);

  // 切到别的分区时清掉上一分区残留的校验错误。
  React.useEffect(() => {
    setProblems([]);
  }, [section]);

  // 成功回执到点自动收起；换了一条提示就重新计时，旧计时器因对象不同不会误清新提示。
  React.useEffect(() => {
    if (notice === null || notice.kind !== 'ok') return undefined;
    const timer = setTimeout(() => {
      setNotice((current) => (current === notice ? null : current));
    }, NOTICE_TTL_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // 「已保存」按钮态到点回落到「保存」，避免保存成功后永远停在已保存态；再次编辑该分区
  // 时也会立即复位（见 dirtySections 的清理），两者不冲突。
  React.useEffect(() => {
    if (savedSection === null) return undefined;
    const timer = setTimeout(() => {
      setSavedSection((current) => (current === savedSection ? null : current));
    }, NOTICE_TTL_MS);
    return () => clearTimeout(timer);
  }, [savedSection]);

  const notify = (kind: Notice['kind'], text: string): void => setNotice({ kind, text });

  const repoPath = draft === null ? '' : draft.repo.path;

  // 读仓库默认分支（只读展示）：路径变化时重新读取，不写任何状态。
  React.useEffect(() => {
    if (repoPath.trim() === '') {
      setBranchInfo(null);
      return () => undefined;
    }
    let cancelled = false;
    setBranchLoading(true);
    apiCall<{ repo: RepoBranchResult }>('GET', `/repo/branch?path=${encodeURIComponent(repoPath)}`)
      .then((result) => {
        if (!cancelled) setBranchInfo(result.repo);
      })
      .catch((error) => {
        if (!cancelled) setBranchInfo({ source: 'none', message: error instanceof Error ? error.message : String(error) });
      })
      .finally(() => {
        if (!cancelled) setBranchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath]);

  const update = (mutate: (next: SettingsShape) => void): void => {
    if (draft === null) return;
    const prev = draft;
    const next = cloneSettings(draft);
    mutate(next);
    setDraft(next);
    const changed = SECTIONS.filter((id) => !sectionEquals(prev, next, id));
    if (changed.length > 0) {
      setDirtySections((current) => {
        const merged = { ...current };
        for (const id of changed) merged[id] = true;
        return merged;
      });
      setSavedSection((current) => (current !== null && changed.includes(current) ? null : current));
      setProblems([]);
    }
  };

  const save = async (section: SectionId): Promise<void> => {
    if (draft === null) return;
    setSavingSection(section);
    setProblems([]);
    try {
      const result = await apiCall<{ saved: boolean; settings: SettingsShape; problems: Array<{ field: string; message: string }> }>(
        'POST',
        '/config',
        { settings: draft, section },
      );
      if (result.saved) {
        // 只回填本分区的规范化结果，保留其它分区里尚未保存的编辑。
        setDraft((current) => (current === null ? current : applySection(current, result.settings, section)));
        setDirtySections((current) => ({ ...current, [section]: false }));
        setSavedSection(section);
        setNotice(null);
        await store.refresh({ quiet: true });
      } else {
        setProblems(result.problems ?? []);
      }
    } catch (error) {
      notify('err', error instanceof Error ? error.message : String(error));
    } finally {
      setSavingSection(null);
    }
  };

  const runPreflight = async (): Promise<void> => {
    if (draft === null) return;
    setPreflighting(true);
    setPreflight(null);
    try {
      const result = await apiCall<{ preflight: PreflightResult }>('POST', '/preflight', { settings: draft });
      setPreflight(result.preflight);
    } catch (error) {
      setPreflight({ ok: false, message: error instanceof Error ? error.message : String(error), durationMs: 0, mode: draft.model.mode });
    } finally {
      setPreflighting(false);
    }
  };

  const recheck = async (): Promise<void> => {
    setRechecking(true);
    try {
      await apiCall('GET', '/core?fresh=1');
      await store.refresh({ quiet: true });
    } catch {
      // 失败信息由 /state 的 core.message 展示
    } finally {
      setRechecking(false);
    }
  };

  const downloadCore = async (): Promise<void> => {
    setDownloading(true);
    setProblems([]);
    setNotice(null);
    try {
      await apiCall('POST', '/core/download', {});
      notify('ok', t('core.downloaded'));
      await store.refresh({ quiet: true });
    } catch (error) {
      notify('err', error instanceof Error ? error.message : String(error));
    } finally {
      setDownloading(false);
    }
  };

  const testGithub = async (): Promise<void> => {
    if (draft === null) return;
    setTesting(true);
    setGithubTest(null);
    try {
      const result = await apiCall<{ github: GithubProbeResult }>('POST', '/github/test', { settings: draft });
      setGithubTest(result.github);
    } catch (error) {
      setGithubTest({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  };

  const openVerifyPage = (url: string | undefined): void => {
    if (url === undefined) return;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      /* 被拦截不是错误：弹窗里仍可点「打开验证页」兜底 */
    }
  };

  const startSignIn = async (): Promise<void> => {
    setSignInModal(true);
    setSignIn({ phase: 'idle' });
    try {
      let view = await beginGithubSignIn();
      // 兜底：Host 理论上不再返回 idle（已修），但真拿到 idle 时要再问一次状态，
      // 否则界面会停在「什么都没发生」。
      if (view.phase === 'idle') view = await getGithubSignInStatus();
      setSignIn(view);
      // 拿到验证码即自动打开 GitHub 验证页；验证码仍需手输，弹窗里提供一键复制。
      if (view.phase === 'waiting-device') openVerifyPage(view.verificationUri);
    } catch (error) {
      setSignIn({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  };

  // attempt 进行中时重开弹窗（不重复 begin）。
  const openSignInModal = (): void => setSignInModal(true);

  // 关闭弹窗：只关窗，不取消后台 attempt（下次可再看）。
  const closeSignInModal = (): void => setSignInModal(false);

  const cancelSignIn = async (): Promise<void> => {
    try {
      setSignIn(await cancelGithubSignIn());
    } catch (error) {
      notify('err', error instanceof Error ? error.message : String(error));
    } finally {
      setSignInModal(false);
    }
  };

  // 验证码必须手输，提供一键复制码，减少抄错导致的「找不到」。
  const copyDeviceCode = (): void => {
    if (signIn.userCode === undefined) return;
    void copyText(signIn.userCode).then((ok) =>
      notify(ok ? 'ok' : 'err', ok ? t('auth.browser.codeCopied') : t('auth.browser.codeCopyFailed')),
    );
  };

  // 登录进行中时轮询状态；终态（done/error/idle）后停止。
  const signInActive = signIn.phase === 'waiting-device' || signIn.phase === 'exchanging';
  React.useEffect(() => {
    if (!signInActive) return undefined;
    let alive = true;
    const timer = setInterval(() => {
      void getGithubSignInStatus()
        .then((view) => {
          if (!alive) return;
          setSignIn(view);
          if (view.phase === 'done') {
            setGithubTest(view.login === undefined ? { ok: true } : { ok: true, login: view.login });
            notify('ok', t('auth.browser.done'));
            void store.refresh({ quiet: true });
          }
        })
        .catch(() => {
          /* 轮询失败保持当前状态，下次再试 */
        });
    }, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [signInActive]);

  const importCli = async (): Promise<void> => {
    try {
      const result = await apiCall<{ import: { ok: boolean; imported: string[]; skippedSecrets: string[]; problems: string[]; settings?: SettingsShape } }>(
        'POST',
        '/import',
        {},
      );
      const payload = result.import;
      if (payload.ok && payload.settings !== undefined) {
        setDraft(payload.settings);
        setDirtySections({ ...EMPTY_DIRTY });
        setSavedSection(null);
        notify('ok', t('settings.import.done', { fields: payload.imported.join('、') }));
        await store.refresh({ quiet: true });
      } else {
        notify('err', payload.problems[0] ?? t('settings.import.empty'));
      }
    } catch (error) {
      notify('err', error instanceof Error ? error.message : String(error));
    }
  };

  const copyConfig = (): void => {
    if (draft === null) return;
    const redacted = JSON.stringify(
      { ...draft, model: { ...draft.model, apiKeyRef: draft.model.apiKeyRef }, github: { ...draft.github } },
      null,
      2,
    );
    void navigator.clipboard?.writeText(redacted).then(() => notify('ok', t('settings.copied')));
  };

  if (state === null || draft === null) {
    return h('div', { className: 'dshgt-root' }, h('p', { className: 'dshgt-hint' }, store.error ?? t('quickfill.loading')));
  }

  const providers = state.core.supportedProviders.length > 0 ? state.core.supportedProviders : ['deepseek', 'openai-compatible'];
  const coreKind = state.core.state === 'ready' ? 'ok' : state.core.state === 'incompatible' ? 'warn' : 'err';

  const branchText = branchLoading
    ? t('branch.loading')
    : branchInfo?.branch !== undefined
      ? branchInfo.branch
      : draft.repo.baseBranch !== ''
        ? draft.repo.baseBranch
        : '—';
  const branchHint =
    branchInfo?.source === 'origin-head'
      ? t('branch.fromOrigin')
      : branchInfo?.source === 'head'
        ? t('branch.fromHead')
        : branchInfo?.message !== undefined
          ? branchInfo.message
          : t('branch.readonlyHint');

  const isGh = draft.github.authMode === 'gh';
  const isBrowser = draft.github.authMode === 'browser';
  const browserAvailable = state.github.browserAvailable === true;

  const sections: Array<{ id: SectionId; label: string }> = [
    { id: 'source', label: t('st.source') },
    { id: 'model', label: t('st.model') },
    { id: 'repo', label: t('st.repo') },
    { id: 'auth', label: t('st.auth') },
    { id: 'scope', label: t('st.scope') },
    { id: 'releases', label: t('st.releases') },
  ];

  const sourceCard = h(
    Card,
    {
      title: t('card.source.title'),
      hint: t('card.source.hint'),
      extra: h(Btn, { small: true, onClick: () => void recheck(), disabled: rechecking }, rechecking ? t('core.checking') : t('core.recheck')),
    },
    h('p', { className: 'dshgt-desc' }, t('card.source.desc')),
    h(
      Row,
      { label: t('card.source.title') },
      h('span', { className: 'dshgt-pill' }, h('span', { className: 'dshgt-dot ok' }), t('source.local')),
      h('span', { className: 'dshgt-hint' }, t('source.local.hint')),
    ),
    h(
      Row,
      { label: t('core.label') },
      h('span', { className: 'dshgt-pill' }, h('span', { className: `dshgt-dot ${coreKind}` }), state.core.version ?? t(`core.${state.core.state}`)),
      state.core.ipcSchema === undefined
        ? null
        : h('span', { className: 'dshgt-hint dshgt-mono' }, `ipc ${state.core.ipcSchema} · digest ${state.core.digestSchema ?? '?'}`),
      state.core.release === undefined
        ? null
        : h('span', { className: 'dshgt-hint dshgt-mono' }, `${state.core.release.tag} · ${state.core.release.asset}`),
      h(
        'span',
        { className: 'dshgt-hint' },
        state.core.download.state === 'override'
          ? t('core.override', { path: state.core.override?.path ?? '' })
          : state.core.release?.cached === true
            ? t('core.cached')
            : t('core.notDownloaded'),
      ),
      state.core.download.state === 'override'
        ? null
        : h(Btn, { small: true, onClick: () => void downloadCore(), disabled: downloading },
            downloading ? t('core.downloading') : state.core.release?.cached === true ? t('core.redownload') : t('core.download')),
    ),
    state.core.release === undefined
      ? null
      : h('p', { className: 'dshgt-hint dshgt-mono', style: { fontSize: 11 } }, `${state.core.release.url}  →  ${state.core.release.binaryPath}`),
    state.core.state === 'ready'
      ? null
      : h(Alert, { kind: 'err', title: t('core.label') }, h('div', null, state.core.message ?? ''), h('div', { className: 'dshgt-hint' }, t('core.order'))),
    h('p', { className: 'dshgt-hint' }, t('core.order')),
    h(
      Row,
      { label: t('network.proxy'), help: t('network.proxy.help') },
      h(Input, {
        mono: true,
        width: 280,
        value: draft.network?.proxy ?? '',
        placeholder: t('network.proxy.placeholder'),
        onInput: (value: string) => update((next) => {
          next.network = { proxy: value };
        }),
      }),
    ),
    h(
      Row,
      { label: t('run.timeout'), help: t('run.timeout.help') },
      h(Input, {
        mono: true,
        width: 120,
        value: String(Math.round((draft.run?.timeoutMs ?? 300_000) / 1000)),
        placeholder: t('run.timeout.placeholder'),
        onInput: (value: string) => update((next) => {
          // UI 用秒，存储用毫秒；非数字/空先原样保留，交给保存时的 validateSettings 拦。
          const seconds = Number(value);
          next.run = { timeoutMs: Number.isFinite(seconds) && value.trim() !== '' ? Math.round(seconds * 1000) : 0 };
        }),
      }),
      h('span', { className: 'dshgt-hint' }, t('run.timeout.unit')),
    ),
    state.coexistence.found
      ? h(Alert, { kind: 'warn', title: t('coexist.title') }, h('div', { className: 'dshgt-mono', style: { fontSize: 12 } }, `${state.coexistence.path ?? ''} ${state.coexistence.version ?? ''}`), h('div', null, state.coexistence.message ?? ''), h('div', { className: 'dshgt-hint' }, t('coexist.hint')))
      : null,
  );

  // 用 draft 的 mode + 服务端解析结果合成文案：刚点完「沿用 DSH 配置」还没保存时，
  // 也应该先看到「沿用 DSH 凭据」，而不是旧模式下的「未配置」。
  const modelCredential = credentialView({ mode: draft.model.mode, credential: state.model.credential }, t);
  const modelCard = h(
    Card,
    {
      title: t('card.model.title'),
      hint: t('card.model.hint'),
      extra: h(Btn, { small: true, variant: 'primary', onClick: () => setQuickOpen(true) }, t('model.quickfill')),
    },
    h('p', { className: 'dshgt-desc' }, t('model.quickfill.desc')),
    h(
      Row,
      { label: t('model.provider') },
      h(Select, {
        value: draft.model.provider,
        options: providers.map((provider) => ({ value: provider, label: provider })),
        onChange: (value: string) => update((next) => { next.model.provider = value; }),
      }),
      h('span', { className: 'dshgt-hint' }, draft.model.mode === 'proxy' ? t('model.mode.proxy') : t('model.mode.direct')),
    ),
    h(Row, { label: t('model.baseURL') }, h(Input, {
      mono: true,
      width: 420,
      value: draft.model.baseURL,
      placeholder: t('model.baseURL.placeholder'),
      onInput: (value: string) => update((next) => { next.model.baseURL = value; }),
    })),
    h(
      Row,
      { label: t('model.model') },
      h(Input, {
        mono: true,
        width: 260,
        value: draft.model.model,
        placeholder: t('model.model.placeholder'),
        onInput: (value: string) => update((next) => { next.model.model = value; }),
      }),
      h(Btn, { small: true, onClick: () => void runPreflight(), disabled: preflighting }, preflighting ? t('model.preflighting') : t('model.preflight')),
    ),
    h(
      Row,
      { label: t('model.credential') },
      h(Pill, { kind: modelCredential.kind }, modelCredential.label),
      h('span', { className: 'dshgt-hint' }, modelCredential.hint),
    ),
    h(
      Row,
      { label: t('model.temperature'), help: t('model.temperature.help') },
      h(Input, { mono: true, width: 70, value: String(draft.model.temperature), onInput: (value: string) => update((next) => { next.model.temperature = Number(value) || 0; }) }),
    ),
    h(
      Row,
      { label: t('model.maxTokens'), help: t('model.maxTokens.help') },
      h(Input, { mono: true, width: 90, value: String(draft.model.maxTokens), onInput: (value: string) => update((next) => { next.model.maxTokens = Math.round(Number(value) || 0); }) }),
    ),
    h(
      Row,
      { label: t('model.params'), help: t('model.allowDegraded.help') },
      h(Toggle, { checked: draft.model.allowDegraded, label: t('model.allowDegraded'), onChange: (value: boolean) => update((next) => { next.model.allowDegraded = value; }) }),
    ),
    preflight === null
      ? null
      : h(
          Alert,
          { kind: preflight.ok ? 'ok' : 'err', title: preflight.ok ? t('state.ok') : t('error.prefix') },
          h('div', null, `${preflight.mode} · ${duration(preflight.durationMs)}${preflight.endpoint === undefined ? '' : ` · ${preflight.endpoint}`}`),
          preflight.message === undefined ? null : h('div', null, preflight.message),
          preflight.hint === undefined ? null : h('div', { className: 'dshgt-hint' }, preflight.hint),
        ),
  );

  const repoCard = h(
    Card,
    { title: t('card.repo.title'), hint: t('card.repo.hint') },
    h(
      Row,
      { label: t('repo.path') },
      h(Input, {
        mono: true,
        width: 260,
        value: draft.repo.path,
        placeholder: t('repo.path.placeholder'),
        onInput: (value: string) => update((next) => { next.repo.path = value.trim(); }),
      }),
      props.pickDirectory === undefined
        ? null
        : h(Btn, {
            small: true,
            disabled: pickerKind === 'browse',
            title: pickerKind === 'browse' ? t('repo.pick.unavailable') : undefined,
            onClick: () => {
              const pending = props.pickDirectory?.();
              if (pending === undefined) return;
              void pending
                .then((picked) => {
                  if (typeof picked === 'string' && picked !== '') update((next) => { next.repo.path = picked; });
                })
                .catch((error) => {
                  const unavailable = isPickerUnavailable(error);
                  if (unavailable) setPickerKind('browse');
                  notify('err', pickErrorText(error, t));
                });
            },
          }, t('repo.pick')),
    ),
    pickerKind === 'browse'
      ? h(
          Row,
          { label: '' },
          h('span', { className: 'dshgt-hint' }, t('repo.pick.unavailableHint')),
        )
      : null,
    h(
      Row,
      { label: t('repo.baseBranch') },
      h('span', { className: 'dshgt-mono' }, branchText),
      h('span', { className: 'dshgt-hint' }, branchHint),
    ),
    h(
      Row,
      { label: t('repo.outputDir') },
      h(Input, { mono: true, width: 200, value: draft.output.dir, onInput: (value: string) => update((next) => { next.output.dir = value; }) }),
      h('span', { className: 'dshgt-hint' }, t('repo.outputDir.hint')),
    ),
    h(
      Row,
      { label: t('repo.commitMode') },
      h(Select, {
        value: draft.repo.commitMode,
        options: [
          { value: 'branch', label: t('repo.commitMode.branch') },
          { value: 'direct', label: t('repo.commitMode.direct') },
        ],
        onChange: (value: string) => update((next) => { next.repo.commitMode = value === 'direct' ? 'direct' : 'branch'; }),
      }),
      h(Toggle, { checked: draft.pr.autoMerge, label: t('repo.autoMerge'), onChange: (value: boolean) => update((next) => { next.pr.autoMerge = value; }) }),
    ),
  );

  const authCard = h(
    Card,
    { title: t('card.auth.title'), hint: t('card.auth.hint') },
    h(
      Row,
      { label: t('auth.mode') },
      h(Select, {
        value: draft.github.authMode,
        options: [
          { value: 'gh', label: t('auth.gh') },
          { value: 'pat', label: t('auth.pat') },
          { value: 'browser', label: t('auth.browser') },
        ],
        onChange: (value: string) =>
          update((next) => {
            next.github.authMode = value === 'pat' ? 'pat' : value === 'browser' ? 'browser' : 'gh';
          }),
      }),
      h(Pill, { kind: state.github.configured ? 'ok' : 'warn' }, state.github.configured ? `${t('auth.configured')} · ${state.github.source}` : t('auth.missing')),
    ),
    h('p', { className: 'dshgt-hint' }, isGh ? t('auth.gh.hint') : isBrowser ? t('auth.browser.hint') : t('auth.pat.hint')),
    isGh
      ? null
      : isBrowser
        ? h(
            Row,
            { label: t('auth.status') },
            browserAvailable
              ? h(
                  Btn,
                  {
                    small: true,
                    variant: 'primary',
                    onClick: () => void (signInActive ? openSignInModal() : startSignIn()),
                  },
                  signInActive
                    ? t('auth.modal.viewCode')
                    : signIn.phase === 'done' && signIn.login !== undefined
                      ? `${t('auth.browser.done')} · @${signIn.login}`
                      : t('auth.browser.signin'),
                )
              : h('span', { className: 'dshgt-hint' }, t('auth.browser.unavailable')),
          )
        : h(
            Row,
            { label: t('auth.tokenRef') },
            h(Input, { mono: true, width: 220, value: draft.github.tokenRef, placeholder: 'GITHUB_TOKEN', onInput: (value: string) => update((next) => { next.github.tokenRef = value; }) }),
            h('span', { className: 'dshgt-hint' }, t('auth.tokenRef.hint')),
          ),
    h(
      Row,
      { label: t('auth.test') },
      h(Btn, { small: true, onClick: () => void testGithub(), disabled: testing }, testing ? t('auth.testing') : t('auth.test')),
      githubTest === null
        ? null
        : h(Pill, { kind: githubTest.ok ? 'ok' : 'err' },
            githubTest.ok
              ? `${t('auth.test.ok')}${githubTest.login === undefined ? '' : ` · @${githubTest.login}`}`
              : githubTest.message ?? t('auth.test.fail'),
          ),
    ),
  );

  // 观测库设置：旧 settings.json 可能没有 observe 字段，先补一份安全默认再编辑/渲染。
  const observeOf = (s: SettingsShape) => s.observe ?? { enabled: true, backfillDays: 30, maxCandidates: 300 };
  const observe = observeOf(draft);

  const scopeCard = h(
    Card,
    {
      title: t('card.scope.title'),
      hint: state.schedule.nextRunAt === undefined ? undefined : `${t('schedule.next')} ${localTime(state.schedule.nextRunAt)}`,
    },
    h(
      Row,
      { label: t('scope.period') },
      h(
        'div',
        { className: 'dshgt-period-list' },
        ...(['daily', 'weekly', 'monthly'] as Period[]).map((period) =>
          h(
            'div',
            { key: period, className: 'dshgt-period' },
            h('span', { className: 'dshgt-period-check' }, '✓'),
            h('span', null, t(`scope.${period}`)),
          ),
        ),
      ),
    ),
    h(
      Row,
      { label: t('scope.languages') },
      h(Chips, {
        values: LANGUAGES,
        selected: draft.trending.languages,
        onChange: (next: string[]) => update((draftNext) => { draftNext.trending.languages = next; }),
      }),
    ),
    h('h4', { className: 'dshgt-subhead' }, t('card.schedule.title')),
    h(
      Row,
      { label: t('schedule.enabled') },
      h(Toggle, { checked: draft.schedule.enabled, onChange: (value: boolean) => update((next) => { next.schedule.enabled = value; }) }),
      h('span', { className: 'dshgt-hint' }, t('schedule.time')),
      h(Input, { mono: true, width: 110, value: draft.schedule.time, onInput: (value: string) => update((next) => { next.schedule.time = value; }) }),
      h('span', { className: 'dshgt-hint' }, t('schedule.timezone')),
      h(Input, { mono: true, width: 170, value: draft.schedule.timezone, onInput: (value: string) => update((next) => { next.schedule.timezone = value; }) }),
    ),
    h(
      Row,
      { label: t('schedule.periods') },
      h('span', { className: 'dshgt-hint' }, t('schedule.periods.value')),
    ),
    h('p', { className: 'dshgt-hint' }, t('schedule.source')),
    h('h4', { className: 'dshgt-subhead' }, t('card.summarize.title')),
    h(
      Row,
      { label: t('summarize.batchSize'), help: t('summarize.batchSize.help') },
      h(Input, { mono: true, width: 90, value: String(draft.summarize.batchSize), onInput: (value: string) => update((next) => { next.summarize.batchSize = Math.round(Number(value) || 0); }) }),
    ),
    h(
      Row,
      { label: t('summarize.maxRetries'), help: t('summarize.maxRetries.help') },
      h(Input, { mono: true, width: 90, value: String(draft.summarize.maxRetries), onInput: (value: string) => update((next) => { next.summarize.maxRetries = Math.round(Number(value) || 0); }) }),
    ),
    h(
      Row,
      { label: t('summarize.enrich'), help: t('summarize.enrich.help') },
      h(Select, {
        value: draft.summarize.enrich,
        options: [
          { value: 'none', label: t('summarize.enrich.none') },
          { value: 'repo', label: t('summarize.enrich.repo') },
          { value: 'readme', label: t('summarize.enrich.readme') },
        ],
        onChange: (value: string) => update((next) => { next.summarize.enrich = value === 'repo' ? 'repo' : value === 'readme' ? 'readme' : 'none'; }),
      }),
    ),
    h(
      Row,
      { label: t('summarize.readmeChars'), help: t('summarize.readmeChars.help') },
      h(Input, { mono: true, width: 90, value: String(draft.summarize.readmeChars), onInput: (value: string) => update((next) => { next.summarize.readmeChars = Math.round(Number(value) || 0); }) }),
    ),
    // 摘要语言：首项「跟随宿主({hostLang})」（值 ''），其余为支持语言。
    // 核心版本过旧时给一条提示，但下拉仍可用（保存不依赖核心在线）。
    (() => {
      const hostLang = language?.hostLanguage !== undefined && language.hostLanguage !== '' ? language.hostLanguage : t('summaryLang.unknownHost');
      const current = draft.outputLanguage ?? '';
      // 旧状态可能没有 outputLanguage：'' 视为跟随宿主。
      const missingCore = state?.core?.state === 'incompatible';
      return [
        h(
          Row,
          { label: t('summaryLang.label'), help: t('summaryLang.help') },
          h(Select, {
            value: current,
            options: [
              { value: '', label: t('summaryLang.followHost', { hostLang }) },
              { value: 'zh', label: t('summaryLang.zh') },
              { value: 'en', label: t('summaryLang.en') },
            ],
            onChange: (value: string) => update((next) => { next.outputLanguage = value; }),
          }),
        ),
        missingCore ? h(Alert, { kind: 'warn' }, h('div', null, t('summaryLang.coreTooOld'))) : null,
      ];
    })(),
    draft.summarize.enrich === 'none' ? null : h(Alert, { kind: 'warn' }, h('div', null, t('summarize.enrichNote'))),
    // 本地 star 观测库（核心 observe.*）：旧设置里可能还没有该字段，先取默认再编辑。
    // 观测库让「今日新增」来自本地每日快照的差分；关闭即回到「增量只来自趋势页」的旧行为。
    h('h4', { className: 'dshgt-subhead' }, t('card.observe.title')),
    h(
      Row,
      { label: t('observe.enabled'), help: t('observe.enabled.help') },
      h(Toggle, {
        checked: observe.enabled,
        onChange: (value: boolean) => update((next) => { next.observe = { ...observeOf(next), enabled: value }; }),
      }),
    ),
    h(
      Row,
      { label: t('observe.backfillDays'), help: t('observe.backfillDays.help') },
      h(Input, { mono: true, width: 90, value: String(observe.backfillDays), onInput: (value: string) => update((next) => { next.observe = { ...observeOf(next), backfillDays: Math.round(Number(value) || 0) }; }) }),
    ),
    h(
      Row,
      { label: t('observe.maxCandidates'), help: t('observe.maxCandidates.help') },
      h(Input, { mono: true, width: 90, value: String(observe.maxCandidates), onInput: (value: string) => update((next) => { next.observe = { ...observeOf(next), maxCandidates: Math.round(Number(value) || 0) }; }) }),
    ),
    observe.enabled ? null : h(Alert, { kind: 'info' }, h('div', null, t('observe.disabledNote'))),
  );

  // 发版节奏与并发是这次新增的字段：旧设置文件里可能还没有，先给安全默认值再编辑，
  // 避免出现「输入框显示 undefined」这种半坏状态。
  const releaseSchedule = draft.releases.schedule ?? { enabled: false, weekday: 1, time: '08:00:00', timezone: 'Asia/Shanghai' };
  const releaseConcurrency = draft.releases.concurrency ?? 'auto';
  const releaseBudget = draft.releases.budgetSeconds ?? 'auto';

  const releasesCard = h(
    Card,
    {
      title: t('card.releases.title'),
      hint: t('card.releases.hint'),
      extra: props.onOpenSubscriptions === undefined ? undefined : h(Btn, { small: true, onClick: () => props.onOpenSubscriptions?.() }, t('releases.manage')),
    },
    h(
      Row,
      { label: t('releases.includePrerelease'), help: t('releases.includePrerelease.help') },
      h(Toggle, { checked: draft.releases.includePrerelease, onChange: (value: boolean) => update((next) => { next.releases.includePrerelease = value; }) }),
    ),
    h(
      Row,
      { label: t('releases.includeDrafts'), help: t('releases.includeDrafts.help') },
      h(Toggle, { checked: draft.releases.includeDrafts, onChange: (value: boolean) => update((next) => { next.releases.includeDrafts = value; }) }),
    ),
    h(
      Row,
      { label: t('releases.notesChars'), help: t('releases.notesChars.help') },
      h(Input, { mono: true, width: 90, value: String(draft.releases.maxNotesChars), onInput: (value: string) => update((next) => { next.releases.maxNotesChars = Math.round(Number(value) || 0); }) }),
    ),
    h(
      Row,
      { label: t('releases.backfillLatest'), help: t('releases.backfillLatest.help') },
      h(Input, { mono: true, width: 90, value: String(draft.releases.backfillLatest ?? 3), onInput: (value: string) => update((next) => { next.releases.backfillLatest = Math.round(Number(value) || 0); }) }),
    ),
    h(
      Row,
      { label: t('releases.schedule.enabled'), help: t('releases.schedule.help') },
      h(Toggle, {
        checked: releaseSchedule.enabled,
        onChange: (value: boolean) => update((next) => { next.releases.schedule = { ...releaseSchedule, enabled: value }; }),
      }),
    ),
    h(
      Row,
      { label: t('releases.schedule.weekday') },
      h(Select, {
        value: String(releaseSchedule.weekday),
        options: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ value: String(weekday), label: t(`weekday.${weekday}`) })),
        onChange: (value: string) => update((next) => { next.releases.schedule = { ...releaseSchedule, weekday: Math.round(Number(value) || 1) }; }),
      }),
      h('span', { className: 'dshgt-hint' }, t('releases.schedule.time')),
      h(Input, { mono: true, width: 90, value: releaseSchedule.time, onInput: (value: string) => update((next) => { next.releases.schedule = { ...releaseSchedule, time: value }; }) }),
      h('span', { className: 'dshgt-hint' }, t('releases.schedule.timezone')),
      h(Input, { mono: true, width: 170, value: releaseSchedule.timezone, onInput: (value: string) => update((next) => { next.releases.schedule = { ...releaseSchedule, timezone: value }; }) }),
    ),
    h('p', { className: 'dshgt-hint' }, t('releases.schedule.hint')),
    h(
      Row,
      { label: t('releases.concurrency'), help: t('releases.concurrency.help') },
      h(Select, {
        value: releaseConcurrency === 'auto' ? 'auto' : 'fixed',
        options: [
          { value: 'auto', label: t('releases.concurrency.auto') },
          { value: 'fixed', label: t('releases.concurrency.fixed') },
        ],
        onChange: (value: string) =>
          update((next) => {
            next.releases.concurrency = value === 'auto' ? 'auto' : typeof next.releases.concurrency === 'number' ? next.releases.concurrency : 4;
          }),
      }),
      releaseConcurrency === 'auto'
        ? null
        : h(Input, {
            mono: true,
            width: 70,
            value: String(releaseConcurrency),
            onInput: (value: string) => update((next) => { next.releases.concurrency = Math.round(Number(value) || 1); }),
          }),
    ),
    h(
      Row,
      { label: t('releases.budget'), help: t('releases.budget.help') },
      h(Select, {
        value: releaseBudget === 'auto' ? 'auto' : 'fixed',
        options: [
          { value: 'auto', label: t('releases.budget.auto') },
          { value: 'fixed', label: t('releases.budget.fixed') },
        ],
        onChange: (value: string) =>
          update((next) => {
            next.releases.budgetSeconds = value === 'auto' ? 'auto' : typeof next.releases.budgetSeconds === 'number' ? next.releases.budgetSeconds : 150;
          }),
      }),
      releaseBudget === 'auto'
        ? null
        : h(Input, {
            mono: true,
            width: 70,
            value: String(releaseBudget),
            onInput: (value: string) => update((next) => { next.releases.budgetSeconds = Math.round(Number(value) || 1); }),
          }),
    ),
  );

  const currentCard =
    section === 'source' ? sourceCard
      : section === 'model' ? modelCard
        : section === 'repo' ? repoCard
          : section === 'auth' ? authCard
            : section === 'scope' ? scopeCard
              : releasesCard;

  return h(
    'div',
    { className: 'dshgt-settings' },
    h(
      'nav',
      { className: 'dshgt-vtabs', role: 'tablist', 'aria-orientation': 'vertical' },
      sections.map((item) =>
        h(
          'button',
          {
            key: item.id,
            type: 'button',
            className: 'dshgt-vtab',
            role: 'tab',
            'aria-selected': section === item.id ? 'true' : 'false',
            onClick: () => setSection(item.id),
          },
          item.label,
          dirtySections[item.id] ? h('span', { className: 'dshgt-vtab-dirty', title: t('settings.dirty') }) : null,
        ),
      ),
    ),
    h(
      'div',
      { className: 'dshgt-vpanel' },
      currentCard,
      problems.length > 0
        ? h(Alert, { kind: 'err', title: t('error.prefix') }, h('ul', { style: { margin: 0, paddingLeft: 16 } }, problems.map((problem, index) => h('li', { key: index }, `${problem.field}：${problem.message}`))))
        : null,
      notice === null ? null : h(Alert, { kind: notice.kind }, notice.text),
      h(
        'div',
        { className: 'dshgt-footer' },
        sectionEditable
          ? h(
              Btn,
              {
                variant: 'primary',
                onClick: () => void save(section),
                disabled: savingSection !== null || !dirtySections[section],
              },
              savingSection === section
                ? t('settings.saving')
                : dirtySections[section]
                  ? t('settings.saveSection')
                  : savedSection === section
                    ? t('settings.saved')
                    : t('settings.saveSection'),
            )
          : null,
        h(Btn, { onClick: () => void importCli() }, t('settings.import')),
        h(Btn, { onClick: copyConfig }, t('settings.copyConfig')),
      ),
    ),
    quickOpen
      ? h(QuickFillModal, { t, onClose: () => setQuickOpen(false), onApplied: (settings: SettingsShape) => { setDraft(settings); setDirtySections({ ...EMPTY_DIRTY }); setSavedSection(null); void store.refresh({ quiet: true }); } })
      : null,
    signInModal
      ? h(AuthSignInModal, {
          t,
          view: signIn,
          onClose: closeSignInModal,
          onCancel: () => void cancelSignIn(),
          onRetry: () => void startSignIn(),
          onCopyCode: copyDeviceCode,
          onOpenPage: () => openVerifyPage(signIn.verificationUri),
        })
      : null,
  );
}

function AuthSignInModal(props: {
  t: Translate;
  view: GithubAttemptView;
  onClose: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onCopyCode: () => void;
  onOpenPage: () => void;
}): any {
  const { t, view } = props;
  const active = view.phase === 'waiting-device' || view.phase === 'exchanging';

  const body =
    view.phase === 'waiting-device' || view.phase === 'exchanging'
      ? h(
          'div',
          { className: 'dshgt-authmodal-body' },
          h('p', { className: 'dshgt-hint', style: { margin: 0 } }, t('auth.modal.lead')),
          view.userCode !== undefined
            ? h(
                'div',
                { className: 'dshgt-authcode' },
                h('span', { className: 'dshgt-authcode-value' }, view.userCode),
              )
            : null,
          view.userCode !== undefined
            ? h(
                'div',
                { className: 'dshgt-authcode-actions' },
                h(Btn, { small: true, variant: 'ghost', onClick: props.onCopyCode }, t('auth.browser.copyCode')),
                view.verificationUri !== undefined
                  ? h(Btn, { small: true, variant: 'primary', onClick: props.onOpenPage }, `${t('auth.modal.openPage')} ↗`)
                  : null,
              )
            : null,
          h(
            'div',
            { className: 'dshgt-authwait' },
            h('span', { className: 'dshgt-authwait-dot' }),
            h('span', null, view.phase === 'exchanging' ? t('auth.modal.exchanging') : t('auth.modal.waiting')),
          ),
        )
      : view.phase === 'done'
        ? h(
            'div',
            { className: 'dshgt-authmodal-body' },
            h(Alert, { kind: 'ok' }, view.login === undefined ? t('auth.browser.done') : `${t('auth.browser.done')} · @${view.login}`),
          )
        : view.phase === 'error'
          ? h(
              'div',
              { className: 'dshgt-authmodal-body' },
              h(Alert, { kind: 'err', title: t('auth.browser.failed') }, view.error ?? t('auth.browser.failed.hint')),
            )
          : h(
              'div',
              { className: 'dshgt-authmodal-body dshgt-authwait' },
              h('span', { className: 'dshgt-authwait-dot' }),
              h('span', null, t('auth.modal.requesting')),
            );

  const footer =
    view.phase === 'error'
      ? h(
          'div',
          { className: 'dshgt-authmodal-footer' },
          h(Btn, { small: true, variant: 'primary', onClick: props.onRetry }, t('auth.modal.retry')),
          h(Btn, { small: true, variant: 'ghost', onClick: props.onClose }, t('auth.modal.close')),
        )
      : view.phase === 'done'
        ? h(
            'div',
            { className: 'dshgt-authmodal-footer' },
            h(Btn, { small: true, variant: 'primary', onClick: props.onClose }, t('auth.modal.close')),
          )
        : h(
            'div',
            { className: 'dshgt-authmodal-footer' },
            h('span', { className: 'dshgt-hint' }, t('auth.modal.closeHint')),
            h(Btn, { small: true, variant: 'ghost', onClick: props.onCancel, disabled: !active }, t('auth.browser.cancel')),
          );

  return h(
    'div',
    { className: 'dshgt-modal-mask', onClick: (event: any) => { if (event.target === event.currentTarget) props.onClose(); } },
    h(
      'div',
      { className: 'dshgt-modal dshgt-authmodal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('auth.modal.title') },
      h(
        'div',
        { className: 'dshgt-authmodal-head' },
        h('h3', { style: { margin: 0, fontSize: 14 } }, t('auth.modal.title')),
        h('button', { type: 'button', className: 'dshgt-authmodal-x', 'aria-label': t('auth.modal.close'), onClick: props.onClose }, '✕'),
      ),
      body,
      footer,
    ),
  );
}

function QuickFillModal(props: { t: Translate; onClose: () => void; onApplied: (settings: SettingsShape) => void }): any {
  const { t } = props;
  const [data, setData] = React.useState<QuickfillResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = React.useState('');
  const [selectedModel, setSelectedModel] = React.useState('');
  const [applying, setApplying] = React.useState<string | null>(null);
  const [showOthers, setShowOthers] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const result = await apiCall<QuickfillResponse>('GET', '/quickfill');
        setData(result);
        const first = result.providers[0];
        if (first !== undefined) {
          setSelectedProvider(first.id);
          setSelectedModel(first.models[0]?.id ?? '');
        }
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : String(failure));
        setData({ providers: [], defaultSelection: null });
      }
    })();
  }, []);

  const providers = data?.providers ?? [];
  const defaultSelection: DefaultSelection | null = data?.defaultSelection ?? null;
  const current = providers.find((provider) => provider.id === selectedProvider);

  const finish = (settings: SettingsShape): void => {
    props.onApplied(settings);
    props.onClose();
  };

  const applyDefault = async (): Promise<void> => {
    setApplying('default');
    setError(null);
    try {
      const result = await apiCall<{ settings: SettingsShape }>('POST', '/quickfill', { useDefault: true });
      finish(result.settings);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setApplying(null);
    }
  };

  const applySelected = async (): Promise<void> => {
    if (current === undefined) return;
    setApplying('selected');
    setError(null);
    try {
      const result = await apiCall<{ settings: SettingsShape }>('POST', '/quickfill', { providerId: current.id, modelId: selectedModel });
      finish(result.settings);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setApplying(null);
    }
  };

  return h(
    'div',
    { className: 'dshgt-modal-mask', onClick: (event: any) => { if (event.target === event.currentTarget) props.onClose(); } },
    h(
      'div',
      { className: 'dshgt-modal' },
      h('h3', { style: { margin: 0, fontSize: 14 } }, t('quickfill.title')),
      h('p', { className: 'dshgt-hint', style: { margin: 0 } }, t('quickfill.hint')),
      error === null ? null : h(Alert, { kind: 'err' }, error),
      data === null
        ? h('p', { className: 'dshgt-hint' }, t('quickfill.loading'))
        : h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            defaultSelection === null
              ? null
              : h(
                  'div',
                  { className: 'dshgt-default' },
                  h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
                    h('span', { className: 'dshgt-hint' }, t('quickfill.default')),
                    h('span', { className: 'dshgt-mono' }, `${defaultSelection.provider} / ${defaultSelection.model}`),
                  ),
                  h(Btn, { variant: 'primary', small: true, onClick: () => void applyDefault(), disabled: applying !== null }, applying === 'default' ? t('quickfill.applying') : t('quickfill.useDefault')),
                ),
            providers.length === 0
              ? defaultSelection === null
                ? h('p', { className: 'dshgt-hint' }, t('quickfill.empty'))
                : null
              : h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                  h(Btn, { small: true, onClick: () => setShowOthers(!showOthers) }, showOthers ? t('quickfill.others.hide') : t('quickfill.others')),
                  showOthers
                    ? h(
                        'div',
                        { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                        h(Select, {
                          value: selectedProvider,
                          options: providers.map((provider) => ({ value: provider.id, label: `${provider.name} (${provider.id})` })),
                          onChange: (value: string) => {
                            setSelectedProvider(value);
                            const provider = providers.find((item) => item.id === value);
                            setSelectedModel(provider?.models[0]?.id ?? '');
                          },
                        }),
                        current === undefined
                          ? null
                          : h(Select, {
                              value: selectedModel,
                              options: current.models.map((model) => ({ value: model.id, label: model.name })),
                              onChange: setSelectedModel,
                            }),
                        current === undefined
                          ? null
                          : h(KV, {
                              items: [
                                ['provider', current.coreProvider],
                                ['baseURL', current.baseURL === '' ? t('label.optional') : current.baseURL],
                                ['credential', current.credential.ref ?? '—'],
                                ['mode', t(`quickfill.mode.${current.credential.mode}`)],
                              ],
                            }),
                        h(Btn, { variant: 'primary', small: true, disabled: applying !== null || selectedModel === '', onClick: () => void applySelected() }, applying === 'selected' ? t('quickfill.applying') : t('quickfill.apply')),
                      )
                    : null,
                ),
          ),
      h(
        'div',
        { className: 'dshgt-footer', style: { justifyContent: 'flex-end' } },
        h(Btn, { onClick: props.onClose }, t('quickfill.close')),
      ),
    ),
  );
}
