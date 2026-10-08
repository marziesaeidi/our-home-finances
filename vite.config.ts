import { defineConfig } from 'vite';
export default defineConfig({
  server:{proxy:{'/api/exchange-rates':'http://127.0.0.1:8788'}},
  preview:{proxy:{'/api/exchange-rates':'http://127.0.0.1:8788'}},
});
