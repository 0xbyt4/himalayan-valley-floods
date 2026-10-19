// Readers for the compact data files written by data/build_app.py, model/export_flood2d.py and model/export_app.mjs.
// The files are gzip streams stored as plain .bin files (the host does not compress binary types itself); they are
// inflated here with DecompressionStream. If a host already inflated a file, it is used as it is.

// the data version: goes up whenever a data file changes, so a browser never mixes new code with cached old data
export const DATA_V = 6;
export const dataUrl = (path) => `${path}?v=${DATA_V}`;

export async function fetchGz(url) {
  const res = await fetch(dataUrl(url));
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf; // not gzip: already inflated
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

// heights (data/build_app.py encode_heights): float32 step, int32 first value in steps, then the zigzag residuals of
// the planar prediction left + up - upper-left as low bytes [n] and high bytes [n]
export function decodeHeights(buf, rows, cols) {
  const dv = new DataView(buf);
  const n = rows * cols;
  const step = dv.getFloat32(0, true);
  const lo = new Uint8Array(buf, 8, n);
  const hi = new Uint8Array(buf, 8 + n, n);
  const q = new Int32Array(n);
  q[0] = dv.getInt32(4, true);
  for (let i = 1; i < n; i++) {
    const z = lo[i] | (hi[i] << 8);
    const r = (z >>> 1) ^ -(z & 1);
    const c = i % cols;
    q[i] = r + (i < cols ? q[i - 1] : c === 0 ? q[i - cols] : q[i - 1] + q[i - cols] - q[i - cols - 1]);
  }
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) h[i] = q[i] * step;
  return h;
}

// the stage rise bands (model/export_app.mjs): uint32 series, uint32 minutes, then per series the zigzag differences
// from one minute to the next, as low bytes [all] and high bytes [all]; returns Int16 centimetres in the old layout
export function decodeRise(buf) {
  const dv = new DataView(buf);
  const series = dv.getUint32(0, true);
  const minutes = dv.getUint32(4, true);
  const n = series * minutes;
  const lo = new Uint8Array(buf, 8, n);
  const hi = new Uint8Array(buf, 8 + n, n);
  const out = new Int16Array(n);
  for (let s = 0; s < series; s++) {
    let v = 0;
    for (let m = 0; m < minutes; m++) {
      const i = s * minutes + m;
      const z = lo[i] | (hi[i] << 8);
      v += (z >>> 1) ^ -(z & 1);
      out[i] = v;
    }
  }
  return out;
}
