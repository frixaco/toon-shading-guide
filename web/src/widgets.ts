// Small 2D explainers embedded in the text: <div data-widget="lambert|ramp|dot"></div>
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
const srgb = (v: number) => {
  v = Math.min(Math.max(v, 0), 1);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
};
const grey = (lin: number) => {
  const c = Math.round(srgb(lin) * 255);
  return `rgb(${c},${c},${c})`;
};
const rgb = (l: number[]) => `rgb(${l.map((v) => Math.round(srgb(v) * 255)).join(',')})`;
const SKIN = [0.93, 0.66, 0.56]; // a typical linear skin value from body_Color.png
const GREY = 0.3632;

function canvas(host: HTMLElement, w: number, h: number) {
  const c = document.createElement('canvas');
  const r = devicePixelRatio || 1;
  c.width = w * r;
  c.height = h * r;
  c.style.width = '100%';
  c.style.maxWidth = w + 'px';
  c.style.aspectRatio = `${w} / ${h}`;
  host.append(c);
  const g = c.getContext('2d')!;
  g.scale(r, r);
  // labels are 13 px at full size; a phone shows the canvas at about half size, so they grow up to 1.5x
  const font = () => (g.font = `${13 * Math.min(1.5, Math.max(1, w / (c.clientWidth || w)))}px system-ui`);
  return { c, g, font };
}

function slider(host: HTMLElement, label: string, min: number, max: number, step: number, value: number, on: (v: number) => void) {
  const l = document.createElement('label');
  l.className = 'wslider';
  l.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;
  const i = l.querySelector('input')!;
  i.oninput = () => on(+i.value);
  host.append(l);
  return i;
}

function arrow(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, w = 2.5) {
  g.strokeStyle = g.fillStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x1 - 11 * Math.cos(a - 0.4), y1 - 11 * Math.sin(a - 0.4));
  g.lineTo(x1 - 11 * Math.cos(a + 0.4), y1 - 11 * Math.sin(a + 0.4));
  g.closePath();
  g.fill();
}

// a line of coloured labels under a canvas: HTML, so it wraps on a narrow screen
function legend(host: HTMLElement, items: [string, string][]) {
  const d = document.createElement('div');
  d.className = 'wleg';
  d.innerHTML = items.map(([t, col]) => `<span style="color:${col}">${t}</span>`).join('');
  host.append(d);
}

function readout(host: HTMLElement) {
  const d = document.createElement('div');
  d.className = 'wread';
  host.append(d);
  return d;
}

// ---------------------------------------------------------------- Lambert: count rays per tile
// The beam is 8 parallel rays, each carrying the same amount of light. The surface is cut into tiles.
// Facing the light, the beam lands on 4 tiles (2 rays each). Tilted, the same 8 rays spread over more tiles.
function lambert(host: HTMLElement) {
  const W = 600, H = 330;
  const { c, g } = canvas(host, W, H);
  const out = readout(host);
  let th = 60;
  const cx = 300, gy = 240, tile = 40, x0 = 20, x1 = 580, beam = 160, rays = 8;
  // labels drawn on a dark backing so the rays don't run through them
  const tag = (s: string, x: number, y: number, col: string) => {
    g.font = '12px system-ui'; g.textAlign = 'left';
    g.fillStyle = 'rgba(17,19,23,0.85)';
    g.fillRect(x - 3, y - 11, g.measureText(s).width + 6, 15);
    g.fillStyle = col; g.fillText(s, x, y);
  };
  const draw = () => {
    g.clearRect(0, 0, W, H);
    const t = rad(th), cos = Math.cos(t), sin = Math.sin(t);
    const lit = cos > 0.02;
    const ux = sin, uy = -cos; // screen direction from the surface toward the light
    const half = beam / 2 / Math.max(cos, 1e-3);
    const fl = cx - half, fr = cx + half; // footprint on the surface
    // tiles: brightness = light landing per tile, relative to a tile facing the light
    g.font = '12px system-ui';
    g.textAlign = 'center';
    for (let x = x0; x < x1; x += tile) {
      const cover = lit ? Math.max(0, Math.min(x + tile, fr) - Math.max(x, fl)) / tile : 0;
      const v = cover * cos;
      g.fillStyle = v > 0.005 ? grey(v) : '#1b1e24';
      g.fillRect(x + 1, gy + 2, tile - 2, 30);
      if (v > 0.005) {
        g.fillStyle = v > 0.45 ? '#111' : '#ddd';
        g.fillText(v.toFixed(2), x + tile / 2, gy + 21);
      }
    }
    g.strokeStyle = '#8a93a3'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0, gy); g.lineTo(x1, gy); g.stroke();
    // normal
    g.setLineDash([5, 5]);
    arrow(g, cx, gy, cx, gy - 150, '#6ea8ff', 2);
    g.setLineDash([]);
    if (lit) {
      // the rays, landing evenly spaced inside the footprint
      for (let k = 0; k < rays; k++) {
        const hx = cx + (-beam / 2 + beam / rays / 2 + (k * beam) / rays) / cos;
        arrow(g, hx + ux * 260, gy + uy * 260, hx, gy - 2, 'rgba(255,213,74,0.9)', 1.6);
        g.fillStyle = '#ffd54a'; g.beginPath(); g.arc(hx, gy, 3, 0, 7); g.fill();
      }
      // the beam's own width: the short side of a right triangle whose long side is the footprint
      if (Math.abs(th) > 3 && fl >= x0 && fr <= x1) {
        const [sx, sy] = th > 0 ? [fr, gy] : [fl, gy];
        const ex = sx + (th > 0 ? -1 : 1) * beam * cos, ey = sy - Math.abs(sin) * beam;
        g.setLineDash([4, 3]); g.strokeStyle = '#ff5aa8'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
        tag('beam width: 4 tiles', (sx + ex) / 2 + (th > 0 ? 8 : -124), (sy + ey) / 2, '#ff5aa8');
      }
      // footprint bracket
      const bl = Math.max(fl, x0), br = Math.min(fr, x1);
      g.strokeStyle = '#ffd54a'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(bl, gy + 40); g.lineTo(bl, gy + 46); g.lineTo(br, gy + 46); g.lineTo(br, gy + 40); g.stroke();
      g.fillStyle = '#ffd54a'; g.textAlign = 'center';
      g.fillText(`lands on ${(2 * half / tile).toFixed(1)} tiles${fr > x1 ? ' (runs off the picture)' : ''}`, cx, gy + 62);
      g.textAlign = 'left';
      const n = (2 * half) / tile;
      out.innerHTML = th === 0
        ? `Tilt <b>0°</b>: facing the light. The beam is 8 rays, 4 tiles wide, and lands on exactly 4 tiles: <b>2 rays per tile</b>. Call that 1.00, the most a tile can get. Now drag the slider.
          <span class="sw" style="background:${grey(1)}"></span>`
        : `Tilt <b>${th.toFixed(0)}°</b>. The beam is always the same 8 rays, 4 tiles wide. Facing the light it lands on 4 tiles: <b>2 rays per tile</b>, and each tile gets 1.00.
        Tilted, the same 8 rays land on <b>${n.toFixed(1)} tiles</b>, so each tile gets <b>8 / ${n.toFixed(1)} = ${(8 / n).toFixed(2)} rays</b>, which is <b>${cos.toFixed(2)}</b> of the head-on amount (cos ${Math.abs(th).toFixed(0)}° = ${cos.toFixed(2)}).
        No light was lost: ${n.toFixed(1)} tiles × ${cos.toFixed(2)} ≈ 4 tiles × 1.00. It's just spread thinner, and a pixel shows how much light lands on <i>its</i> bit of surface.
        <span class="sw" style="background:${grey(cos)}"></span>`;
    } else {
      for (let k = 0; k < rays; k++) {
        const hx = cx - beam / 2 + beam / rays / 2 + (k * beam) / rays;
        arrow(g, hx + ux * 260, gy + uy * 260, hx + ux * 40, gy + uy * 40, 'rgba(255,213,74,0.3)', 1.4);
      }
      out.innerHTML = `Tilt <b>${th.toFixed(0)}°</b>: the light runs along or behind the surface, so no ray lands on this side. Every tile gets <b>0</b>.`;
    }
    tag('normal', cx + 6, gy - 140, '#6ea8ff');
  };
  slider(host, 'tilt the light', -90, 90, 1, th, (v) => { th = v; draw(); });
  c.onpointermove = (e) => {
    if (!e.buttons) return;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W - cx, y = gy - ((e.clientY - r.top) / r.height) * H;
    th = Math.max(-90, Math.min(90, Math.round(deg(Math.atan2(x, y)))));
    (host.querySelector('input') as HTMLInputElement).value = String(th);
    draw();
  };
  draw();
}

// ---------------------------------------------------------------- Color Ramp, Constant: a staircase
function ramp(host: HTMLElement) {
  const W = 600, H = 190;
  const { c, g, font } = canvas(host, W, H);
  const out = readout(host);
  let v = 0.42, stop = 0.15;
  const x0 = 40, x1 = W - 40, X = (t: number) => x0 + t * (x1 - x0);
  const draw = () => {
    g.clearRect(0, 0, W, H);
    font();
    g.fillStyle = '#c9d1dc';
    g.fillText('Fac (in): the light Shader to RGB measured', x0, 18);
    for (let i = 0; i < 256; i++) {
      g.fillStyle = grey(i / 255);
      g.fillRect(X(i / 256), 26, (x1 - x0) / 256 + 1, 34);
    }
    g.fillStyle = '#c9d1dc';
    g.fillText('Color (out): Constant interpolation', x0, 112);
    g.fillStyle = grey(GREY);
    g.fillRect(x0, 120, X(stop) - x0, 34);
    g.fillStyle = '#fff';
    g.fillRect(X(stop), 120, x1 - X(stop), 34);
    // stops
    for (const [p, col] of [[0, grey(GREY)], [stop, '#fff']] as const) {
      g.fillStyle = col;
      g.strokeStyle = '#000';
      g.beginPath();
      g.moveTo(X(p), 156); g.lineTo(X(p) - 7, 170); g.lineTo(X(p) + 7, 170); g.closePath();
      g.fill(); g.stroke();
    }
    g.fillStyle = '#8a93a3';
    g.fillText('0', x0 - 4, 186); g.fillText('1', x1 - 4, 186);
    g.fillText(`stop ${stop.toFixed(2)}`, X(stop) + 10, 184);
    arrow(g, X(v), 62, X(v), 116, '#ff5aa8', 2.5);
    const outV = v >= stop ? 1 : GREY;
    const ang = deg(Math.acos(Math.min(1, v)));
    out.innerHTML = `In: <b>${v.toFixed(2)}</b> (a spot turned about <b>${ang.toFixed(0)}°</b> away from the sun). ${v >= stop ? `${v.toFixed(2)} ≥ ${stop.toFixed(2)}` : `${v.toFixed(2)} &lt; ${stop.toFixed(2)}`} → out <b>${outV === 1 ? 'white (lit)' : 'grey 0.363 (shadow)'}</b> <span class="sw" style="background:${grey(outV)}"></span> × skin <span class="sw" style="background:${rgb(SKIN)}"></span> = <span class="sw" style="background:${rgb(SKIN.map((s) => s * outV))}"></span>`;
  };
  slider(host, 'measured light', 0, 1, 0.01, v, (x) => { v = x; draw(); });
  slider(host, 'white stop position', 0, 1, 0.01, stop, (x) => { stop = x; draw(); });
  new ResizeObserver(draw).observe(c); // draws now, and again when the label size changes
}

// ---------------------------------------------------------------- dot product and the x0.5+0.5 remap
function dot(host: HTMLElement) {
  const W = 600, H = 330;
  const { c, g, font } = canvas(host, W, H);
  const out = readout(host);
  let th = 60;
  const cx = 150, cy = 230, R = 115;
  const draw = () => {
    g.clearRect(0, 0, W, H);
    const t = rad(th), d = Math.cos(t), r = d * 0.5 + 0.5, lit = r >= 0.575;
    g.strokeStyle = '#8a93a3'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(20, cy); g.lineTo(280, cy); g.stroke();
    g.strokeStyle = '#3a4150'; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    // shadow of L on N (the projection IS the dot product)
    g.setLineDash([4, 4]);
    g.strokeStyle = 'rgba(255,213,74,0.6)';
    g.beginPath(); g.moveTo(cx + Math.sin(t) * R, cy - Math.cos(t) * R); g.lineTo(cx, cy - d * R); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = d >= 0 ? '#ffffff' : '#4f86ff'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - d * R); g.stroke();
    arrow(g, cx, cy, cx, cy - R, '#6ea8ff', 2.5);
    arrow(g, cx, cy, cx + Math.sin(t) * R, cy - Math.cos(t) * R, '#ffd54a', 2.5);
    font();
    g.fillStyle = '#6ea8ff'; g.fillText('N (normal)', cx + 6, cy - R - 6);
    const lt = 'L (to the light)'; // ends where the number lines start, even with the larger phone font
    g.fillStyle = '#ffd54a'; g.fillText(lt, Math.min(cx + Math.sin(t) * (R + 8) - 30, 308 - g.measureText(lt).width), cy - Math.cos(t) * (R + 14));
    // number lines
    const lx0 = 320, lx1 = 580, LX = (u: number) => lx0 + u * (lx1 - lx0);
    const line = (y: number, a: string, b: string, mid: string) => {
      g.strokeStyle = '#8a93a3'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(lx0, y); g.lineTo(lx1, y); g.stroke();
      g.fillStyle = '#8a93a3';
      g.fillText(a, lx0 - 6, y + 18); g.fillText(mid, LX(0.5) - 4, y + 18); g.fillText(b, lx1 - 6, y + 18);
    };
    g.fillStyle = '#c9d1dc'; g.fillText('Dot Product  (−1 … 1)', lx0, 40);
    line(62, '−1', '1', '0');
    g.fillStyle = '#c9d1dc'; g.fillText('× 0.5 + 0.5  (0 … 1)', lx0, 132);
    line(154, '0', '1', '0.5');
    g.fillStyle = grey(GREY); g.fillRect(lx0, 190, LX(0.575) - lx0, 22);
    g.fillStyle = '#fff'; g.fillRect(LX(0.575), 190, lx1 - LX(0.575), 22);
    g.fillStyle = '#c9d1dc'; g.fillText('Color Ramp, stop at 0.575', lx0, 232);
    g.fillStyle = '#ff5aa8';
    g.beginPath(); g.arc(LX(d * 0.5 + 0.5), 62, 6, 0, 7); g.fill();
    arrow(g, LX(d * 0.5 + 0.5), 70, LX(r), 148, '#ff5aa8', 1.5);
    g.beginPath(); g.arc(LX(r), 154, 6, 0, 7); g.fill();
    arrow(g, LX(r), 162, LX(r), 188, '#ff5aa8', 1.5);
    const nx = 0, ny = 1, lx = Math.sin(t), ly = Math.cos(t);
    out.innerHTML = `N = (${nx}, ${ny}), L = (${lx.toFixed(2)}, ${ly.toFixed(2)}). N·L = ${nx}×${lx.toFixed(2)} + ${ny}×${ly.toFixed(2)} = <b>${d.toFixed(2)}</b> = cos(${th.toFixed(0)}°). Remapped: ${d.toFixed(2)}×0.5+0.5 = <b>${r.toFixed(3)}</b> → ${lit ? '≥' : '&lt;'} 0.575 → <b>${lit ? 'lit' : 'shadow'}</b> <span class="sw" style="background:${grey(lit ? 1 : GREY)}"></span>`;
  };
  slider(host, 'angle between N and L', 0, 180, 1, th, (v) => { th = v; draw(); });
  c.style.touchAction = 'none'; // dragging on the drawing turns the arrow instead of scrolling
  c.onpointerdown = c.onpointermove = (e) => {
    if (!e.buttons) return;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W - cx, y = cy - ((e.clientY - r.top) / r.height) * H;
    th = Math.round(Math.abs(deg(Math.atan2(x, y))));
    (host.querySelector('input') as HTMLInputElement).value = String(th);
    draw();
  };
  new ResizeObserver(draw).observe(c); // draws now, and again when the label size changes
}

// ---------------------------------------------------------------- step vs line vs smoothstep (the shadow edge)
function plotAxes(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  g.strokeStyle = '#3a4150'; g.lineWidth = 1;
  g.strokeRect(x0, y0, w, h);
}
function smooth(host: HTMLElement) {
  const W = 600, H = 268;
  const { c, g, font } = canvas(host, W, H);
  legend(host, [['x = remapped N·L.', '#8a93a3'], ['smoothstep', '#ffd54a'], ['straight line (kinks at both ends)', '#6ea8ff'], ['step (Constant ramp)', '#8a93a3']]);
  const out = readout(host);
  let hard = 0.688;
  const x0 = 50, y0 = 20, pw = 520, ph = 200, lo = 0.35, hi = 0.8;
  const X = (x: number) => x0 + ((x - lo) / (hi - lo)) * pw, Y = (v: number) => y0 + ph - v * ph;
  const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const draw = () => {
    g.clearRect(0, 0, W, H);
    const a = (0.3 + 0.7 * hard) / 1.51, b = 1 / 1.51;
    plotAxes(g, x0, y0, pw, ph);
    g.fillStyle = 'rgba(255,213,74,0.08)'; g.fillRect(X(a), y0, X(b) - X(a), ph);
    const curve = (f: (x: number) => number, col: string, dash: number[] = []) => {
      g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath();
      for (let i = 0; i <= 260; i++) { const x = lo + (i / 260) * (hi - lo); const yy = Y(f(x)); i ? g.lineTo(X(x), yy) : g.moveTo(X(x), yy); }
      g.stroke(); g.setLineDash([]);
    };
    curve((x) => (x >= 0.575 ? 1 : 0), '#8a93a3', [4, 4]);
    curve((x) => Math.min(1, Math.max(0, (x - a) / (b - a))), '#6ea8ff', [8, 4]);
    curve((x) => ss(a, b, x), '#ffd54a');
    for (let i = 0; i < 260; i++) {
      const x = lo + (i / 260) * (hi - lo);
      g.fillStyle = grey(GREY + (1 - GREY) * ss(a, b, x)); g.fillRect(X(x), y0 + ph + 18, pw / 260 + 1, 22);
    }
    font(); g.fillStyle = '#8a93a3';
    for (const v of [0.4, 0.5, 0.6, 0.7, 0.8]) g.fillText(v.toFixed(1), X(v) - 9, y0 + ph + 14);
    out.innerHTML = `Edge from <b>${a.toFixed(3)}</b> to <b>${b.toFixed(3)}</b> (N·L ${(2 * a - 1).toFixed(2)} … ${(2 * b - 1).toFixed(2)}, i.e. ${(Math.acos(2 * a - 1) * 180 / Math.PI).toFixed(0)}° … ${(Math.acos(2 * b - 1) * 180 / Math.PI).toFixed(0)}° from the light). The strip is the resulting tone, shadow 0.363 → lit.`;
  };
  slider(host, 'hardness', 0, 0.98, 0.01, hard, (v) => { hard = v; draw(); });
  new ResizeObserver(draw).observe(c); // draws now, and again when the label size changes
}

// ---------------------------------------------------------------- HDRP spot falloff: distance and cone
function falloff(host: HTMLElement) {
  const W = 600, H = 204;
  const { c, g, font } = canvas(host, W, H);
  legend(host, [['attenuation (physical)', '#6ea8ff'], ['toon falloff = smoothstep(min(·, 1))', '#ffd54a']]);
  const out = readout(host);
  let d = 1.5, th = 20;
  const AS = 3.59995127, AO = -2.53499126, RS = 0.01;
  const att = (dist: number, deg: number) => {
    const inv = Math.min(1 / dist, 100), win = Math.min(1, Math.max(0, 1 - (dist * dist * RS) ** 2));
    const ang = Math.min(1, Math.max(0, Math.cos(rad(deg)) * AS + AO));
    return (inv * win * ang) ** 2;
  };
  const ss = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  const graph = (x0: number, title: string, xmax: number, unit: string, f: (x: number) => number, ft: (x: number) => number, cur: number) => {
    const pw = 250, ph = 150, y0 = 30, X = (x: number) => x0 + (x / xmax) * pw, Y = (v: number) => y0 + ph - Math.min(v, 1.25) / 1.25 * ph;
    plotAxes(g, x0, y0, pw, ph);
    g.strokeStyle = '#3a4150'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x0, Y(1)); g.lineTo(x0 + pw, Y(1)); g.stroke(); g.setLineDash([]);
    for (const [fn, col] of [[f, '#6ea8ff'], [ft, '#ffd54a']] as const) {
      g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath();
      for (let i = 0; i <= 200; i++) { const x = (i / 200) * xmax || 0.01; const yy = Y(fn(x)); i ? g.lineTo(X(x), yy) : g.moveTo(X(x), yy); }
      g.stroke();
    }
    g.strokeStyle = '#ff5aa8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(cur), y0); g.lineTo(X(cur), y0 + ph); g.stroke();
    font(); g.fillStyle = '#c9d1dc'; g.fillText(title, x0, 20);
    g.fillStyle = '#8a93a3'; g.fillText('0', x0 - 3, y0 + ph + 16); g.fillText(`${xmax}${unit}`, x0 + pw - 22, y0 + ph + 16); g.fillText('1', x0 - 12, Y(1) + 4);
  };
  const draw = () => {
    g.clearRect(0, 0, W, H);
    graph(40, `vs distance (at ${th}° off axis)`, 4, ' m', (x) => att(x, th), (x) => ss(Math.min(att(x, th), 1)), d);
    graph(330, `vs angle off axis (at ${d.toFixed(1)} m)`, 60, '°', (x) => att(d, x), (x) => ss(Math.min(att(d, x), 1)), th);
    const a = att(d, th);
    out.innerHTML = `At ${d.toFixed(2)} m and ${th}°: attenuation <b>${a.toFixed(3)}</b> → toon falloff <b>${ss(Math.min(a, 1)).toFixed(3)}</b>. Inside about 1 m the physical value passes 1; the toon version stays flat at 1.`;
  };
  slider(host, 'distance (m)', 0.2, 4, 0.01, d, (v) => { d = v; draw(); });
  slider(host, 'angle off the lamp axis (°)', 0, 60, 1, th, (v) => { th = v; draw(); });
  new ResizeObserver(draw).observe(c); // draws now, and again when the label size changes
}

const ALL: Record<string, (h: HTMLElement) => void> = { lambert, ramp, dot, smooth, falloff };
export function mountWidgets(root: HTMLElement) {
  for (const h of root.querySelectorAll<HTMLElement>('[data-widget]')) {
    h.classList.add('widget');
    ALL[h.dataset.widget!]?.(h);
  }
}
