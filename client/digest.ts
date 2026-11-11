/**
 * 榜单预览：按「日榜 / 周榜 / 月榜」三个周期分别回看。
 *
 * 三个周期各有自己的时间线（日按天、周按 ISO 周、月按月），互不吞并。期数列表
 * 只来自 `/state` 的 history；正文只在记录带 `preview` 元数据时按需请求
 * `GET /preview?id=`。快速切换用 AbortController 取消上一个请求，避免旧响应覆盖
 * 新选择。没有预览时显示诚实空状态，不用示例内容兜底。
 *
 * 版式分三层：工具条（周期 / 期数）→ 概览（统计 + 文件信息，技术元数据收进折叠面板）
 * → 纸面（核心产出的 markdown 原样渲染）。页面只重新排版与派生展示数字，不改写正文。
 */
import { Badge, Btn, Disclosure, Stat, copyText, h, React } from './ui.js';
import type { Translate } from './i18n.js';
import { getPreview, type DigestTarget, type Period, type PreviewPayload } from './api.js';
import type { StoreValue } from './store.js';
import type { RunController } from './run-controller.js';
import {
  buildPeriodGroups,
  formatBucketLabel,
  formatBytes,
  regenTarget,
  type DigestStatus,
  type PeriodDay,
} from './digest-core.js';
import { collectBoardStats, renderMarkdown, type BoardStats, type RenderedMarkdown } from './markdown.js';

export interface DigestProps {
  t: Translate;
  lang: 'zh' | 'en';
  store: StoreValue;
  controller: RunController;
  selected?: DigestTarget;
  onSelect: (target: DigestTarget) => void;
  onOpenRuns: () => void;
}

const STATUS_TAG: Record<DigestStatus, string> = {
  preview: 'digest.tag.preview',
  failed: 'digest.tag.failed',
  skipped: 'digest.tag.skipped',
  dry: 'digest.tag.dry',
  legacy: 'digest.tag.legacy',
  missing: 'digest.tag.missing',
};

const STATUS_LABEL: Record<DigestStatus, string> = {
  preview: 'state.ok',
  failed: 'state.failed',
  skipped: 'state.skipped',
  dry: 'state.dry',
  legacy: 'digest.tag.legacy',
  missing: 'digest.tag.missing',
};

const STATUS_LAMP: Record<DigestStatus, string> = {
  preview: 'ok',
  failed: 'err',
  skipped: 'warn',
  dry: 'warn',
  legacy: 'warn',
  missing: 'warn',
};

/** 文件卡上的状态标签：数据「能读到」与「这次跑得怎样」是两件事，这里统一成一种说法。 */
const STATUS_BADGE: Record<DigestStatus, { kind: 'ok' | 'warn' | 'err'; key: string }> = {
  preview: { kind: 'ok', key: 'digest.tag.preview' },
  failed: { kind: 'err', key: 'state.failed' },
  skipped: { kind: 'warn', key: 'state.skipped' },
  dry: { kind: 'warn', key: 'state.dry' },
  legacy: { kind: 'warn', key: 'digest.tag.legacy' },
  missing: { kind: 'warn', key: 'digest.tag.missing' },
};

/** 技术字段的友好名；没有映射的字段直接显示原始 key，不静默丢。 */
const META_LABEL: Record<string, string> = {
  date: 'digest.meta.date',
  period: 'digest.meta.period',
  languages: 'digest.meta.languages',
  count: 'digest.meta.count',
  degraded: 'digest.meta.degraded',
  coreVersion: 'digest.meta.coreVersion',
  contentHash: 'digest.meta.contentHash',
  generatedAt: 'digest.meta.generatedAt',
};

interface PeriodOption {
  period: Period;
  count: number;
  active: boolean;
}

interface BucketOption {
  value: string;
  label: string;
}

/** 工具条：周期分段 + 期数导航 + 全部运行记录入口。 */
export interface BoardBarProps {
  t: Translate;
  groups: PeriodOption[];
  onPeriod: (period: Period) => void;
  dateText: string;
  statusText: string;
  bucket: string;
  buckets: BucketOption[];
  onBucket: (value: string) => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  windowText: string;
  onOpenRuns: () => void;
}

export function BoardBar(props: BoardBarProps): any {
  const { t } = props;
  return h(
    'section',
    { className: 'dshgt-board-bar' },
    h(
      'div',
      { className: 'dshgt-segmented', role: 'group', 'aria-label': t('digest.selectPeriod') },
      props.groups.map((group) =>
        h(
          'button',
          {
            key: group.period,
            type: 'button',
            'aria-pressed': group.active ? 'true' : 'false',
            className: group.active ? 'on' : '',
            onClick: () => props.onPeriod(group.period),
          },
          h('span', null, t(`period.${group.period}`)),
          h('span', { className: 'dshgt-segmented-count' }, String(group.count)),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dshgt-issue-nav' },
      h(
        'button',
        {
          type: 'button',
          className: 'dshgt-nav-btn',
          'aria-label': t('digest.prev'),
          title: t('digest.prev'),
          disabled: props.prevDisabled,
          onClick: props.onPrev,
        },
        '‹',
      ),
      h(
        'label',
        { className: 'dshgt-issue' },
        h('span', { className: 'dshgt-issue-date dshgt-mono' }, props.dateText),
        h('span', { className: 'dshgt-issue-meta' }, props.statusText),
        h(
          'select',
          {
            className: 'dshgt-issue-select',
            'aria-label': t('digest.selectBucket'),
            value: props.bucket,
            onChange: (event: any) => props.onBucket(event.target.value),
            disabled: props.buckets.length === 0,
          },
          props.buckets.length === 0
            ? h('option', { value: '' }, t('digest.window.empty'))
            : props.buckets.map((item) => h('option', { key: item.value, value: item.value }, item.label)),
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dshgt-nav-btn',
          'aria-label': t('digest.next'),
          title: t('digest.next'),
          disabled: props.nextDisabled,
          onClick: props.onNext,
        },
        '›',
      ),
    ),
    h('span', { className: 'dshgt-grow' }),
    h('span', { className: 'dshgt-board-window' }, props.windowText),
    h('button', { type: 'button', className: 'dshgt-linkbtn', onClick: props.onOpenRuns }, t('digest.allRuns')),
  );
}

/** 纸面前面的概览区：三个真实数字 + 文件信息（技术元数据收进「数据详情」）。 */
export interface BoardOverviewProps {
  t: Translate;
  status: DigestStatus;
  stats: BoardStats;
  degraded: boolean;
  file: { name: string; bytes?: number; truncated: boolean; prUrl?: string };
  mode: 'render' | 'raw';
  onMode: (mode: 'render' | 'raw') => void;
  onRegenerate: () => void;
  regenDisabled: boolean;
  onCopyPath: () => void;
  copied: boolean;
  meta: Record<string, string>;
  copiedField: string | undefined;
  onCopyField: (key: string, value: string) => void;
}

export function BoardOverview(props: BoardOverviewProps): any {
  const { t, stats, file, status } = props;
  const statusKind = STATUS_BADGE[status];
  const statusText = t(statusKind.key);
  const metaKeys = Object.keys(props.meta);
  return h(
    'div',
    { className: 'dshgt-board-grid' },
    h(
      'section',
      { className: 'dshgt-board-card dshgt-board-stats', 'aria-label': t('digest.stats') },
      h(Stat, { label: t('digest.stat.repos'), value: stats.repos.toLocaleString('en-US'), note: t('digest.stat.reposNote') }),
      h(Stat, {
        label: t('digest.stat.newStars'),
        value: `${stats.newStars >= 0 ? '+' : ''}${stats.newStars.toLocaleString('en-US')}`,
        note: t('digest.stat.newStarsNote'),
        tone: 'ok',
      }),
      h(Stat, {
        label: t('digest.stat.status'),
        value: statusText,
        className: 'dshgt-stat-status',
        note: t('digest.stat.statusNote', { langs: stats.languages }),
      }),
    ),
    h(
      'section',
      { className: 'dshgt-board-card dshgt-board-file' },
      h(
        'div',
        { className: 'dshgt-file-head' },
        h(Badge, { kind: statusKind.kind }, statusText),
        h('span', { className: 'dshgt-file-name dshgt-mono', title: file.name }, file.name),
        h(
          'span',
          { className: 'dshgt-file-meta' },
          [file.bytes === undefined ? '—' : formatBytes(file.bytes), t(`period.${props.meta.period ?? 'daily'}`)]
            .filter((part) => part !== '')
            .join(' · '),
        ),
        props.degraded ? h(Badge, { kind: 'warn' }, t('digest.degraded.short')) : null,
        file.truncated ? h(Badge, { kind: 'muted' }, t('digest.truncated')) : null,
      ),
      h(
        'div',
        { className: 'dshgt-file-actions' },
        h(
          'div',
          { className: 'dshgt-seg', role: 'group', 'aria-label': t('digest.mode') },
          h(
            'button',
            {
              type: 'button',
              'aria-pressed': props.mode === 'render' ? 'true' : 'false',
              className: props.mode === 'render' ? 'on' : '',
              onClick: () => props.onMode('render'),
            },
            t('digest.render'),
          ),
          h(
            'button',
            {
              type: 'button',
              'aria-pressed': props.mode === 'raw' ? 'true' : 'false',
              className: props.mode === 'raw' ? 'on' : '',
              onClick: () => props.onMode('raw'),
            },
            t('digest.raw'),
          ),
        ),
        h(Btn, { small: true, onClick: props.onRegenerate, disabled: props.regenDisabled }, t('digest.regenerate')),
        h(Btn, { small: true, variant: 'ghost', onClick: props.onCopyPath }, props.copied ? t('digest.copied') : t('digest.copyPath')),
        file.prUrl === undefined
          ? null
          : h(
              'a',
              { className: 'dshgt-btn dshgt-btn-sm dshgt-btn-ghost', href: file.prUrl, target: '_blank', rel: 'noreferrer' },
              t('digest.openPr'),
            ),
      ),
      metaKeys.length === 0
        ? null
        : h(
            Disclosure,
            {
              className: 'dshgt-meta-panel',
              summary: [
                h('span', { key: 'label' }, t('digest.meta.toggle')),
                h('span', { key: 'count', className: 'dshgt-disclosure-count' }, String(metaKeys.length)),
              ],
            },
            h(
              'dl',
              { className: 'dshgt-meta-list' },
              metaKeys.flatMap((key) => [
                h('dt', { key: `${key}-k` }, META_LABEL[key] === undefined ? key : t(META_LABEL[key])),
                h(
                  'dd',
                  { key: `${key}-v`, className: key === 'contentHash' ? 'dshgt-meta-hash' : undefined },
                  h('span', { className: 'dshgt-mono dshgt-meta-val' }, props.meta[key]),
                  key === 'contentHash'
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'dshgt-meta-copy',
                          onClick: () => props.onCopyField(key, props.meta[key] ?? ''),
                          title: t('digest.meta.copy'),
                          'aria-label': t('digest.meta.copy'),
                        },
                        props.copiedField === key ? t('digest.copied') : t('digest.copy'),
                      )
                    : null,
                ),
              ]),
            ),
          ),
    ),
  );
}

/** 降级提示：页面上只出现这一处，展开才给核心写的原因原文。 */
export function BoardNotice(props: { t: Translate; reason: string | undefined }): any {
  const { t } = props;
  return h(
    'section',
    { className: 'dshgt-notice', role: 'note' },
    h('span', { className: 'dshgt-notice-mark', 'aria-hidden': 'true' }, '!'),
    h(
      'div',
      { className: 'dshgt-notice-body' },
      h('strong', { className: 'dshgt-notice-title' }, t('digest.degraded.title')),
      h('p', { className: 'dshgt-notice-text' }, t('digest.degraded.desc')),
      props.reason === undefined
        ? null
        : h(
            'details',
            { className: 'dshgt-notice-more' },
            h('summary', null, t('digest.degraded.detail')),
            h('p', { className: 'dshgt-notice-reason' }, props.reason),
          ),
    ),
  );
}

function EmptyDigest(props: {
  t: Translate;
  lang: 'zh' | 'en';
  day: PeriodDay;
  nearest?: PeriodDay;
  error?: string;
  onOpenRuns: () => void;
  onSelect: (target: DigestTarget) => void;
  onRegenerate?: () => void;
  regenDisabled?: boolean;
}): any {
  const { t, lang, day, nearest } = props;
  const status: DigestStatus = props.error === undefined ? day.status : 'missing';
  return h(
    'section',
    { className: 'dshgt-board-card dshgt-digest-empty' },
    h(
      'div',
      { className: 'dshgt-status-line' },
      h('span', { className: `dshgt-lamp ${STATUS_LAMP[status]}` }),
      h('b', null, t(STATUS_LABEL[status])),
      h('span', { className: 'dshgt-dim' }, formatBucketLabel(day.period, day.bucket, lang)),
    ),
    h('h2', null, t(`digest.empty.${status}.title`)),
    h('p', null, t(`digest.empty.${status}.reason`)),
    day.record.errorCode === undefined && props.error === undefined
      ? null
      : h(
          'p',
          { className: 'dshgt-mono dshgt-digest-error' },
          [day.record.errorCode, day.record.errorMessage ?? props.error].filter((item) => item !== undefined && item !== '').join(' · '),
        ),
    h(
      'div',
      { className: 'dshgt-actions' },
      h(Btn, { small: true, onClick: props.onOpenRuns }, t('digest.empty.viewRuns')),
      props.onRegenerate === undefined
        ? null
        : h(Btn, { small: true, onClick: props.onRegenerate, disabled: props.regenDisabled === true }, t('digest.regenerate')),
      nearest === undefined
        ? null
        : h(
            Btn,
            { small: true, onClick: () => props.onSelect({ period: nearest.period, bucket: nearest.bucket }) },
            t('digest.empty.latest', { date: formatBucketLabel(nearest.period, nearest.bucket, lang) }),
          ),
    ),
  );
}

/** 把核心的降级说明（引用块）从正文里摘出来：同一句警告不在页面出现两次。 */
function pickDegradedReason(rendered: RenderedMarkdown | null): { reason: string | undefined; hideIndex: number } {
  if (rendered === null) return { reason: undefined, hideIndex: -1 };
  for (let index = 0; index < rendered.blocks.length; index += 1) {
    const block = rendered.blocks[index];
    if (block === undefined || block.type !== 'quote') continue;
    const text = block.children
      .map((child) => (child.type === 'text' ? child.value : ''))
      .join('')
      .trim();
    if (/降级|degraded/i.test(text)) return { reason: text, hideIndex: index };
  }
  return { reason: undefined, hideIndex: -1 };
}

export function DigestView(props: DigestProps): any {
  const { t, lang, store, selected, controller } = props;
  const [mode, setMode] = React.useState<'render' | 'raw'>('render');
  const [payload, setPayload] = React.useState<PreviewPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const state = store.state;
  const history = state?.status.history ?? [];
  const timeZone = state?.schedule.timezone ?? 'UTC';
  const groups = buildPeriodGroups(history, { timeZone });
  const groupMap = new Map(groups.map((group) => [group.period, group] as const));
  const activePeriod: Period = selected?.period ?? 'daily';
  const activeGroup = groupMap.get(activePeriod) ?? { period: activePeriod, days: [], previewCount: 0 };
  const days = activeGroup.days;
  // 打开时默认该周期最近一期「有预览」的期数；没有预览才回落到最近一条记录。
  const fallbackBucket = days.find((item) => item.status === 'preview')?.bucket ?? days[0]?.bucket;
  const requestedBucket = selected?.period === activePeriod ? selected.bucket : undefined;
  const effectiveBucket =
    requestedBucket !== undefined && days.some((day) => day.bucket === requestedBucket) ? requestedBucket : fallbackBucket;
  const day = days.find((item) => item.bucket === effectiveBucket);
  const index = day === undefined ? -1 : days.indexOf(day);
  const previewRunId =
    day !== undefined && day.status === 'preview' && day.record.preview !== undefined ? day.record.id : undefined;

  React.useEffect(() => {
    if (effectiveBucket === undefined) return;
    if (selected?.period !== activePeriod || selected?.bucket !== effectiveBucket) {
      props.onSelect({ period: activePeriod, bucket: effectiveBucket });
    }
  }, [activePeriod, effectiveBucket, selected?.period, selected?.bucket, props.onSelect]);

  // 「已复制」到点自动恢复，卸载时清掉计时器。
  React.useEffect(() => {
    if (copied === null) return undefined;
    const timer = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  React.useEffect(() => {
    setMode('render');
  }, [activePeriod, effectiveBucket]);

  React.useEffect(() => {
    if (previewRunId === undefined) {
      setPayload(null);
      setError(null);
      setLoading(false);
      return () => undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPayload(null);
    getPreview(previewRunId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setPayload(result);
        setLoading(false);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : String(failure));
        setLoading(false);
      });
    return () => controller.abort();
  }, [previewRunId]);

  if (state === null) {
    return h('div', { className: 'dshgt-empty' }, store.error ?? t('quickfill.loading'));
  }

  const nearest = day === undefined ? undefined : days.find((item) => item.status === 'preview' && item.bucket !== day.bucket);

  let rendered: RenderedMarkdown | null = null;
  let parseFailed = false;
  if (payload !== null) {
    try {
      rendered = renderMarkdown(payload.preview.text);
    } catch {
      parseFailed = true;
    }
  }

  const dateText =
    day === undefined ? t('digest.window.empty') : formatBucketLabel(activePeriod, day.bucket, lang);
  const bar = h(BoardBar, {
    t,
    groups: groups.map((group) => ({ period: group.period, count: group.days.length, active: group.period === activePeriod })),
    onPeriod: (period: Period) => {
      const target = groupMap.get(period);
      const bucket = target?.days.find((item) => item.status === 'preview')?.bucket ?? target?.days[0]?.bucket ?? '';
      props.onSelect({ period, bucket });
    },
    dateText,
    statusText: day === undefined ? '—' : t(STATUS_LABEL[day.status]),
    bucket: effectiveBucket ?? '',
    buckets: days.map((item) => ({
      value: item.bucket,
      label: `${formatBucketLabel(activePeriod, item.bucket, lang)} · ${t(STATUS_TAG[item.status])}`,
    })),
    onBucket: (value: string) => props.onSelect({ period: activePeriod, bucket: value }),
    onPrev: () => {
      const target = days[index + 1];
      if (target !== undefined) props.onSelect({ period: activePeriod, bucket: target.bucket });
    },
    onNext: () => {
      const target = days[index - 1];
      if (target !== undefined) props.onSelect({ period: activePeriod, bucket: target.bucket });
    },
    prevDisabled: index < 0 || index >= days.length - 1,
    nextDisabled: index <= 0,
    windowText:
      days.length === 0
        ? t('digest.window.empty')
        : activeGroup.previewCount >= days.length
          ? t('digest.window.count', { count: days.length })
          : t('digest.window.period', { count: days.length, previews: activeGroup.previewCount }),
    onOpenRuns: props.onOpenRuns,
  });

  if (day === undefined) {
    return h(
      'div',
      { className: 'dshgt-view dshgt-digest' },
      bar,
      h(
        'section',
        { className: 'dshgt-board-card dshgt-digest-empty' },
        h('h2', null, t('digest.empty.none.title')),
        h('p', null, t('digest.empty.none.reason')),
        h('div', { className: 'dshgt-actions' }, h(Btn, { small: true, onClick: props.onOpenRuns }, t('digest.empty.viewRuns'))),
      ),
    );
  }

  const showEmpty = day.status !== 'preview' || error !== null;
  const record = day.record;
  // 「重新生成这一期」：按该期代表日期 + 周期 force 重跑，跑完刷新后停留在同一期。
  const regenerate = (): void => {
    const target = regenTarget(day);
    props.onSelect({ period: target.period, bucket: day.bucket });
    void controller.run(false, { force: true, date: target.date, period: target.period });
  };
  const regenerateDisabled = controller.running || controller.busy;
  const degraded = rendered !== null && rendered.meta.degraded === 'true';
  const { reason: degradedReason, hideIndex } = pickDegradedReason(rendered);
  const nodes =
    rendered === null
      ? []
      : hideIndex === -1
        ? rendered.nodes
        : rendered.nodes.filter((_, nodeIndex) => nodeIndex !== hideIndex);
  const stats = rendered === null ? { repos: 0, newStars: 0, languages: 0 } : collectBoardStats(rendered.blocks);

  return h(
    'div',
    { className: 'dshgt-view dshgt-digest' },
    bar,
    showEmpty
      ? h(EmptyDigest, {
          t,
          lang,
          day,
          ...(nearest === undefined ? {} : { nearest }),
          ...(error === null ? {} : { error }),
          onOpenRuns: props.onOpenRuns,
          onSelect: props.onSelect,
          onRegenerate: regenerate,
          regenDisabled: regenerateDisabled,
        })
      : h(
          React.Fragment,
          null,
          rendered === null
            ? null
            : h(BoardOverview, {
                t,
                status: day.status,
                stats,
                degraded,
                file: {
                  name: record.preview?.file ?? '—',
                  ...(record.preview === undefined ? {} : { bytes: record.preview.bytes }),
                  truncated: payload?.preview.truncated === true,
                  ...(record.prUrl === undefined ? {} : { prUrl: record.prUrl }),
                },
                mode,
                onMode: setMode,
                onRegenerate: regenerate,
                regenDisabled: regenerateDisabled,
                onCopyPath: () => {
                  const file = record.preview?.file;
                  if (file === undefined) return;
                  void copyText(file).then((ok) => {
                    if (ok) setCopied('path');
                  });
                },
                copied: copied === 'path',
                meta: rendered.meta,
                copiedField: copied === null ? undefined : copied,
                onCopyField: (key: string, value: string) => {
                  void copyText(value).then((ok) => {
                    if (ok) setCopied(key);
                  });
                },
              }),
          degraded || degradedReason !== undefined
            ? h(BoardNotice, { t, reason: degradedReason })
            : null,
          h(
            'section',
            { className: 'dshgt-board-sheet' },
            loading || payload === null
              ? h('div', { className: 'dshgt-digest-loading' }, t('digest.loading'))
              : mode === 'raw' || parseFailed
                ? h('pre', { className: 'dshgt-digest-raw' }, payload.preview.text)
                : h('div', { className: 'dshgt-md dshgt-board-doc' }, nodes),
          ),
        ),
  );
}

/** 供静态预览与测试使用的最小渲染单元：只吃已准备好的数据，不订阅 store。 */
export function DigestBoardFixture(props: {
  t: Translate;
  lang: 'zh' | 'en';
  markdown: string;
  meta: Record<string, string>;
  file: { name: string; bytes?: number; truncated?: boolean; prUrl?: string };
  status?: DigestStatus;
  mode?: 'render' | 'raw';
}): any {
  const rendered = renderMarkdown(props.markdown);
  const degraded = rendered.meta.degraded === 'true';
  const { reason, hideIndex } = pickDegradedReason(rendered);
  const body =
    hideIndex === -1 ? rendered.nodes : rendered.nodes.filter((_, nodeIndex) => nodeIndex !== hideIndex);
  return h(
    'div',
    { className: 'dshgt-view dshgt-digest' },
    h(BoardOverview, {
      t: props.t,
      status: props.status ?? 'preview',
      stats: collectBoardStats(rendered.blocks),
      degraded,
      file: { name: props.file.name, bytes: props.file.bytes, truncated: props.file.truncated === true, prUrl: props.file.prUrl },
      mode: props.mode ?? 'render',
      onMode: () => undefined,
      onRegenerate: () => undefined,
      regenDisabled: false,
      onCopyPath: () => undefined,
      copied: false,
      meta: props.meta,
      copiedField: undefined,
      onCopyField: () => undefined,
    }),
    degraded ? h(BoardNotice, { t: props.t, reason }) : null,
    h('section', { className: 'dshgt-board-sheet' }, h('div', { className: 'dshgt-md dshgt-board-doc' }, body)),
  );
}




