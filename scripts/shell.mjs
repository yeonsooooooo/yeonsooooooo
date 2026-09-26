// One visitor command, in two phases so a push conflict never causes a second reply:
//   node scripts/shell.mjs reply    answer + close the issue, stash the entry in $RUNNER_TEMP
//   node scripts/shell.mjs record   append the stashed entry to data/history.json (safe to retry)
// The issue title is untrusted: it only ever reaches run(), which parses it against an allowlist.
import { readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import config from '../profile.config.mjs';
import { client } from './lib/gh.mjs';
import { run, parse } from './lib/commands.mjs';

const mode = process.argv[2];
const entryFile = join(process.env.RUNNER_TEMP || tmpdir(), 'shell-entry.json');
const historyFile = new URL('../data/history.json', import.meta.url);
const readJson = (f, fallback) => readFile(f, 'utf8').then(JSON.parse).catch(() => fallback);
const RATE = { window: 10 * 60_000, max: 3 };

if (mode === 'reply') {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const { issue, repository } = event;
  if (issue.user.type === 'Bot') process.exit(0);

  const login = issue.user.login;
  const now = new Date();
  const stats = await readJson(new URL('../data/stats.json', import.meta.url), null);
  const history = await readJson(historyFile, { entries: [] });
  const { line } = parse(issue.title);
  const result = run(issue.title, { login, now, stats, config });
  const recent = history.entries.filter((e) => e.login === login && now - new Date(e.at) < RATE.window).length;

  const profile = `https://github.com/${config.login}`;
  const repo = `${profile}/${config.login}`;
  const next = config.shell.buttons
    .filter((c) => c !== line)
    .slice(0, 4)
    .map((c) => `[\`$ ${c}\`](${repo}/issues/new?title=${encodeURIComponent(`$ ${c}`)})`)
    .join(' · ');
  const body = [
    '```console',
    `${login}@${config.host} ~ ❯ ${line}`,
    result.text,
    '```',
    '',
    recent >= RATE.max
      ? `<sub>⏳ you've run ${recent} commands in the last 10 minutes, so this one isn't added to the history — but it still ran.</sub>`
      : `<sub>🚀 answered by [shell.yml](${repo}/blob/main/.github/workflows/shell.yml) · this command now shows up in <code>~/.visitor_history</code> on [the profile](${profile}).</sub>`,
    '',
    `<sub>try another: ${next}</sub>`,
  ].join('\n');

  if (process.env.DRY_RUN) {
    console.log(body);
  } else {
    const gh = client(process.env.GITHUB_TOKEN);
    const base = `/repos/${repository.full_name}/issues/${issue.number}`;
    await gh.request('POST', `${base}/reactions`, { content: 'rocket' }).catch(() => {});
    await gh.request('POST', `${base}/comments`, { body });
    await gh.request('PATCH', base, { state: 'closed', state_reason: 'completed' });
  }

  await rm(entryFile, { force: true });
  if (recent < RATE.max) {
    const entry = { login, cmd: line.slice(0, 40), summary: result.summary, unknown: Boolean(result.unknown), at: now.toISOString() };
    await writeFile(entryFile, JSON.stringify(entry));
  }
  console.log(`shell: @${login} ran "${line}" → ${result.summary}`);
} else if (mode === 'record') {
  const entry = await readJson(entryFile, null);
  if (!entry) {
    console.log('shell: nothing to record');
    process.exit(0);
  }
  const history = await readJson(historyFile, { total: 0, since: null, visitors: [], entries: [] });
  history.total += 1;
  history.since ??= entry.at;
  if (!history.visitors.includes(entry.login)) history.visitors.push(entry.login);
  history.entries = [...history.entries, entry].slice(-50);
  await writeFile(historyFile, JSON.stringify(history, null, 2) + '\n');
  console.log(`shell: recorded #${history.total}`);
} else {
  console.error('usage: node scripts/shell.mjs reply|record');
  process.exit(2);
}
