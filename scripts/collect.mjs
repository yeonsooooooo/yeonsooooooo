// Reads every repository the token can see and reduces it to data/stats.json.
// Private repositories contribute counts, histograms and language bytes — never names or descriptions.
//
//   GH_PAT=<token with repo scope> node scripts/collect.mjs
//
// Without a token that can read private repos, the cached full-mode stats are kept as-is,
// so a missing secret never silently shrinks the profile.
import { readFile, writeFile } from 'node:fs/promises';
import { client } from './lib/gh.mjs';
import config from '../profile.config.mjs';

const STATS = new URL('../data/stats.json', import.meta.url);
const DAY = 86_400_000;
const TZ = config.tzOffsetHours * 3_600_000;

const cached = await readFile(STATS, 'utf8').then(JSON.parse).catch(() => null);
const token = process.env.GH_PAT || process.env.GH_TOKEN;
if (!token) {
  console.warn('collect: no GH_PAT — keeping cached stats');
  process.exit(0);
}

const gh = client(token);
const local = (iso) => new Date(new Date(iso).getTime() + TZ); // read with getUTC* for KST wall-clock
const dayKey = (d) => d.toISOString().slice(0, 10);

// Calendar window: 53 columns ending with the current KST week, weeks start on Sunday (like GitHub).
const today = local(new Date().toISOString());
today.setUTCHours(0, 0, 0, 0);
const windowStart = new Date(today.getTime() - (52 * 7 + today.getUTCDay()) * DAY);
const since = new Date(windowStart.getTime() - TZ).toISOString();

let user;
try {
  ({ user } = await gh.graphql(
    `query($login:String!){ user(login:$login){
      id login name bio location createdAt
      followers{totalCount} following{totalCount}
      contributionsCollection{ contributionCalendar{ totalContributions } }
    } }`,
    { login: config.login },
  ));
} catch (err) {
  console.warn(`collect: token rejected (${err.message}) — keeping cached stats`);
  process.exit(0);
}

const repos = [];
for (let after = null; ; ) {
  const { user: page } = await gh.graphql(
    `query($login:String!,$after:String,$uid:ID!,$since:GitTimestamp!){ user(login:$login){
      repositories(ownerAffiliations:OWNER, isFork:false, first:50, after:$after){
        pageInfo{ hasNextPage endCursor }
        nodes{
          name description isPrivate isArchived createdAt pushedAt stargazerCount
          primaryLanguage{ name color }
          languages(first:12, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name color } } }
          defaultBranchRef{ target{ ... on Commit{
            year: history(since:$since, author:{id:$uid}){ totalCount }
            all: history(author:{id:$uid}){ totalCount }
          } } }
        }
      }
    } }`,
    { login: config.login, after, uid: user.id, since },
  );
  repos.push(...page.repositories.nodes);
  if (!page.repositories.pageInfo.hasNextPage) break;
  after = page.repositories.pageInfo.endCursor;
}

const privateCount = repos.filter((r) => r.isPrivate).length;
if (privateCount === 0 && cached?.mode === 'full') {
  console.warn('collect: token sees no private repos — keeping cached full-mode stats');
  process.exit(0);
}

// Commit timestamps, authored by this user, on each default branch.
async function commitDates(repo) {
  const dates = [];
  for (let after = null; ; ) {
    const { repository } = await gh.graphql(
      `query($owner:String!,$name:String!,$uid:ID!,$since:GitTimestamp!,$after:String){
        repository(owner:$owner, name:$name){ defaultBranchRef{ target{ ... on Commit{
          history(first:100, after:$after, since:$since, author:{id:$uid}){
            pageInfo{ hasNextPage endCursor } nodes{ authoredDate }
          }
        } } } } }`,
      { owner: config.login, name: repo.name, uid: user.id, since, after },
    );
    const history = repository.defaultBranchRef.target.history;
    dates.push(...history.nodes.map((n) => n.authoredDate));
    if (!history.pageInfo.hasNextPage) return dates;
    after = history.pageInfo.endCursor;
  }
}

const active = repos.filter((r) => r.defaultBranchRef?.target?.year?.totalCount > 0);
const allDates = [];
for (let i = 0; i < active.length; i += 6) {
  const batch = await Promise.all(active.slice(i, i + 6).map(commitDates));
  allDates.push(...batch.flat());
}

// ---- commit aggregates (KST) ----
const days = Math.round((today - windowStart) / DAY) + 1;
const calendar = new Array(days).fill(0);
const hours = new Array(24).fill(0);
const weekdays = new Array(7).fill(0);
for (const iso of allDates) {
  const d = local(iso);
  const idx = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - windowStart) / DAY);
  if (idx < 0 || idx >= days) continue;
  calendar[idx]++;
  hours[d.getUTCHours()]++;
  weekdays[d.getUTCDay()]++;
}

let longest = 0;
let run = 0;
for (const c of calendar) {
  run = c ? run + 1 : 0;
  longest = Math.max(longest, run);
}
let current = 0;
for (let i = calendar.length - 1 - (calendar.at(-1) ? 0 : 1); i >= 0 && calendar[i]; i--) current++;

const busiestIdx = calendar.indexOf(Math.max(...calendar));
const yearTotal = calendar.reduce((a, b) => a + b, 0);
const night = [22, 23, 0, 1, 2, 3, 4].reduce((a, h) => a + hours[h], 0);
const peakHour = hours.indexOf(Math.max(...hours));

// ---- repositories ----
const ageDays = (iso) => Math.floor((Date.now() - new Date(iso)) / DAY);
const live = repos.filter((r) => !r.isArchived);

const langBytes = new Map();
for (const r of live) {
  for (const { size, node } of r.languages.edges) {
    if (config.excludeLanguages.includes(node.name)) continue;
    const cur = langBytes.get(node.name) ?? { name: node.name, color: node.color, bytes: 0, repos: 0 };
    cur.bytes += size;
    cur.repos += 1;
    langBytes.set(node.name, cur);
  }
}
const totalBytes = [...langBytes.values()].reduce((a, l) => a + l.bytes, 0);
const languages = [...langBytes.values()]
  .sort((a, b) => b.bytes - a.bytes)
  .map((l) => ({ ...l, pct: +((l.bytes / totalBytes) * 100).toFixed(1) }));

// Byte counts reward vendored code; weighting each repo's language mix by this year's
// commits answers "what is actually being written right now".
const writing = new Map();
for (const r of live) {
  const yearCommits = r.defaultBranchRef?.target?.year?.totalCount ?? 0;
  const edges = r.languages.edges.filter((e) => !config.excludeLanguages.includes(e.node.name));
  const bytes = edges.reduce((a, e) => a + e.size, 0);
  if (!yearCommits || !bytes) continue;
  for (const { size, node } of edges) {
    const cur = writing.get(node.name) ?? { name: node.name, color: node.color, weight: 0 };
    cur.weight += (yearCommits * size) / bytes;
    writing.set(node.name, cur);
  }
}
const totalWeight = [...writing.values()].reduce((a, l) => a + l.weight, 0);
const languagesActive = [...writing.values()]
  .sort((a, b) => b.weight - a.weight)
  .map(({ name, color, weight }) => ({ name, color, pct: +((weight / totalWeight) * 100).toFixed(1) }));

function layerOf(r) {
  const hay = `${r.name} ${r.description ?? ''}`;
  const lang = r.primaryLanguage?.name;
  for (const layer of config.layers) if (layer.match.test(hay)) return layer.id;
  for (const layer of config.layers) if (lang && layer.languages.includes(lang)) return layer.id;
  return 'other';
}
const layers = Object.fromEntries([...config.layers.map((l) => l.id), 'other'].map((id) => [id, { repos: 0, active: 0, commits: 0 }]));
for (const r of repos) {
  const l = layers[layerOf(r)];
  l.repos++;
  if (ageDays(r.pushedAt) <= 30) l.active++;
  l.commits += r.defaultBranchRef?.target?.year?.totalCount ?? 0;
}

// One window per repository for the hero building, oldest at the bottom. Anonymous by design.
const windows = [...repos]
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  .map((r) => ({ pushedDays: ageDays(r.pushedAt), layer: layerOf(r) }));

const stats = {
  generatedAt: new Date().toISOString(),
  mode: privateCount > 0 ? 'full' : 'public',
  user: {
    login: user.login,
    name: user.name,
    bio: user.bio,
    location: user.location,
    createdAt: user.createdAt,
    followers: user.followers.totalCount,
    following: user.following.totalCount,
  },
  publicContributions: user.contributionsCollection.contributionCalendar.totalContributions,
  repos: {
    total: repos.length,
    public: repos.length - privateCount,
    private: privateCount,
    archived: repos.filter((r) => r.isArchived).length,
    pushedWeek: repos.filter((r) => ageDays(r.pushedAt) <= 7).length,
    pushedMonth: repos.filter((r) => ageDays(r.pushedAt) <= 30).length,
    createdThisYear: repos.filter((r) => r.createdAt.startsWith(String(today.getUTCFullYear()))).length,
    stars: repos.reduce((a, r) => a + r.stargazerCount, 0),
  },
  commits: {
    year: yearTotal,
    allTime: repos.reduce((a, r) => a + (r.defaultBranchRef?.target?.all?.totalCount ?? 0), 0),
    activeDays: calendar.filter(Boolean).length,
    longestStreak: longest,
    currentStreak: current,
    busiest: { date: dayKey(new Date(windowStart.getTime() + busiestIdx * DAY)), count: calendar[busiestIdx] },
    peakHour,
    nightOwlPct: yearTotal ? Math.round((night / yearTotal) * 100) : 0,
    hours,
    weekdays,
    calendar: { start: dayKey(windowStart), days: calendar },
  },
  languages,
  languagesActive,
  layers,
  windows,
  publicRepos: repos
    .filter((r) => !r.isPrivate)
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))
    .map((r) => ({ name: r.name, description: r.description, language: r.primaryLanguage?.name ?? null, stars: r.stargazerCount, pushedAt: r.pushedAt })),
};

await writeFile(STATS, JSON.stringify(stats, null, 2) + '\n');
console.log(
  `collect: ${stats.mode} · ${repos.length} repos (${privateCount} private) · ${yearTotal} commits/yr · ` +
    `${stats.commits.allTime} all-time · public graph shows ${stats.publicContributions}`,
);
