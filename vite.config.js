import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

/**
 * In development, /api/* is served by the same handlers Vercel runs (api/*.js export GET/POST/...),
 * so `npm run dev` works end to end with a .env.local holding GOOGLE_WEB_CLIENT_SECRET.
 */
function devApi() {
  return {
    name: 'recundle-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        const name = req.url.slice(5).split('?')[0].replace(/[^a-z]/g, '');
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`);
          const handler = mod[req.method];
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
          const response = await handler(new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body }));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          if (err.code === 'ERR_LOAD_URL') return next();
          res.statusCode = 500;
          res.end(JSON.stringify({ error: { message: err.message } }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss(), devApi()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    build: { chunkSizeWarningLimit: 900 },
  };
});
