import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    tools: 'src/tools.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  banner: {
    js: '// @provenonce/mcp — Provenonce Skill for AI agents',
  },
});
