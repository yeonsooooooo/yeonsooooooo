// Offline Breakout physics. The whole game is simulated here, deterministically, and the
// renderer only replays the result: ball paths become keyframes at each bounce (motion
// between bounces is a straight line, so nothing is lost), bricks get their hit times.
//
// Rules: one brick per day with commits; the brightest quartile takes two hits; the busiest
// day is a golden brick that splits the ball into three and raises a shield. Score is the
// number of commits destroyed, so a cleared stage always ends on the year's commit total.

export const GEOM = {
  pitch: 14,
  cell: 12,
  top: 124, // ceiling
  gridTop: 146,
  paddleY: 404,
  paddleW: 66,
  wallPad: 26,
  r: 4.2,
};

function prng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function simulate({ days, start, width = 900, speed = 560, maxTime = 22, maxBalls = 6 }) {
  const { pitch, cell, top, gridTop, paddleY, paddleW, wallPad, r } = GEOM;
  const weeks = Math.ceil(days.length / 7);
  const gridW = weeks * pitch - (pitch - cell);
  const gx = Math.round((width - gridW) / 2);
  const WL = gx - wallPad;
  const WR = gx + gridW + wallPad;

  const nonzero = days.filter(Boolean).sort((a, b) => a - b);
  const q = (p) => nonzero[Math.floor(p * (nonzero.length - 1))] ?? 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (v) => (v === 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);
  const max = Math.max(...days);
  const goldIdx = days.indexOf(max);
  let streakStart = days.length - 1 - (days.at(-1) ? 0 : 1);
  while (streakStart > 0 && days[streakStart - 1]) streakStart--;
  const second = days.map((v, i) => [v, i]).filter(([, i]) => i !== goldIdx).sort((a, b) => b[0] - a[0])[0]?.[1];
  const fireIdx = days.length - streakStart >= 7 && streakStart !== goldIdx ? streakStart : second;

  const bricks = days.map((count, i) => {
    const col = Math.floor(i / 7);
    const row = i % 7;
    const lv = level(count);
    return {
      i, col, row, count, level: lv,
      x0: gx + col * pitch, y0: gridTop + row * pitch,
      hp: lv === 4 ? 2 : lv ? 1 : 0,
      gold: i === goldIdx && count > 0,
      fire: i === fireIdx && count > 0,
      hits: [],
    };
  });
  const cols = new Map();
  for (const b of bricks) if (b.hp) (cols.get(b.col) ?? cols.set(b.col, []).get(b.col)).push(b);

  const rand = prng(days.length * 7919 + max * 104729 + Date.parse(start) / 86_400_000);
  const alive = () => bricks.filter((b) => b.hp > 0);

  function clearPath(x0, y0, x1, y1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3);
    for (let k = 0; k <= steps; k++) {
      const x = x0 + ((x1 - x0) * k) / steps;
      const y = y0 + ((y1 - y0) * k) / steps;
      if (y > gridTop + 7 * pitch + r || y < gridTop - r) continue;
      for (const b of cols.get(Math.floor((x - gx) / pitch)) ?? []) {
        if (b.hp > 0 && x > b.x0 - r - 1 && x < b.x0 + cell + r + 1 && y > b.y0 - r - 1 && y < b.y0 + cell + r + 1) return false;
      }
      for (const b of cols.get(Math.floor((x - gx) / pitch) + 1) ?? []) {
        if (b.hp > 0 && x > b.x0 - r - 1 && x < b.x0 + cell + r + 1 && y > b.y0 - r - 1 && y < b.y0 + cell + r + 1) return false;
      }
      for (const b of cols.get(Math.floor((x - gx) / pitch) - 1) ?? []) {
        if (b.hp > 0 && x > b.x0 - r - 1 && x < b.x0 + cell + r + 1 && y > b.y0 - r - 1 && y < b.y0 + cell + r + 1) return false;
      }
    }
    return true;
  }

  // Aim from the paddle. First shot goes for the golden brick; after that, a weighted pick
  // that favours lower rows but sometimes threads a gap to get the ball above the wall.
  function aim(x, y) {
    const cands = alive();
    if (!cands.length) return [0, -speed];
    let target = !split && cands.find((b) => b.gold);
    // Tunnel shot: if a straight line to the ceiling is clear, send the ball up behind the
    // wall, where it rattles between ceiling and bricks — that's where combos come from.
    const burning = fire && t >= fire.start && t < fire.end;
    if (!target && !fire && split && destroyed >= totalBricks * 0.3) target = cands.find((b) => b.fire);
    if (!target && split && !burning && rand() < 0.5) {
      for (let k = 0; k < 18; k++) {
        const tx = WL + r + rand() * (WR - WL - 2 * r);
        if (clearPath(x, y, tx, top + r + 1)) {
          const len = Math.hypot(tx - x, top + r + 1 - y);
          const dx = (tx - x) / len;
          const dy = (top + r + 1 - y) / len;
          if (-dy >= 0.42) return [dx * speed, dy * speed];
        }
      }
    }
    if (!target) {
      const weights = cands.map((b) => (b.row + 1) ** 2 / (1 + Math.abs(b.x0 - x) / 260));
      let pick = rand() * weights.reduce((a, w) => a + w, 0);
      target = cands.find((_, i) => (pick -= weights[i]) <= 0) ?? cands[0];
    }
    let dx = target.x0 + cell / 2 - x;
    let dy = target.y0 + cell / 2 - y;
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    const minUp = 0.42;
    if (-dy < minUp) {
      dy = -minUp;
      dx = Math.sign(dx || 1) * Math.sqrt(1 - minUp * minUp);
    }
    return [dx * speed, dy * speed];
  }

  const dt = 1 / 360;
  const ready = 1.6;
  let t = 0;
  let score = 0;
  let remaining = bricks.filter((b) => b.hp).length;
  const scoreEvents = [{ t: 0, score: 0, remaining }];
  const paddle = [{ t: 0, x: (WL + WR) / 2 }];
  const popups = [];
  let split = null;
  let laser = null;
  let fire = null; // { start, end }
  const FIRE = 2.4;

  const launchX = (WL + WR) / 2;
  const [vx0, vy0] = aim(launchX, paddleY - r);
  const balls = [{ x: launchX, y: paddleY - r, vx: vx0, vy: vy0, main: true, spawn: 0, end: null, combo: 0, frames: [{ t: 0, x: launchX, y: paddleY - r }, { t: ready, x: launchX, y: paddleY - r }] }];
  t = ready;
  paddle.push({ t: ready, x: launchX });

  const spawnBall = (x, y, vx, vy) =>
    balls.push({ x, y, vx, vy, main: false, spawn: t, end: null, combo: 0, frames: [{ t, x, y }] });
  let destroyed = 0;
  const totalBricks = remaining;

  function destroy(b, ball) {
    score += b.count;
    remaining--;
    destroyed++;
    scoreEvents.push({ t, score, remaining });
    if (split && !laser && balls.length < maxBalls && destroyed % 45 === 0) {
      const x = paddle.at(-1).x;
      spawnBall(x, paddleY - r, ...aim(x, paddleY - r));
      popups.push({ t, x, y: paddleY - 18, text: '+1 BALL', kind: 'ball' });
    }
    if (b.fire && !fire) {
      fire = { start: t, end: t + FIRE };
      popups.push({ t, x: b.x0 + cell / 2, y: b.y0, text: 'FIREBALL', kind: 'fire' });
    }
    if (b.gold && !split) {
      split = t;
      for (const deg of [-38, 38]) {
        const a = (deg * Math.PI) / 180;
        const vx = ball.vx * Math.cos(a) - ball.vy * Math.sin(a);
        const vy = ball.vx * Math.sin(a) + ball.vy * Math.cos(a);
        spawnBall(ball.x, ball.y, vx, Math.abs(vy) < speed * 0.3 ? Math.sign(vy || 1) * speed * 0.3 : vy);
      }
      popups.push({ t, x: b.x0 + cell / 2, y: b.y0, text: `+${b.count}`, kind: 'gold' });
    } else if (b.level === 4 && popups.filter((p) => p.kind === 'big').length < 10 && b.count >= cuts[2] * 1.4) {
      popups.push({ t, x: b.x0 + cell / 2, y: b.y0, text: `+${b.count}`, kind: 'big' });
    }
  }

  while (remaining > 0 && t < maxTime) {
    t += dt;
    for (const ball of balls) {
      let nx = ball.x + ball.vx * dt;
      let ny = ball.y + ball.vy * dt;
      let bounced = false;

      if (nx - r < WL) { nx = WL + r; ball.vx = Math.abs(ball.vx); bounced = true; }
      if (nx + r > WR) { nx = WR - r; ball.vx = -Math.abs(ball.vx); bounced = true; }
      if (ny - r < top) { ny = top + r; ball.vy = Math.abs(ball.vy); bounced = true; }
      if (ny + r >= paddleY && ball.vy > 0) {
        ny = paddleY - r;
        [ball.vx, ball.vy] = aim(nx, ny);
        bounced = true;
        if (ball.combo >= 5 && popups.filter((p) => p.kind === 'combo').length < 14)
          popups.push({ t, x: nx, y: paddleY - 18, text: `COMBO ×${ball.combo}`, kind: 'combo' });
        ball.combo = 0;
        if (ball.main) {
          const center = Math.min(WR - paddleW / 2, Math.max(WL + paddleW / 2, nx - (ball.vx / speed) * paddleW * 0.36));
          paddle.push({ t, x: center });
        }
      }

      // bricks — only the columns the ball overlaps; at most one brick per step
      const c0 = Math.floor((nx - r - gx) / pitch);
      const c1 = Math.floor((nx + r - gx) / pitch);
      outer: for (let c = c0; c <= c1; c++) {
        for (const b of cols.get(c) ?? []) {
          if (b.hp <= 0) continue;
          const cx = Math.max(b.x0, Math.min(nx, b.x0 + cell));
          const cy = Math.max(b.y0, Math.min(ny, b.y0 + cell));
          if ((nx - cx) ** 2 + (ny - cy) ** 2 > r * r) continue;
          if (fire && t >= fire.start && t < fire.end) {
            while (b.hp > 0) { b.hp--; b.hits.push(t); }
            ball.combo++;
            destroy(b, ball);
            continue; // pierce: no bounce, keep burning through this column
          }
          const ox = Math.min(nx + r - b.x0, b.x0 + cell - (nx - r));
          const oy = Math.min(ny + r - b.y0, b.y0 + cell - (ny - r));
          if (ox < oy) {
            ball.vx = nx < b.x0 + cell / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
          } else {
            ball.vy = ny < b.y0 + cell / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
          }
          b.hp--;
          b.hits.push(t);
          ball.combo++;
          bounced = true;
          if (b.hp === 0) destroy(b, ball);
          break outer;
        }
      }

      ball.x = nx;
      ball.y = ny;
      if (bounced) ball.frames.push({ t, x: nx, y: ny });
    }
  }

  // Anything left after maxTime goes out in a laser sweep from the paddle, column by column.
  if (remaining > 0) {
    laser = t;
    const left = alive();
    for (const col of [...new Set(left.map((b) => b.col))].sort((a, b) => a - b)) {
      t += 0.05;
      paddle.push({ t, x: Math.min(WR - paddleW / 2, Math.max(WL + paddleW / 2, gx + col * pitch + cell / 2)) });
      for (const b of left.filter((x) => x.col === col).sort((a, b) => b.row - a.row)) {
        while (b.hp > 0) { b.hp--; b.hits.push(t); }
        destroy(b, balls[0]);
      }
    }
  }

  const end = t;
  for (const ball of balls) {
    ball.frames.push({ t: end, x: ball.x, y: ball.y });
    ball.end = end;
  }
  paddle.push({ t: end, x: paddle.at(-1).x });

  return {
    geom: { ...GEOM, gx, gridW, WL, WR, weeks },
    bricks, balls, paddle, scoreEvents, popups,
    ready, split, laser, fire, end,
    loop: end + 3.8,
    total: score,
  };
}
