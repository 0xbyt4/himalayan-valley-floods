# .venv/bin/python -m pytest model/test_swe2d.py (from the project root)
import numpy as np
from swe2d import G, Grid, Solver


def run(s: Solver, t_end: float) -> None:
    while s.t < t_end - 1e-9:
        s.step(min(s.max_dt(), t_end - s.t))


def test_lake_at_rest_stays_at_rest():
    rng = np.random.default_rng(1)
    z = rng.uniform(0.0, 2.0, (30, 40))
    z[10:14, 10:30] = 3.5  # an island above the lake level
    mask = np.ones_like(z, bool)
    mask[0, :5] = False  # an irregular edge
    g = Grid(mask, z, 5.0)
    s = Solver(g, 0.04)
    s.h = np.maximum(0.0, 2.5 - g.z)
    run(s, 60.0)
    assert np.abs(s.hu).max() < 1e-9 and np.abs(s.hv).max() < 1e-9
    assert np.allclose(s.h + g.z, np.where(s.h > 0, 2.5, g.z + s.h))


def test_mass_is_conserved_in_a_closed_box():
    z = np.zeros((20, 60))
    z[:, 30:] = np.linspace(0, 3, 30)  # a ramp the wave runs up
    g = Grid(np.ones_like(z, bool), z, 2.0)
    s = Solver(g, 0.03)
    s.h = np.where(g.cols < 15, 2.0, 0.0)
    v0 = s.volume()
    run(s, 40.0)
    assert abs(s.volume() - v0) < 1e-9 * v0
    assert s.h.min() >= 0.0


def test_dam_break_on_a_dry_bed_matches_ritter():
    # Ritter (1892): h = (2 c0 - x / t)^2 / (9 g) between -c0 t and 2 c0 t; 4/9 h0 at the dam. The front itself has zero
    # depth, so it is compared where the analytic depth is 5 cm; a first-order scheme lags a little at the thin tip.
    n, dx, h0, t = 1000, 0.5, 1.0, 20.0
    g = Grid(np.ones((1, n), bool), np.zeros((1, n)), dx)
    s = Solver(g, 0.0)
    x = (g.cols + 0.5) * dx - n * dx / 2
    s.h = np.where(x < 0, h0, 0.0)
    run(s, t)
    c0 = np.sqrt(G * h0)
    exact = np.where(x < -c0 * t, h0, np.where(x > 2 * c0 * t, 0.0, (2 * c0 - x / t) ** 2 / (9 * G)))
    assert abs(s.h[np.argmin(np.abs(x))] - 4 / 9 * h0) < 0.03 * h0
    assert np.abs(s.h - exact).sum() * dx < 0.08 * h0 * n * dx / 2  # L1 error under 8 % of the released volume
    front, front_exact = x[s.h > 0.05].max(), x[exact > 0.05].max()
    assert abs(front - front_exact) < 0.1 * front_exact
