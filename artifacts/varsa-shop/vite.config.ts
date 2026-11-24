import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type UserConfig } from 'vite';
import { storefrontPlugin } from './seo-plugin';
import { storefrontHeaders } from './security-policy';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT ?? '5173';

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';
const apiOrigin = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:5000';
const apiProxy = {
  '^/api(?:/|$)': { target: apiOrigin },
};

export default defineConfig(async ({ isSsrBuild }): Promise<UserConfig> => ({
  base: basePath,
  publicDir: isSsrBuild ? false : undefined,
  appType: 'custom',
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== 'production' ? [runtimeErrorOverlay()] : []),
    storefrontPlugin(apiOrigin),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  ssr: { noExternal: [/^@workspace\//] },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    manifest: !isSsrBuild,
  },
  server: {
    headers: { 'X-Robots-Tag': 'noindex, follow' },
    port,
    proxy: apiProxy,
    strictPort: true,
    host: '127.0.0.1',
    allowedHosts: ['localhost', '127.0.0.1'],
    fs: {
      strict: true,
    },
  },
  preview: {
    headers: { ...storefrontHeaders, 'X-Robots-Tag': 'noindex, follow' },
    port,
    proxy: apiProxy,
    host: '127.0.0.1',
    allowedHosts: ['localhost', '127.0.0.1'],
  },
}));
