"""Two-dimensional shallow-water solver on a masked square grid (research/methods.md 4.9).

First-order finite volumes: HLL fluxes with the hydrostatic reconstruction of Audusse et al. (2004), which keeps a
lake at rest at rest over any bed and keeps depths non-negative; Manning friction, semi-implicit. Only the active
cells of a mask are stored, as compact 1-D arrays with neighbour indices, so a long narrow river corridor costs only
its own cells. Faces between two active cells carry fluxes; faces to inactive cells are walls.

State per cell: h (depth, m), hu and hv (unit discharges, m2/s, x east and y south as the grid rows). Units SI.
"""

import numpy as np
from numba import njit, prange

G = 9.81
DRY = 1e-3  # m: below this a cell carries no velocity


class Grid:
    """Active cells of a 2-D mask (rows, cols) with cell size dx: compact indices and the faces between them."""

    def __init__(self, mask: np.ndarray, z: np.ndarray, dx: float):
        rows, cols = np.nonzero(mask)
        self.shape = mask.shape
        self.dx = float(dx)
        self.rows = rows.astype(np.int32)
        self.cols = cols.astype(np.int32)
        index = np.full(mask.shape, -1, np.int64)
        index[rows, cols] = np.arange(rows.size)
        self.index = index
        self.z = z[rows, cols].astype(np.float64)
        # x faces: cell (r, c) and (r, c + 1); y faces: (r, c) and (r + 1, c)
        e = index[:, 1:]
        w = index[:, :-1]
        m = (e >= 0) & (w >= 0)
        self.xl = w[m].astype(np.int64)
        self.xr = e[m].astype(np.int64)
        s = index[1:, :]
        n = index[:-1, :]
        m = (s >= 0) & (n >= 0)
        self.yt = n[m].astype(np.int64)
        self.yb = s[m].astype(np.int64)
        self.n = rows.size
        # walls: a missing neighbour reflects the flow; its pressure force is g h^2 / 2 on that side
        pad = np.pad(index, 1, constant_values=-1)
        r1, c1 = rows + 1, cols + 1
        west = pad[r1, c1 - 1] < 0
        east = pad[r1, c1 + 1] < 0
        north = pad[r1 - 1, c1] < 0
        south = pad[r1 + 1, c1] < 0
        self.wx = west.astype(np.float64) - east.astype(np.float64)
        self.wy = north.astype(np.float64) - south.astype(np.float64)


@njit(inline="always")
def _hll(hl, ul, vl, hr, ur, vr):
    """HLL flux for the x-normal direction: mass, normal momentum, tangential momentum."""
    if hl <= DRY and hr <= DRY:
        return 0.0, 0.0, 0.0
    cl = np.sqrt(G * hl)
    cr = np.sqrt(G * hr)
    sl = min(ul - cl, ur - cr)
    sr = max(ul + cl, ur + cr)
    f1l = hl * ul
    f2l = hl * ul * ul + 0.5 * G * hl * hl
    f1r = hr * ur
    f2r = hr * ur * ur + 0.5 * G * hr * hr
    if sl >= 0.0:
        f1, f2 = f1l, f2l
    elif sr <= 0.0:
        f1, f2 = f1r, f2r
    else:
        f1 = (sr * f1l - sl * f1r + sl * sr * (hr - hl)) / (sr - sl)
        f2 = (sr * f2l - sl * f2r + sl * sr * (hr * ur - hl * ul)) / (sr - sl)
    f3 = f1 * (vl if f1 >= 0.0 else vr)
    return f1, f2, f3


@njit(parallel=True, cache=True)
def _faces(h, hu, hv, z, al, ar, normal_x, f1, f2l, f2r, f3):
    """Fluxes across faces between cells al (left/top) and ar (right/bottom), with the hydrostatic reconstruction.
    f2l and f2r are the normal-momentum fluxes seen by the left and right cell (they differ by the bed source)."""
    for k in prange(al.size):
        i = al[k]
        j = ar[k]
        hi = h[i]
        hj = h[j]
        if normal_x:
            ui = hu[i] / hi if hi > DRY else 0.0
            vi = hv[i] / hi if hi > DRY else 0.0
            uj = hu[j] / hj if hj > DRY else 0.0
            vj = hv[j] / hj if hj > DRY else 0.0
        else:  # rotate: the normal is y
            ui = hv[i] / hi if hi > DRY else 0.0
            vi = hu[i] / hi if hi > DRY else 0.0
            uj = hv[j] / hj if hj > DRY else 0.0
            vj = hu[j] / hj if hj > DRY else 0.0
        zf = max(z[i], z[j])
        hl = max(0.0, hi + z[i] - zf)
        hr = max(0.0, hj + z[j] - zf)
        a, b, c = _hll(hl, ui, vi, hr, uj, vj)
        f1[k] = a
        f2l[k] = b + 0.5 * G * (hi * hi - hl * hl)
        f2r[k] = b + 0.5 * G * (hj * hj - hr * hr)
        f3[k] = c


@njit(parallel=True, cache=True)
def _wavespeed(h, hu, hv):
    n = h.size
    out = np.zeros(n)
    for i in prange(n):
        if h[i] > DRY:
            c = np.sqrt(G * h[i])
            out[i] = max(abs(hu[i] / h[i]), abs(hv[i] / h[i])) + c
    return out.max()


@njit(cache=True)
def _update(h, hu, hv, n2, dt, dx, xl, xr, xf1, xf2l, xf2r, xf3, yt, yb, yf1, yf2l, yf2r, yf3, src, wx, wy):
    """Advance one step: flux divergence, wall pressure, sources (m/s of depth), then Manning friction
    (semi-implicit)."""
    r = dt / dx
    for i in range(h.size):
        p = r * 0.5 * G * h[i] * h[i]
        hu[i] += p * wx[i]
        hv[i] += p * wy[i]
    for k in range(xl.size):
        i = xl[k]
        j = xr[k]
        h[i] -= r * xf1[k]
        h[j] += r * xf1[k]
        hu[i] -= r * xf2l[k]
        hu[j] += r * xf2r[k]
        hv[i] -= r * xf3[k]
        hv[j] += r * xf3[k]
    for k in range(yt.size):
        i = yt[k]
        j = yb[k]
        h[i] -= r * yf1[k]
        h[j] += r * yf1[k]
        hv[i] -= r * yf2l[k]
        hv[j] += r * yf2r[k]
        hu[i] -= r * yf3[k]
        hu[j] += r * yf3[k]
    for i in range(h.size):
        h[i] += src[i] * dt
        if h[i] <= DRY:
            h[i] = max(h[i], 0.0)
            hu[i] = 0.0
            hv[i] = 0.0
            continue
        speed = np.sqrt(hu[i] * hu[i] + hv[i] * hv[i]) / h[i]
        fr = 1.0 + dt * G * n2[i] * speed / h[i] ** (4.0 / 3.0)
        hu[i] /= fr
        hv[i] /= fr


class Solver:
    def __init__(self, grid: Grid, n_manning, cfl: float = 0.45):
        self.g = grid
        self.h = np.zeros(grid.n)
        self.hu = np.zeros(grid.n)
        self.hv = np.zeros(grid.n)
        self.n2 = np.broadcast_to(np.asarray(n_manning, dtype=np.float64) ** 2, (grid.n,)).copy()
        self.cfl = cfl
        self.src = np.zeros(grid.n)  # depth rate (m/s) added each step
        nx, ny = grid.xl.size, grid.yt.size
        self.xb = [np.zeros(nx) for _ in range(4)]
        self.yb = [np.zeros(ny) for _ in range(4)]
        self.t = 0.0

    def max_dt(self) -> float:
        s = _wavespeed(self.h, self.hu, self.hv)
        return self.cfl * self.g.dx / s if s > 0 else 10.0

    def step(self, dt: float) -> None:
        g = self.g
        _faces(self.h, self.hu, self.hv, g.z, g.xl, g.xr, True, *self.xb)
        _faces(self.h, self.hu, self.hv, g.z, g.yt, g.yb, False, *self.yb)
        _update(self.h, self.hu, self.hv, self.n2, dt, g.dx, g.xl, g.xr, *self.xb, g.yt, g.yb, *self.yb, self.src, g.wx, g.wy)
        self.t += dt

    def volume(self) -> float:
        return float(self.h.sum() * self.g.dx * self.g.dx)
