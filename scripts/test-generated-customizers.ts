import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { customizeNextJs, customizeReactVite } from '../src/cli/commands/create';

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'template-api-generated-'));

  try {
    const viteDir = path.join(root, 'vite');
    await fs.ensureDir(path.join(viteDir, 'src', 'assets'));
    await customizeReactVite(viteDir, 'Smoke API', '.env');

    const viteApi = await fs.readFile(path.join(viteDir, 'src', 'lib', 'api.ts'), 'utf8');
    assert.match(viteApi, /return \(await response\.json\(\)\) as StatusSnapshot;/);
    assert.doesNotMatch(viteApi, /a>FDFs/);

    const nextDir = path.join(root, 'next');
    await fs.ensureDir(path.join(nextDir, 'src', 'app'));
    await customizeNextJs(nextDir, 'Smoke API', '.env.local');

    const nextApi = await fs.readFile(path.join(nextDir, 'src', 'lib', 'api.ts'), 'utf8');
    assert.match(nextApi, /return \(await response\.json\(\)\) as StatusSnapshot;/);

    const nextPage = await fs.readFile(path.join(nextDir, 'src', 'app', 'page.tsx'), 'utf8');
    assert.match(nextPage, /Smoke API/);
  } finally {
    await fs.remove(root);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
