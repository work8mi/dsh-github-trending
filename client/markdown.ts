/**
 * Markdown 子集 → React 节点。
 *
 * 只消费 `markdown-core` 的结构化结果：文本一律作为 React 文本节点传入（由 React
 * 转义），不拼 HTML、不用 dangerouslySetInnerHTML，不渲染图片。链接已在解析阶段
 * 过滤为 http(s)，这里只负责加 `target` / `rel`。
 */
import { h } from './ui.js';
import { parseMarkdown, type Align, type Block, type Inline } from './markdown-core.js';

/** 标题大纲条目：给抽屉的章节目录（TOC）用。`id` 与正文标题元素上的 `id` 一致，可点击跳转。 */
export interface HeadingToc {
  id: string;
  level: number;
  text: string;
}

export interface RenderedMarkdown {
  meta: Record<string, string>;
  nodes: any[];
  /** 正文里出现的标题大纲，按出现顺序；没有标题时为空数组。 */
  headings: HeadingToc[];
  /** 解析后的块列表，与 `nodes` 一一对应；页面要从正文里派生统计（收录数、增长合计）时用。 */
  blocks: Block[];
}

/** 从行内节点里抽出纯文本（用于 TOC 标签与锚点 slug）。 */
export function inlineText(nodes: Inline[]): string {
  let text = '';
  for (const node of nodes) {
    if (node.type === 'text') text += node.value;
    else if (node.type === 'code') text += node.value;
    else if (node.type === 'strong' || node.type === 'link') text += inlineText(node.children);
  }
  return text;
}

/**
 * 生成锚点 slug：保留字母数字与中文，其余折叠为 `-`；为空时退回 `section`。
 * 重名由调用方加序号去重。
 */
function slugify(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'section' : slug;
}

/** 正文里的版本号 / owner/repo 这类「值得扫读」的 token：仅加等宽样式，不改写文本。 */
const HILITE_PATTERN = /(\bv?\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?\b)|(\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b)/g;

/**
 * 把一段纯文本按「版本号 / owner/repo」切成带样式的片段。
 * 只切分、不增删字符——拼起来与原文完全一致，纯表现增强。
 */
function renderTextRun(value: string, key: string): any {
  const parts: any[] = [];
  let cursor = 0;
  let seq = 0;
  const pattern = new RegExp(HILITE_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) parts.push(value.slice(cursor, match.index));
    parts.push(
      h('span', { key: `${key}-t${seq++}`, className: match[1] !== undefined ? 'dshgt-md-ver' : 'dshgt-md-repo' }, match[0]),
    );
    cursor = pattern.lastIndex;
  }
  if (parts.length === 0) return value;
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

function renderInline(nodes: Inline[], prefix: string): any[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`;
    switch (node.type) {
      case 'text':
        return renderTextRun(node.value, key);
      case 'strong':
        return h('strong', { key }, renderInline(node.children, key));
      case 'code':
        return h('code', { key, className: 'dshgt-md-code' }, node.value);
      case 'link':
        return h(
          'a',
          { key, href: node.href, target: '_blank', rel: 'noreferrer' },
          renderInline(node.children, key),
        );
    }
  });
}

function alignStyle(align: Align | undefined): any {
  return align === undefined ? undefined : { textAlign: align };
}

/** 单元格开头的 `[标签]`（如 `[原文]`）：抽出来单独渲染成小 chip，不与摘要正文混成一串。 */
const LEADING_TAG = /^\[([^\]\n]{1,16})\]\s*/;

/** 摘要列超过这个字符数才折叠成三行；短摘要完整显示，不为整齐牺牲可读性。 */
const CELL_CLAMP_CHARS = 96;

interface CellParts {
  tag: string | undefined;
  rest: Inline[];
}

/** 摘出首段文本里的 `[标签]`；首节点不是文本或没有标签时原样返回。 */
function splitLeadingTag(cell: Inline[]): CellParts {
  const first = cell[0];
  if (first === undefined || first.type !== 'text') return { tag: undefined, rest: cell };
  const match = LEADING_TAG.exec(first.value);
  if (match === null) return { tag: undefined, rest: cell };
  const remainder = first.value.slice(match[0].length);
  return {
    tag: match[1],
    rest: remainder === '' ? cell.slice(1) : [{ type: 'text', value: remainder }, ...cell.slice(1)],
  };
}

/**
 * compact 表的单元格内容：标签走 chip，长文本折叠成三行并把全文放进 `title`。
 * 折叠只做视觉截断，DOM 里仍是全文，选中与复制不受影响。
 */
function renderCompactCell(cell: Inline[], key: string, clamp: boolean): any {
  const { tag, rest } = splitLeadingTag(cell);
  const full = inlineText(cell);
  // 标签必须和正文同一段行内流：单独放进折叠块外层会各占一行，短摘要时尤其散。
  const flow: any[] =
    tag === undefined
      ? renderInline(rest, key)
      : [h('span', { key: `${key}-tag`, className: 'dshgt-md-tag' }, tag), ...renderInline(rest, key)];
  if (!clamp || full.length <= CELL_CLAMP_CHARS) return flow;
  return h('div', { key: `${key}-clamp`, className: 'dshgt-md-clamp', title: full }, flow);
}

/** 单格就是 `owner/repo` 链接时，把组织名与仓库名分开：组织名压暗、仓库名保持正文色。 */
function renderRepoLink(cell: Inline[], key: string): any {
  const only = cell[0];
  if (cell.length === 1 && only !== undefined && only.type === 'link') {
    const text = inlineText(only.children);
    const slash = text.indexOf('/');
    if (slash > 0 && slash < text.length - 1 && !/\s/.test(text)) {
      return h(
        'a',
        { key, href: only.href, target: '_blank', rel: 'noreferrer', className: 'dshgt-md-repolink' },
        h('span', { key: `${key}-org`, className: 'dshgt-md-org' }, text.slice(0, slash + 1)),
        h('span', { key: `${key}-name`, className: 'dshgt-md-name' }, text.slice(slash + 1)),
      );
    }
  }
  return renderInline(cell, key);
}

/** 「今日新增」这类带符号的数字列：正增长上绿、负值上红，其余保持中性数字。 */
const GROWTH_VALUE = /^[+-][\d,]+$/;

function renderCellValue(cell: Inline[], key: string, growth: boolean): any {
  const flow = renderInline(cell, key);
  if (!growth) return flow;
  const text = inlineText(cell).trim();
  if (!GROWTH_VALUE.test(text)) return flow;
  return h('span', { key: `${key}-growth`, className: text.startsWith('-') ? 'dshgt-md-growth is-down' : 'dshgt-md-growth' }, flow);
}

/** compact 表里除仓库列之外的值：数字列原样（增长列上色），文本列抽标签 + 长摘要折叠。 */
function compactCellValue(cell: Inline[], key: string, growth: boolean, numeric: boolean): any {
  return growth ? renderCellValue(cell, key, true) : renderCompactCell(cell, key, !numeric);
}

function renderBlock(block: Block, key: string, headingId?: string): any {
  switch (block.type) {
    case 'heading': {
      const level = Math.min(Math.max(block.level, 1), 6);
      return h(
        `h${level}`,
        { key, className: `dshgt-md-h dshgt-md-h${level}`, ...(headingId === undefined ? {} : { id: headingId }) },
        renderInline(block.children, key),
      );
    }
    case 'paragraph':
      return h('p', { key, className: 'dshgt-md-p' }, renderInline(block.children, key));
    case 'list':
      return h(
        block.ordered ? 'ol' : 'ul',
        { key, className: 'dshgt-md-list' },
        block.items.map((item, index) => h('li', { key: `${key}-${index}` }, renderInline(item, `${key}-${index}`))),
      );
    case 'quote':
      return h('blockquote', { key, className: 'dshgt-md-quote' }, renderInline(block.children, key));
    case 'code':
      return h(
        'pre',
        { key, className: 'dshgt-md-pre', ...(block.lang === undefined ? {} : { 'data-lang': block.lang }) },
        h('code', null, block.value),
      );
    case 'hr':
      return h('hr', { key, className: 'dshgt-md-hr' });
    case 'table': {
      // 「排行榜」形态：≥3 列且存在右对齐数字列。只有这种表换成带排名列的排行榜，
      // 其它表格（元信息、任意 markdown 表）保持原有的自动布局与横向滚动。
      const compact = block.header.length >= 3 && block.align.some((align) => align === 'right');
      // 列宽交给 CSS（数字列定宽、仓库列随内容），行内样式只留对齐：
      // 写死的像素宽度没法跟着面板宽度与容器查询一起收放。
      const isNumeric = (index: number): boolean => block.align[index] === 'right';
      const headerText = (index: number): string => {
        const cell = block.header[index];
        return cell === undefined ? '' : inlineText(cell);
      };
      // 「今日新增 / New stars」这类列是增长量，单独上色；Stars 总量仍是中性数字。
      const isGrowth = (index: number): boolean => compact && isNumeric(index) && /新增|new/i.test(headerText(index));
      return h(
        'div',
        { key, className: compact ? 'dshgt-md-tablewrap dshgt-md-tablewrap--compact' : 'dshgt-md-tablewrap' },
        h(
          'table',
          { className: compact ? 'dshgt-md-table dshgt-md-table--compact' : 'dshgt-md-table' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              compact ? h('th', { key: 'rank', scope: 'col', className: 'dshgt-md-rank' }, '#') : null,
              block.header.map((cell, index) =>
                h(
                  'th',
                  {
                    key: `h${index}`,
                    scope: 'col',
                    className: isNumeric(index) ? 'dshgt-md-num' : undefined,
                    style: alignStyle(block.align[index]),
                  },
                  renderInline(cell, `${key}-h${index}`),
                ),
              ),
            ),
          ),
          h(
            'tbody',
            null,
            block.rows.map((row, rowIndex) =>
              h(
                'tr',
                { key: `r${rowIndex}` },
                compact ? h('td', { key: 'rank', className: 'dshgt-md-rank' }, String(rowIndex + 1)) : null,
                row.map((cell, cellIndex) => {
                  const label = block.header[cellIndex];
                  const growth = isGrowth(cellIndex);
                  return h(
                    'td',
                    {
                      key: `c${cellIndex}`,
                      className: isNumeric(cellIndex) ? 'dshgt-md-num' : undefined,
                      style: alignStyle(block.align[cellIndex]),
                      // 窄面板下表格会堆叠成卡片，列头隐藏后靠这个属性给数字补回单位。
                      ...(compact && label !== undefined ? { 'data-label': inlineText(label) } : {}),
                    },
                    compact && cellIndex === 0
                      ? renderRepoLink(cell, `${key}-r${rowIndex}c${cellIndex}`)
                      : compact
                        ? compactCellValue(cell, `${key}-r${rowIndex}c${cellIndex}`, growth, isNumeric(cellIndex))
                        : renderInline(cell, `${key}-r${rowIndex}c${cellIndex}`),
                  );
                }),
              ),
            ),
          ),
        ),
      );
    }
  }
}

/**
 * 渲染元信息值：只把版本号 / owner/repo 这类片段做行内高亮，和正文同一套规则。
 * 值本身是纯文本（时间、哈希等不解析成链接），所以这里直接当一个 text 节点喂给 renderInline。
 */
function renderMetaValue(value: string, key: string): any[] {
  return renderInline([{ type: 'text', value }], `meta-${key}`);
}

/**
 * 把 frontmatter 元信息渲染成两列「字段 | 值」表，与 GitHub 渲染同样式的纵向键值表。
 * 顺序按 `order` 给定的白名单，未列出的字段（核心将来新增的）按原顺序追加在后，
 * 不静默丢字段。值里的 `contentHash` 太宽，单独允许换行。
 */
export function renderMetaTable(meta: Record<string, string>, order: readonly string[]): any | null {
  const keys = order.filter((key) => meta[key] !== undefined && meta[key] !== '');
  for (const key of Object.keys(meta)) {
    if (!order.includes(key) && meta[key] !== '') keys.push(key);
  }
  if (keys.length === 0) return null;
  return h(
    'div',
    { className: 'dshgt-md dshgt-doc-meta-table' },
    h(
      'div',
      { className: 'dshgt-md-tablewrap' },
      h(
        'table',
        { className: 'dshgt-md-table dshgt-doc-meta' },
        h(
          'tbody',
          null,
          keys.map((key) =>
            h(
              'tr',
              { key },
              h('th', { scope: 'row', className: 'dshgt-doc-meta-key' }, key),
              h(
                'td',
                { className: key === 'contentHash' ? 'dshgt-doc-meta-val dshgt-doc-meta-hash' : 'dshgt-doc-meta-val' },
                renderMetaValue(meta[key] ?? '', key),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/** 榜单概览从正文派生的三个数字；全部来自本期真实表格，不做任何估算。 */
export interface BoardStats {
  /** 去重后的仓库数：同一仓库出现在多个语言榜里只算一次。 */
  repos: number;
  /** 去重后各仓库「今日新增」之和。 */
  newStars: number;
  /** 正文里的语言分区数（二级标题个数）。 */
  languages: number;
}

/**
 * 从解析后的块里数出概览数字。增长列按列头识别（核心写「今日新增 / New」），
 * 同一仓库只取第一次出现的那一行，避免多语言榜重复累加把总量放大。
 */
export function collectBoardStats(blocks: Block[]): BoardStats {
  const seen = new Set<string>();
  let newStars = 0;
  let languages = 0;
  for (const block of blocks) {
    if (block.type === 'heading') {
      if (block.level === 2) languages += 1;
      continue;
    }
    if (block.type !== 'table') continue;
    const growthCol = block.header.findIndex((cell) => /新增|new/i.test(inlineText(cell)));
    for (const row of block.rows) {
      const first = row[0];
      const repo = first === undefined ? '' : inlineText(first).trim();
      if (repo === '') continue;
      const key = repo.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (growthCol === -1) continue;
      const raw = row[growthCol];
      const match = raw === undefined ? null : /[+-]?[\d,]+/.exec(inlineText(raw));
      const amount = match === null ? 0 : Number(match[0].replace(/,/g, ''));
      if (Number.isFinite(amount)) newStars += amount;
    }
  }
  return { repos: seen.size, newStars, languages };
}

export function renderMarkdown(markdown: string): RenderedMarkdown {
  const parsed = parseMarkdown(markdown);
  // 先给每个标题块分配去重后的锚点 id，同时收集 TOC；再按块渲染，把 id 挂到 heading 元素上。
  const idByBlock = new Map<number, string>();
  const headings: HeadingToc[] = [];
  const used = new Set<string>();
  parsed.blocks.forEach((block, index) => {
    if (block.type !== 'heading') return;
    const text = inlineText(block.children).trim();
    if (text === '') return;
    const base = slugify(text);
    let id = base;
    let seq = 1;
    while (used.has(id)) id = `${base}-${seq++}`;
    used.add(id);
    idByBlock.set(index, id);
    headings.push({ id, level: Math.min(Math.max(block.level, 1), 6), text });
  });
  return {
    meta: parsed.meta,
    nodes: parsed.blocks.map((block, index) => renderBlock(block, `b${index}`, idByBlock.get(index))),
    headings,
    blocks: parsed.blocks,
  };
}
