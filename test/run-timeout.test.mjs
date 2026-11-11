import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as runModule, config as configModule } from '../lib/internal.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_CORE = path.join(here, 'fixtures', 'fake-core.mjs');

/** 造一个「睡 N 毫秒再输出结果」的核心脚本（FAKE_SLEEP 走脚本内赋值）。 */
function slowCore(sleepMs) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dshgt-timeout-core-'));
  const file = path.join(dir, 'core.mjs');
  writeFileSync(
    file,
    `#!/usr/bin/env node\nprocess.env.FAKE_SLEEP = ${JSON.stringify(String(sleepMs))};\nawait import(${JSON.stringify(`file://${FAKE_CORE}`)});\n`,
  );
  chmodSync(file, 0o755);
  return file;
}

function baseOptions(corePath, timeoutMs) {
  const settings = configModule.normalizeSettings({
    model: { provider: 'deepseek', model: 'deepseek-chat', apiKeyRef: 'K', baseURL: 'https://api.deepseek.com/v1' },
    repo: { path: mkdtempSync(path.join(tmpdir(), 'dshgt-timeout-repo-')) },
  });
  return {
    core: { path: corePath, source: 'env' },
    version: { version: '0.12.3', commit: 'x', ipcSchema: 4, digestSchema: 3, contractVersion: '0.7.0', supportedProviders: ['deepseek'] },
    settings,
    apiKey: 'sk-test',
    period: 'daily',
    dryRun: true,
    timeoutMs,
  };
}

test('runCore 真超时（无挂起）→ CORE_TIMEOUT，消息是「核心运行超时」而非挂起', async () => {
  const core = slowCore(3000);
  const opts = baseOptions(core, 400);
  await assert.rejects(
    () => runModule.runCore(opts),
    (error) => {
      assert.equal(error.code, 'CORE_TIMEOUT');
      assert.match(error.message, /核心运行超时/);
      assert.doesNotMatch(error.message, /挂起\/睡眠/);
      return true;
    },
  );
});
