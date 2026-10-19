#!/usr/bin/env python3
"""Hydraulic tables for routing: for each cross-section, area A(h), top width B(h) and wetted perimeter P(h) for
stages h above the section's lowest point, plus the bed slope; written as JSON for the browser model.

Input: out/derived/<event>/corridor.json and sections.npz (data/prepare.py).
Output: out/derived/<event>/hydraulics.json (one section every 500 m, stages 0 to 60 m every 0.5 m) and
model/data/<event>_hydraulics.json (the same, the input of the routing models).

Method notes (research/methods.md 4.4):
- Only water connected to the channel counts: from the lowest point near the centreline, the wet zone grows left
  and right until the ground rises above the water surface.
- The DEM is a surface model and does not see the bed under water; the low-flow channel is missing, so modelled
  depths for a given discharge are too low. Stages are reported as ranges for that reason.
- Conveyance is summed over 30 m vertical strips (as in HEC-RAS subdivided sections), so discharge always grows
  with stage. The wetted perimeter is kept for reference.
- Slope: from the bed profile (a running minimum, see prepare.py) over a 2 km centred window, at least 0.0005.

Usage (from the repo root): .venv/bin/python data/hydraulics.py [rasuwa] [budhi_gandaki]
"""

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "out/derived"
APP_DATA = ROOT / "model/data"
STAGES = np.arange(0.0, 60.0 + 0.25, 0.5)
SPACING_KM = 0.5
CENTRE_HALF_M = 150.0  # the channel is looked for within this distance of the centreline
MIN_SLOPE = 0.0005


def section_table(lateral: np.ndarray, z: np.ndarray) -> tuple[float, list[list[float]]]:
    dx = float(lateral[1] - lateral[0])
    near = np.abs(lateral) <= CENTRE_HALF_M
    i0 = int(np.flatnonzero(near)[np.argmin(z[near])])
    bed = float(z[i0])
    rows = []
    for h in STAGES:
        ws = bed + h
        lo = i0
        while lo > 0 and z[lo - 1] <= ws:
            lo -= 1
        hi = i0
        while hi < len(z) - 1 and z[hi + 1] <= ws:
            hi += 1
        depth = np.clip(ws - z[lo : hi + 1], 0, None)
        area = float(depth.sum() * dx)
        width = float((hi - lo + 1) * dx)
        seg = z[lo : hi + 1]
        perim = float(np.sum(np.hypot(dx, np.diff(seg)))) + float(depth[0] + depth[-1])
        # conveyance factor sum(a_i * r_i^(2/3)) over 30 m vertical strips (r_i ~ the strip depth): Q = F S^0.5 / n.
        # One hydraulic radius for the whole section makes Q fall when the water spills onto a wide bench.
        convey = float(np.sum(dx * depth ** (5.0 / 3.0)))
        rows.append([round(h, 2), round(area, 1), round(width, 1), round(max(perim, dx), 1), round(convey, 1)])
    return bed, rows


def build(event: str) -> None:
    src = DERIVED / event
    corridor = json.loads((src / "corridor.json").read_text())
    sec = np.load(src / "sections.npz")
    km_sec, lateral, zs = sec["station_km"], sec["lateral_m"], sec["z"]
    km_st = np.array([s["km"] for s in corridor["stations"]])
    bed_st = np.array([s["bed_m"] for s in corridor["stations"]])

    out = []
    for target in np.arange(0.0, km_sec[-1] + 1e-9, SPACING_KM):
        j = int(np.argmin(np.abs(km_sec - target)))
        bed, rows = section_table(lateral, zs[j])
        km = float(km_sec[j])
        a, b = km - 1.0, km + 1.0
        m = (km_st >= a) & (km_st <= b)
        slope = MIN_SLOPE
        if m.sum() >= 3:
            fit = np.polyfit(km_st[m] * 1000.0, bed_st[m], 1)
            slope = max(MIN_SLOPE, -float(fit[0]))
        out.append({"km": round(km, 2), "bed_m": round(bed, 1), "slope": round(slope, 5), "table": rows})

    data = {
        "event": event,
        "columns": ["h_m", "area_m2", "top_width_m", "wetted_perimeter_m", "conveyance_factor_m8_3"],
        "spacing_km": SPACING_KM,
        "note": "From Copernicus DEM GLO-30 (a surface model): the bed under water is not seen, so depths are too low.",
        "places": corridor["places"],
        "sections": out,
    }
    text = json.dumps(data, separators=(",", ":"))
    (src / "hydraulics.json").write_text(text)
    APP_DATA.mkdir(parents=True, exist_ok=True)
    (APP_DATA / f"{event}_hydraulics.json").write_text(text)
    slopes = np.array([s["slope"] for s in out])
    widths20 = np.array([s["table"][40][2] for s in out])  # top width at 20 m stage
    print(
        f"{event}: {len(out)} sections, {len(text) / 1e6:.2f} MB; slope median {np.median(slopes):.4f} "
        f"(max {slopes.max():.3f}); width at 20 m stage median {np.median(widths20):.0f} m"
    )


if __name__ == "__main__":
    for ev in sys.argv[1:] or ["rasuwa", "budhi_gandaki"]:
        build(ev)
