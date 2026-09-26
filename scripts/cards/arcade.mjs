// COMMIT BREAKOUT — the last 365 days (private repos included) as a Breakout level that
// plays itself on a loop. scripts/lib/breakout.mjs simulates the game; this file replays it.
// Bricks, bursts and banners are CSS keyframes over one loop period; balls, paddle and the
// rolling score are SMIL. Both clocks start at image load, so they stay in lockstep.
import { frame, typed, prompt, esc, num, shade, delay } from '../lib/svg.mjs';
import { simulate } from '../lib/breakout.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let cache = null;
function game(stats) {
  const key = stats.generatedAt;
  if (cache?.key !== key) cache = { key, g: simulate({ days: stats.commits.calendar.days, start: stats.commits.calendar.start }) };
  return cache.g;
}

export function arcade({ t, stats, config }) {
  const g = game(stats);
  const { pitch, cell, top, gridTop, paddleY, paddleW, r, gx, WL, WR } = g.geom;
  const L = g.loop;
  const W = 900;
  const H = 466;
  const P = (s) => `${+Math.min(100, Math.max(0, (s / L) * 100)).toFixed(2)}%`;
  const K = (s) => String(+Math.min(1, Math.max(0, s / L)).toFixed(5));
  const dur = `dur="${L.toFixed(3)}s" repeatCount="indefinite"`;
  const css = [];
  const body = [];
  const field = [];

  body.push(prompt(t, 24, 62));
  const cmd = typed({ x: 58, y: 62, text: './commit-breakout --level 365d --bricks "git log --all-repos"', begin: 0.1, cps: 60 });
  body.push(cmd.svg);
  body.push(`<text x="24" y="84" class="dim" style="font-size:12.5px"># 1 brick = 1 day of commits, private repos included · the public graph (${stats.publicContributions}) would leave this level empty</text>`);

  // ---- HUD ----
  const LH = 18;
  let clip = 0;
  function roller(x, y, events, key, digits, cls) {
    const out = [];
    for (let d = 0; d < digits; d++) {
      const pow = 10 ** (digits - 1 - d);
      const vals = [];
      const times = [];
      let last = null;
      for (const e of events) {
        const v = Math.floor(e[key] / pow) % 10;
        if (v === last) continue;
        last = v;
        vals.push(`0 ${-v * LH}`);
        times.push(K(e.t));
      }
      times[0] = '0';
      const id = `dg${clip++}`;
      const cx = x + d * 11;
      out.push(`<clipPath id="${id}"><rect x="${cx - 1}" y="${y - LH + 4}" width="12" height="${LH}"/></clipPath>`);
      out.push(`<g clip-path="url(#${id})"><g>` +
        (vals.length > 1 ? `<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="${vals.join(';')}" keyTimes="${times.join(';')}" ${dur}/>` : '') +
        `<text class="dg ${cls}">${Array.from({ length: 10 }, (_, k) => `<tspan x="${cx}" y="${y + k * LH}">${k}</tspan>`).join('')}</text>` +
        `</g></g>`);
    }
    return out.join('');
  }
  const hudY = 111;
  const totalBricks = g.scoreEvents[0].remaining;
  body.push(`<text x="${WL}" y="${hudY}" class="dim" style="font-size:11px;letter-spacing:1px">SCORE</text>`);
  body.push(roller(WL + 46, hudY + 1, g.scoreEvents, 'score', String(g.total).length, 'green b'));
  body.push(`<text x="${WL + 112}" y="${hudY}" class="dim" style="font-size:11px;letter-spacing:1px">HI</text>`);
  body.push(`<text x="${WL + 132}" y="${hudY + 1}" class="amber b" style="font-size:15px">${num(stats.commits.allTime)}</text>`);
  body.push(`<text x="${WL + 196}" y="${hudY}" class="dim" style="font-size:11px;letter-spacing:1px">BRICKS</text>`);
  body.push(roller(WL + 248, hudY + 1, g.scoreEvents, 'remaining', String(totalBricks).length, 'b'));

  // power-up lamps
  const lamps = [
    ['★ MULTI', g.split, 'amber'],
    ['ϟ FIRE', g.fire?.start, 'red'],
    ['⇡ LASER', g.laser, 'cyan'],
  ];
  lamps.forEach(([label, at, cls], i) => {
    const x = 520 + i * 70;
    if (at == null) {
      body.push(`<text x="${x}" y="${hudY}" class="faint" style="font-size:11px">${label}</text>`);
      return;
    }
    css.push(`@keyframes lamp${i}{0%,${P(at - 0.01)}{opacity:.28}${P(at)},${P(g.end + 1)}{opacity:1}${P(g.end + 1.3)},100%{opacity:.28}}`);
    body.push(`<text x="${x}" y="${hudY}" class="${cls} b" style="font-size:11px;opacity:.28;animation:lamp${i} ${L.toFixed(3)}s linear infinite">${label}</text>`);
  });

  // balls-in-play dots
  g.balls.forEach((b, i) => {
    const x = WR - 8 - (g.balls.length - 1 - i) * 11;
    const vis = i === 0 ? '' : `<animate attributeName="opacity" calcMode="discrete" values="0;1;0" keyTimes="0;${K(b.spawn)};${K(b.end)}" ${dur}/>`;
    body.push(`<circle cx="${x}" cy="${hudY - 4}" r="3.5" fill="${t.lit}" opacity="${i === 0 ? 1 : 0}">${vis}</circle>`);
  });

  // ---- field ----
  field.push(`<path d="M${WL} ${paddleY + 16} V${top} H${WR} V${paddleY + 16}" fill="none" stroke="${t.border}" stroke-dasharray="3 4"/>`);

  // month + weekday labels, like the real contribution graph
  const start = new Date(`${stats.commits.calendar.start}T00:00:00Z`);
  let lastMonth = -1;
  for (let w = 0; w < g.geom.weeks; w++) {
    const d = new Date(start.getTime() + w * 7 * 86_400_000);
    if (d.getUTCMonth() !== lastMonth && d.getUTCDate() <= 7) {
      lastMonth = d.getUTCMonth();
      field.push(`<text x="${gx + w * pitch}" y="${gridTop - 7}" class="faint" style="font-size:10px">${MONTHS[lastMonth]}</text>`);
    }
  }
  for (const [row, label] of [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']])
    body.push(`<text x="${WL - 6}" y="${gridTop + row * pitch + 10}" text-anchor="end" class="faint" style="font-size:10px">${label}</text>`);

  // bricks — each gets its own keyframes (born in a wave, flash on hits, pop on the last one)
  const heat = t.heat;
  for (const b of g.bricks) {
    const x = b.x0;
    const y = b.y0;
    if (!b.count) {
      field.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${heat[0]}" opacity=".55"/>`);
      continue;
    }
    const color = b.gold ? t.amber : b.fire ? t.red : heat[b.level];
    const hits = b.hits.length > 1 && b.hits[1] - b.hits[0] < 0.12 ? [b.hits[1]] : b.hits;
    const final = hits.at(-1);
    const born = 0.15 + b.col * 0.012 + b.row * 0.02;
    const stops = [
      [`0%,${P(born - 0.1)},${P(final + 0.22)},100%`, 0],
      [P(born), 1.25],
      [`${P(born + 0.12)},${P(final)}`, 1],
      [P(final + 0.06), 1.5],
    ];
    if (hits.length > 1) stops.push([P(hits[0] + 0.05), 1.3], [P(hits[0] + 0.14), 0.92]);
    css.push(`@keyframes b${b.i}{${stops.map(([at, v]) => `${at}{scale:${v}}`).join('')}}`);
    const names = [`b${b.i}`];
    if (hits.length > 1) {
      const cracked = shade(color, t.id === 'dark' ? -0.45 : 0.45);
      css.push(`@keyframes f${b.i}{0%,${P(hits[0])}{fill:${color}}${P(hits[0] + 0.02)},100%{fill:${cracked}}}`);
      names.push(`f${b.i}`);
    }
    const rect = `<rect class="k" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${color}" style="animation-name:${names.join(',')}"/>`;
    if (b.gold || b.fire) {
      const glyph = b.gold
        ? `<path d="M${x + 6} ${y + 1.8} l1.3 2.9 3.1.3 -2.3 2.1.7 3.1 -2.8-1.6 -2.8 1.6.7-3.1 -2.3-2.1 3.1-.3z" fill="${t.bg}"/>`
        : `<path d="M${x + 7} ${y + 1.5} l-3.5 5 h2.6 l-1.3 4 3.8-5.4 h-2.6z" fill="${t.bg}"/>`;
      field.push(`<g class="k" style="animation-name:b${b.i}" filter="url(#glow)">${rect.replace(' class="k"', '').replace(/ style="[^"]*"/, '')}${glyph}</g>`);
    } else {
      field.push(rect);
    }

    // burst ring on the final hit; specials also throw shards
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    const at = final.toFixed(2);
    field.push(`<circle class="u" cx="${cx}" cy="${cy}" r="5"${b.gold || b.fire ? ` stroke="${color}"` : ''} style="animation-delay:${at}s"/>`);
    if (b.gold || b.fire) {
      for (const [dx, dy] of [[-16, -12], [15, -14], [3, 17], [-12, 12], [14, 8]]) {
        field.push(`<rect class="s" x="${cx - 2}" y="${cy - 2}" width="4" height="4" fill="${color}" style="--dx:${dx}px;--dy:${dy}px;animation-delay:${at}s"/>`);
      }
    }
  }

  // shield (after multiball)
  if (g.split != null) {
    field.push(`<line x1="${WL + 2}" y1="${paddleY + 1}" x2="${WR - 2}" y2="${paddleY + 1}" stroke="${t.cyan}" stroke-width="1.5" stroke-dasharray="6 3" opacity="0">` +
      `<animate attributeName="opacity" calcMode="discrete" values="0;.55;0" keyTimes="0;${K(g.split)};${K(g.end)}" ${dur}/></line>`);
  }

  // paddle (+ laser beam that rides on it)
  const pts = g.paddle;
  const px = pts.map((p) => (p.x - paddleW / 2).toFixed(1));
  const pk = pts.map((p) => K(p.t));
  const pKeys = { values: [...px, px.at(-1)], times: [...pk, '1'] };
  pKeys.times[0] = '0';
  const pAnim = (offset) =>
    `<animate attributeName="x" values="${pKeys.values.map((v) => (Number(v) + offset).toFixed(1)).join(';')}" keyTimes="${pKeys.times.join(';')}" ${dur}/>`;
  if (g.laser != null) {
    field.push(`<rect class="ball" x="${px[0]}" y="${top}" width="3" height="${paddleY - top}" fill="${t.cyan}" opacity="0" filter="url(#glow)">${pAnim(paddleW / 2 - 1.5)}` +
      `<animate attributeName="opacity" calcMode="discrete" values="0;.85;0" keyTimes="0;${K(g.laser)};${K(g.end)}" ${dur}/></rect>`);
  }
  field.push(`<rect x="${px[0]}" y="${paddleY + 3}" width="${paddleW}" height="8" rx="4" fill="${t.purple}">${pAnim(0)}</rect>`);
  field.push(`<rect x="${px[0]}" y="${paddleY + 3}" width="${paddleW}" height="3" rx="1.5" fill="${shade(t.purple, 0.35)}" opacity=".8">${pAnim(0)}</rect>`);

  // balls with two ghost trails each
  const ballColor = t.id === 'dark' ? t.lit : t.orange;
  g.balls.forEach((b) => {
    const frames = b.frames[0].t > 0 ? [{ ...b.frames[0], t: 0 }, ...b.frames] : b.frames;
    const all = [...frames, { ...frames.at(-1), t: L }];
    const keyTimes = all.map((f) => K(f.t));
    keyTimes[0] = '0';
    keyTimes[keyTimes.length - 1] = '1';
    const xs = all.map((f) => f.x.toFixed(1)).join(';');
    const ys = all.map((f) => f.y.toFixed(1)).join(';');
    const kt = keyTimes.join(';');
    const visVals = b.spawn > 0 ? `values="0;1;0" keyTimes="0;${K(b.spawn)};${K(b.end)}"` : `values="1;0" keyTimes="0;${K(b.end)}"`;
    const fireFill = g.fire ? `<animate attributeName="fill" calcMode="discrete" values="${ballColor};${t.red};${ballColor}" keyTimes="0;${K(g.fire.start)};${K(g.fire.end)}" ${dur}/>` : '';
    [[0.07, 2.4, 0.25], [0.035, 3.3, 0.45], [0, r, 1]].forEach(([lag, rad, op]) => {
      const begin = lag ? ` begin="${lag}s"` : '';
      field.push(
        `<circle class="ball" cx="${all[0].x.toFixed(1)}" cy="${all[0].y.toFixed(1)}" r="${rad}" fill="${ballColor}" opacity="0"${lag ? '' : ' filter="url(#glow)"'}>` +
          `<animate attributeName="cx" values="${xs}" keyTimes="${kt}" ${dur}${begin}/>` +
          `<animate attributeName="cy" values="${ys}" keyTimes="${kt}" ${dur}${begin}/>` +
          `<animate attributeName="opacity" calcMode="discrete" ${visVals.replace(/values="([^"]*)"/, (_, v) => `values="${v.split(';').map((n) => (Number(n) * op).toFixed(2)).join(';')}"`)} ${dur}${begin}/>` +
          fireFill.replace(`${dur}/>`, `${dur}${begin}/>`) +
          `</circle>`,
      );
    });
  });

  // popups
  const popCls = { gold: 'amber', big: 'green', combo: 'cyan', ball: 'purple', fire: 'red' };
  for (const p of g.popups) {
    field.push(`<text x="${p.x.toFixed(1)}" y="${(p.y - 4).toFixed(1)}" text-anchor="middle" class="${popCls[p.kind]} b popup" style="animation-delay:${p.t.toFixed(3)}s">${esc(p.text)}</text>`);
  }

  // banners
  const cxF = (WL + WR) / 2;
  const by = 318;
  const banners = [
    [0, g.ready, 'READY?', 'text', 'launching at the busiest day ★'],
    [g.split, g.split + 1.3, 'MULTIBALL', 'amber', `${num(g.bricks.find((b) => b.gold)?.count ?? 0)} commits on the busiest day → ×3`],
    [g.fire?.start, g.fire ? g.fire.start + 1.3 : null, 'FIREBALL', 'red', `${stats.commits.currentStreak}-day streak unlocked — balls pierce`],
    [g.laser, g.laser != null ? g.laser + 1.1 : null, 'LASER FINISH', 'cyan', 'sweeping what is left'],
    [g.end + 0.2, L - 0.15, 'STAGE CLEAR', 'green', `${num(g.total)} commits · ${totalBricks} days · 0 bricks left`],
  ];
  banners.forEach(([from, to, title, cls, sub], i) => {
    if (from == null) return;
    const inAt = Math.max(0, from);
    const kf = inAt === 0
      ? `0%{opacity:1;transform:scale(.6)}${P(0.18)}{transform:scale(1.12)}${P(0.3)}{transform:scale(1)}${P(to - 0.12)}{opacity:1}${P(to)},100%{opacity:0}`
      : `0%,${P(inAt - 0.01)}{opacity:0;transform:scale(.5)}${P(inAt + 0.12)}{opacity:1;transform:scale(1.15)}${P(inAt + 0.24)}{transform:scale(1)}${P(to - 0.15)}{opacity:1;transform:scale(1)}${P(to)},100%{opacity:0;transform:scale(1)}`;
    css.push(`@keyframes bn${i}{${kf}}`);
    field.push(`<g class="banner" style="animation:bn${i} ${L.toFixed(3)}s linear infinite">` +
      `<text x="${cxF}" y="${by}" text-anchor="middle" class="${cls === 'text' ? '' : cls} b" style="font-size:26px;letter-spacing:4px" filter="url(#glow)">${esc(title)}</text>` +
      `<text x="${cxF}" y="${by + 22}" text-anchor="middle" class="dim" style="font-size:12px">${esc(sub)}</text></g>`);
  });

  // screen shake on the big moments
  const shakes = [g.split, g.fire?.start, g.laser].filter((s) => s != null);
  const shakeKf = ['0%{transform:none}'];
  for (const s0 of shakes.sort((a, b) => a - b)) {
    shakeKf.push(`${P(s0 - 0.01)}{transform:none}`, `${P(s0 + 0.04)}{transform:translate(3px,-2px)}`, `${P(s0 + 0.08)}{transform:translate(-3px,2px)}`, `${P(s0 + 0.12)}{transform:translate(2px,1px)}`, `${P(s0 + 0.18)}{transform:none}`);
  }
  shakeKf.push('100%{transform:none}');
  css.push(`@keyframes shake{${shakeKf.join('')}}`);
  body.push(`<g style="animation:shake ${L.toFixed(3)}s linear infinite">${field.join('\n')}</g>`);

  body.push(
    `<text x="24" y="${H - 14}" class="faint" style="font-size:11px" xml:space="preserve">` +
      `<tspan class="amber">★</tspan> busiest day → multiball · <tspan class="red">ϟ</tspan> streak start → fireball  · bright days take 2 hits  · score = commits destroyed  · loops every ${Math.round(L)}s</text>`,
  );

  const D = `${L.toFixed(3)}s`;
  const extra = `
  .k{transform-box:fill-box;transform-origin:center;scale:0;animation-duration:${D};animation-timing-function:linear;animation-iteration-count:infinite}
  .u,.s,.popup,.banner{opacity:0;transform-box:fill-box;transform-origin:center}
  .u{fill:none;stroke:${t.text};stroke-width:1.4;animation:burst ${D} linear infinite}
  .s{animation:shard ${D} linear infinite}
  .popup{animation:rise ${D} linear infinite;font-size:11px}
  .dg{font-size:17px}
  @keyframes burst{0%{opacity:.95;scale:.4}${P(0.42)}{opacity:0;scale:3}100%{opacity:0}}
  @keyframes shard{0%{opacity:1;translate:0 0}${P(0.6)}{opacity:0;translate:var(--dx) var(--dy);rotate:180deg}100%{opacity:0}}
  @keyframes rise{0%{opacity:0;translate:0 4px}${P(0.08)}{opacity:1;translate:0 0}${P(0.75)}{opacity:1}${P(1.05)}{opacity:0;translate:0 -22px}100%{opacity:0}}
  ${css.join('\n  ')}
  @media (prefers-reduced-motion:reduce){.k{scale:1}.ball{opacity:0!important}}`;

  return frame({
    t,
    w: W,
    h: H,
    title: '~/arcade — commit-breakout',
    label: `Commit Breakout: a self-playing Breakout level where every brick is a day of commits from the last year (${totalBricks} days, ${num(g.total)} commits, private repositories included). The busiest day triggers multiball, the start of the ${stats.commits.currentStreak}-day streak triggers fireball, and the score ends at ${num(g.total)}.`,
    defs: `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    extraStyle: extra,
    body: body.join('\n'),
  });
}
