import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: true,   // expose ke network — setara dengan --host
    https: true,
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
});
