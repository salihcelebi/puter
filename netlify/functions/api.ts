import serverless from "serverless-http";

import { createApiApp } from "../../server/app.js";

let cachedHandler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (!cachedHandler) {
    const app = await createApiApp();
    cachedHandler = serverless(app, {
      basePath: "/.netlify/functions/api",
    });
  }

  return cachedHandler;
}

export const handler = async (event: any, context: any) => {
  const currentHandler = await getHandler();
  return currentHandler(event, context);
};
