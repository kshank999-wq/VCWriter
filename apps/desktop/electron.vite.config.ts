import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Supabase's URL and anon key are public values, but they still have to be
  // baked in at build time rather than read from the machine the app runs on.
  // A build without them produces an application that works completely on
  // local files and simply has sync switched off.
  const env = loadEnv(mode, __dirname, 'MAIN_VITE_');
  const cloudEnv = {
    'process.env.MAIN_VITE_SUPABASE_URL': JSON.stringify(env['MAIN_VITE_SUPABASE_URL'] ?? ''),
    'process.env.MAIN_VITE_SUPABASE_ANON_KEY': JSON.stringify(env['MAIN_VITE_SUPABASE_ANON_KEY'] ?? ''),
  };

  return {
    main: {
      plugins: [externalizeDepsPlugin({ exclude: ['@vcwriter/domain'] })],
      define: cloudEnv,
      build: {
        rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } },
      },
    },
    renderer: {
      root: resolve(__dirname, 'src/renderer'),
      plugins: [react()],
      resolve: {
        alias: { '@renderer': resolve(__dirname, 'src/renderer') },
      },
      build: {
        rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } },
      },
    },
  };
});
