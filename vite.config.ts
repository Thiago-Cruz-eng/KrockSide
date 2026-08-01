import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Porta fixa em 3000 de propósito: a política de CORS do backend libera
    // exatamente http://localhost:3000 (Program.cs, "AllowReactDevelopment"), e a
    // suíte Playwright aponta para lá. O padrão do Vite (5173) quebraria os dois.
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    css: false,
    // Só os testes unitários/integração de src. tests-e2e/ é do Playwright, que tem
    // runner próprio: sem este recorte o Vitest tenta coletar os .spec.ts de lá e
    // falha em test.describe().
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/mocks/**', 'src/test-utils/**'],
    },
  },
});
