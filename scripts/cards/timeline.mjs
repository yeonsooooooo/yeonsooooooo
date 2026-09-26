// A career rendered as `git log --graph --oneline --decorate`: lanes branch off main,
// grow, and merge into what came next. Content lives in profile.config.mjs → timeline.
import { frame, typed, prompt, esc, delay } from '../lib/svg.mjs';

const LANE_COLOR = ['dim', 'blue', 'orange', 'pink', 'green'];

function sha(text) {
  let h = 0x811c9dc5;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
  return (h.toString(16) + ((h * 2654435761) >>> 0).toString(16)).padStart(8, '0').slice(0, 7);
}

export function timeline({ t, config }) {
  const rows = config.timeline;
  const W = 900;
  const y0 = 110;
  const RH = 22;
  const H = y0 + rows.length * RH + 34;
  const laneX = (l) => 32 + l * 15;
  const rowY = (i) => y0 + i * RH;
  const color = (l) => t[LANE_COLOR[l]] ?? t.dim;
  const body = [];

  body.push(prompt(t, 24, 62));
  const cmd = typed({ x: 58, y: 62, text: 'git log --graph --oneline --decorate --date=format:%Y-%m career', begin: 0.2, cps: 48 });
  body.push(cmd.svg);
  body.push(`<text x="24" y="84" class="dim in" ${delay(cmd.end)}># newest first · lanes branch from main and merge into what came next</text>`);

  // lane segments, walking oldest → newest
  const segs = [];
  const open = new Map();
  for (let i = rows.length - 1; i >= 0; i--) {
    const { lane, branch, merge } = rows[i];
    if (lane === 0) continue;
    if (!open.has(lane)) open.set(lane, { lane, bottom: i, branchFrom: branch });
    if (merge !== undefined) {
      segs.push({ ...open.get(lane), top: i, mergeInto: merge });
      open.delete(lane);
    }
  }
  for (const s of open.values()) segs.push({ ...s, top: -1 });

  const g = [];
  const topEdge = y0 - RH * 0.9;
  g.push(`<line x1="${laneX(0)}" y1="${rowY(rows.length - 1)}" x2="${laneX(0)}" y2="${topEdge}" stroke="${color(0)}" stroke-width="2"/>`);
  for (const s of segs) {
    const x = laneX(s.lane);
    const yb = rowY(s.bottom);
    const yt = s.top === -1 ? topEdge : rowY(s.top);
    const c = color(s.lane);
    g.push(`<line x1="${x}" y1="${yb}" x2="${x}" y2="${yt}" stroke="${c}" stroke-width="2"/>`);
    if (s.branchFrom !== undefined) {
      const px = laneX(s.branchFrom);
      const py = yb + RH;
      g.push(`<path d="M${px} ${py} C${px} ${py - RH * 0.7} ${x} ${yb + RH * 0.5} ${x} ${yb}" fill="none" stroke="${c}" stroke-width="2"/>`);
    }
    if (s.mergeInto !== undefined) {
      const tx = laneX(s.mergeInto);
      const ty = yt - RH;
      g.push(`<path d="M${x} ${yt} C${x} ${yt - RH * 0.5} ${tx} ${ty + RH * 0.7} ${tx} ${ty}" fill="none" stroke="${c}" stroke-width="2"/>`);
    }
  }
  body.push(`<g class="in" ${delay(cmd.end + 0.1)}>${g.join('')}</g>`);

  rows.forEach((row, i) => {
    const y = rowY(i);
    const x = laneX(row.lane);
    const c = color(row.lane);
    const head = row.refs?.startsWith('HEAD');
    const d = cmd.end + 0.15 + i * 0.045;
    const m = row.msg.match(/^(\w+)(\(([^)]*)\))?:\s*(.*)$/);
    const msg = m
      ? `<tspan class="${LANE_COLOR[row.lane]} b">${esc(m[1])}</tspan>${m[3] ? `<tspan class="dim">(${esc(m[3])})</tspan>` : ''}<tspan class="dim">:</tspan> ${esc(m[4])}`
      : esc(row.msg);
    let refs = '';
    if (row.refs) {
      const [a, b] = row.refs.split(' -> ');
      refs = b
        ? `<tspan class="amber">(</tspan><tspan class="cyan b">${esc(a)} -&gt; </tspan><tspan class="green b">${esc(b)}</tspan><tspan class="amber">)</tspan> `
        : `<tspan class="amber">(</tspan><tspan class="amber b">${esc(a)}</tspan><tspan class="amber">)</tspan> `;
    }
    body.push(
      `<g class="in" ${delay(d)}>` +
        (head ? `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${c}" class="pulse"/>` : '') +
        `<circle cx="${x}" cy="${y}" r="4.5" fill="${head ? c : t.bg}" stroke="${c}" stroke-width="2"/>` +
        `<text x="118" y="${y + 4.5}" xml:space="preserve"><tspan class="amber">${sha(row.msg)}</tspan> ${refs}${msg}</text>` +
        `<text x="876" y="${y + 4.5}" text-anchor="end" class="faint" style="font-size:12px">${esc(row.date)}</text>` +
        `</g>`,
    );
  });

  // legend
  const ly = H - 16;
  let lx = 24;
  body.push(`<g class="in" ${delay(cmd.end + 0.2 + rows.length * 0.045)}>`);
  config.lanes.forEach((lane, l) => {
    body.push(`<circle cx="${lx + 4}" cy="${ly - 4}" r="4" fill="${color(l)}"/><text x="${lx + 13}" y="${ly}" class="dim" style="font-size:11.5px">${esc(lane.label)}</text>`);
    lx += 26 + lane.label.length * 7.5;
  });
  body.push(`</g>`);

  return frame({
    t,
    w: W,
    h: H,
    title: '~/career — git log',
    label: `Career as a git log: ${rows.map((r) => `${r.date} ${r.msg}`).join('; ')}.`,
    body: body.join('\n'),
  });
}
