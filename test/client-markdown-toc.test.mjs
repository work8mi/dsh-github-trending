import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// markdown.ts 依赖 ./ui.js → require('react')（peer）。测试里用最小 react stub 顶替，
// 只验证「标题锚点 / TOC / 行内高亮」这类纯逻辑，不跑真实 React 渲染。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const stubDir = mkdtempSync(path.join(tmpdir(), 'dshgt-react-stub-'));
const reactStub = path.join(stubDir, 'react.js');
writeFileSync(
  reactStub,
  [
    'export function createElement(type, props, ...children){ return { type, props: props || {}, children }; }',
    'export default { createElement };',
    'export function useState(v){ return [v, () => {}]; }',
    'export function useEffect(){}',
    'export function useRef(v){ return { current: v }; }',
    'export function useCallback(fn){ return fn; }',
    'export function useMemo(fn){ return fn(); }',
    'export const Fragment = "Fragment";',
  ].join('\n'),
);

async function loadWithStub(file) {
  const outfile = path.join(mkdtempSync(path.join(tmpdir(), 'dshgt-md-toc-')), 'markdown.mjs');
  await build({
    absWorkingDir: root,
    entryPoints: [path.join(root, 'client', file)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
    alias: { react: reactStub },
  });
  return import(pathToFileURL(outfile).href);
}

const markdown = await loadWithStub('markdown.ts');

/** 从 createElement 结果里收集被渲染成元素的 heading 节点。 */
function collectHeadings(nodes) {
  const headings = [];
  const walk = (node) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const type = node.type;
    if (typeof type === 'string' && /^h[1-6]$/.test(type)) headings.push(node);
    (node.children || []).forEach(walk);
  };
  walk(nodes);
  return headings;
}

test('renderMarkdown：标题生成去重锚点 id，且 TOC 与正文 id 一致', () => {
  const rendered = markdown.renderMarkdown('## 主要变更\n\n正文\n\n## 主要变更\n\n重复标题\n\n### 升级注意');
  assert.deepEqual(
    rendered.headings.map((h) => h.text),
    ['主要变更', '主要变更', '升级注意'],
  );
  // 重名第二个标题获得 -1 后缀。
  assert.deepEqual(
    rendered.headings.map((h) => h.id),
    ['主要变更', '主要变更-1', '升级注意'],
  );
  const headingEls = collectHeadings(rendered.nodes);
  const ids = headingEls.map((el) => el.props.id);
  assert.deepEqual(ids, rendered.headings.map((h) => h.id));
});

test('renderMarkdown：无标题时 headings 为空（不造假目录）', () => {
  const rendered = markdown.renderMarkdown('一段没有标题的散文。\n\n还有一段。');
  assert.equal(rendered.headings.length, 0);
});

test('renderMarkdown：正文里的版本号与 owner/repo 被包成高亮节点，文本不变', () => {
  const rendered = markdown.renderMarkdown('本周 dsh-v0.2.2-alpha.3 与 vercel/next.js 有更新');
  // 找到 paragraph 的 children，拼接所有文本应等于原文。
  const para = rendered.nodes.find((n) => n.type === 'p');
  const flatten = (nodes) => {
    if (typeof nodes === 'string') return nodes;
    if (!Array.isArray(nodes)) {
      if (nodes === null || typeof nodes !== 'object') return '';
      return flatten(nodes.children || []);
    }
    return nodes.map(flatten).join('');
  };
  assert.equal(flatten(para.children), '本周 dsh-v0.2.2-alpha.3 与 vercel/next.js 有更新');
  // 收集所有 span 的高亮 className（嵌套在数组里）。
  const classes = [];
  const walk = (nodes) => {
    if (typeof nodes === 'string' || nodes === null || typeof nodes !== 'object') return;
    if (Array.isArray(nodes)) {
      nodes.forEach(walk);
      return;
    }
    if (nodes.props?.className === 'dshgt-md-ver' || nodes.props?.className === 'dshgt-md-repo') classes.push(nodes.props.className);
    (nodes.children || []).forEach(walk);
  };
  walk(para.children);
  assert.ok(classes.includes('dshgt-md-ver'), 'version 应被高亮');
  assert.ok(classes.includes('dshgt-md-repo'), 'owner/repo 应被高亮');
});

test('renderMetaTable：frontmatter 按字段顺序渲染成两列键值表（值里的冒号不拆）', () => {
  const meta = {
    date: '2026-11-06',
    period: 'daily',
    languages: '[all, typescript, python]',
    count: '67',
    degraded: 'false',
    contentHash: 'sha256:f59bc9e694d8fbb558ed5aa812e2c889e5d4855a74c4f4026c57db7fab72bf3a',
    coreVersion: '0.10.0',
    generatedAt: '2026-11-06T00:31:18Z',
  };
  const order = ['date', 'period', 'languages', 'count', 'degraded', 'coreVersion', 'contentHash', 'generatedAt'];
  const table = markdown.renderMetaTable(meta, order);
  assert.ok(table, '有 meta 时应渲染出表格');

  const rows = [];
  const walk = (node) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === 'tr') rows.push(node);
    (node.children || []).forEach(walk);
  };
  walk(table);
  // 每个字段一行，且按 order 排列。
  assert.deepEqual(
    rows.map((tr) => tr.children[0].children[0]),
    order,
  );
  // generatedAt 完整保留时间（含两个冒号）。
  const genRow = rows.find((tr) => tr.children[0].children[0] === 'generatedAt');
  const flattenText = (node) => {
    if (typeof node === 'string') return node;
    if (node === null || typeof node !== 'object') return '';
    if (Array.isArray(node)) return node.map(flattenText).join('');
    return flattenText(node.children || []);
  };
  assert.equal(flattenText(genRow.children[1]), '2026-11-06T00:31:18Z');
});

test('renderMetaTable：核心新增字段不被丢弃，追加在已知字段之后', () => {
  const table = markdown.renderMetaTable({ date: '2026-11-06', contentHashAlgo: 'sha256' }, ['date']);
  const rows = [];
  const walk = (node) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === 'tr') rows.push(node);
    (node.children || []).forEach(walk);
  };
  walk(table);
  assert.deepEqual(
    rows.map((tr) => tr.children[0].children[0]),
    ['date', 'contentHashAlgo'],
  );
});

test('renderMetaTable：meta 为空返回 null（不渲染空表）', () => {
  assert.equal(markdown.renderMetaTable({}, ['date', 'count']), null);
});

/** 把 createElement 结果（children 可能是数组套数组）摊平成元素列表。 */
function flattenTrees(nodes, out = []) {
  if (nodes === null || typeof nodes !== 'object') return out;
  if (Array.isArray(nodes)) {
    nodes.forEach((node) => flattenTrees(node, out));
    return out;
  }
  out.push(nodes);
  if (Array.isArray(nodes.children)) nodes.children.forEach((node) => flattenTrees(node, out));
  return out;
}

test('renderMarkdown：排行榜表启用紧凑布局，数字列定宽右对齐、标签独立、长摘要折叠', () => {
  const long = 'A'.repeat(120);
  const rendered = markdown.renderMarkdown(
    [
      '| 仓库 | Stars | 今日新增 | 摘要 |',
      '| --- | ---: | ---: | --- |',
      '| anthropics/skills | 192,382 | +1,679 | [原文] 简要说明 |',
      `| meta/astryx | 22,991 | +3,108 | [原文] ${long} |`,
    ].join('\n'),
  );
  const trees = flattenTrees(rendered.nodes);
  const table = trees.find((node) => node.type === 'table');
  assert.ok(table, '应渲染出表格');
  assert.match(table.props.className, /dshgt-md-table--compact/, '排行榜表应走紧凑布局');

  const cells = (type) => trees.filter((node) => node.type === type);
  const head = cells('th');
  assert.deepEqual(
    head.map((node) => node.props.className ?? ''),
    ['', 'dshgt-md-num', 'dshgt-md-num', ''],
    '只有数字列带 dshgt-md-num',
  );
  assert.deepEqual(
    head.map((node) => node.props.style?.textAlign),
    [undefined, 'right', 'right', undefined],
    '只有数字列表头右对齐；列宽由 CSS 的 fixed 布局给出，不写死行内像素宽',
  );
  assert.ok(
    head.every((node) => node.props.scope === 'col'),
    '表头单元格应声明 scope=col',
  );
  assert.deepEqual(
    trees
      .filter((node) => node.type === 'td')
      .slice(0, 4)
      .map((node) => node.props['data-label']),
    ['仓库', 'Stars', '今日新增', '摘要'],
    '单元格带 data-label：窄面板堆叠布局靠它给数字补回单位',
  );

  const tag = trees.find((node) => node.props?.className === 'dshgt-md-tag');
  assert.equal(tag?.children?.[0], '原文', '摘要开头的 [原文] 应渲染成独立标签');
  const clamp = trees.find((node) => node.props?.className === 'dshgt-md-clamp');
  assert.ok(clamp, '超长摘要应折叠');
  assert.equal(clamp.props.title, `[原文] ${long}`, '折叠单元格的 title 必须是全文');
});

test('renderMarkdown：普通表格保持自动布局（不启用紧凑样式）', () => {
  const rendered = markdown.renderMarkdown('| 字段 | 值 |\n| --- | --- |\n| 日期 | 2026-11-11 |');
  const json = JSON.stringify(rendered.nodes);
  assert.ok(!json.includes('dshgt-md-table--compact'), '两列表不应变紧凑');
  assert.ok(!json.includes('dshgt-md-tag'), '普通表格不抽标签');
});
