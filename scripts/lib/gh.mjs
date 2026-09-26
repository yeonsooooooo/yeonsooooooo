// Minimal GitHub client on top of fetch. No dependencies, so the workflow never runs `npm install`.
const API = 'https://api.github.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function client(token) {
  if (!token) throw new Error('no GitHub token in env');
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'profile-readme-builder',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  async function request(method, path, body) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(path.startsWith('http') ? path : API + path, {
        method,
        headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const retryable = res.status >= 500 || res.status === 429 || (res.status === 403 && res.headers.get('retry-after'));
      if (retryable && attempt < 4) {
        await sleep(Number(res.headers.get('retry-after') || 0) * 1000 || 1500 * 2 ** attempt);
        continue;
      }
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok) throw Object.assign(new Error(`${method} ${path} → ${res.status} ${json?.message ?? ''}`), { status: res.status });
      return json;
    }
  }

  async function graphql(query, variables = {}) {
    const body = await request('POST', '/graphql', { query, variables });
    if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
    return body.data;
  }

  return { request, graphql };
}
