#!/usr/bin/env python3
"""Fetch the open data for the Himalaya valley hazard explorer (sources and licences: research/data_sources.md).

Everything goes to out/raw/ (not committed):
  dem/      Copernicus DEM GLO-30 tiles, full COGs, from the public AWS bucket (no account) and the licence PDF
  s2/       Sentinel-2 L2A true-colour (TCI) windows over each valley, read from the public COGs by range request
  reports/  official reports (NDRRMA, ICIMOD) for reading only

Usage (from the repo root): .venv/bin/python data/fetch.py dem s2 reports
"""

import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "out/raw"
UA = {"User-Agent": "himalaya-hazard-research/0.1 (open-data reconstruction; contact via repository owner)"}

DEM_TILES = [f"Copernicus_DSM_COG_10_{lat}_00_{lon}_00_DEM" for lat in ("N27", "N28") for lon in ("E084", "E085")]
DEM_URL = "https://copernicus-dem-30m.s3.amazonaws.com/{name}/{name}.tif"
DEM_LICENCE = "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N28_00_E084_00_DEM/INFO/eula_F.pdf"

# valley windows (lon_min, lat_min, lon_max, lat_max), WGS84
AREAS = {
    "budhi_gandaki": (84.70, 27.80, 85.10, 28.70),
    "rasuwa": (85.10, 27.85, 85.60, 28.40),
}
# scene ids from research/data_sources.md, section 4.1
SCENES = {
    "budhi_gandaki": [
        "S2C_T45RTM_20261001T050516_L2A",  # clearest pre-event
        "S2C_T45RTM_20261011T050657_L2A",  # same morning, about 6.5 h after the failure
        "S2B_T45RTM_20261016T050607_L2A",  # second post-event
    ],
    "rasuwa": [
        "S2C_T45RUM_20260812T050239_L2A",  # clear pre-event, whole corridor
        "S2B_T45RUM_20260827T051017_L2A",  # first post-event (cloudy tile)
        "S2C_T45RUM_20260928T045730_L2A",  # first clear post-event, source area
        "S2C_T45RUM_20261001T050516_L2A",  # first clear post-event, Rasuwagadhi to Betrawati
    ],
}
STAC_ITEM = "https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/{id}"

REPORTS = {
    "ndrrma_budhigandaki_sitrep04_ne.pdf": "https://ndrrma.gov.np/mediafiles/publications/SitRep_NEP_04_15102026_Gorkha_Budhigandaki_Flood_jChOfmq.pdf",
    "ndrrma_bhotekoshi_trishuli_update_0826_1003.pdf": "https://ndrrma.gov.np/mediafiles/publications/Bhotekoshi-Trishuli_Flood_Update_From_August_26_2026_to_October_3_2026.pdf",
    "ndrrma_rdna_2026_ne.pdf": "https://ndrrma.gov.np/mediafiles/publications/RDNA_2026_for_web_compressed.pdf",
}
ICIMOD_RECORD = "https://lib.icimod.org/api/records/qdvc1-tc123/files"


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def download(url: str, path: Path, max_mb: float) -> None:
    """Stream a file to disk; stop if it grows past max_mb (a guard against a wrong link)."""
    if path.exists() and path.stat().st_size > 0:
        print(f"have {path.relative_to(ROOT)}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".part")
    size = 0
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            size += len(chunk)
            if size > max_mb * 1e6:
                tmp.unlink()
                raise RuntimeError(f"{url} is larger than {max_mb} MB; stopped")
            f.write(chunk)
    tmp.rename(path)
    print(f"got {path.relative_to(ROOT)} ({size / 1e6:.1f} MB)")


def fetch_dem() -> None:
    out = RAW / "dem"
    for name in DEM_TILES:
        path = out / f"{name}.tif"
        download(DEM_URL.format(name=name), path, 80)
        with rasterio.open(path) as ds:
            band = ds.read(1, masked=True)
            print(f"  {name}: {ds.width}x{ds.height} {ds.crs} elev {band.min():.0f}..{band.max():.0f} m")
    download(DEM_LICENCE, out / "LICENCE_eula_F.pdf", 5)


def fetch_s2() -> None:
    for area, scenes in SCENES.items():
        bounds = AREAS[area]
        for sid in scenes:
            path = RAW / "s2" / area / f"{sid}_TCI.tif"
            if path.exists():
                print(f"have {path.relative_to(ROOT)}")
                continue
            item = json.loads(get(STAC_ITEM.format(id=sid)))
            href = item["assets"]["visual"]["href"]
            env = rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif")
            with env, rasterio.open(href) as src:
                b = transform_bounds("EPSG:4326", src.crs, *bounds)
                win = from_bounds(*b, transform=src.transform).round_offsets().round_lengths()
                win = win.intersection(rasterio.windows.Window(0, 0, src.width, src.height))
                data = src.read(window=win)
                profile = src.profile | {
                    "width": int(win.width),
                    "height": int(win.height),
                    "transform": src.window_transform(win),
                    "compress": "deflate",
                    "predictor": 2,
                    "tiled": True,
                    "blockxsize": 512,
                    "blockysize": 512,
                }
            path.parent.mkdir(parents=True, exist_ok=True)
            with rasterio.open(path, "w", **profile) as dst:
                dst.write(data)
                dst.update_tags(
                    source=href,
                    item=sid,
                    datetime=item["properties"]["datetime"],
                    cloud_cover=str(item["properties"].get("eo:cloud_cover")),
                    attribution="Contains modified Copernicus Sentinel data 2026",
                )
            nodata = float(np.mean(np.all(data == 0, axis=0)))
            print(
                f"got {path.relative_to(ROOT)} {data.shape[2]}x{data.shape[1]} px, {path.stat().st_size / 1e6:.1f} MB, no-data {nodata:.0%}"
            )


def fetch_reports() -> None:
    out = RAW / "reports"
    for name, url in REPORTS.items():
        download(url, out / name, 40)
    files = json.loads(get(ICIMOD_RECORD))
    for entry in files.get("entries", []):
        if entry["key"].lower().endswith(".pdf"):
            download(entry["links"]["content"], out / f"icimod_{entry['key']}", 40)
    for pdf in out.glob("*.pdf"):
        head = pdf.read_bytes()[:5]
        if head != b"%PDF-":
            raise RuntimeError(f"{pdf.name} is not a PDF (starts with {head!r})")
    print("reports: all files start with %PDF-")


if __name__ == "__main__":
    steps = {"dem": fetch_dem, "s2": fetch_s2, "reports": fetch_reports}
    for arg in sys.argv[1:] or list(steps):
        steps[arg]()
