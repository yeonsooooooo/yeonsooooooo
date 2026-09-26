// Shared building blocks for every card: theme tokens, the terminal window frame, text helpers.
// GitHub renders README SVGs through <img>: no scripts, no external fonts or CSS —
// but inline <style>, CSS keyframes, SMIL and filters all survive.

export const MONO =
  "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, 'JetBrains Mono', 'Cascadia Code', Consolas, 'D2Coding', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', 'Liberation Mono', monospace";

export const themes = {
  dark: {
    id: 'dark',
    page: '#0d1117',
    bg: '#010409',
    chrome: '#0d1117',
    border: '#30363d',
    text: '#e6edf3',
    dim: '#7d8590',
    faint: '#3d444d',
    grid: '#161b22',
    green: '#3fb950',
    cyan: '#39c5cf',
    blue: '#58a6ff',
    purple: '#bc8cff',
    pink: '#f778ba',
    amber: '#e3b341',
    orange: '#f0883e',
    red: '#ff7b72',
    heat: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
    lit: '#f2cc60',
    warm: '#bb8009',
    tv: '#1f3a5f',
    off: '#0d1117',
    body: '#0b1016',
  },
  light: {
    id: 'light',
    page: '#ffffff',
    bg: '#ffffff',
    chrome: '#f6f8fa',
    border: '#d0d7de',
    text: '#1f2328',
    dim: '#656d76',
    faint: '#d0d7de',
    grid: '#f6f8fa',
    green: '#1a7f37',
    cyan: '#1b7c83',
    blue: '#0969da',
    purple: '#8250df',
    pink: '#bf3989',
    amber: '#9a6700',
    orange: '#bc4c00',
    red: '#cf222e',
    heat: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    lit: '#eac54f',
    warm: '#d4a72c',
    tv: '#b6d7fb',
    off: '#ffffff',
    body: '#eef1f4',
  },
};

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const num = (n) => Number(n).toLocaleString('en-US');

// Darken (amt < 0) or lighten (amt > 0) a hex color.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// Wall clock in the configured timezone. Read the result with getUTC*.
export const localDate = (date, offsetHours) => new Date(date.getTime() + offsetHours * 3_600_000);

export function stamp(date, offsetHours) {
  const d = localDate(date, offsetHours);
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
    dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()],
    mon: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()],
    day: d.getUTCDate(),
  };
}

// Styles every card shares. Base state is the final frame, so reduced-motion viewers
// (and anything that ignores animation) see the finished card rather than a blank one.
export function baseStyle(t) {
  return `
  text{font-family:${MONO};font-size:13.5px;fill:${t.text}}
  .dim{fill:${t.dim}} .faint{fill:${t.faint}} .b{font-weight:700}
  .green{fill:${t.green}} .cyan{fill:${t.cyan}} .blue{fill:${t.blue}} .purple{fill:${t.purple}}
  .pink{fill:${t.pink}} .amber{fill:${t.amber}} .orange{fill:${t.orange}} .red{fill:${t.red}}
  .title{font-size:12px;fill:${t.dim}}
  .in{animation:in .45s cubic-bezier(.2,.7,.2,1) backwards}
  .pop{animation:pop .5s cubic-bezier(.2,.7,.2,1) backwards}
  .blink{animation:blink 1.1s steps(1) infinite}
  .pulse{animation:pulse 2.4s ease-in-out infinite}
  @keyframes in{from{opacity:0;transform:translateY(5px)}}
  @keyframes pop{from{opacity:0;transform:translateY(-14px)}}
  @keyframes blink{50%{opacity:0}}
  @keyframes pulse{50%{opacity:.35}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important}}`;
}

export const delay = (s) => `style="animation-delay:${s.toFixed(2)}s"`;

// A command typed character by character: a clip rect grows in discrete steps (SMIL works in <img>).
let clipSeq = 0;
export function typed({ x, y, text, begin = 0.25, cps = 28, cls = '' , charW = 8.13}) {
  const id = `ty${clipSeq++}`;
  const n = [...text].length;
  const values = Array.from({ length: n + 1 }, (_, i) => (i * charW).toFixed(1)).join(';');
  return {
    end: begin + n / cps,
    svg: `<clipPath id="${id}"><rect x="${x}" y="${y - 14}" height="20" width="${(n * charW + 4).toFixed(1)}">` +
      `<animate attributeName="width" values="${values}" dur="${(n / cps).toFixed(2)}s" begin="${begin}s" fill="freeze" calcMode="discrete"/>` +
      `<set attributeName="width" to="0" begin="0s" dur="${begin}s"/></rect></clipPath>` +
      `<text x="${x}" y="${y}" class="${cls}" clip-path="url(#${id})" xml:space="preserve">${esc(text)}</text>`,
  };
}

export function prompt(t, x, y, path = '~') {
  return `<text x="${x}" y="${y}"><tspan class="green b">${esc(path)}</tspan><tspan class="purple b"> ❯</tspan></text>`;
}

// Terminal window frame. `body` is raw SVG positioned in window coordinates.
export function frame({ t, w, h, title, label, body, extraStyle = '', defs = '' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<style>${baseStyle(t)}${extraStyle}</style>
<defs>${defs}</defs>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="10" fill="${t.bg}" stroke="${t.border}"/>
<path d="M.5 36 V10.5 a10 10 0 0 1 10-10 H${w - 10.5} a10 10 0 0 1 10 10 V36 Z" fill="${t.chrome}"/>
<line x1=".5" y1="36" x2="${w - 0.5}" y2="36" stroke="${t.border}"/>
<circle cx="20" cy="18" r="6" fill="#ff5f57"/><circle cx="40" cy="18" r="6" fill="#febc2e"/><circle cx="60" cy="18" r="6" fill="#28c840"/>
<text x="${w / 2}" y="22.5" text-anchor="middle" class="title">${esc(title)}</text>
${body}
</svg>
`;
}
