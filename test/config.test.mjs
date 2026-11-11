import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config, importCli } from '../lib/internal.js';

test('默认值合理且未知字段被丢弃', () => {
  const settings = config.normalizeSettings({ model: { provider: 'deepseek', nope: 1 }, extra: true });
  assert.equal(settings.model.provider, 'deepseek');
  assert.equal(settings.model.mode, 'direct');
  assert.equal(settings.repo.baseBranch, 'main');
  assert.equal(settings.schedule.time, '08:30:00');
  assert.equal(settings.schedule.timezone, 'Asia/Shanghai');
  assert.equal('extra' in settings, false);
  assert.equal('nope' in settings.model, false);
});

test('校验拦下缺模型、缺仓库、坏时区与不支持的 provider', () => {
  const problems = config.validateSettings(config.normalizeSettings({}), ['deepseek', 'openai-compatible']);
  const fields = problems.map((problem) => problem.field);
  assert.ok(fields.includes('model.model'));
  assert.ok(fields.includes('repo.path'));

  const badProvider = config.validateSettings(
    config.normalizeSettings({ model: { provider: 'anthropic', model: 'x', baseURL: 'https://a.b/v1' }, repo: { path: '/tmp/x' } }),
    ['deepseek'],
  );
  assert.equal(badProvider[0].code, 'MODEL_PROVIDER_UNSUPPORTED');

  const badTz = config.validateSettings(
    config.normalizeSettings({ model: { provider: 'deepseek', model: 'x' }, repo: { path: '/tmp/x' }, schedule: { timezone: 'Mars/Base' } }),
    ['deepseek'],
  );
  assert.ok(badTz.some((problem) => problem.field === 'schedule.timezone'));
});

test('provider 默认端点与代理模式的 baseURL 处理', () => {
  const settings = config.normalizeSettings({ model: { provider: 'deepseek', model: 'deepseek-chat' }, repo: { path: '/tmp/x' } });
  assert.equal(config.effectiveBaseURL(settings.model), 'https://api.deepseek.com/v1');
  const proxy = config.normalizeSettings({ model: { provider: 'openai-compatible', mode: 'proxy', model: 'm', baseURL: 'https://ignored' }, repo: { path: '/tmp/x' } });
  const coreConfig = config.toCoreConfig(proxy, 'KEY', 'http://127.0.0.1:1234/v1');
  assert.equal(coreConfig.model.baseURL, 'http://127.0.0.1:1234/v1');
  assert.equal(coreConfig.model.apiKey, 'KEY');
  assert.equal(coreConfig.pr.enabled, true);
});

test('toYaml 生成的配置能被自己的 YAML 子集解析器读回', () => {
  const settings = config.normalizeSettings({ model: { provider: 'deepseek', model: 'deepseek-chat' }, repo: { path: '/tmp/x' }, trending: { languages: ['all', 'go'] } });
  const yaml = config.toYaml(config.toCoreConfig(settings, 'sk-test'));
  const parsed = importCli.parseSimpleYaml(yaml);
  assert.equal(parsed.model.name, 'deepseek-chat');
  assert.equal(parsed.model.apiKey, 'sk-test');
  assert.deepEqual(parsed.trending.languages, ['all', 'go']);
  assert.equal(parsed.repo.path, '/tmp/x');
  assert.equal(parsed.output.retentionDays, 90);
});

test('direct 提交模式不会写 PR 开关', () => {
  const settings = config.normalizeSettings({ model: { provider: 'deepseek', model: 'm' }, repo: { path: '/tmp/x', commitMode: 'direct' } });
  assert.equal(config.toCoreConfig(settings, 'k').pr.enabled, false);
});

test('分支模式下多周期合并到同一天的分支，避免 index.md 兄弟冲突', () => {
  const branch = config.normalizeSettings({
    model: { provider: 'deepseek', model: 'm' },
    repo: { path: '/tmp/x' },
  });
  assert.equal(config.toCoreConfig(branch, 'k').output.branchGrouping, 'per-date');

  const direct = config.normalizeSettings({
    model: { provider: 'deepseek', model: 'm' },
    repo: { path: '/tmp/x', commitMode: 'direct' },
    schedule: { periods: ['daily', 'weekly'] },
  });
  assert.equal(config.toCoreConfig(direct, 'k').output.branchGrouping, 'per-period');
});

test('代理模式允许空 baseURL，direct 仍需显式端点', () => {
  const providers = ['deepseek', 'openai-compatible'];
  const proxy = config.normalizeSettings({ model: { provider: 'openai-compatible', mode: 'proxy', model: 'm' }, repo: { path: '/tmp/x' } });
  assert.equal(config.effectiveBaseURL(proxy.model), '');
  assert.equal(config.validateSettings(proxy, providers).some((problem) => problem.field === 'model.baseURL'), false);

  const direct = config.normalizeSettings({ model: { provider: 'openai-compatible', mode: 'direct', model: 'm' }, repo: { path: '/tmp/x' } });
  assert.ok(config.validateSettings(direct, providers).some((problem) => problem.field === 'model.baseURL'));
});

test('分段合并只覆盖目标分区，字段归位正确', () => {
  const stored = config.normalizeSettings({ model: { provider: 'deepseek', model: 'deepseek-chat' }, repo: { path: '/tmp/a' }, trending: { languages: ['all', 'go'] } });
  const incoming = config.normalizeSettings({ model: { provider: 'openai-compatible', mode: 'proxy', model: '' }, repo: { path: '/tmp/b' }, trending: { languages: ['all', 'python', 'rust'] } });

  const repoMerged = config.mergeSettingsSection(stored, incoming, 'repo');
  assert.equal(repoMerged.repo.path, '/tmp/b');
  assert.equal(repoMerged.model.provider, 'deepseek'); // 其它分区保持已保存值
  assert.deepEqual(repoMerged.trending.languages, ['all', 'go']);

  const modelMerged = config.mergeSettingsSection(stored, incoming, 'model');
  assert.equal(modelMerged.model.provider, 'openai-compatible');
  assert.equal(modelMerged.repo.path, '/tmp/a');
  assert.deepEqual(modelMerged.trending.languages, ['all', 'go']);

  assert.equal(config.sectionOfField('model.baseURL'), 'model');
  assert.equal(config.sectionOfField('output.dir'), 'repo');
  assert.equal(config.sectionOfField('github.tokenRef'), 'auth');
  assert.equal(config.sectionOfField('trending.languages'), 'scope');
  assert.equal(config.sectionOfField('schedule.timezone'), 'scope');
  assert.equal(config.sectionOfField('schedule.periods'), 'scope');
});

test('周期枚举：since 支持 monthly，非法值回落 daily', () => {
  assert.equal(config.normalizeSettings({ trending: { since: 'monthly' } }).trending.since, 'monthly');
  assert.equal(config.normalizeSettings({ trending: { since: 'weekly' } }).trending.since, 'weekly');
  assert.equal(config.normalizeSettings({ trending: { since: 'hourly' } }).trending.since, 'daily');
});

test('schedule.periods：固定三周期全产出，任何输入都收敛为日/周/月', () => {
  assert.deepEqual(config.normalizeSettings({}).schedule.periods, ['daily', 'weekly', 'monthly']);
  // 旧版只存了 daily 也升级成三周期
  assert.deepEqual(config.normalizeSettings({ schedule: { periods: ['daily'] } }).schedule.periods, ['daily', 'weekly', 'monthly']);
  // 乱序/重复/非法值一律归一为规范三周期
  assert.deepEqual(
    config.normalizeSettings({ schedule: { periods: ['monthly', 'daily', 'daily', 'bogus'] } }).schedule.periods,
    ['daily', 'weekly', 'monthly'],
  );
  // 显式空数组也收敛为三周期（不再允许「一个都不选」）
  assert.deepEqual(config.normalizeSettings({ schedule: { periods: [] } }).schedule.periods, ['daily', 'weekly', 'monthly']);
});

test('校验：周期固定三周期，不再因 period 为空而报错', () => {
  const settings = config.normalizeSettings({
    model: { provider: 'deepseek', model: 'x' },
    repo: { path: '/tmp/x' },
    schedule: { enabled: true },
  });
  assert.equal(config.validateSettings(settings, ['deepseek']).some((problem) => problem.field === 'schedule.periods'), false);
});

test('toCoreConfig 用本次运行的 period 覆盖 trending.since', () => {
  const settings = config.normalizeSettings({ trending: { since: 'daily' } });
  assert.equal(config.toCoreConfig(settings, 'k').trending.since, 'daily');
  assert.equal(config.toCoreConfig(settings, 'k', undefined, 'weekly').trending.since, 'weekly');
  assert.equal(config.toCoreConfig(settings, 'k', undefined, 'monthly').trending.since, 'monthly');
});

test('summarize / releases 归一化默认值与未知字段丢弃', () => {
  const settings = config.normalizeSettings({ summarize: { enrich: 'readme', bogus: 1 }, releases: { enabled: true, period: 'weekly', perRepoLimit: 8 } });
  assert.equal(settings.summarize.enrich, 'readme');
  assert.equal('bogus' in settings.summarize, false);
  // 发版订阅常开：旧的 enabled 字段在归一化时丢弃，不再进 settings.json。
  assert.equal('enabled' in settings.releases, false);
  assert.equal(settings.releases.period, 'weekly');
  assert.equal(settings.releases.perRepoLimit, 8);
  // 默认值
  const defaults = config.normalizeSettings({});
  assert.equal(defaults.summarize.enrich, 'none');
  assert.equal(defaults.summarize.batchSize, 10);
  assert.equal('enabled' in defaults.releases, false);
  assert.equal(defaults.releases.period, 'weekly');
  assert.equal(defaults.releases.perRepoLimit, 10);
  assert.equal(defaults.releases.backfillLatest, 3);
  assert.equal(defaults.releases.summaryMaxChars, 1200);
  assert.equal(defaults.releases.docMaxLines, 600);
  assert.equal(defaults.releases.concurrency, 'auto');
  assert.equal(defaults.releases.budgetSeconds, 'auto');
  assert.deepEqual(defaults.releases.schedule, { enabled: true, weekday: 1, time: '08:00:00', timezone: 'Asia/Shanghai' });
  assert.equal(defaults.releases.fallbackToTags, true);
  assert.equal(defaults.releases.baselineOnFirstRun, true);
  // 非法 enrich / 非周期枚举的 period 回落默认；daily/monthly 是合法枚举，保留下来交给校验解释。
  assert.equal(config.normalizeSettings({ summarize: { enrich: 'bogus' } }).summarize.enrich, 'none');
  assert.equal(config.normalizeSettings({ releases: { period: 'hourly' } }).releases.period, 'weekly');
  assert.equal(config.normalizeSettings({ releases: { period: 'daily' } }).releases.period, 'daily');
  // auto / 显式数字 / 垃圾值
  assert.equal(config.normalizeSettings({ releases: { concurrency: 'auto' } }).releases.concurrency, 'auto');
  assert.equal(config.normalizeSettings({ releases: { concurrency: 3 } }).releases.concurrency, 3);
  assert.equal(config.normalizeSettings({ releases: { concurrency: '3' } }).releases.concurrency, 'auto');
  assert.equal(config.normalizeSettings({ releases: { budgetSeconds: 90.4 } }).releases.budgetSeconds, 90);
  // backfillLatest：显式数字取整透传；垃圾/缺省回落默认 3。
  assert.equal(config.normalizeSettings({ releases: { backfillLatest: 5 } }).releases.backfillLatest, 5);
  assert.equal(config.normalizeSettings({ releases: { backfillLatest: 2.6 } }).releases.backfillLatest, 3);
  assert.equal(config.normalizeSettings({ releases: { backfillLatest: 'x' } }).releases.backfillLatest, 3);
  assert.deepEqual(config.normalizeSettings({ releases: { schedule: { weekday: 3, time: '07:30', timezone: 'UTC' } } }).releases.schedule, {
    enabled: true,
    weekday: 3,
    time: '07:30',
    timezone: 'UTC',
  });
});

test('summarize / releases 校验边界', () => {
  const base = { model: { provider: 'deepseek', model: 'x' }, repo: { path: '/tmp/x' } };
  // 合法
  const ok = config.validateSettings(config.normalizeSettings(base), ['deepseek']);
  assert.equal(ok.some((p) => p.field.startsWith('summarize.') || p.field.startsWith('releases.')), false);
  // 越界 perRepoLimit / maxNotesChars
  const bad = config.validateSettings(
    config.normalizeSettings({ ...base, releases: { perRepoLimit: 25, maxNotesChars: 100 } }),
    ['deepseek'],
  );
  assert.ok(bad.some((p) => p.field === 'releases.perRepoLimit'));
  assert.ok(bad.some((p) => p.field === 'releases.maxNotesChars'));
});

test('releases 校验：只支持 weekly，新字段越界都落 releases.* 路径', () => {
  const base = { model: { provider: 'deepseek', model: 'x' }, repo: { path: '/tmp/x' } };
  const validate = (releases) => config.validateSettings(config.normalizeSettings({ ...base, releases }), ['deepseek']);

  // 只支持 weekly：daily/monthly 明确报错，且消息说明本版本限制。
  for (const period of ['daily', 'monthly']) {
    const problems = validate({ period });
    const problem = problems.find((p) => p.field === 'releases.period');
    assert.ok(problem, `${period} 必须被拦下`);
    assert.match(problem.message, /weekly|每周/);
  }

  const bad = validate({
    perRepoLimit: 21,
    summaryMaxChars: 400,
    docMaxLines: 20,
    concurrency: 9,
    budgetSeconds: 0,
    schedule: { weekday: 8, time: '8:00', timezone: 'Mars/Base' },
  });
  const fields = bad.map((p) => p.field);
  assert.ok(fields.includes('releases.perRepoLimit'));
  assert.ok(fields.includes('releases.summaryMaxChars'));
  assert.ok(fields.includes('releases.docMaxLines'));
  assert.ok(fields.includes('releases.concurrency'));
  assert.ok(fields.includes('releases.budgetSeconds'));
  assert.ok(fields.includes('releases.schedule.weekday'));
  assert.ok(fields.includes('releases.schedule.time'));
  assert.ok(fields.includes('releases.schedule.timezone'));
  // backfillLatest：默认 3；0 与 20 合法，-1 / 21 越界报错。
  assert.equal(validate({}).some((p) => p.field === 'releases.backfillLatest'), false);
  assert.equal(validate({ backfillLatest: 0 }).some((p) => p.field === 'releases.backfillLatest'), false);
  assert.equal(validate({ backfillLatest: 20 }).some((p) => p.field === 'releases.backfillLatest'), false);
  assert.ok(validate({ backfillLatest: -1 }).some((p) => p.field === 'releases.backfillLatest'));
  assert.ok(validate({ backfillLatest: 21 }).some((p) => p.field === 'releases.backfillLatest'));
  // 字段归位：全部落在 releases 分区（界面只回这一栏）。
  assert.equal(new Set(bad.map((p) => config.sectionOfField(p.field))).size, 1);
  assert.equal(config.sectionOfField('releases.schedule.weekday'), 'releases');

  // auto 合法；显式范围内的数字也合法。
  const autoOk = validate({ concurrency: 'auto', budgetSeconds: 'auto' });
  assert.equal(autoOk.some((p) => p.field === 'releases.concurrency' || p.field === 'releases.budgetSeconds'), false);
  const explicitOk = validate({ concurrency: 8, budgetSeconds: 300 });
  assert.equal(explicitOk.some((p) => p.field.startsWith('releases.concurrency') || p.field.startsWith('releases.budgetSeconds')), false);
});

test('toCoreConfig 映射 summarize.* 与 releases.* 到核心 YAML', () => {
  const settings = config.normalizeSettings({
    model: { provider: 'deepseek', model: 'm' },
    repo: { path: '/tmp/x' },
    summarize: { batchSize: 7, enrich: 'repo', readmeChars: 500 },
    releases: {
      includePrerelease: true,
      perRepoLimit: 3,
      backfillLatest: 5,
      maxNotesChars: 6000,
      summaryMaxChars: 900,
      docMaxLines: 300,
      period: 'weekly',
      schedule: { weekday: 5, time: '09:15:00', timezone: 'America/New_York' },
    },
  });
  const core = config.toCoreConfig(settings, 'k');
  assert.equal(core.summarize.batchSize, 7);
  assert.equal(core.summarize.enrich, 'repo');
  assert.equal(core.summarize.readmeChars, 500);
  // 插件侧没有开关，核心配置里恒为 true。
  assert.equal(core.releases.enabled, true);
  assert.equal(core.releases.includePrerelease, true);
  assert.equal(core.releases.perRepoLimit, 3);
  assert.equal(core.releases.backfillLatest, 5);
  assert.equal(core.releases.maxNotesChars, 6000);
  assert.equal(core.releases.summaryMaxChars, 900);
  assert.equal(core.releases.docMaxLines, 300);
  assert.equal(core.releases.weekStart, 'monday');
  // 核心只实现每周一次：无论如何都写 weekly。
  assert.equal(core.releases.period, 'weekly');
  // 文档按发版调度的时区切周；调度对象本身绝不进 YAML。
  assert.equal(core.releases.timezone, 'America/New_York');
  assert.equal('schedule' in core.releases, false);
  // YAML 里也不能出现插件侧的 schedule 键。
  const yaml = config.toYaml(core);
  assert.equal(/^\s*schedule:/m.test(yaml), false);
});

test('toCoreConfig：auto 并发/预算按订阅数解析，显式数字永远优先', () => {
  const base = { model: { provider: 'deepseek', model: 'm' }, repo: { path: '/tmp/x' } };
  const auto = config.normalizeSettings(base);
  // ceil(n/10) 夹在 4–8；预算 = min(300, 30+3n)。
  assert.equal(config.toCoreConfig(auto, 'k').releases.concurrency, 4);
  assert.equal(config.toCoreConfig(auto, 'k').releases.budgetSeconds, 30);
  assert.equal(config.toCoreConfig(auto, 'k', undefined, undefined, 0).releases.concurrency, 4);
  assert.equal(config.toCoreConfig(auto, 'k', undefined, undefined, 20).releases.concurrency, 4);
  assert.equal(config.toCoreConfig(auto, 'k', undefined, undefined, 50).releases.concurrency, 5);
  assert.equal(config.toCoreConfig(auto, 'k', undefined, undefined, 80).releases.concurrency, 8);
  assert.equal(config.toCoreConfig(auto, 'k', undefined, undefined, 500).releases.concurrency, 8);
  assert.equal(config.toCoreConfig(auto, 'k', undefined, undefined, 10).releases.budgetSeconds, 60);
  assert.equal(config.toCoreConfig(auto, 'k', undefined, undefined, 100).releases.budgetSeconds, 300);
  assert.equal(config.toCoreConfig(auto, 'k', undefined, undefined, 2000).releases.budgetSeconds, 300);

  const explicit = config.normalizeSettings({ ...base, releases: { concurrency: 2, budgetSeconds: 45 } });
  const core = config.toCoreConfig(explicit, 'k', undefined, undefined, 100);
  assert.equal(core.releases.concurrency, 2);
  assert.equal(core.releases.budgetSeconds, 45);
});

test('summarize / releases 分区归位与分段合并互不牵连', () => {
  // 摘要（summarize.*）与调度、观测库一起归「榜单(scope)」分区；releases 仍是独立分区。
  assert.equal(config.sectionOfField('summarize.enrich'), 'scope');
  assert.equal(config.sectionOfField('outputLanguage'), 'scope');
  assert.equal(config.sectionOfField('releases.perRepoLimit'), 'releases');
  const stored = config.normalizeSettings({ model: { provider: 'deepseek', model: 'm' }, repo: { path: '/tmp/a' }, summarize: { batchSize: 3 }, releases: { perRepoLimit: 4 } });
  const incoming = config.normalizeSettings({ model: { provider: 'deepseek', model: 'm' }, repo: { path: '/tmp/a' }, summarize: { batchSize: 9 }, releases: { perRepoLimit: 9, includePrerelease: true } });
  const merged = config.mergeSettingsSection(stored, incoming, 'scope');
  assert.equal(merged.summarize.batchSize, 9);
  assert.equal(merged.releases.perRepoLimit, 4); // 其它分区保持已保存值
  assert.equal(merged.releases.includePrerelease, false);
});

test('network.proxy：归一化默认空串、校验 http(s) 形态、可保存到 source 分区', () => {
  // 缺省为空串
  const d = config.normalizeSettings({});
  assert.equal(d.network.proxy, '');
  // 保留合法值（去空白）
  const ok = config.normalizeSettings({ network: { proxy: '  http://127.0.0.1:7890  ' } });
  assert.equal(ok.network.proxy, 'http://127.0.0.1:7890');
  // 非法值被校验拦下，且归属 source 分区
  const bad = config.normalizeSettings({ network: { proxy: '7890' } });
  const problems = config.validateSettings(
    { ...bad, model: { ...bad.model, provider: 'deepseek', model: 'x' }, repo: { ...bad.repo, path: '/tmp/x' } },
    ['deepseek'],
  );
  const p = problems.find((x) => x.field === 'network.proxy');
  assert.ok(p, 'proxy problem expected');
  assert.equal(config.sectionOfField('network.proxy'), 'source');
  // 分段保存只并入 source 的 network
  const stored = config.normalizeSettings({});
  const incoming = config.normalizeSettings({ network: { proxy: 'http://127.0.0.1:7890' } });
  const merged = config.mergeSettingsSection(stored, incoming, 'source');
  assert.equal(merged.network.proxy, 'http://127.0.0.1:7890');
});

test('run.timeoutMs：默认 300000、非法回落、范围校验、归属 source 分区', () => {
  // 缺省 300000（5 分钟）。
  const d = config.normalizeSettings({});
  assert.equal(d.run.timeoutMs, 300_000);
  // 显式值保留；非数字回落默认。
  assert.equal(config.normalizeSettings({ run: { timeoutMs: 600_000 } }).run.timeoutMs, 600_000);
  assert.equal(config.normalizeSettings({ run: { timeoutMs: 'abc' } }).run.timeoutMs, 300_000);
  // 范围外被校验拦下（< 60s、> 30min、非整数），归属 source。
  const check = (ms) => {
    const s = config.normalizeSettings({ run: { timeoutMs: ms }, model: { provider: 'deepseek', model: 'x' }, repo: { path: '/tmp/x' } });
    return config.validateSettings(s, ['deepseek']).find((x) => x.field === 'run.timeoutMs');
  };
  assert.ok(check(1_000), 'too small rejected');
  assert.ok(check(3_600_000), 'too large rejected');
  assert.equal(check(120_000), undefined, '120s ok');
  assert.equal(config.sectionOfField('run.timeoutMs'), 'source');
  // 分段保存只并入 source 的 run。
  const stored = config.normalizeSettings({});
  const incoming = config.normalizeSettings({ run: { timeoutMs: 600_000 } });
  const merged = config.mergeSettingsSection(stored, incoming, 'source');
  assert.equal(merged.run.timeoutMs, 600_000);
});

test('observe：默认开启，归一化、校验与 toCoreConfig 透传', () => {
  // 默认：开启、回填 30 天、候选上限 300。
  const defaults = config.normalizeSettings({});
  assert.deepEqual(defaults.observe, { enabled: true, backfillDays: 30, maxCandidates: 300 });

  // 显式关闭 + 改数值 + 未知字段丢弃。
  const off = config.normalizeSettings({ observe: { enabled: false, backfillDays: 7, maxCandidates: 100, bogus: 1 } });
  assert.equal(off.observe.enabled, false);
  assert.equal(off.observe.backfillDays, 7);
  assert.equal(off.observe.maxCandidates, 100);
  assert.equal('bogus' in off.observe, false);

  // 透传到核心配置。
  const coreConfig = config.toCoreConfig(off, 'k');
  assert.deepEqual(coreConfig.observe, { enabled: false, backfillDays: 7, maxCandidates: 100 });

  // 校验：越界拦下，合法通过。
  const base = config.normalizeSettings({ model: { provider: 'deepseek', model: 'm' }, repo: { path: '/tmp/x' } });
  assert.equal(config.validateSettings(base).some((p) => p.field.startsWith('observe.')), false);
  const bad = config.normalizeSettings({
    model: { provider: 'deepseek', model: 'm' },
    repo: { path: '/tmp/x' },
    observe: { backfillDays: 999, maxCandidates: 0 },
  });
  const problems = config.validateSettings(bad);
  assert.ok(problems.some((p) => p.field === 'observe.backfillDays'));
  assert.ok(problems.some((p) => p.field === 'observe.maxCandidates'));
});

test('observe 归入 scope 分区并随分段合并保留', () => {
  const stored = config.normalizeSettings({ model: { provider: 'deepseek', model: 'm' }, repo: { path: '/tmp/x' } });
  const incoming = config.normalizeSettings({ observe: { enabled: false, backfillDays: 14, maxCandidates: 200 } });
  // 保存 scope 分区时，observe 一起被覆盖。
  const merged = config.mergeSettingsSection(stored, incoming, 'scope');
  assert.deepEqual(merged.observe, { enabled: false, backfillDays: 14, maxCandidates: 200 });
  // 保存其它分区（如 model）时，observe 保持 stored 的值不被牵连。
  const mergedModel = config.mergeSettingsSection(stored, incoming, 'model');
  assert.deepEqual(mergedModel.observe, stored.observe);
});

test('outputLanguage：默认空串（跟随宿主），归一化与校验', () => {
  // 默认与归一化
  assert.equal(config.DEFAULT_SETTINGS.outputLanguage, '');
  assert.equal(config.normalizeSettings({}).outputLanguage, '');
  assert.equal(config.normalizeSettings({ outputLanguage: 'EN' }).outputLanguage, 'en');
  assert.equal(config.normalizeSettings({ outputLanguage: '  zh  ' }).outputLanguage, 'zh');
  // 垃圾类型 → ''（跟随宿主）
  assert.equal(config.normalizeSettings({ outputLanguage: 42 }).outputLanguage, '');

  const base = { model: { provider: 'deepseek', model: 'm' }, repo: { path: '/tmp/x' } };
  // 空串合法
  assert.equal(
    config.validateSettings(config.normalizeSettings(base)).some((p) => p.field === 'outputLanguage'),
    false,
  );
  // zh / en / en-US 主标签在支持集 → 合法
  for (const value of ['zh', 'en', 'en-US', 'zh-CN']) {
    const problems = config.validateSettings(config.normalizeSettings({ ...base, outputLanguage: value }));
    assert.equal(problems.some((p) => p.field === 'outputLanguage'), false, `${value} 应合法`);
  }
  // fr 不在支持集 → CONFIG_INVALID，并列出可选项
  const bad = config.validateSettings(config.normalizeSettings({ ...base, outputLanguage: 'fr' }));
  const problem = bad.find((p) => p.field === 'outputLanguage');
  assert.ok(problem);
  assert.equal(problem.code, 'CONFIG_INVALID');
  assert.match(problem.message, /zh/);
  assert.match(problem.message, /en/);
});

test('toCoreConfig 把解析后的 outputLanguage 写进 language.outputLanguage', () => {
  const settings = config.normalizeSettings({ model: { provider: 'deepseek', model: 'm' }, repo: { path: '/tmp/x' } });
  assert.equal(config.toCoreConfig(settings, 'k').language.outputLanguage, '');
  assert.equal(config.toCoreConfig(settings, 'k', undefined, undefined, 0, 'en').language.outputLanguage, 'en');
  assert.equal(config.toCoreConfig(settings, 'k', undefined, undefined, 0, 'zh').language.outputLanguage, 'zh');
});
