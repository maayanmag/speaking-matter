const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { const x = clamp(n); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a + (b - a) * t;

export function validateMesh(field) {
  if (!Array.isArray(field.surface) || field.surface.length !== 4096
    || !Array.isArray(field.triangles) || !field.triangles.length || field.triangles.length > 6000
    || field.uv?.length !== field.triangles.length || field.sampleTriangle?.length !== 4096
    || field.barycentric?.length !== 4096 || !(field.bounds?.zmax > field.bounds?.zmin)) {
    throw new Error('Invalid mesh correspondence');
  }
  field.triangles.forEach((t, i) => {
    if (t.length !== 9 || t.some(n => !Number.isFinite(n) || Math.abs(n) > 0.501)
      || field.uv[i].length !== 6 || field.uv[i].some(n => !Number.isFinite(n) || n < -0.001 || n > 1.001)) {
      throw new Error('Invalid triangle');
    }
  });
  field.surface.forEach((p, i) => {
    if (!field.mask[i]) {
      if (p !== null) throw new Error('Invalid empty surface cell');
      return;
    }
    const t = field.triangles[field.sampleTriangle[i]], uv = field.uv[field.sampleTriangle[i]];
    const w = field.barycentric[i];
    if (!p || p.length !== 3 || p.some(n => !Number.isFinite(n)) || !t
      || !w || w.length !== 3 || w.some(n => !Number.isFinite(n) || n < -1e-8)
      || Math.abs(w.reduce((a, b) => a + b, 0) - 1) > 1e-8) throw new Error('Invalid sample');
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(w.reduce((a, b, k) => a + b * t[k * 3 + axis], 0) - p[axis]) > 1e-8) {
        throw new Error('Surface/triangle mismatch');
      }
    }
    const u = w.reduce((a, b, k) => a + b * uv[k * 2], 0);
    const v = w.reduce((a, b, k) => a + b * uv[k * 2 + 1], 0);
    if (Math.abs(u - (i % 64 + 0.5) / 64) > 1e-8
      || Math.abs(v - (1 - (Math.floor(i / 64) + 0.5) / 64)) > 1e-8
      || Math.abs((p[2] - field.bounds.zmin) / (field.bounds.zmax - field.bounds.zmin) - field.heights[i]) > 1e-8) {
      throw new Error('UV/height correspondence mismatch');
    }
  });
}

export function createMeshView(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas unavailable');
  let width = 1, height = 1, field, palette;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  function setField(next) {
    if (field === next) return;
    field = next;
    palette = field.heights.map(h => `rgb(${Math.round(65 + h * 170)},${Math.round(69 + h * 133)},${Math.round(64 + h * 90)})`);
  }
  function render(phase, fraction, reduced) {
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, width, height);
    if (!field || width < 2) return;
    const size = Math.min(width * 0.76, height * 0.83);
    const t = phase === 'mesh' ? 0 : phase === 'unwrap' ? ease(fraction) : 1;
    const a = phase === 'mesh' && !reduced ? -0.65 + fraction * 1.3 : 0.65;
    const c = Math.cos(a), s = Math.sin(a);
    const cx = width / 2, cy = height / 2;
    function project(x, y, z, u, v) {
      const sx = x * c - y * s;
      const sy = -z * 0.95 + (x * s + y * c) * 0.32;
      const spread = Math.sin(t * Math.PI) * 0.25;
      return [cx + size * (mix(sx, u - 0.5, t) + (u - 0.5) * spread),
        cy + size * (mix(sy, 0.5 - v, t) + (0.5 - v) * spread)];
    }
    if (t < 1) {
      ctx.lineWidth = 0.65;
      ctx.strokeStyle = `rgba(203,193,162,${0.38 * (1 - t * 0.6)})`;
      ctx.beginPath();
      // A representative wireframe avoids tessellating thousands of overlapping fills.
      const stride = Math.ceil(field.triangles.length / 2000);
      for (let i = 0; i < field.triangles.length; i += stride) {
        const triangle = field.triangles[i];
        const uv = field.uv[i];
        for (let k = 0; k < 3; k++) {
          const p = project(triangle[k * 3], triangle[k * 3 + 1], triangle[k * 3 + 2], uv[k * 2], uv[k * 2 + 1]);
          if (k === 0) ctx.moveTo(...p); else ctx.lineTo(...p);
        }
        ctx.closePath();
      }
      ctx.stroke();
    }
    const cell = size / 64;
    field.surface.forEach((p, i) => {
      if (!p) return;
      const uvx = (i % 64 + 0.5) / 64, uvy = 1 - (Math.floor(i / 64) + 0.5) / 64;
      const xy = project(...p, uvx, uvy);
      const scanned = phase !== 'sampling' || i <= fraction * 4096;
      ctx.fillStyle = scanned ? palette[i] : '#242724';
      const radius = mix(1.35, cell * 0.94, t);
      ctx.fillRect(xy[0] - radius / 2, xy[1] - radius / 2, radius, radius);
    });
    if (t === 1) {
      ctx.strokeStyle = '#555446'; ctx.lineWidth = 1;
      ctx.strokeRect(cx - size / 2 - 2, cy - size / 2 - 2, size + 4, size + 4);
      if (phase === 'sampling') {
        const row = Math.min(63, Math.floor(fraction * 64));
        ctx.fillStyle = '#e8ce91';
        ctx.fillRect(cx - size / 2, cy - size / 2 + row * cell, size, 2);
      }
      ctx.fillStyle = '#b1aea2'; ctx.font = '12px monospace';
      ctx.fillText('U →', cx - size / 2, cy + size / 2 + 24);
      ctx.fillText('64 × 64', cx + size / 2 - 60, cy + size / 2 + 24);
    }
  }
  return {
    setField, render,
    get triangleCount() { return field ? Math.ceil(field.triangles.length / Math.ceil(field.triangles.length / 2000)) : 0; },
    dispose: () => observer.disconnect(),
  };
}
