import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootNm = join(root, 'node_modules');
const mobileNm = join(root, 'apps', 'mobile', 'node_modules');
const packages = ['react', 'react-dom', 'react-native', 'semver'];

mkdirSync(mobileNm, { recursive: true });

for (const pkg of packages) {
  const target = join(rootNm, pkg);
  const link = join(mobileNm, pkg);
  if (!existsSync(target)) continue;
  if (existsSync(link)) {
    try {
      rmSync(link, { recursive: true, force: true });
    } catch {
      // Windows junctions often need rmdir
      try {
        execFileSync('cmd', ['/c', 'rmdir', link], { stdio: 'ignore' });
      } catch {
        // ignore
      }
    }
  }
  if (process.platform === 'win32') {
    // Prefer Node junctions over `mklink` — cmd quoting breaks on many Windows setups.
    symlinkSync(target, link, 'junction');
  } else {
    symlinkSync(target, link);
  }
}

console.log('Linked mobile React deps to workspace root.');
