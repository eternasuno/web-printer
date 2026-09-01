import monkey from 'vite-plugin-monkey';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      build: { fileName: 'web-printer.user.js' },
      userscript: {
        name: 'Web Printer',
        namespace: 'https://github.com/eternasuno/web-printer',
        connect: ['self'],
        version: packageJson.version,
        author: 'eternasuno',
        description: 'Merge same-origin documentation pages for printing',
        match: ['*://*/*'],
        grant: ['GM_registerMenuCommand', 'GM_xmlhttpRequest'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
