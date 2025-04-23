// Vite bundle analyzer script
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [visualizer({ open: true })],
});
