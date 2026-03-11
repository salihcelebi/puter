import { createServer as createViteServer } from "vite";
import express from "express";

import { createApiApp } from "./server/app.js";

async function startServer() {
  const app = await createApiApp();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = `${process.cwd()}/dist`;
    app.use(express.static(distDir));
    app.get("*", (req, res) => {
      res.sendFile(`${distDir}/index.html`);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
