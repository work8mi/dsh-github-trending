/**
 * 概览：第一屏回答「下次什么时候跑 / 现在能不能跑 / 上次交付了什么」。
 *
 * 所有状态都来自 `/state`；运行中只显示开始时间、已用时与「核心执行中」，
 * 不伪造九步百分比。PR 不写「已合并」——state 无法区分 merged/closed。
 *
 * 顺序按问题的重要性排：下次运行 → 上次交付 → 用量 → 缺什么 → 历史各期。
 * 「下次运行」在这里常驻（外壳的同一条在窄栏会被收起），首次使用给可点的下一步而不是一句空话。
 */
import { Btn, Pill, React, copyText, duration, formatTokens, h, localTime, nextRunText, relativeFuture, shortHash } from './ui.js';
import type { Translate } from './i18n.js';
import type { DigestTarget, RunRecord, StatePayload } from './api.js';
import type { SettingsSection } from './settings.js';
import type { StoreValue } from './store.js';
import { reasonHint } from './error-copy.js';
import type { RunController } from './run-controller.js';
import { LiveRun } from './live-run.js';
import { credentialView } from './credential.js';
import {
  buildPeriodGroups,
  digestTarget,
  formatBucketLabel,
  PERIODS,
  zonedDateString,
  type DigestStatus,
  type Period,
} from './digest-core.js';

const COPIED_TTL_MS = 1500;

export interface OverviewProps {
  t: Translate;
  lang: 'zh' | 'en';
  store: StoreValue;
  controller: RunController;
  onOpenDigest: (target?: DigestTarget) => void;
  onOpenRuns: () => void;
  onOpenSettings: (section?: SettingsSection) => void;
}

function statusPill(t: Translate, record: RunRecord): any {
  if (!record.ok) return h(Pill, { kind: 'err' }, t('state.failed'));
  if (record.skipped) return h(Pill, { kind: 'warn' }, t('state.skipped'));
  if (record.kind === 'dry-run') return h(Pill, { kind: 'warn' }, t('state.dry'));
  return h(Pill, { kind: 'ok' }, t('state.ok'));
}

const STATUS_LAMP: Record<DigestStatus, string> = {
  preview: 'ok',
  failed: 'err',
  skipped: 'warn',
  dry: 'warn',
  legacy: 'warn',
  missing: 'warn',
};

/** 状态词：成功也写「成功」，时长另占一行，避免同一行前两期是状态、后三期是耗时。 */
function statusWord(t: Translate, status: DigestStatus): string {
  switch (status) {
    case 'preview':
      return t('state.ok');
    case 'failed':
      return t('state.failed');
    case 'skipped':
      return t('state.skipped');
    case 'dry':
      return t('state.dry');
    case 'legacy':
      return t('digest.tag.legacy');
    case 'missing':
      return t('digest.tag.missing');
  }
}

/** 交付卡标题跟着运行结果变：失败/无变更/试跑不能再叫「今天的榜单」。 */
function deliveryTitle(t: Translate, record: RunRecord): string {
  if (!record.ok) return t('overview.last.digestFailed');
  if (record.skipped) return t('overview.last.digestSkipped');
  if (record.kind === 'dry-run') return t('overview.last.digestDry');
  return record.preview === undefined ? t('overview.last.digestNoPreview') : t('overview.last.digestOk');
}

function prLabel(t: Translate, state: StatePayload, record: RunRecord | null): { label: string; url?: string; kind: 'warn' | 'ok' | 'idle' } | null {
  if (record === null || record.prUrl === undefined) {
    if (record !== null && record.ok && !record.skipped && record.kind !== 'dry-run' && state.settings.repo.commitMode === 'direct') {
      return { label: t('overview.last.direct'), kind: 'idle' };
    }
    return null;
  }
  const pending = state.status.pendingPr;
  const matches = pending !== null && pending.url === record.prUrl;
  if (matches && state.status.pendingPrState === 'unknown') {
    return { label: t('overview.last.prUnknown'), url: record.prUrl, kind: 'warn' };
  }
  if (matches) return { label: t('overview.last.prPending'), url: record.prUrl, kind: 'warn' };
  return { label: t('overview.last.prCreated'), url: record.prUrl, kind: 'ok' };
}

/** 就绪检查的四行；壳层也复用它算「还差几项」和缺的是哪些。 */
export interface ReadyRow {
  ok: boolean;
  label: string;
  value: string;
  extra?: string;
  /** 低频细节（wire 版本），收进 title，不占正文。 */
  detail?: string;
  section: SettingsSection;
}

export function readyRows(t: Translate, state: StatePayload): ReadyRow[] {
  const core = state.core;
  const credential = credentialView(state.model, t);
  const repo = state.settings.repo;
  return [
    {
      ok: core.state === 'ready',
      label: t('overview.ready.core'),
      value: core.state === 'ready' ? `${core.version ?? '—'} · ${t('core.ready')}` : t(`core.${core.state}`),
      section: 'source',
      ...(core.ipcSchema === undefined ? {} : { detail: `ipc ${core.ipcSchema} · digest ${core.digestSchema ?? '—'}` }),
    },
    {
      ok: credential.ok,
      label: t('overview.ready.model'),
      value: `${state.settings.model.provider} / ${state.settings.model.model || '—'}`,
      extra: credential.label,
      section: 'model',
    },
    {
      ok: repo.path.trim() !== '',
      label: t('overview.ready.repo'),
      value: repo.path.trim() === '' ? t('repo.path.empty') : repo.path,
      extra: repo.commitMode === 'direct' ? t('repo.commitMode.direct') : t('repo.commitMode.branch'),
      section: 'repo',
    },
    {
      ok: state.github.configured,
      label: t('overview.ready.github'),
      value: state.github.configured ? t('auth.configured') : t('auth.missing'),
      extra: `${state.github.authMode}${state.github.source === '' ? '' : ` · ${state.github.source}`}`,
      section: 'auth',
    },
  ];
}

/** 速览卡里的一格：标签 + 数值 + 可选单位（如 tokens）。 */
function glanceCell(label: string, value: string, unit?: string): any {
  return h(
    'div',
    { className: 'dshgt-glance-cell' },
    h('span', { className: 'dshgt-glance-label' }, label),
    h(
      'span',
      { className: 'dshgt-glance-val' },
      h('span', { className: 'dshgt-glance-num dshgt-mono' }, value),
      unit === undefined ? null : h('span', { className: 'dshgt-glance-unit' }, unit),
    ),
  );
}

/** 一张速览卡；没有可用数据时整体不渲染（旧核心/无数据不留空壳）。 */
function glanceCard(title: string, cells: any[]): any {
  if (cells.length === 0) return null;
  return h(
    'div',
    { className: 'dshgt-glance' },
    h('div', { className: 'dshgt-glance-k' }, title),
    h('div', { className: 'dshgt-glance-vs' }, cells),
  );
}

/** 一格事实：截断的值留 title，并给键盘可达的复制入口；复制回执 1.5 s 自动退场。 */
function FactCell(props: { t: Translate; label: string; value: string; copy?: boolean; copyValue?: string }): any {
  const [copiedAt, setCopiedAt] = React.useState(0);
  React.useEffect(() => {
    if (copiedAt === 0) return () => undefined;
    const timer = setTimeout(() => setCopiedAt(0), COPIED_TTL_MS);
    return () => clearTimeout(timer);
  }, [copiedAt]);
  // 展示值可能被截断（hash 只显示前 10 位），复制走完整值，否则「复制完整值」名不副实。
  const full = props.copyValue ?? props.value;
  const copy = (): void => {
    void copyText(full).then((ok) => {
      if (ok) setCopiedAt(Date.now());
    });
  };
  return h(
    'div',
    { className: 'dshgt-fact' },
    h('div', { className: 'dshgt-fact-k' }, props.label),
    h(
      'div',
      { className: 'dshgt-fact-v', title: full },
      h('span', null, props.value),
      props.copy === true && full !== '—'
        ? h(
            'button',
            {
              type: 'button',
              className: `dshgt-fact-copy${copiedAt === 0 ? '' : ' is-copied'}`,
              title: props.t('overview.copyFull'),
              onClick: copy,
            },
            copiedAt === 0 ? props.t('overview.copy') : props.t('overview.copied'),
          )
        : null,
    ),
  );
}

export function OverviewView(props: OverviewProps): any {
  const { t, lang, store, controller } = props;
  const state = store.state;
  const [activePeriod, setActivePeriod] = React.useState<Period>('daily');
  if (state === null) {
    return h('div', { className: 'dshgt-empty' }, store.error ?? t('quickfill.loading'));
  }

  const last = state.status.lastResult ?? state.status.history[0] ?? null;
  const pr = prLabel(t, state, last);
  const rows = readyRows(t, state);
  const timeZone = state.schedule.timezone;
  const today = zonedDateString(new Date(), timeZone);
  // 三榜（日/周/月）各自成组，只展示真正有记录的期数，不再为空白日期占位。
  const groups = buildPeriodGroups(state.status.history, { timeZone });
  const groupMap = new Map(groups.map((group) => [group.period, group] as const));
  const enabledPeriods = PERIODS.filter((period) => state.schedule.periods.includes(period));
  const periods = enabledPeriods.length > 0 ? enabledPeriods : PERIODS;
  const period: Period = periods.includes(activePeriod) ? activePeriod : (periods[0] ?? 'daily');
  const activeDays = groupMap.get(period)?.days ?? [];
  // 日榜最多展示最近 7 期；周/月榜历史本身有限，全部展示。
  const recent = period === 'daily' ? activeDays.slice(0, 7) : activeDays;
  // 今天还没跑、且调度开着：日榜给一个「等待 {time}」提示位（不算空日期，只是状态）。
  const todayHasDaily = groupMap.get('daily')?.days.some((day) => day.date === today) ?? false;
  const showWaiting = period === 'daily' && !todayHasDaily && state.schedule.enabled;
  const lastTarget = last === null ? undefined : digestTarget(last, timeZone);
  // 速览只展示确有数据的格子；旧核心 / 无用量时整卡隐藏，不铺一排「—」。
  const lastTokens = last?.tokens;
  const releases = last?.releases;
  const totalTokens = state.status.totalTokens;
  const tokenCells = [
    ...(lastTokens === undefined ? [] : [glanceCell(t('overview.tokens.thisRun'), formatTokens(lastTokens), 'tokens')]),
    ...(totalTokens === undefined ? [] : [glanceCell(t('overview.tokens.total'), formatTokens(totalTokens), 'tokens')]),
  ];
  const releaseCells = releases === undefined
    ? []
    : [
        glanceCell(t('overview.releases.new'), String(releases.newReleases)),
        glanceCell(t('overview.releases.repos'), String(releases.repos)),
      ];
  const glanceCards = [
    glanceCard(t('overview.tokens.title'), tokenCells),
    glanceCard(t('overview.releases.title'), releaseCells),
  ].filter((card) => card !== null);

  // 下次运行：时刻跟调度时区走；同一个挂钟只在 title 里再标注一次时区，避免两个挂钟互相打架。
  const scheduleOn = state.schedule.enabled;
  const tzHint = timeZone === '' ? undefined : t('overview.tz', { tz: timeZone });
  const nextValue = !scheduleOn
    ? t('shell.scheduleOff')
    : state.schedule.nextRunAt === undefined
      ? `${state.schedule.time} · ${timeZone}`
      : nextRunText(state.schedule.nextRunAt);
  const relNext = scheduleOn && state.schedule.nextRunAt !== undefined ? relativeFuture(state.schedule.nextRunAt, t) : undefined;
  const missing = rows.filter((row) => !row.ok);
  const dateText = last === null ? '' : last.date ?? localTime(last.at);
  const dateDetail = last === null || last.at === undefined || tzHint === undefined
    ? undefined
    : `${localTime(last.at)} · ${tzHint}`;

  return h(
    'div',
    { className: 'dshgt-view dshgt-overview' },
    controller.running ? h(LiveRun, { t, controller, startedAt: controller.startedAt }) : null,
    controller.error === null
      ? null
      : h(
          'div',
          { className: 'dshgt-alert err', role: 'alert' },
          h(
            'div',
            { className: 'dshgt-alert-row' },
            h('span', null, controller.error),
            h(
              'button',
              {
                type: 'button',
                className: 'dshgt-alert-dismiss',
                title: t('overview.last.dismiss'),
                'aria-label': t('overview.last.dismiss'),
                onClick: controller.clearError,
              },
              '×',
            ),
          ),
        ),

    h(
      'div',
      { className: 'dshgt-nextrow' },
      h('span', { className: 'dshgt-nextrow-key' }, t('shell.nextRun')),
      h('span', { className: 'dshgt-nextrow-val', title: scheduleOn ? tzHint : undefined }, nextValue),
      relNext === undefined ? null : h('span', { className: 'dshgt-nextrow-rel' }, relNext),
      scheduleOn
        ? null
        : h('button', { type: 'button', className: 'dshgt-linkbtn', onClick: () => props.onOpenSettings('scope') }, t('overview.next.configure')),
    ),

    last === null
      ? h(
          'section',
          { className: 'dshgt-guide' },
          h('h2', null, t('overview.empty.title')),
          h('p', { className: 'dshgt-guide-desc' }, t('overview.empty.desc')),
          missing.length === 0
            ? null
            : h(
                'p',
                { className: 'dshgt-guide-note' },
                t('run.blocked', { count: missing.length, items: missing.map((row) => row.label).join(t('overview.listSep')) }),
              ),
          h(
            'div',
            { className: 'dshgt-guide-actions' },
            h(
              Btn,
              {
                variant: 'primary',
                disabled: controller.running || controller.busy || missing.length > 0,
                onClick: () => void controller.run(),
              },
              t('overview.empty.run'),
            ),
            h('button', { type: 'button', className: 'dshgt-linkbtn', onClick: () => props.onOpenSettings() }, t('overview.empty.settings')),
          ),
        )
      : h(
          'section',
          { className: 'dshgt-delivery' },
          h(
            'div',
            { className: 'dshgt-delivery-top' },
            statusPill(t, last),
            h('span', { className: `dshgt-pchip ${last.period ?? 'daily'}` }, t(`period.${last.period ?? 'daily'}`)),
            h('span', { className: 'dshgt-hint', title: dateDetail }, dateText),
            h(
              'span',
              { className: 'dshgt-pill-mini' },
              `${t('overview.last.files', { count: last.files })} · ${duration(last.durationMs)}`,
            ),
            last.legacy === true ? h('span', { className: 'dshgt-tag' }, t('runs.legacy')) : null,
          ),
          h('h2', null, deliveryTitle(t, last)),
          h(
            'div',
            { className: 'dshgt-when' },
            last.branch === undefined ? null : h('span', null, `${t('run.usage.branch')} `, h('span', { className: 'dshgt-mono' }, last.branch)),
            pr === null
              ? null
              : pr.url === undefined
                ? h('span', { className: 'dshgt-hint' }, pr.label)
                : h('a', { href: pr.url, target: '_blank', rel: 'noreferrer' }, pr.label),
          ),
          last.ok
            ? null
            : h(
                'div',
                { className: 'dshgt-alert err dshgt-delivery-error', role: 'alert' },
                h('b', null, `${t('error.prefix')} ${last.errorCode ?? 'INTERNAL'}`),
                h('div', null, last.errorMessage ?? t('state.failed')),
                last.errorReason === undefined
                  ? null
                  : h('div', { className: 'dshgt-hint' }, reasonHint(t, last.errorReason) ?? ''),
                h(
                  'div',
                  { className: 'dshgt-alert-actions' },
                  h(
                    Btn,
                    {
                      small: true,
                      disabled: controller.running || controller.busy || missing.length > 0,
                      onClick: () => void controller.run(false, { force: true }),
                    },
                    t('overview.last.retry'),
                  ),
                ),
              ),
          h(
            'div',
            { className: 'dshgt-artifacts' },
            last.preview === undefined
              ? h('span', { className: 'dshgt-hint' }, t('overview.last.noPreview'))
              : h(
                  'span',
                  { className: 'dshgt-filechip dshgt-filechip-static', title: last.preview.file },
                  h('span', { className: 'dshgt-mono' }, last.preview.file),
                ),
            last.preview === undefined
              ? null
              : h(Btn, { small: true, onClick: () => { if (lastTarget !== undefined) props.onOpenDigest(lastTarget); } }, t('overview.last.read')),
            pr === null || pr.url === undefined ? null : h(
              'a',
              { className: 'dshgt-btn dshgt-btn-sm', href: pr.url, target: '_blank', rel: 'noreferrer' },
              t('digest.openPr'),
            ),
          ),
          h(
            'div',
            { className: 'dshgt-facts' },
            h(FactCell, { t, label: t('run.usage.commit'), value: last.commit === undefined ? '—' : last.commit, copy: true }),
            h(FactCell, { t, label: t('run.usage.hash'), value: shortHash(last.contentHash), copy: true, copyValue: last.contentHash }),
            h(FactCell, { t, label: t('run.usage.core'), value: last.coreVersion || '—' }),
            h(FactCell, { t, label: t('overview.model'), value: last.model?.model ?? '—' }),
          ),
        ),

    glanceCards.length === 0
      ? null
      : h(
          'section',
          { className: 'dshgt-block dshgt-usage-glance' },
          h('div', { className: 'dshgt-glance-grid' }, glanceCards),
          h('p', { className: 'dshgt-hint dshgt-glance-note' }, t('overview.tokens.note')),
        ),

    h(
      'section',
      { className: 'dshgt-block' },
      h('h2', { className: 'dshgt-section-label' }, t('overview.ready.title')),
      h(
        'div',
        { className: 'dshgt-ready-list' },
        rows.map((row) =>
          h(
            'div',
            { className: 'dshgt-ready-row', key: row.label },
            h('span', { className: `dshgt-lamp ${row.ok ? 'ok' : 'warn'}` }),
            h('span', { className: 'dshgt-ready-label' }, row.label),
            h(
              'span',
              { className: 'dshgt-ready-value', title: row.detail },
              row.value,
              row.extra === undefined ? null : h('span', { className: 'dshgt-ready-extra' }, `· ${row.extra}`),
            ),
            h(
              'button',
              { type: 'button', className: 'dshgt-linkbtn', onClick: () => props.onOpenSettings(row.section) },
              row.ok ? t('overview.ready.view') : t('overview.ready.fix'),
            ),
          ),
        ),
      ),
    ),

    h(
      'section',
      { className: 'dshgt-block' },
      h(
        'div',
        { className: 'dshgt-section-row' },
        h('h2', { className: 'dshgt-section-label' }, t('overview.week.title')),
        h('button', { type: 'button', className: 'dshgt-linkbtn', onClick: props.onOpenRuns }, t('overview.week.all')),
      ),
      periods.length > 1
        ? h(
            'div',
            { className: 'dshgt-period-seg dshgt-overview-seg', role: 'group', 'aria-label': t('overview.week.selectPeriod') },
            periods.map((item) => {
              const on = item === period;
              const count = groupMap.get(item)?.days.length ?? 0;
              return h(
                'button',
                {
                  key: item,
                  type: 'button',
                  'aria-pressed': on ? 'true' : 'false',
                  className: on ? 'on' : '',
                  onClick: () => setActivePeriod(item),
                },
                h('span', null, t(`period.${item}`)),
                h('span', { className: 'dshgt-period-count' }, String(count)),
              );
            }),
          )
        : null,
      recent.length === 0 && !showWaiting
        ? h('div', { className: 'dshgt-hint dshgt-overview-empty' }, t('overview.week.empty'))
        : h(
            'div',
            { className: 'dshgt-week' },
            recent.map((day) =>
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshgt-day dshgt-day-clickable',
                  key: day.bucket,
                  onClick: () => props.onOpenDigest({ period, bucket: day.bucket }),
                  title:
                    day.record.errorCode === undefined
                      ? formatBucketLabel(period, day.bucket, lang)
                      : `${formatBucketLabel(period, day.bucket, lang)} · ${day.record.errorCode}`,
                },
                h('div', { className: 'dshgt-day-date' }, shortBucket(period, day.bucket)),
                h('div', { className: 'dshgt-day-status' }, h('span', { className: `dshgt-lamp ${STATUS_LAMP[day.status]}` }), statusWord(t, day.status)),
                day.status === 'preview' ? h('div', { className: 'dshgt-day-note' }, duration(day.record.durationMs)) : null,
              ),
            ),
            showWaiting
              ? h(
                  'div',
                  { className: 'dshgt-day' },
                  h('div', { className: 'dshgt-day-date' }, today.slice(5).replace('-', '/')),
                  h('div', { className: 'dshgt-day-status' }, t('overview.week.wait', { time: state.schedule.time })),
                )
              : null,
          ),
    ),
  );
}

/** 榜单格子上的短标签：日=MM/DD、周=Wnn、月=YY/MM。 */
function shortBucket(period: Period, bucket: string): string {
  if (period === 'daily') return bucket.slice(5).replace('-', '/');
  if (period === 'weekly') return bucket.slice(5);
  return bucket.slice(2).replace('-', '/');
}
