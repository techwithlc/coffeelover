import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy requests starting with /maps-api to Google Maps API
      '/maps-api': {
        target: 'https://maps.googleapis.com', // Target API endpoint
        changeOrigin: true, // Needed for virtual hosted sites
        rewrite: (path) => path.replace(/^\/maps-api/, '/maps/api'), // Rewrite path: /maps-api/... -> /maps/api/...
        secure: false, // Optional: set to false if target has self-signed cert (not needed for Google)
      },
    },
  },
  // optimizeDeps: { // Temporarily remove this to test
  //   exclude: ['lucide-react'],
  // },
});
