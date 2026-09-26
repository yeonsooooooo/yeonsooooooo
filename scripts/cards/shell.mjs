// ~/.visitor_history — the last commands visitors ran through issues, plus the buttons that start them.
import { frame, typed, prompt, esc, num, stamp, delay, MONO } from '../lib/svg.mjs';

// Rough display width: CJK and emoji take two columns in a monospace font.
function clip(text, cols) {
  let w = 0;
  let out = '';
  for (const ch of text) {
    const cw = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠\u{1f300}-\u{1faff}]/u.test(ch) ? 2 : 1;
    if (w + cw > cols) return out + '…';
    out += ch;
    w += cw;
  }
  return out;
}

export function shell({ t, history, config }) {
  const W = 900;
  const rows = history.entries.slice(-7).reverse();
  const H = 120 + Math.max(rows.length, 2) * 24 + 42;
  const body = [];

  body.push(prompt(t, 24, 62));
  const cmd = typed({ x: 58, y: 62, text: 'tail -f ~/.visitor_history', begin: 0.2, cps: 30 });
  body.push(cmd.svg);
  body.push(`<text x="24" y="86" class="dim in" ${delay(cmd.end)}># open an issue titled "$ &lt;command&gt;" — GitHub Actions runs it and replies in ~30s</text>`);

  let y = 120;
  if (!rows.length) {
    body.push(`<text x="24" y="${y}" class="dim in" ${delay(cmd.end + 0.1)}>(empty) no one has run a command yet — be the first. try the buttons below ↓</text>`);
    y += 24;
    body.push(`<text x="24" y="${y}" class="dim in" ${delay(cmd.end + 0.2)}>        $ fortune → your 개발 운세 for today, seeded by your login</text>`);
    y += 24;
  }
  rows.forEach((e, i) => {
    const s = stamp(new Date(e.at), config.tzOffsetHours);
    body.push(
      `<text x="24" y="${y}" class="in" ${delay(cmd.end + 0.1 + i * 0.07)} xml:space="preserve">` +
        `<tspan class="faint">[${s.date.slice(5)} ${s.time}]</tspan>  <tspan class="blue">@${esc(clip(e.login, 18))}</tspan>` +
        `<tspan x="330" class="purple b">❯</tspan> <tspan class="${e.unknown ? 'red' : ''}">${esc(clip(e.cmd, 16))}</tspan>` +
        `<tspan x="512" class="dim">→ ${esc(clip(e.summary, 44))}</tspan></text>`,
    );
    y += 24;
  });

  y += 14;
  body.push(`<line x1="24" y1="${y - 16}" x2="876" y2="${y - 16}" stroke="${t.border}" stroke-dasharray="2 4"/>`);
  const since = history.since ? stamp(new Date(history.since), config.tzOffsetHours).date : '—';
  body.push(`<text x="24" y="${y + 6}" class="dim" style="font-size:12px">${num(history.total)} commands · ${num(history.visitors.length)} visitors · since ${since}</text>`);
  body.push(`<text x="876" y="${y + 6}" text-anchor="end" style="font-size:12px"><tspan class="green b">guest@${esc(config.host)}</tspan><tspan class="purple b"> ~ ❯ </tspan><tspan class="blink">█</tspan></text>`);

  return frame({
    t,
    w: W,
    h: H,
    title: '~/.visitor_history',
    label: `Visitor shell: ${history.total} commands run by ${history.visitors.length} visitors. Open an issue titled "$ fortune" to run one.`,
    body: body.join('\n'),
  });
}

export function button({ t, label, prefix = '$' }) {
  const W = 132;
  const H = 34;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${prefix} ${esc(label)}">
<title>${prefix} ${esc(label)}</title>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="8" fill="${t.chrome}" stroke="${t.border}"/>
<text x="${W / 2}" y="21.5" text-anchor="middle" font-family="${MONO.replace(/"/g, "'")}" font-size="13" fill="${t.text}"><tspan fill="${prefix === '$' ? t.green : t.blue}" font-weight="700">${prefix}</tspan> ${esc(label)}</text>
</svg>
`;
}

export function statusline({ t, stats, config, now }) {
  const W = 900;
  const H = 30;
  const s = stamp(now, config.tzOffsetHours);
  const segs = [
    { text: 'NORMAL', bg: t.green, fg: t.bg, bold: true },
    { text: '⎇ main', bg: t.faint, fg: t.text },
    { text: 'README.md', bg: t.chrome, fg: t.dim },
  ];
  const right = [
    { text: '● all systems operational', bg: t.green, fg: t.bg, bold: true },
    { text: `${num(stats.repos.total)} repos · ${num(stats.commits.year)} commits/yr`, bg: t.faint, fg: t.text },
    { text: `built ${s.date} ${s.time} ${config.tzLabel}`, bg: t.chrome, fg: t.dim },
  ];
  const cw = 7.4;
  const width = (seg) => seg.text.length * cw + 24;
  const out = [];
  const text = (seg, x) =>
    `<text x="${x}" y="19.5" fill="${seg.fg}" font-weight="${seg.bold ? 700 : 400}" xml:space="preserve">${esc(seg.text)}</text>`;

  // Powerline arrows overlap the neighbour, so each side is painted from the far end inward.
  let x = 0;
  const left = segs.map((seg) => ({ ...seg, x: (x += width(seg)) - width(seg), w: width(seg) }));
  for (const seg of [...left].reverse()) {
    out.push(`<rect x="${seg.x}" y="0" width="${seg.w}" height="${H}" fill="${seg.bg}"/>`);
    out.push(`<polygon points="${seg.x + seg.w},0 ${seg.x + seg.w + 12},${H / 2} ${seg.x + seg.w},${H}" fill="${seg.bg}"/>`);
    out.push(text(seg, seg.x + (seg.x ? 20 : 12)));
  }
  let rx = W;
  const rightSegs = right.map((seg) => ({ ...seg, x: (rx -= width(seg)), w: width(seg) }));
  for (const seg of [...rightSegs].reverse()) {
    out.push(`<rect x="${seg.x}" y="0" width="${seg.w}" height="${H}" fill="${seg.bg}"/>`);
    out.push(`<polygon points="${seg.x},0 ${seg.x - 12},${H / 2} ${seg.x},${H}" fill="${seg.bg}"/>`);
    out.push(text(seg, seg.x + 8));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Status: built ${s.date} ${s.time} ${config.tzLabel}">
<title>built ${s.date} ${s.time} ${config.tzLabel}</title>
<style>text{font-family:${MONO};font-size:12px}</style>
<clipPath id="r"><rect width="${W}" height="${H}" rx="6"/></clipPath>
<g clip-path="url(#r)"><rect width="${W}" height="${H}" fill="${t.bg}" stroke="${t.border}"/>
${out.join('\n')}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="6" fill="none" stroke="${t.border}"/>
</svg>
`;
}
