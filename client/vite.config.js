import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev only: send /api calls to the Express server, so the browser sees one origin
    // (same as production, where Express serves the client). Port: needs team agreement.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
