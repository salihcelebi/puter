import { refreshOfficialPuterCatalog, getCatalogWithTryPrices } from "./src/server/services/puter-sync";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Simple KV adapter for Cloudflare Workers or similar
    const kvAdapter = {
      async get(key) {
        return await env.KV.get(key);
      },
      async set(key, value) {
        await env.KV.put(key, value);
      }
    };

    if (url.pathname === '/api/prices' && request.method === 'GET') {
      try {
        const rows = await getCatalogWithTryPrices(kvAdapter, "USD");
        return new Response(JSON.stringify(rows), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }

    if (url.pathname === '/api/refresh' && request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.secret !== 'my-admin-secret') {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        const result = await refreshOfficialPuterCatalog({
          fetchFn: fetch,
          kv: kvAdapter,
          modelsIndexUrl: "https://docs.puter.com/ai/models/",
          allowedHost: "docs.puter.com",
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }

    return new Response("Not Found", { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
