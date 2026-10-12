// Vite bundler setup for the Baseline University Registrar & Academic Dossier Desk
import wasmPlugin from 'vite-plugin-wasm';
import { defineConfig as createViteConfig, type UserConfig } from 'vite';

const WASM_RUNTIME_PKG = '@midnightntwrk/onchain-runtime-v4';
const JS_TARGET = 'es2022';

const registrarWebConfig: UserConfig = {
  base: './',
  plugins: [wasmPlugin()],
  server: {
    fs: {
      allow: ['..'],
    },
  },
  esbuild: {
    target: JS_TARGET,
  },
  optimizeDeps: {
    exclude: [WASM_RUNTIME_PKG],
    esbuildOptions: {
      target: JS_TARGET,
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: JS_TARGET,
  },
};

export default createViteConfig(registrarWebConfig);
