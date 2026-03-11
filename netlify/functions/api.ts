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

function normalizeSetCookie(response: any) {
  const headers = response?.headers || {};
  const rawSetCookie = headers['set-cookie'] || headers['Set-Cookie'];

  if (!rawSetCookie) {
    return response;
  }

  const cookieValues = Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
  return {
    ...response,
    multiValueHeaders: {
      ...(response?.multiValueHeaders || {}),
      'set-cookie': cookieValues,
    },
  };
}

export const handler = async (event: any, context: any) => {
  const currentHandler = await getHandler();
  const response = await currentHandler(event, context);
  return normalizeSetCookie(response);
};
