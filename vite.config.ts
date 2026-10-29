import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { benhermesApiPlugin } from './server/apiRouter';

// https://vitejs.dev/config/
export default defineConfig({
  // benhermesApiPlugin: atende /api/* (auth, usuários, relatórios, whatsapp, feriados, escala, relatorio-ura e argus)
  plugins: [react(), benhermesApiPlugin()],
  // @ts-ignore vitest config
  test: {
    testTimeout: 15000,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/exceljs')) {
            return 'vendor-exceljs';
          }
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-xlsx';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
});
