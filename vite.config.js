import { defineConfig } from 'vite';
import vinext from 'vinext';

const localCloudflareWorkers = {
  name: 'booknerd-local-cloudflare-workers',
  apply: 'serve',
  enforce: 'pre',
  resolveId(id) {
    return id === 'cloudflare:workers' ? '\0booknerd-cloudflare-workers' : null;
  },
  load(id) {
    if (id !== '\0booknerd-cloudflare-workers') return null;
    return 'export const env = { DB: null, BUCKET: null, BOOKNERD_OWNER_EMAIL: "" };';
  },
};

export default defineConfig({
  plugins: [localCloudflareWorkers, vinext()],
  build: {
    rolldownOptions: {
      external: ['cloudflare:workers'],
    },
  },
});
