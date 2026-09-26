// data/*.json + profile.config.mjs → assets/*.svg (dark + light), profile.json, llms.txt, README buttons.
//   node scripts/render.mjs            render everything
//   node scripts/render.mjs --only shell   just the visitor shell (used by the issue workflow)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import config from '../profile.config.mjs';
import { themes, num } from './lib/svg.mjs';
import { hero } from './cards/hero.mjs';
import { stack } from './cards/stack.mjs';
import { skyline } from './cards/skyline.mjs';
import { timeline } from './cards/timeline.mjs';
import { shell, button, statusline } from './cards/shell.mjs';

const root = new URL('../', import.meta.url);
const at = (p) => new URL(p, root);
const readJson = (p, fallback) => readFile(at(p), 'utf8').then(JSON.parse).catch(() => fallback);

const stats = await readJson('data/stats.json', null);
if (!stats) throw new Error('data/stats.json missing — run collect.mjs with GH_PAT first');
const history = await readJson('data/history.json', { total: 0, since: null, visitors: [], entries: [] });
const now = new Date();
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

await mkdir(at('assets/btn'), { recursive: true });
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

const cards = {
  hero: (t) => hero({ t, stats, config, now }),
  stack: (t) => stack({ t, stats, config }),
  skyline: (t) => skyline({ t, stats, config }),
  timeline: (t) => timeline({ t, config }),
  shell: (t) => shell({ t, history, config }),
  status: (t) => statusline({ t, stats, config, now }),
};

for (const t of Object.values(themes)) {
  for (const [name, render] of Object.entries(cards)) {
    if (only && name !== only) continue;
    await writeFile(at(`assets/${name}-${t.id}.svg`), render(t));
  }
  if (only) continue;
  for (const label of config.shell.buttons) await writeFile(at(`assets/btn/${slug(label)}-${t.id}.svg`), button({ t, label }));
  for (const [file, label] of [['linkedin', 'linkedin'], ['profile-json', 'profile.json'], ['llms-txt', 'llms.txt']])
    await writeFile(at(`assets/btn/link-${file}-${t.id}.svg`), button({ t, label, prefix: '↗' }));
}

if (!only) {
  // Buttons in README: each one opens a pre-filled issue that the shell workflow answers.
  const repo = `https://github.com/${config.login}/${config.login}`;
  const raw = `https://raw.githubusercontent.com/${config.login}/${config.login}/main/`;
  const issueBody = (cmd) =>
    `👋 Hit **Create** — a GitHub Action runs \`$ ${cmd}\` and replies here in about 30 seconds.\n\n` +
    `Keep the title as-is; it is the command. The issue closes itself once answered.`;
  const buttons = config.shell.buttons
    .map((cmd) => {
      const href = `${repo}/issues/new?title=${encodeURIComponent(`$ ${cmd}`)}&body=${encodeURIComponent(issueBody(cmd))}`;
      const s = slug(cmd);
      return `<a href="${href}"><picture><source media="(prefers-color-scheme: dark)" srcset="${raw}assets/btn/${s}-dark.svg"><img alt="$ ${cmd}" src="${raw}assets/btn/${s}-light.svg" width="128"></picture></a>`;
    })
    .join('\n');
  const readme = await readFile(at('README.md'), 'utf8');
  await writeFile(at('README.md'), readme.replace(/(<!-- buttons:start -->)[\s\S]*?(<!-- buttons:end -->)/, `$1\n${buttons}\n$2`));

  // Machine-readable profile for crawlers and agents. Public-safe fields only.
  const layers = [...config.layers]
    .sort((a, b) => b.level - a.level)
    .map((l) => ({ layer: l.name.toLowerCase(), tech: l.tech, repos: stats.layers[l.id].repos, commitsLastYear: stats.layers[l.id].commits }));
  const profile = {
    name: `${config.name.en} (${config.name.ko})`,
    github: config.login,
    location: config.location,
    tagline: config.tagline,
    links: { github: `https://github.com/${config.login}`, linkedin: config.links.linkedin },
    stack: layers,
    writing: stats.languagesActive.slice(0, 6).map(({ name, pct }) => ({ language: name, sharePct: pct })),
    activity: {
      commitsLastYear: stats.commits.year,
      commitsAllTime: stats.commits.allTime,
      activeDaysLastYear: stats.commits.activeDays,
      currentStreakDays: stats.commits.currentStreak,
      repositories: { total: stats.repos.total, public: stats.repos.public, private: stats.repos.private },
      note: 'Counts include private repositories; names of private repositories are intentionally omitted.',
    },
    timeline: config.timeline.map(({ date, msg }) => ({ date, event: msg })),
    updatedAt: stats.generatedAt,
  };
  await writeFile(at('profile.json'), JSON.stringify(profile, null, 2) + '\n');

  const llms = [
    `# ${config.name.en} (${config.name.ko}) — github.com/${config.login}`,
    '',
    `> ${config.tagline}`,
    '',
    `Based in ${config.location}. ${num(stats.commits.year)} commits in the last year across ${stats.repos.total} repositories ` +
      `(${stats.repos.private} private; the public contribution graph shows only ${stats.publicContributions}).`,
    '',
    '## Stack, top to bottom',
    ...layers.map((l) => `- ${l.layer}: ${l.tech} (${l.repos} repos)`),
    '',
    '## Writing right now (share of this year\'s commits)',
    ...profile.writing.map((l) => `- ${l.language}: ${l.sharePct}%`),
    '',
    '## Timeline',
    ...profile.timeline.map((e) => `- ${e.date}: ${e.event}`),
    '',
    '## Contact',
    `- LinkedIn: ${config.links.linkedin}`,
    '',
    `Structured version: https://raw.githubusercontent.com/${config.login}/${config.login}/main/profile.json`,
    '',
  ].join('\n');
  await writeFile(at('llms.txt'), llms);
}

console.log(`render: ${only ?? 'all'} · ${Object.keys(themes).length} themes · stats from ${stats.generatedAt}`);
