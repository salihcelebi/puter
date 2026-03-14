exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED', data: null, error: { message: 'Method not allowed' } }),
      };
    }

    if (!event.path.endsWith('/generate')) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, code: 'NOT_FOUND', data: null, error: { message: 'Not found' } }),
      };
    }

    const host = event.headers['x-forwarded-host'] || event.headers.host;
    const proto = event.headers['x-forwarded-proto'] || 'https';
    const targetUrl = `${proto}://${host}/.netlify/functions/api/api/ai/image/generate`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'content-type': event.headers['content-type'] || 'application/json',
        accept: 'application/json',
        cookie: event.headers.cookie || '',
      },
      body: event.body,
    });

    const text = await response.text();
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: text,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, code: 'IMAGE_WORKER_ERROR', data: null, error: { message: String(error?.message || error) } }),
    };
  }
};
