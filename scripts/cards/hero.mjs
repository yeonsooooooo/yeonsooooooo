// neofetch, except the ASCII logo is a hotel: one window per repository, oldest floor at the bottom.
// Windows light up by how recently that repo was pushed; the crane is lifting the next one.
import { frame, typed, prompt, esc, num, stamp, delay } from '../lib/svg.mjs';

function uptime(fromIso, now) {
  const a = new Date(fromIso);
  let y = now.getUTCFullYear() - a.getUTCFullYear();
  let m = now.getUTCMonth() - a.getUTCMonth();
  let d = now.getUTCDate() - a.getUTCDate();
  if (d < 0) {
    m -= 1;
    d += new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate();
  }
  if (m < 0) {
    y -= 1;
    m += 12;
  }
  return `${y}y ${m}m ${d}d`;
}

function building(t, windows, ox, oy) {
  const cols = 8;
  const ww = 16;
  const wh = 9;
  const gx = 8;
  const gy = 7;
  const pad = 14;
  const floors = Math.ceil(windows.length / cols) + (windows.length % cols === 0 ? 1 : 0);
  const bw = cols * ww + (cols - 1) * gx + pad * 2;
  const lobby = 36;
  const bh = floors * (wh + gy) + 10 + lobby;
  const top = oy - bh; // oy is ground level
  const out = [];

  // stars (dark only) — static, a few twinkle
  if (t.id === 'dark') {
    const stars = [[-20, -250], [-14, -150], [262, -300], [250, -190], [60, -270], [20, -300], [150, -296]];
    stars.forEach(([sx, sy], i) =>
      out.push(`<circle cx="${ox + sx}" cy="${oy + sy}" r="${i % 3 ? 0.9 : 1.3}" fill="${t.dim}" ${i % 2 ? `class="pulse" ${delay(i * 0.7)}` : ''}/>`),
    );
  }

  // body
  out.push(`<rect x="${ox}" y="${top}" width="${bw}" height="${bh}" fill="${t.body}" stroke="${t.border}"/>`);
  out.push(`<rect x="${ox - 6}" y="${top - 6}" width="${bw + 12}" height="6" fill="${t.border}"/>`);

  // roof sign
  const signW = 128;
  const sx = ox + (bw - signW) / 2;
  out.push(`<line x1="${sx + 20}" y1="${top - 6}" x2="${sx + 20}" y2="${top - 14}" stroke="${t.faint}" stroke-width="2"/>`);
  out.push(`<line x1="${sx + signW - 20}" y1="${top - 6}" x2="${sx + signW - 20}" y2="${top - 14}" stroke="${t.faint}" stroke-width="2"/>`);
  out.push(`<rect x="${sx}" y="${top - 34}" width="${signW}" height="20" rx="3" fill="${t.bg}" stroke="${t.pink}" stroke-opacity=".6"/>`);
  out.push(`<text x="${sx + signW / 2}" y="${top - 19.5}" text-anchor="middle" class="pink b neon" style="font-size:12px;letter-spacing:3px" filter="url(#glow)">HOTEL·YS</text>`);

  // windows, bottom-left first
  const slots = floors * cols;
  for (let i = 0; i < slots; i++) {
    const floor = Math.floor(i / cols);
    const col = i % cols;
    const x = ox + pad + col * (ww + gx);
    const y = oy - lobby - 6 - (floor + 1) * (wh + gy) + gy;
    const w = windows[i];
    if (!w) {
      out.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${ww - 1}" height="${wh - 1}" fill="none" stroke="${t.faint}" stroke-dasharray="2 2"/>`);
      continue;
    }
    const age = w.pushedDays;
    const fill = age <= 7 ? t.lit : age <= 30 ? t.warm : age <= 180 ? t.tv : t.off;
    const glow = age <= 7 ? ' filter="url(#glow)"' : '';
    const flicker = age <= 7 && i % 5 === 0 ? ' pulse' : '';
    out.push(`<rect x="${x}" y="${y}" width="${ww}" height="${wh}" rx="1" fill="${fill}" stroke="${t.border}" stroke-width=".6" class="in${flicker}" ${delay(0.9 + i * 0.012)}${glow}/>`);
  }

  // lobby: glass doors + the kiosk
  const gy0 = oy - lobby;
  out.push(`<line x1="${ox}" y1="${gy0 - 3}" x2="${ox + bw}" y2="${gy0 - 3}" stroke="${t.border}"/>`);
  const dx = ox + bw / 2 - 22;
  out.push(`<rect x="${dx}" y="${gy0 + 6}" width="44" height="${lobby - 6}" fill="${t.tv}" fill-opacity=".5" stroke="${t.border}"/>`);
  out.push(`<line x1="${dx + 22}" y1="${gy0 + 6}" x2="${dx + 22}" y2="${oy}" stroke="${t.border}"/>`);
  const kx = ox + bw - 40;
  out.push(`<rect x="${kx}" y="${gy0 + 8}" width="14" height="${lobby - 8}" rx="2" fill="${t.chrome}" stroke="${t.dim}" stroke-width=".8"/>`);
  out.push(`<rect x="${kx + 2.5}" y="${gy0 + 11}" width="9" height="13" rx="1" fill="${t.cyan}" class="pulse"/>`);
  out.push(`<text x="${kx + 7}" y="${oy + 14}" text-anchor="middle" class="faint" style="font-size:8px">kiosk</text>`);
  out.push(`<rect x="${ox + 16}" y="${gy0 + 12}" width="30" height="16" fill="${t.tv}" fill-opacity=".35" stroke="${t.border}"/>`);

  // ground
  out.push(`<line x1="${ox - 24}" y1="${oy}" x2="${ox + bw + 24}" y2="${oy}" stroke="${t.dim}"/>`);

  // tower crane: mast on the left of the roof, jib reaching past the right edge,
  // lowering the next window down the side of the building
  const mx = ox + 22;
  const mastTop = top - 66;
  const jibEnd = ox + bw + 26;
  out.push(`<g stroke="${t.amber}" stroke-width="1.4" fill="none">`);
  out.push(`<path d="M${mx - 4} ${top - 6} V${mastTop} M${mx + 4} ${top - 6} V${mastTop}"/>`);
  for (let y = top - 6; y > mastTop + 6; y -= 8) out.push(`<path d="M${mx - 4} ${y} L${mx + 4} ${y - 8}"/>`);
  out.push(`<path d="M${mx - 30} ${mastTop} H${jibEnd} M${mx - 30} ${mastTop + 5} H${jibEnd - 6}"/>`);
  for (let x = mx + 4; x < jibEnd - 8; x += 10) out.push(`<path d="M${x} ${mastTop + 5} L${x + 5} ${mastTop} L${x + 10} ${mastTop + 5}"/>`);
  out.push(`<path d="M${mx - 4} ${mastTop} L${mx} ${mastTop - 12} L${mx + 4} ${mastTop} M${mx} ${mastTop - 12} L${jibEnd - 40} ${mastTop} M${mx} ${mastTop - 12} L${mx - 30} ${mastTop}"/>`);
  out.push(`</g>`);
  out.push(`<rect x="${mx - 32}" y="${mastTop + 5}" width="14" height="8" fill="${t.faint}"/>`);
  const hx = jibEnd - 10;
  out.push(`<rect x="${hx - 5}" y="${mastTop + 5}" width="10" height="4" fill="${t.amber}"/>`);
  const drop = (a) => `values="${a} ; ${a + 34} ; ${a + 34} ; ${a} ; ${a}" keyTimes="0;.4;.6;.92;1" dur="7s" repeatCount="indefinite"`;
  out.push(`<line x1="${hx}" y1="${mastTop + 9}" x2="${hx}" y2="${mastTop + 20}" stroke="${t.dim}" stroke-width="1"><animate attributeName="y2" ${drop(mastTop + 20)}/></line>`);
  out.push(`<rect x="${hx - 8}" y="${mastTop + 20}" width="16" height="9" rx="1" fill="${t.lit}" stroke="${t.amber}" stroke-width=".8" filter="url(#glow)"><animate attributeName="y" ${drop(mastTop + 20)}/></rect>`);
  return { svg: out.join('\n'), width: bw, top: mastTop };
}

export function hero({ t, stats, config, now }) {
  const W = 900;
  const H = 492;
  const login = stamp(new Date(stats.generatedAt), config.tzOffsetHours);
  const body = [];

  body.push(`<text x="24" y="62" class="dim">Last login: ${login.dow} ${login.mon} ${login.day} ${login.time} ${config.tzLabel} on ttys001 — data refreshed nightly by GitHub Actions</text>`);
  body.push(prompt(t, 24, 86));
  const cmd = typed({ x: 58, y: 86, text: 'neofetch --live', begin: 0.2, cps: 22 });
  body.push(cmd.svg);

  const b = building(t, stats.windows, 44, 440);
  body.push(b.svg);
  body.push(`<text x="${44 + b.width / 2}" y="470" text-anchor="middle" class="dim" style="font-size:11px">1 window = 1 repo · lit = pushed ≤ 30d</text>`);

  // info column
  const kx = 336;
  const vx = 440;
  let y = 124;
  const lh = 21.5;
  const t0 = cmd.end + 0.1;
  let i = 0;
  const line = (inner) => {
    body.push(`<g class="in" ${delay(t0 + i++ * 0.06)}>${inner}</g>`);
  };
  const kv = (k, v, cls = 'cyan') => {
    line(`<text x="${kx}" y="${y}" class="${cls} b">${esc(k)}</text><text x="${vx}" y="${y}">${v}</text>`);
    y += lh;
  };

  line(`<text x="${kx}" y="${y}" style="font-size:15px" class="b"><tspan class="green">${esc(config.login)}</tspan><tspan class="dim">@</tspan><tspan class="blue">${esc(config.host)}</tspan></text>`);
  y += 12;
  line(`<line x1="${kx}" y1="${y}" x2="${kx + 200}" y2="${y}" stroke="${t.dim}" stroke-dasharray="3 3"/>`);
  y += 22;

  const c = stats.commits;
  const r = stats.repos;
  kv('Name', `${esc(config.name.ko)} <tspan class="dim">·</tspan> ${esc(config.name.en)}`);
  kv('OS', esc(config.neofetch.os));
  kv('Host', `${esc(config.location)} <tspan class="dim">· UTC+${config.tzOffsetHours} (${config.tzLabel})</tspan>`);
  kv('Kernel', esc(config.neofetch.kernel));
  kv('Uptime', `${uptime(stats.user.createdAt, now)} <tspan class="dim">(on GitHub since ${stats.user.createdAt.slice(0, 10)})</tspan>`);
  kv('Packages', `${num(r.total)} repos <tspan class="dim">(${r.public} public · ${r.private} private)</tspan>`);
  kv('Shell', esc(config.neofetch.shell));
  kv('Stack', esc(config.neofetch.stack));

  // language bar — weighted by this year's commits, not bytes
  const langs = stats.languagesActive.slice(0, 4);
  const barW = 150;
  let bx = vx;
  const segs = langs.map((l) => {
    const w = Math.max(2, (l.pct / 100) * barW);
    const seg = `<rect x="${bx.toFixed(1)}" y="${y - 10}" width="${w.toFixed(1)}" height="10" fill="${l.color}"/>`;
    bx += w;
    return seg;
  });
  const names = langs.slice(0, 2).map((l) => `${esc(l.name)} ${Math.round(l.pct)}%`).join(' · ');
  line(
    `<text x="${kx}" y="${y}" class="cyan b">Writing</text>` +
      `<clipPath id="lb"><rect x="${vx}" y="${y - 10}" width="${barW}" height="10" rx="2"/></clipPath>` +
      `<rect x="${vx}" y="${y - 10}" width="${barW}" height="10" rx="2" fill="${t.faint}"/><g clip-path="url(#lb)">${segs.join('')}</g>` +
      `<text x="${vx + barW + 10}" y="${y}" class="dim" style="font-size:12.5px">${names}</text>`,
  );
  y += lh;

  kv('Commits', `<tspan class="green b">${num(c.year)}</tspan> this year <tspan class="dim">· ${num(c.allTime)} all-time, private included</tspan>`, 'amber');
  kv('Streak', `<tspan class="b">${c.currentStreak}d</tspan> current <tspan class="dim">· ${c.longestStreak}d longest · ${c.activeDays}/365 active days</tspan>`, 'amber');
  kv('Shipping', `${r.pushedWeek} repos pushed this week <tspan class="dim">· ${r.createdThisYear} new this year</tspan>`, 'amber');
  kv('Motto', `<tspan class="pink">${esc(config.motto)}</tspan>`, 'amber');

  // palette swatches
  const sw = [t.faint, t.red, t.green, t.amber, t.blue, t.purple, t.cyan, t.text];
  line(sw.map((col, j) => `<rect x="${kx + j * 26}" y="${y - 6}" width="26" height="14" fill="${col}"/>`).join(''));
  body.push(`<text x="${kx + 8 * 26 + 12}" y="${y + 5}" class="dim">▍<tspan class="blink green">█</tspan></text>`);

  return frame({
    t,
    w: W,
    h: H,
    title: `${config.login}@${config.host}: ~ — zsh — 120×32`,
    label: `${config.name.en} (${config.name.ko}) — ${config.tagline} ${num(c.year)} commits across ${r.total} repositories in the last year.`,
    defs: `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    body: body.join('\n'),
  });
}
