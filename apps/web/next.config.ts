import type { NextConfig } from 'next';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appDir, '../..');

const nextConfig: NextConfig = {
  reactCompiler: true,
  // pnpm hoists deps to the workspace root; pin Turbopack + tracing there.
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
