import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(path.join(root, 'client/styles.ts'), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\{([^}]*)\\}`));
  assert.ok(match !== null, `缺少样式规则：${selector}`);
  return match[1];
}

/**
 * 五个 tab（概览 / 榜单 / 订阅 / 运行记录 / 设置）必须共用同一套内容框：
 * 同一条 max 宽度 + 同一组左右留白。任何一个页面单独 max-width / margin-inline:auto
 * 都会重新造成「有的居中、有的靠左」。
 */
test('外壳与五个视图共用 --dshgt-frame / --dshgt-inset 内容框', () => {
  const app = rule('.dshgt-app');
  assert.match(app, /--dshgt-frame:\d+px/);
  assert.match(app, /--dshgt-gutter:\d+px/);
  assert.match(app, /--dshgt-inset:max\(/);

  for (const selector of ['.dshgt-idbar', '.dshgt-tabsbar', '.dshgt-page-head']) {
    assert.match(rule(selector), /var\(--dshgt-inset\)/, `${selector} 没有使用统一内容框`);
  }
  assert.match(rule('.dshgt-view'), /padding:[^;]*var\(--dshgt-inset\)/);
  assert.match(rule('.dshgt-main-body > .dshgt-settings'), /padding:[^;]*var\(--dshgt-inset\)/);
});

test('视图内部不再各自限宽或居中', () => {
  assert.doesNotMatch(css, /max-width:920px/);
  assert.doesNotMatch(css, /max-width:1240px/);
  assert.doesNotMatch(rule('.dshgt-board-sheet'), /max-width/);
  assert.doesNotMatch(rule('.dshgt-board-doc'), /max-width/);
  assert.doesNotMatch(rule('.dshgt-digest-empty'), /max-width/);
});

/**
 * 身份条：更新 / GitHub 入口是包名后面的第二段，不再靠右推到底（A 方案）；
 * 确认气泡跟着图标落在左侧，贴 right:0 会朝右伸出面板。
 */
test('身份条动作区紧跟包名，确认气泡贴左', () => {
  const actions = rule('.dshgt-idbar-actions');
  assert.doesNotMatch(actions, /margin-left:auto/, '动作区不该再被推到右端');
  assert.match(actions, /flex:none/);
  assert.match(rule('.dshgt-confirm-pop'), /left:0/);
});

