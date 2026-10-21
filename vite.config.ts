import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { argusProxy } from './server/argusProxy';

// https://vitejs.dev/config/
export default defineConfig({
  // argusProxy: ponte local para a API do Argus (veja server/argusProxy.ts)
  plugins: [react(), argusProxy()],
});
