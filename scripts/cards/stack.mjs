// Exploded isometric view of the stack. Each plate is a layer, each tile a repository that
// lives on it (raised = pushed in the last 30 days). Packets ride the buses between layers.
import { frame, typed, prompt, esc, num, pts, shade, delay } from '../lib/svg.mjs';

const LAYER_COLOR = { silicon: 'orange', edge: 'cyan', core: 'blue', surface: 'purple', intelligence: 'pink' };

// Deterministic shuffle so the same data always renders the same picture.
function seeded(n, seed) {
  const idx = Array.from({ length: n }, (_, i) => i);
  let s = seed;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

export function stack({ t, stats, config }) {
  const W = 900;
  const H = 588;
  const cx = 205;
  const A = 150;
  const B = 54;
  const T = 9;
  const S = 86;
  const top = 168;
  const body = [];

  body.push(prompt(t, 24, 62));
  const cmd = typed({ x: 58, y: 62, text: 'hotel-os --explode --layers', begin: 0.2, cps: 30 });
  body.push(cmd.svg);
  body.push(`<text x="24" y="86" class="dim in" ${delay(cmd.end)}># one builder, every layer — ${stats.repos.total} repos classified by what they touch</text>`);

  const layers = [...config.layers].sort((a, b) => a.level - b.level);
  const cyOf = (level) => top + (layers.length - 1 - level) * S;
  const maxCommits = Math.max(...layers.map((l) => stats.layers[l.id].commits), 1);

  // data buses behind the plates — only visible in the gaps, which is the point
  const busTop = cyOf(layers.length - 1);
  const busBot = cyOf(0);
  const span = busBot - busTop;
  for (const [bx, color, dir] of [[cx - 118, t.cyan, -1], [cx + 118, t.amber, 1]]) {
    body.push(`<line x1="${bx}" y1="${busTop}" x2="${bx}" y2="${busBot}" stroke="${color}" stroke-opacity=".45" stroke-dasharray="2 4"/>`);
    for (let k = 0; k < 3; k++) {
      const y0 = dir < 0 ? busBot : busTop;
      body.push(
        `<circle cx="${bx}" cy="${y0}" r="3" fill="${color}" filter="url(#glow)">` +
          `<animateMotion path="M0 0 V${dir * span}" dur="3.6s" begin="${(k * 1.2 + (dir > 0 ? 0.6 : 0)).toFixed(1)}s" repeatCount="indefinite"/></circle>`,
      );
    }
  }

  for (const layer of layers) {
    const cy = cyOf(layer.level);
    const col = t[LAYER_COLOR[layer.id]];
    const data = stats.layers[layer.id];
    const Tp = [cx, cy - B];
    const R = [cx + A, cy];
    const Bt = [cx, cy + B];
    const L = [cx - A, cy];
    const g = [];

    g.push(`<polygon points="${pts([L, Bt, [Bt[0], Bt[1] + T], [L[0], L[1] + T]])}" fill="${shade(col, t.id === 'dark' ? -0.55 : -0.1)}"/>`);
    g.push(`<polygon points="${pts([Bt, R, [R[0], R[1] + T], [Bt[0], Bt[1] + T]])}" fill="${shade(col, t.id === 'dark' ? -0.7 : -0.25)}"/>`);
    g.push(`<polygon points="${pts([Tp, R, Bt, L])}" fill="${t.bg}"/>`);
    g.push(`<polygon points="${pts([Tp, R, Bt, L])}" fill="${col}" fill-opacity="${t.id === 'dark' ? 0.1 : 0.08}" stroke="${col}" stroke-opacity=".8"/>`);

    // tiles
    const n = Math.min(7, Math.max(2, Math.ceil(Math.sqrt(data.repos))));
    const P = (u, v) => [Tp[0] + u * (R[0] - Tp[0]) + v * (L[0] - Tp[0]), Tp[1] + u * (R[1] - Tp[1]) + v * (L[1] - Tp[1])];
    const m = 0.1;
    const cell = (1 - 2 * m) / n;
    const order = seeded(n * n, layer.level * 97 + 13);
    const litSet = new Set(order.slice(0, data.active));
    const used = new Set(order.slice(0, data.repos));
    const cells = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cells.push([i, j]);
    cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [i, j] of cells) {
      const k = i * n + j;
      if (!used.has(k)) continue;
      const u0 = m + i * cell + cell * 0.14;
      const u1 = m + (i + 1) * cell - cell * 0.14;
      const v0 = m + j * cell + cell * 0.14;
      const v1 = m + (j + 1) * cell - cell * 0.14;
      const back = P(u0, v0);
      const right = P(u1, v0);
      const front = P(u1, v1);
      const left = P(u0, v1);
      if (!litSet.has(k)) {
        g.push(`<polygon points="${pts([back, right, front, left])}" fill="${col}" fill-opacity=".32"/>`);
        continue;
      }
      const h = 9;
      const up = ([x, y]) => [x, y - h];
      g.push(`<g class="pulse" ${delay((k % 5) * 0.4)}>`);
      g.push(`<polygon points="${pts([left, front, up(front), up(left)])}" fill="${shade(col, -0.35)}"/>`);
      g.push(`<polygon points="${pts([front, right, up(right), up(front)])}" fill="${shade(col, -0.55)}"/>`);
      g.push(`<polygon points="${pts([up(back), up(right), up(front), up(left)])}" fill="${col}" filter="url(#glow)"/>`);
      g.push(`</g>`);
    }
    g.push(`<text x="${L[0] + 10}" y="${L[1] + 4}" class="dim" style="font-size:10px">L${layer.level}</text>`);

    body.push(`<g class="pop" ${delay(0.35 + layer.level * 0.14)}>${g.join('')}</g>`);

    // label column
    const lx = 420;
    const d = 0.45 + layer.level * 0.14;
    const barW = Math.max(2, (data.commits / maxCommits) * 190);
    body.push(
      `<g class="in" ${delay(d)}>` +
        `<line x1="${R[0] + 6}" y1="${cy}" x2="${lx - 14}" y2="${cy}" stroke="${col}" stroke-opacity=".5" stroke-dasharray="1 3"/>` +
        `<circle cx="${lx - 12}" cy="${cy}" r="2.5" fill="${col}"/>` +
        `<text x="${lx}" y="${cy - 12}"><tspan class="dim">L${layer.level}  </tspan><tspan class="b ${LAYER_COLOR[layer.id]}">${esc(layer.name)}</tspan></text>` +
        `<text x="876" y="${cy - 12}" text-anchor="end"><tspan class="b">${data.repos}</tspan><tspan class="dim"> repos</tspan></text>` +
        `<text x="${lx}" y="${cy + 8}" class="dim" style="font-size:12.5px">${esc(layer.tech)}</text>` +
        `<rect x="${lx}" y="${cy + 18}" width="190" height="7" rx="3.5" fill="${t.grid}"/>` +
        `<rect x="${lx}" y="${cy + 18}" width="${barW.toFixed(1)}" height="7" rx="3.5" fill="${col}"/>` +
        `<text x="${lx + 200}" y="${cy + 25}" style="font-size:12px">${num(data.commits)}<tspan class="dim"> commits/yr</tspan></text>` +
        `<text x="876" y="${cy + 25}" text-anchor="end" style="font-size:12px">${data.active ? `<tspan class="green">●</tspan> ${data.active} live` : '<tspan class="dim">○ idle</tspan>'}</text>` +
        `</g>`,
    );
  }

  const other = stats.layers.other?.repos ?? 0;
  if (other) body.push(`<text x="876" y="${H - 14}" text-anchor="end" class="faint" style="font-size:11px"># +${other} sandbox repos · raised tile = pushed ≤ 30d</text>`);

  return frame({
    t,
    w: W,
    h: H,
    title: '~/hotel-os — layers',
    label: `Exploded view of the stack: ${layers.map((l) => `${l.name.toLowerCase()} ${stats.layers[l.id].repos} repos`).join(', ')}.`,
    defs: `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    body: body.join('\n'),
  });
}
