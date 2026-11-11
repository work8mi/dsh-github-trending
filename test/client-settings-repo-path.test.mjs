import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 加载 `client/settings.ts` 里导出的纯函数（isPickerUnavailable / pickErrorText）。
 * 走 esbuild 打包成 ESM，bundle 掉 `react` 等依赖——只测纯逻辑，不渲染 React。
 */
async function loadSettings() {
  const outfile = path.join(mkdtempSync(path.join(tmpdir(), 'dshgt-settings-')), 'settings.mjs');
  await build({
    absWorkingDir: root,
    entryPoints: [path.join(root, 'client/settings.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
    alias: { react: path.join(root, 'test/fixtures/react-stub.mjs') },
  });
  return import(pathToFileURL(outfile).href);
}

// 模拟 Translate：只关心 key，返回可辨识的字符串。
const t = (key) => `T:${key}`;

test('isPickerUnavailable：识别 browse 组合下的 directory-picker/unavailable', async () => {
  const { isPickerUnavailable } = await loadSettings();
  // 最关键：这是客户端真实拿到的东西——ui-workspace 把 RemoteError 折成纯 Error，
  // 错误码丢了，只有这段 message。必须靠它判出来。
  assert.equal(
    isPickerUnavailable(new Error('directory picker failed: directoryPicker.pick needs the native capability; the composed picker serves "browse"')),
    true,
    '真实的客户端可见错误（无 code，只有 capability 文本）必须识别',
  );
  // 带错误码（code 字段）——未来宿主若透传 code 也能识别
  assert.equal(isPickerUnavailable({ code: 'directory-picker/unavailable', message: 'x' }), true);
  // 带错误码（rpcError.code，DirectoryBrowseError 的形态）
  assert.equal(isPickerUnavailable({ rpcError: { code: 'directory-picker/unavailable', message: 'x' }, message: 'directory browse failed' }), true);
  // 负数：普通失败
  assert.equal(isPickerUnavailable(new Error('boom')), false);
  assert.equal(isPickerUnavailable(null), false);
  assert.equal(isPickerUnavailable(undefined), false);
  assert.equal(isPickerUnavailable('directory-picker/unavailable'), true);
});

test('pickErrorText：不可用 → 专门文案；其余 → 原始 message', async () => {
  const { pickErrorText } = await loadSettings();
  assert.equal(pickErrorText({ code: 'directory-picker/unavailable' }, t), 'T:repo.pick.unavailable');
  assert.equal(pickErrorText(new Error('boom'), t), 'boom');
  assert.equal(pickErrorText({ message: 'something bad' }, t), 'something bad');
  assert.equal(pickErrorText('raw', t), 'raw');
});
