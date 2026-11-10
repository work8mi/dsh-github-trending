/**
 * 运行记录：最近 30 条列表 + 展开详情 + 只读日志抽屉。
 *
 * 日志不是实时流：按需 `GET /log?id=`，Host 只回最后 64 KB。运行入口统一走
 * `useRunController`，运行中禁用重复触发。
 */
import { Alert, Btn, copyText, duration, formatTokens, h, shortHash, shortTime, React } from './ui.js';
import type { Translate } from './i18n.js';
import { getLog, releaseRunsOf, type DigestTarget, type ReleaseRunRecord, type RunRecord, type StatePayload } from './api.js';
import type { StoreValue } from './store.js';
import type { RunController } from './run-controller.js';
import { LiveRun } from './live-run.js';
import { reasonHint, skipHint } from './error-copy.js';
import { digestTarget } from './digest-core.js';

/** 记录类型：日报（榜单运行）与订阅（每周 Release 检查）是两个来源。 */
type KindFilter = 'all' | 'digest' | 'release';
const KINDS: Array<{ id: KindFilter; key: string }> = [
  { id: 'all', key: 'runs.type.all' },
  { id: 'digest', key: 'runs.type.digest' },
  { id: 'release', key: 'runs.type.release' },
];

type Filter = 'all' | 'daily' | 'weekly' | 'monthly' | 'failed' | 'dry';
const FILTERS: Array<{ id: Filter; key: string }> = [
  { id: 'all', key: 'runs.filter.all' },
  { id: 'daily', key: 'runs.filter.daily' },
  { id: 'weekly', key: 'runs.filter.weekly' },
  { id: 'monthly', key: 'runs.filter.monthly' },
  { id: 'failed', key: 'runs.filter.failed' },
  { id: 'dry', key: 'runs.filter.dry' },
];

export interface RunsProps {
  t: Translate;
  store: StoreValue;
  controller: RunController;
  onOpenDigest: (target?: DigestTarget) => void;
}

// isDegradedRecord reports whether a run produced degraded trending data. The
// core writes a human-readable degradation reason into warnings; older records
// without such warnings are simply considered clean.
function isDegradedRecord(record: RunRecord): boolean {
  if (!record.ok || record.skipped) return false;
  return Array.isArray(record.warnings) && record.warnings.some((w) => w.includes('降级'));
}

function recordSummary(t: Translate, record: RunRecord): string {
  if (!record.ok) {
    return [record.errorCode, record.errorMessage].filter((item) => item !== undefined && item !== '').join(' · ') || t('state.failed');
  }
  if (record.skipped) {
    // force 重跑且内容无变化：明确「未新增提交」，避免用户以为没生效。
    if (record.forced === true && record.skipReason === 'unchanged') return t('run.force.noChange');
    return skipHint(t, record.skipReason, t('runs.noChange'));
  }
  if (record.kind === 'dry-run') return t('runs.dryHint');
  if (record.branch !== undefined) return record.branch;
  if (record.commit !== undefined) return record.commit;
  if (record.prUrl !== undefined) return t('runs.prCreated');
  return '—';
}

function prStatus(t: Translate, state: StatePayload, record: RunRecord): { label: string; kind: 'warn' | 'ok' } | null {
  if (record.prUrl === undefined) return null;
  const pending = state.status.pendingPr;
  if (pending !== null && pending.url === record.prUrl) {
    return { label: state.status.pendingPrState === 'unknown' ? t('runs.prUnknown') : t('runs.pendingPr'), kind: 'warn' };
  }
  return { label: t('runs.prCreated'), kind: 'ok' };
}

/**
 * 记录类型胶囊：日报按周期（daily / weekly / monthly），订阅固定 release。
 *
 * 三种周期与订阅共用 `.dshgt-pchip` 一套尺寸与填充规则，只是色相不同；
 * 统一从这里出，避免再出现「订阅只带 base 类、看着像按钮」的漂移。
 */
function kindChip(text: string, tone: string): any {
  return h('span', { className: `dshgt-pchip ${tone}` }, text);
}

function LogDrawer(props: { t: Translate; runId: string; onClose: () => void }): any {
  const { t, runId } = props;
  const [loading, setLoading] = React.useState(true);
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setText('');
    getLog(runId, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setText(payload.text);
        setLoading(false);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : String(failure));
        setLoading(false);
      });
    return () => controller.abort();
  }, [runId]);

  React.useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') props.onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [props]);

  return h(
    'div',
    { className: 'dshgt-modal-mask', onClick: (event: any) => { if (event.target === event.currentTarget) props.onClose(); } },
    h(
      'div',
      { className: 'dshgt-modal dshgt-log-modal', role: 'dialog', 'aria-modal': 'true' },
      h(
        'div',
        { className: 'dshgt-log-head' },
        h('h3', { className: 'dshgt-log-title' }, t('log.title')),
        h('span', { className: 'dshgt-hint dshgt-mono' }, runId),
        h(Btn, { small: true, onClick: () => props.onClose() }, t('log.close')),
      ),
      loading ? h('p', { className: 'dshgt-hint' }, t('log.loading')) : null,
      error === null ? null : h(Alert, { kind: 'err' }, error),
      loading || error !== null ? null : text === '' ? h('p', { className: 'dshgt-hint' }, t('log.empty')) : h('pre', { className: 'dshgt-log-pre' }, text),
      h(
        'div',
        { className: 'dshgt-log-foot' },
        h(
          Btn,
          {
            small: true,
            disabled: text === '',
            onClick: () => {
              void copyText(text).then((okResult) => {
                if (!okResult) return;
                setCopied(true);
              });
            },
          },
          copied ? t('log.copied') : t('log.copy'),
        ),
        h('span', { className: 'dshgt-hint' }, t('log.truncated')),
      ),
    ),
  );
}

export function RunsView(props: RunsProps): any {
  const { t, store, controller } = props;
  const [filter, setFilter] = React.useState<Filter>('all');
  const [kind, setKind] = React.useState<KindFilter>('all');
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [logId, setLogId] = React.useState<string | null>(null);
  const state = store.state;

  if (state === null) {
    return h('div', { className: 'dshgt-empty' }, store.error ?? t('quickfill.loading'));
  }

  const history = state.status.history;
  const releaseRuns = releaseRunsOf(state);

  const digestMatches = (record: RunRecord): boolean => {
    if (filter === 'failed') return !record.ok;
    if (filter === 'dry') return record.kind === 'dry-run';
    if (filter === 'daily' || filter === 'weekly' || filter === 'monthly') return (record.period ?? 'daily') === filter;
    return true;
  };
  // 订阅运行没有周期、也不是 dry-run：只认「失败」，其余筛选项一律不命中，
  // 免得把「周期 / 试跑」这类日报属性硬套到它身上。
  const releaseMatches = (run: ReleaseRunRecord): boolean => {
    if (filter === 'failed') return run.status === 'failed';
    return filter === 'all';
  };

  type Entry =
    | { kind: 'digest'; key: string; at: string; record: RunRecord }
    | { kind: 'release'; key: string; at: string; run: ReleaseRunRecord };

  // 两个来源合并成一条时间线：日报按 `at`、订阅按 `finishedAt`（缺失时退回 `startedAt`）。
  const entries: Entry[] = [
    ...(kind === 'release'
      ? []
      : history.filter(digestMatches).map((record): Entry => ({ kind: 'digest', key: record.id, at: record.at, record }))),
    ...(kind === 'digest'
      ? []
      : releaseRuns
          .filter(releaseMatches)
          .map((run): Entry => ({ kind: 'release', key: `release:${run.id}`, at: run.finishedAt || run.startedAt, run }))),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const hintCount = kind === 'release' ? releaseRuns.length : history.length;

  const digestNode = (record: RunRecord): any => {
    const open = openId === record.id;
    const pr = prStatus(t, state, record);
    return h(
      'div',
      { className: `dshgt-run-item${open ? ' open' : ''}${record.tokens === undefined ? '' : ' has-tokens'}`, key: record.id },
      h(
        'button',
        {
          type: 'button',
          className: 'dshgt-run-row',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => setOpenId(open ? null : record.id),
        },
        h('span', { className: `dshgt-lamp ${record.ok ? (record.skipped || record.kind === 'dry-run' ? 'warn' : 'ok') : 'err'}` }),
        h('span', { className: 'dshgt-run-date' }, shortTime(record.at)),
        kindChip(t(`period.${record.period ?? 'daily'}`), record.period ?? 'daily'),
        h(
          'span',
          { className: 'dshgt-run-what' },
          record.kind === 'dry-run' ? t('state.dry') : record.skipped ? t('state.skipped') : record.ok ? t('state.ok') : t('state.failed'),
          h('span', { className: 'dshgt-run-muted' }, recordSummary(t, record)),
          record.legacy === true ? h('span', { className: 'dshgt-tag dshgt-inline-tag' }, t('runs.legacy')) : null,
          record.forced === true ? h('span', { className: 'dshgt-tag dshgt-inline-tag' }, t('run.forced.tag')) : null,
          isDegradedRecord(record) ? h('span', { className: 'dshgt-tag dshgt-inline-tag dshgt-tag-warn' }, t('runs.degraded.tag')) : null,
        ),
        h('span', { className: 'dshgt-run-files' }, t('runs.files', { count: record.files })),
        record.tokens === undefined
          ? null
          : h('span', { className: 'dshgt-run-tokens dshgt-mono', title: t('run.usage.tokens') }, `${formatTokens(record.tokens)} tok`),
        h('span', { className: 'dshgt-run-duration' }, duration(record.durationMs)),
        h('span', { className: 'dshgt-run-chev' }, '›'),
      ),
      open
        ? h(
            'div',
            { className: 'dshgt-run-detail' },
            !record.ok
              ? h(
                  Alert,
                  { kind: 'err', title: `${t('error.prefix')} ${record.errorCode ?? 'INTERNAL'}` },
                  h('div', null, record.errorMessage ?? t('state.failed')),
                  record.errorReason === undefined
                    ? null
                    : h('div', { className: 'dshgt-hint' }, reasonHint(t, record.errorReason) ?? ''),
                )
              : null,
            h(
              'div',
              { className: 'dshgt-detail-grid' },
              detailItem(t, 'run.usage.commit', record.commit === undefined ? '—' : h('span', { className: 'dshgt-mono' }, record.commit)),
              detailItem(t, 'run.usage.hash', h('span', { className: 'dshgt-mono' }, shortHash(record.contentHash))),
              detailItem(t, 'run.usage.branch', record.branch === undefined ? '—' : h('span', { className: 'dshgt-mono' }, record.branch)),
              detailItem(t, 'runs.detail.coreModel', `${record.coreVersion || '—'} · ${record.model?.model ?? '—'}`),
              detailItem(t, 'runs.detail.date', record.date ?? '—'),
              detailItem(t, 'runs.detail.period', kindChip(t(`period.${record.period ?? 'daily'}`), record.period ?? 'daily')),
              detailItem(
                t,
                'run.usage.pr',
                record.prUrl === undefined
                  ? '—'
                  : h(
                      'span',
                      { className: 'dshgt-inline' },
                      h('a', { href: record.prUrl, target: '_blank', rel: 'noreferrer', title: record.prUrl }, t('digest.openPr')),
                      pr === null ? null : h('span', { className: 'dshgt-tag' }, pr.label),
                    ),
              ),
              detailItem(t, 'runs.detail.warnings', record.warnings.length === 0 ? t('runs.detail.none') : record.warnings.join('；')),
              detailItem(t, 'runs.detail.files', `${record.files} · ${duration(record.durationMs)}`),
              detailItem(t, 'runs.detail.tokens', record.tokens === undefined ? t('runs.detail.tokensNone') : h('span', { className: 'dshgt-mono' }, `${formatTokens(record.tokens)} tokens`)),
            ),
            record.releases === undefined ? null : ReleasesDetail({ t, record }),
            record.legacy === true ? h('div', { className: 'dshgt-hint' }, t('runs.legacyHint')) : null,
            h(
              'div',
              { className: 'dshgt-run-actions' },
              record.preview === undefined
                ? h('span', { className: 'dshgt-hint' }, t('runs.detail.noPreview'))
                : h(
                    Btn,
                    {
                      small: true,
                      onClick: () => {
                        const target = digestTarget(record, state.schedule.timezone);
                        if (target !== undefined) props.onOpenDigest(target);
                      },
                    },
                    t('runs.detail.readDigest'),
                  ),
              h(Btn, { small: true, onClick: () => setLogId(record.id) }, t('runs.detail.log')),
              record.preview === undefined ? null : h('span', { className: 'dshgt-hint dshgt-mono' }, record.preview.file),
            ),
          )
        : null,
    );
  };

  return h(
    'div',
    { className: 'dshgt-view dshgt-runs' },
    controller.running ? h(LiveRun, { t, controller, startedAt: controller.startedAt }) : null,
    controller.error === null ? null : h('div', { className: 'dshgt-alert err', role: 'alert' }, controller.error),
    h(
      'div',
      { className: 'dshgt-runs-head' },
      h('span', { className: 'dshgt-hint' }, t('runs.count', { count: hintCount })),
      h(
        'div',
        { className: 'dshgt-runs-filter' },
        // 记录类型：全部 / 日报 / 订阅，始终可选。
        h(
          'div',
          { key: 'kind', className: 'dshgt-chipgroup' },
          KINDS.map((item) =>
            h(
              'button',
              {
                key: item.id,
                type: 'button',
                className: 'dshgt-chip',
                'aria-pressed': kind === item.id ? 'true' : 'false',
                onClick: () => {
                  setKind(item.id);
                  // 周期 / 试跑筛选只对日报有意义，切到订阅时先归零，避免筛出空列表。
                  if (item.id === 'release') setFilter('all');
                },
              },
              t(item.key),
            ),
          ),
        ),
        // 周期 / 状态：只对日报有意义。切到订阅时不清空标签，而是置灰禁用，
        // 让筛选维度保持可见、只是不适用，避免出现「选项突然变少」的错觉。
        h('span', { key: 'sep', className: 'dshgt-chipgroup-sep', 'aria-hidden': 'true' }),
        h(
          'div',
          { key: 'filter', className: 'dshgt-chipgroup' },
          FILTERS.filter((item) => item.id !== 'all').map((item) =>
            // 再点一次当前项 = 取消该筛选，这样不必再摆一个和「全部」重名的胶囊。
            h(
              'button',
              {
                key: item.id,
                type: 'button',
                className: 'dshgt-chip',
                'aria-pressed': filter === item.id ? 'true' : 'false',
                disabled: kind === 'release',
                title: kind === 'release' ? t('runs.filterHintSubs') : undefined,
                onClick: () => setFilter(filter === item.id ? 'all' : item.id),
              },
              t(item.key),
            ),
          ),
        ),
      ),
    ),
    entries.length === 0
      ? h('div', { className: 'dshgt-empty' }, kind === 'release' ? t('runs.release.empty') : t('runs.empty'))
      : h(
          'div',
          { className: 'dshgt-run-list' },
          entries.map((entry) =>
            entry.kind === 'digest'
              ? digestNode(entry.record)
              : h(ReleaseRunItem, {
                  key: entry.key,
                  t,
                  run: entry.run,
                  open: openId === entry.key,
                  onToggle: () => setOpenId(openId === entry.key ? null : entry.key),
                }),
          ),
        ),
    state.status.totalTokens === undefined
      ? null
      : h('div', { className: 'dshgt-runs-foot dshgt-hint' }, t('runs.footer.total', { total: formatTokens(state.status.totalTokens) })),
    logId === null ? null : h(LogDrawer, { t, runId: logId, onClose: () => setLogId(null) }),
  );
}

const RELEASE_LAMP: Record<ReleaseRunRecord['status'], 'ok' | 'warn' | 'err'> = {
  ok: 'ok',
  failed: 'err',
  skipped: 'warn',
  cancelled: 'warn',
};

/**
 * 订阅运行的一行。
 *
 * 它没有日报的 date / period / files / preview：这些字段在这里一律不出现，
 * 只用 ReleaseRunRecord 真正带的 checked / changed / newTags / failed / tokens / duration。
 */
function ReleaseRunItem(props: { t: Translate; run: ReleaseRunRecord; open: boolean; onToggle: () => void }): any {
  const { t, run } = props;
  const lamp = RELEASE_LAMP[run.status] ?? 'warn';
  const headStats: Array<[string, number]> = [
    [t('runs.release.checked'), run.checked],
    [t('runs.release.changed'), run.changed],
    [t('runs.release.newTags'), run.newTags],
  ];
  return h(
    'div',
    { className: `dshgt-run-item${props.open ? ' open' : ''}${run.tokens === undefined ? '' : ' has-tokens'}` },
    h(
      'button',
      {
        type: 'button',
        className: 'dshgt-run-row',
        'aria-expanded': props.open ? 'true' : 'false',
        onClick: props.onToggle,
      },
      h('span', { className: `dshgt-lamp ${lamp}` }),
      h('span', { className: 'dshgt-run-date' }, shortTime(run.startedAt)),
      kindChip(t('runs.type.release'), 'release'),
      h(
        'span',
        { className: 'dshgt-run-what' },
        t(`runs.release.status.${run.status}`),
        h('span', { className: 'dshgt-run-muted' }, headStats.map(([label, value]) => `${label} ${value}`).join(' · ')),
      ),
      h('span', { className: 'dshgt-run-files' }, run.failed > 0 ? `${t('runs.release.failed')} ${run.failed}` : ''),
      run.tokens === undefined
        ? null
        : h('span', { className: 'dshgt-run-tokens dshgt-mono', title: t('run.usage.tokens') }, `${formatTokens(run.tokens)} tok`),
      h('span', { className: 'dshgt-run-duration' }, duration(run.durationMs)),
      h('span', { className: 'dshgt-run-chev' }, '›'),
    ),
    props.open
      ? h(
          'div',
          { className: 'dshgt-run-detail' },
          run.status === 'failed'
            ? h(
                Alert,
                { kind: 'err', title: `${t('error.prefix')} ${run.errorCode ?? 'INTERNAL'}` },
                h('div', null, run.errorMessage ?? t('state.failed')),
              )
            : null,
          h(
            'div',
            { className: 'dshgt-detail-grid' },
            detailItem(t, 'runs.release.startedAt', shortTime(run.startedAt)),
            detailItem(t, 'runs.release.finishedAt', shortTime(run.finishedAt)),
            detailItem(t, 'runs.release.duration', duration(run.durationMs)),
            detailItem(t, 'runs.release.checked', String(run.checked)),
            detailItem(t, 'runs.release.changed', String(run.changed)),
            detailItem(t, 'runs.release.newTags', String(run.newTags)),
            detailItem(t, 'runs.release.summarized', String(run.summarized)),
            detailItem(t, 'runs.release.degraded', String(run.degraded)),
            detailItem(t, 'runs.release.failed', String(run.failed)),
            detailItem(t, 'runs.release.rateLimited', String(run.rateLimited)),
            detailItem(t, 'run.usage.tokens', run.tokens === undefined ? '—' : formatTokens(run.tokens)),
            detailItem(t, 'run.usage.commit', run.commit === undefined ? '—' : h('span', { className: 'dshgt-mono' }, run.commit)),
            detailItem(t, 'run.usage.branch', run.branch === undefined ? '—' : h('span', { className: 'dshgt-mono' }, run.branch)),
            detailItem(
              t,
              'run.usage.pr',
              run.prUrl === undefined
                ? '—'
                : h('a', { href: run.prUrl, target: '_blank', rel: 'noreferrer', title: run.prUrl }, t('digest.openPr')),
            ),
          ),
          h('p', { className: 'dshgt-hint', style: { margin: 0 } }, t('runs.release.note')),
        )
      : null,
  );
}

/** 订阅阶段明细（历史记录展开时展示；只读 summary 字段）。 */
function ReleasesDetail(props: { t: Translate; record: RunRecord }): any {
  const { t, record } = props;
  const r = record.releases;
  if (r === undefined || !r.enabled) {
    return h('div', { className: 'dshgt-releases-detail' }, h('span', { className: 'dshgt-hint' }, t('releases.empty')));
  }
  const stats: Array<[string, number | undefined]> = [
    [t('releases.stat.repos'), r.repos],
    [t('releases.stat.new'), r.newReleases],
    [t('releases.stat.summarized'), r.summarized],
    [t('releases.stat.degraded'), r.degraded],
    [t('releases.stat.failed'), r.failed],
    [t('releases.stat.skipped'), r.skipped],
  ];
  return h(
    'div',
    { className: 'dshgt-releases-detail' },
    h(
      'div',
      { className: 'dshgt-releases-stats' },
      stats
        .filter(([, value]) => value !== undefined)
        .map(([label, value]) => h('span', { className: 'dshgt-releases-stat', key: label }, h('span', { className: 'dshgt-hint' }, label), h('span', { className: 'dshgt-mono' }, String(value)))),
    ),
  );
}

function detailItem(t: Translate, label: string, value: any): any {
  return h(
    'div',
    { className: 'dshgt-detail-item' },
    h('div', { className: 'dshgt-detail-k' }, t(label)),
    h('div', { className: 'dshgt-detail-v' }, value),
  );
}
