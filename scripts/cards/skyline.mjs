// The contribution graph GitHub can't show: every commit across every repo (private included),
// as an isometric skyline, next to what the public graph says. Plus a 24h commit clock.
import { frame, typed, prompt, num, pts, shade, delay } from '../lib/svg.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function skyline({ t, stats, config }) {
  const W = 900;
  const H = 454;
  const c = stats.commits;
  const days = c.calendar.days;
  const start = new Date(`${c.calendar.start}T00:00:00Z`);
  const body = [];

  body.push(prompt(t, 24, 62));
  const cmd = typed({ x: 58, y: 62, text: `git log --all-repos --author=${config.login} --since=1.year | skyline`, begin: 0.2, cps: 45 });
  body.push(cmd.svg);

  // the headline: real vs. public
  const d0 = cmd.end;
  body.push(`<g class="in" ${delay(d0)}>`);
  body.push(`<text x="24" y="118" class="green b" style="font-size:40px">${num(c.year)}</text>`);
  body.push(`<text x="24" y="140" class="dim" style="font-size:12px">commits · all repos · 365d</text>`);
  body.push(`</g><g class="in" ${delay(d0 + 0.25)}>`);
  const vx = Math.max(24 + String(num(c.year)).length * 24.5 + 26, 236);
  body.push(`<text x="${vx}" y="112" class="faint" style="font-size:14px">vs</text>`);
  body.push(`<text x="${vx + 30}" y="118" class="dim b" style="font-size:40px">${stats.publicContributions}</text>`);
  const pubW = String(stats.publicContributions).length * 24.5;
  body.push(`<line x1="${vx + 28}" y1="105" x2="${vx + 32 + pubW}" y2="105" stroke="${t.red}" stroke-width="2.5"/>`);
  body.push(`<text x="${vx + 30}" y="140" class="dim" style="font-size:12px">what the public graph shows</text>`);
  body.push(`</g>`);

  // stat chips
  const chips = [
    ['current streak', `${c.currentStreak}d`],
    ['longest streak', `${c.longestStreak}d`],
    ['busiest day', `${c.busiest.count}`, c.busiest.date.slice(5)],
    ['active days', `${c.activeDays}`, '/365'],
  ];
  chips.forEach(([label, value, suffix], i) => {
    const x = 560 + (i % 2) * 162;
    const y = 96 + Math.floor(i / 2) * 42;
    body.push(
      `<g class="in" ${delay(d0 + 0.35 + i * 0.07)}><text x="${x}" y="${y}" class="b" style="font-size:18px">${value}<tspan class="dim" style="font-size:12px;font-weight:400"> ${suffix ?? ''}</tspan></text>` +
        `<text x="${x}" y="${y + 16}" class="dim" style="font-size:11px">${label}</text></g>`,
    );
  });

  // ---- isometric skyline ----
  const wv = [10.6, -2.1]; // one week back-right
  const dv = [5.4, 3.5]; // one day toward the viewer
  const ox = 30;
  const oy = 392;
  const max = Math.max(...days, 1);
  const nonzero = days.filter(Boolean).sort((a, b) => a - b);
  const q = (p) => nonzero[Math.floor(p * (nonzero.length - 1))] ?? 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (v) => (v === 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);
  const at = (w, d, h = 0) => [ox + w * wv[0] + d * dv[0], oy + w * wv[1] + d * dv[1] - h];
  const weeks = Math.ceil(days.length / 7);

  // month labels along the front edge
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const date = new Date(start.getTime() + w * 7 * 86_400_000);
    if (date.getUTCMonth() !== lastMonth && date.getUTCDate() <= 7) {
      lastMonth = date.getUTCMonth();
      const [x, y] = at(w, 7.9);
      body.push(`<text x="${x.toFixed(1)}" y="${(y + 12).toFixed(1)}" class="faint" style="font-size:10px" transform="rotate(-11 ${x.toFixed(1)} ${(y + 12).toFixed(1)})">${MONTHS[lastMonth]}</text>`);
    }
  }

  // floor
  body.push(`<polygon points="${pts([at(0, 0), at(weeks, 0), at(weeks, 7), at(0, 7)])}" fill="${t.grid}" stroke="${t.border}" stroke-width=".6"/>`);

  // bars, back to front: day ascending, week descending — correct for this view direction
  const bars = [];
  for (let d = 0; d < 7; d++) {
    for (let w = weeks - 1; w >= 0; w--) {
      const i = w * 7 + d;
      if (i >= days.length) continue;
      const v = days[i];
      const lv = level(v);
      const h = v ? 3 + 84 * Math.sqrt(v / max) : 0;
      const isPeak = i === days.indexOf(max);
      const top = isPeak ? t.amber : t.heat[lv];
      const inset = 0.12;
      const a = at(w + inset, d + inset, h);
      const b = at(w + 1 - inset, d + inset, h);
      const cc = at(w + 1 - inset, d + 1 - inset, h);
      const dd = at(w + inset, d + 1 - inset, h);
      if (!v) {
        bars.push(`<polygon points="${pts([a, b, cc, dd])}" fill="${t.heat[0]}" stroke="${t.border}" stroke-width=".3"/>`);
        continue;
      }
      const down = ([x, y]) => [x, y + h];
      const g =
        `<polygon points="${pts([dd, cc, down(cc), down(dd)])}" fill="${shade(top, -0.3)}"/>` + // front (+day)
        `<polygon points="${pts([a, dd, down(dd), down(a)])}" fill="${shade(top, -0.48)}"/>` + // left (-week)
        `<polygon points="${pts([a, b, cc, dd])}" fill="${top}"/>`;
      bars.push(`<g class="in" ${delay(d0 + 0.3 + w * 0.018)}>${g}</g>`);
    }
  }
  body.push(bars.join(''));

  // peak callout
  const pi = days.indexOf(max);
  const [px, py] = at(Math.floor(pi / 7) + 0.5, (pi % 7) + 0.5, 3 + 84);
  body.push(`<g class="in" ${delay(d0 + 1.4)}><line x1="${px.toFixed(1)}" y1="${(py - 4).toFixed(1)}" x2="${px.toFixed(1)}" y2="${(py - 22).toFixed(1)}" stroke="${t.amber}"/>` +
    `<text x="${px.toFixed(1)}" y="${(py - 27).toFixed(1)}" text-anchor="middle" class="amber" style="font-size:11px">${c.busiest.date.slice(5)} · ${max}</text></g>`);

  // today
  const ti = days.length - 1;
  const [tx, ty] = at(Math.floor(ti / 7) + 0.5, (ti % 7) + 0.5, days[ti] ? 3 + 84 * Math.sqrt(days[ti] / max) : 0);
  body.push(`<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="5" fill="none" stroke="${t.green}" class="pulse"/>`);

  // ---- commit clock ----
  const ccx = 790;
  const ccy = 300;
  const r0 = 24;
  const maxH = Math.max(...c.hours, 1);
  body.push(`<g class="in" ${delay(d0 + 0.6)}>`);
  body.push(`<text x="${ccx}" y="200" text-anchor="middle" class="dim" style="font-size:11px">commit clock · ${config.tzLabel}</text>`);
  body.push(`<circle cx="${ccx}" cy="${ccy}" r="${r0 + 56}" fill="none" stroke="${t.grid}"/>`);
  body.push(`<circle cx="${ccx}" cy="${ccy}" r="${r0 - 4}" fill="none" stroke="${t.border}"/>`);
  c.hours.forEach((v, h) => {
    const ang = ((h + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
    const len = 4 + 48 * (v / maxH);
    const x1 = ccx + Math.cos(ang) * r0;
    const y1 = ccy + Math.sin(ang) * r0;
    const x2 = ccx + Math.cos(ang) * (r0 + len);
    const y2 = ccy + Math.sin(ang) * (r0 + len);
    const col = h === c.peakHour ? t.amber : t.heat[Math.min(4, 1 + Math.floor((v / maxH) * 3.999))];
    body.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="5.5" stroke-linecap="round"/>`);
  });
  for (const [h, label] of [[0, '00'], [6, '06'], [12, '12'], [18, '18']]) {
    const ang = (h / 24) * Math.PI * 2 - Math.PI / 2;
    const x = ccx + Math.cos(ang) * (r0 + 66);
    const y = ccy + Math.sin(ang) * (r0 + 66) + 4;
    body.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" class="faint" style="font-size:10px">${label}</text>`);
  }
  body.push(`<text x="${ccx}" y="${ccy + 2}" text-anchor="middle" class="amber b" style="font-size:15px">${String(c.peakHour).padStart(2, '0')}h</text>`);
  body.push(`<text x="${ccx}" y="${ccy + 15}" text-anchor="middle" class="dim" style="font-size:9px">peak</text>`);
  body.push(`<text x="${ccx}" y="414" text-anchor="middle" class="dim" style="font-size:11px">${c.nightOwlPct}% after 22:00 · 🦉</text>`);
  body.push(`</g>`);

  body.push(`<text x="876" y="${H - 12}" text-anchor="end" class="faint" style="font-size:11px"># default branches only · ${config.tzLabel} · recomputed nightly from the GitHub GraphQL API</text>`);

  return frame({
    t,
    w: W,
    h: H,
    title: 'git log — all repositories, last 365 days',
    label: `${num(c.year)} commits in the last year across all repositories, while the public contribution graph shows ${stats.publicContributions}. Longest streak ${c.longestStreak} days, busiest day ${c.busiest.date} with ${c.busiest.count} commits.`,
    body: body.join('\n'),
  });
}
