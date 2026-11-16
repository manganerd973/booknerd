import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import { cloudflare } from "@cloudflare/vite-plugin";

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
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local'],
  },
  plugins: [
    localCloudflareWorkers,
    vinext({
      cache: { cdn: cdnAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      external: ['cloudflare:workers'],
    },
  },
});
