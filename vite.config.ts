import monkey, { cdn } from 'vite-plugin-monkey';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    monkey({
      build: {
        externalGlobals: {
          '@mozilla/readability': cdn.jsdelivr('Readability', 'Readability.min.js'),
        },
        fileName: 'web-printer.user.js',
      },
      entry: 'src/view/main.ts',
      userscript: {
        author: 'web-printer',
        connect: ['*'],
        description: 'Merge all pages from a documentation site into a single HTML and invoke browser print/PDF export',
        grant: ['GM_xmlhttpRequest', 'GM_registerMenuCommand', 'GM_unregisterMenuCommand', 'GM_getValue', 'GM_setValue'],
        match: ['*://*/*'],
        name: 'Web Printer - Document Batch Print Tool',
        namespace: 'https://github.com/web-printer',
        version: '0.1.0',
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
