// The profile's shell. Visitors open an issue titled "$ <command>"; shell.mjs calls run()
// and posts the output as a comment. Pure functions only — nothing here touches the network.
import { stamp } from './svg.mjs';

const clean = (s) => String(s).replace(/[\u0000-\u001f\u007f<>`]/g, '').replace(/\s+/g, ' ').trim();

export function parse(title) {
  const line = clean(title).replace(/^\$\s*/, '').slice(0, 60);
  const [name = '', ...args] = line.split(' ');
  return { line, name: name.toLowerCase(), args };
}

function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return h;
}

function rng(seed) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const FORTUNE = {
  배포운: [
    "오늘은 main에 push 금지. 브랜치를 사랑하라.",
    "'staging에선 됐는데…'를 오늘 말하게 된다.",
    '배포는 되지만 캐시가 늦게 풀린다. 강력 새로고침을 믿어라.',
    'CI가 한 번에 초록불. 그래도 롤백 스크립트는 챙길 것.',
    '금요일 오후 배포도 무사통과. 오늘은 당신이 SRE다.',
  ],
  버그운: [
    "'내 로컬에선 되는데'의 날. 도커부터 켜라.",
    'off-by-one이 당신을 지켜보고 있다.',
    '고친 버그가 친구를 한 명 데려온다.',
    'console.log 한 줄이 모든 걸 설명해 준다.',
    '재현 안 되던 버그가 스스로 자백한다.',
  ],
  리뷰운: [
    '리뷰 요청 후 읽음, 응답 없음.',
    '변수명 논쟁이 스레드 30개로 번진다.',
    "리뷰어가 '사소한 질문'으로 시작한다. 사소하지 않다.",
    'nit 두 개, 그리고 칭찬 하나.',
    'LGTM이 세 개 연속으로 달린다.',
  ],
};
const LUCKY_CMD = ['git stash pop', 'git bisect good', 'npm ci', 'docker compose up -d', 'git commit --amend', 'rm -rf node_modules', 'git push --force-with-lease', 'pnpm dedupe'];
const LUCKY_PORT = [22, 443, 1337, 3000, 5173, 5432, 6379, 8080];
const VERDICT = ['凶 흉', '小凶 소흉', '平 평', '吉 길', '大吉 대길'];

function fortune(login, now, tz) {
  const day = stamp(now, tz).date;
  const r = rng(hash(`${login}:${day}`));
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const rows = Object.entries(FORTUNE).map(([k, lines]) => {
    const n = 1 + Math.floor(r() * 5);
    return { k, n, stars: '★'.repeat(n) + '☆'.repeat(5 - n), line: lines[n - 1] };
  });
  const avg = rows.reduce((a, x) => a + x.n, 0) / rows.length;
  const verdict = VERDICT[Math.min(4, Math.max(0, Math.round(avg) - 1))];
  const text = [
    `🔮 오늘의 개발 운세 — ${day} (KST) · @${login}`,
    '',
    ...rows.map((x) => `  ${x.k}  ${x.stars}  ${x.line}`),
    '',
    `  총운      ${verdict}`,
    `  행운의 커맨드  ${pick(LUCKY_CMD)}`,
    `  행운의 포트    ${pick(LUCKY_PORT)}`,
    '',
    '  (same login, same day, same fortune — seeded, not random)',
  ].join('\n');
  const best = rows.reduce((a, b) => (b.n > a.n ? b : a));
  return { text, summary: `${verdict} · ${best.k} ${best.stars}` };
}

function loadAverage(days) {
  const avg = (n) => (days.slice(-n).reduce((a, b) => a + b, 0) / n).toFixed(2);
  return [avg(1), avg(7), avg(30)];
}

export function run(line, { login, now, stats, config }) {
  const { name, args } = parse(line);
  const tz = config.tzOffsetHours;
  const c = stats.commits;
  const s = stamp(now, tz);

  switch (name) {
    case 'help':
    case '--help':
    case 'man':
      return {
        text: [
          'available commands:',
          '  fortune       오늘의 개발 운세 (seeded by your login + date)',
          '  whoami        who you are, who I am',
          '  ls projects   public repos (+ how many private ones are running)',
          '  uptime        load average, measured in commits/day',
          '  neofetch      the short version of this profile',
          '  coffee        ☕',
          '  hire          how to reach me',
          '  ping          latency to Seoul',
        ].join('\n'),
        summary: 'listed 8 commands',
      };
    case 'fortune':
      return fortune(login, now, tz);
    case 'whoami':
      return {
        text: `you  → @${login}, a curious visitor\nme   → ${config.name.ko} (${config.name.en}), ${config.location}\n       ${config.tagline}`,
        summary: `@${login} · curious visitor`,
      };
    case 'ls':
    case 'projects': {
      const pub = stats.publicRepos.slice(0, 10).map((r) => `  ${r.name.padEnd(30)} ${(r.language ?? '—').padEnd(18)} ${r.description ?? ''}`);
      return {
        text: [`drwxr-xr-x  ${stats.repos.public} public`, ...pub, `  …`, `drwx------  ${stats.repos.private} private — running in production, names redacted`].join('\n'),
        summary: `${stats.repos.public} public · ${stats.repos.private} private (redacted)`,
      };
    }
    case 'uptime': {
      const [l1, l7, l30] = loadAverage(c.calendar.days);
      return {
        text: ` ${s.time}  up since ${stats.user.createdAt.slice(0, 10)},  ${stats.repos.total} repos,  load average: ${l1}, ${l7}, ${l30}\n (load = commits per day over the last 1 / 7 / 30 days)`,
        summary: `load average: ${l1}, ${l7}, ${l30}`,
      };
    }
    case 'neofetch':
      return {
        text: [
          `${config.login}@${config.host}`,
          '-'.repeat(config.login.length + config.host.length + 1),
          `OS: ${config.neofetch.os}`,
          `Stack: ${config.neofetch.stack}`,
          `Repos: ${stats.repos.total} (${stats.repos.private} private)`,
          `Commits/yr: ${c.year} (public graph: ${stats.publicContributions})`,
          `Streak: ${c.currentStreak}d`,
        ].join('\n'),
        summary: `${stats.repos.total} repos · ${c.year} commits/yr`,
      };
    case 'coffee':
    case 'brew':
      return {
        text: ['      ( (', '       ) )', '    ........', '    |      |]', '    \\      /', "     `----'", '', 'HTTP/1.1 418 I’m a teapot', `…but it's ${s.time} in Seoul, so the coffee is already brewing.`].join('\n'),
        summary: '418 I’m a teapot',
      };
    case 'hire':
    case 'contact':
    case 'mail':
      return {
        text: `→ ${config.links.linkedin}\n\nopen to hard problems in hospitality, automation, and anything that ships to real hardware.`,
        summary: 'opened a line to LinkedIn',
      };
    case 'ping':
      return {
        text: `PING seoul (${config.tzLabel} ${s.time}): 56 data bytes\n64 bytes from ${config.host}: icmp_seq=0 ttl=64 time=${(8 + (hash(login) % 30)).toFixed(0)}ms\n--- ${c.currentStreak}-day streak, 0% packet loss ---`,
        summary: 'pong from Seoul',
      };
    case 'sudo':
    case 'rm':
    case 'su':
      return {
        text: `${login} is not in the sudoers file. This incident will be reported. 🚨`,
        summary: 'not in the sudoers file 🚨',
      };
    case 'exit':
    case 'logout':
      return { text: 'logout\n[Process completed] — thanks for stopping by.', summary: 'logout' };
    default:
      return {
        text: `zsh: command not found: ${name || '(empty)'}\ntry: $ help`,
        summary: `command not found`,
        unknown: true,
      };
  }
}
