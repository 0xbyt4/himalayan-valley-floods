# Data sources

Open datasets for reconstructing two 2026 flood events in a browser tool:

- **Budhi Gandaki, Gorkha, 11 October 2026.** Landslide dam near Chumchet (28.4394 N, 84.9121 E, OSM), Ungeling tributary.
- **Bhote Koshi / Trishuli, Rasuwa, 26 August 2026.** Ice-rock avalanche, temporary dam, about 100 km runout. The source is
  in the Lende (Lhende) Khola / Langtang Lirung area, close to the Nepal-China border. The exact source point is
  not settled in this file; see `events.md`.

Compiled 2026-10-17. Licences were read on the licence page or licence document itself, unless the entry says
"not verified". Small JSON API queries were run (STAC, Overpass, BIPAD, CEMS). On that date no imagery, DEM tiles or
other large files had been downloaded; file sizes come from HTTP HEAD requests. The Copernicus DEM tiles and the
Sentinel-2 windows were downloaded later (data/fetch.py) and the app is built from them.

Brief rule applied: public domain, CC0, CC BY, ODbL (with attribution), or a licence that allows free reuse with
attribution (Copernicus Sentinel and DEM). No NC, ND or SA image or data products. No accounts, no paid APIs.

Verdicts:

- **USE**: the licence and the access method both pass the rule.
- **USE WITH CARE**: usable, but with a condition the app must respect (written below).
- **DO NOT USE**: the licence or the access method fails the rule. Reading the product to check facts is still
  fine, if we cite it.

## 1. Summary

| # | Dataset | Res. | Both areas | Access without account | Licence | Verdict |
|---|---|---|---|---|---|---|
| 1.1 | Copernicus DEM GLO-30 | 1 arcsec (~30 m) | yes, 4 tiles | public S3 bucket | Copernicus WorldDEM-30 licence | USE |
| 1.2 | Copernicus DEM GLO-90 | 3 arcsec (~90 m) | yes | public S3 bucket | Copernicus WorldDEM-90 licence | USE (backup) |
| 1.3 | NASADEM (SRTM 2000 reprocessed) | 1 arcsec | yes | Planetary Computer, anonymous token | NASA data, CC0 unless marked | USE |
| 1.4 | ALOS AW3D30 | 1 arcsec | yes | Planetary Computer, anonymous token | JAXA Terms of Use of Research Data | USE WITH CARE |
| 1.5 | FABDEM (bare-earth Copernicus) | 1 arcsec | yes | Bristol repository | non-commercial | DO NOT USE |
| 2.1 | Sentinel-2 L2A (Collection 1) | 10 m | yes | Earth Search STAC + public S3 | Copernicus Sentinel data legal notice | USE |
| 2.2 | Landsat 8/9 Collection 2 | 30 m (15 m pan) | yes | USGS LandsatLook STAC + HTTPS | USGS, no restrictions | USE |
| 3.1 | Sentinel-1 GRD | ~10 m pixel | yes | Planetary Computer, anonymous token | Copernicus Sentinel data legal notice | USE |
| 3.2 | Sentinel-1 RTC (Planetary Computer) | 10 m | yes | needs a PC account | CC BY 4.0 | DO NOT USE (account) |
| 4.1 | HydroSHEDS v1 / HydroRIVERS / HydroBASINS | 15 arcsec | yes | direct download | WWF HydroSHEDS v1 licence agreement | DO NOT USE |
| 4.2 | MERIT Hydro | 3 arcsec | yes | registration and password | CC BY-NC 4.0 or ODbL 1.0 | DO NOT USE |
| 5.1 | OpenStreetMap (Overpass) | vector | yes | Overpass API | ODbL 1.0 | USE |
| 5.2 | GHSL (GHS-BUILT-S, GHS-POP, GHS-SMOD) | 3 arcsec / 100 m | yes | JRC open FTP | CC BY 4.0 | USE |
| 6.1 | DHM real-time water levels (via BIPAD API) | 10 min | yes | BIPAD REST API | no licence found | USE WITH CARE |
| 6.2 | DHM historical hydrological data | daily | yes | paid request form | not published | DO NOT USE (paid) |
| 7.1 | BIPAD portal (incidents, losses) | records | yes | BIPAD REST API | no licence found | USE WITH CARE |
| 7.2 | GEE community catalog `nepal_floods_2026` | 0.35 to 3.9 m | Rasuwa only | Earth Engine account | CC BY-NC 4.0 | DO NOT USE |
| 7.3 | Planet Crisis Response, Source Cooperative | 0.5 to 3.9 m | Rasuwa only | public HTTPS | CC BY-NC 4.0 | DO NOT USE |
| 7.4 | Disasters Charter activation 1052 | maps | Rasuwa only | view on web | reuse needs owner's permission | DO NOT USE |
| 7.5 | Copernicus EMS EMSR927 (vectors, statistics) | vector | Rasuwa only | public API + downloads | CEMS terms (free, full, open) | USE WITH CARE |
| 7.6 | UNOSAT products | maps | Rasuwa (reported) | web | UNITAR terms: non-commercial | DO NOT USE |
| 7.7 | NASA Earth Observatory | images | neither event | web | NASA material, credit line | not applicable |
| 8.1 | Kincey et al. landslide susceptibility | 30 m | yes | Zenodo | CC BY 4.0 | USE (722 MB download) |
| 8.2 | BGS METEOR landslide susceptibility | 90 m | yes | Zenodo | CC BY 4.0 | USE (secondary) |

## 2. Area footprints used in the queries

| Item | Budhi Gandaki | Bhote Koshi / Trishuli |
|---|---|---|
| Key points (OSM / BIPAD) | Chumchet 28.4394 N 84.9121 E; Chumling 28.474 N 84.963 E; Jagat 28.351 N 84.896 E; Machhakhola 28.229 N 84.874 E; Aarughat gauge 28.046 N 84.816 E; Trishuli confluence about 27.81 N 84.78 E | Rasuwagadhi gauge 28.2713 N 85.3776 E; Syaprubesi gauge 28.1707 N 85.3426 E; Betrawati gauge 27.97 N 85.18 E; Galchhi gauge 27.8023 N 85.0031 E; Malekhu gauge 27.8024 N 84.8441 E |
| Copernicus DEM tiles | N28 E084 (valley), N27 E084 (lower reach) | N28 E085 (source, Rasuwagadhi to Betrawati), N27 E085 and N27 E084 (Trishuli to Galchhi, Malekhu) |
| Sentinel-2 MGRS tiles | **45RTM** (Chumchet to Aarughat), 45RTL (confluence with the Trishuli) | **45RUM** (source, Rasuwagadhi, Timure, Syaprubesi, Betrawati), 45RUL (Betrawati to Trishuli Bazar), 45RTL (Galchhi, Malekhu) |
| Landsat WRS-2 | 142/040 and 141/040 | 141/040, 141/041 |
| Sentinel-1 relative orbits | 19 (descending, about 00:18 UTC), 85 (ascending, about 12:21 UTC) | 19, 85, 121 (descending, about 00:10 UTC) |

Nepal Time (NPT) is UTC + 5:45. All Sentinel-2 overpasses here are about 05:00 to 05:11 UTC (10:45 to 10:56 NPT).

## 3. Elevation

### 3.1 Copernicus DEM GLO-30 — USE

- **What:** Global digital surface model derived from TanDEM-X data (Airbus Defence and Space / DLR). The
  COP-DEM_GLO-30-DGED dataset, converted to Cloud Optimized GeoTIFF on AWS.
- **Resolution:** 1 arcsecond (about 30 m). COG tile 3600 x 3600 pixels, float32, DEFLATE.
- **Coverage:** Both areas are covered. Nepal tiles are in the public release. All four tiles answered HTTP 200.
- **Access (no account):** Public S3 bucket `copernicus-dem-30m`, HTTPS
  `https://copernicus-dem-30m.s3.amazonaws.com/<NAME>/<NAME>.tif`.

  | Tile name | Size (bytes) | Covers |
  |---|---|---|
  | `Copernicus_DSM_COG_10_N28_00_E084_00_DEM` | 41,688,284 | Budhi Gandaki from Arughat to Samagaun; Tsum valley |
  | `Copernicus_DSM_COG_10_N27_00_E084_00_DEM` | 45,336,691 | Lower Budhi Gandaki, confluence, Galchhi, Malekhu |
  | `Copernicus_DSM_COG_10_N28_00_E085_00_DEM` | 38,402,839 | Rasuwa: source area, Rasuwagadhi, Syaprubesi, Dhunche |
  | `Copernicus_DSM_COG_10_N27_00_E085_00_DEM` | 44,874,244 | Betrawati to Trishuli Bazar, Nuwakot |

  Total for the four tiles: about 170 MB. This is a large download, listed with its size before it is fetched. Each tile folder
  also holds `AUXFILES/*_EDM.tif` (editing mask), `*_FLM.tif` (filling mask), `*_HEM.tif` (height error,
  about 41 MB), `*_WBM.tif` (water body mask) and `INFO/eula_F.pdf` (the licence). The same tiles are in the
  Earth Search STAC collection `cop-dem-glo-30` and on Planetary Computer.
- **Licence:** "Licence for Copernicus DEM instance COP-DEM-GLO-30-F Global 30m Full, Free & Open". Read in full in
  the copy on the Copernicus Data Space documentation site and in the `INFO/eula_F.pdf` file in the bucket. Both
  copies are the same text.
  - Article 4 grants these rights to any natural or legal person: reproduction, distribution, communication to the
    public, and "adaptation, modification and combination with other data and information".
  - Article 5: the rights are free of charge.
  - The licence has no clause against commercial use. Article 2 defines the "General Public" as "any natural or
    legal person". Rights are worldwide and without time limit (Article 3).
  - The Provider (Airbus) keeps its IPR (Article 9). The licence does not grant use of Airbus logos.
- **Attribution (Article 6, exact text):**
  - Unmodified data: "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS
    by the European Union and ESA; all rights reserved."
  - Modified data (our case: hillshade, flow routing, cross-sections): "produced using Copernicus WorldDEM-30 © DLR
    e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and
    ESA; all rights reserved".
  - Required liability sentence in our legal notice: "The organisations in charge of the Copernicus programme by
    law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30".
  - Article 6(d): do not suggest endorsement by Airbus, ESA or the EU.
- **Verdict:** USE as the primary terrain.

### 3.2 Copernicus DEM GLO-90 — USE (backup)

- 3 arcsecond (about 90 m), bucket `copernicus-dem-90m`, names `Copernicus_DSM_COG_30_<N..>_<E..>_DEM`. Sizes:
  N28 E084 5,126,732; N27 E084 5,408,240; N28 E085 4,731,595; N27 E085 5,471,895 bytes.
- Licence "COP-DEM-GLO-90-F Global 90m Full, Free & Open", read in the bucket copy `INFO/eula_F.pdf`. Its
  articles match GLO-30, with "WorldDEM-90" in the notices. The Copernicus Data Space page links the annex
  `CSCDA_ESA_Mission-specific Annex_31_Oct_22.pdf` on spacedata.copernicus.eu. That server refused the connection,
  so that copy was not read.
- Attribution: the same sentences as GLO-30, with "WorldDEM-90".
- Use it for overview zoom levels and fast whole-corridor routing.

### 3.3 NASADEM — USE

- **What:** SRTM (February 2000) C-band radar elevation, reprocessed by NASA JPL. A DSM in practice: C-band
  partly penetrates the canopy.
- **Resolution:** 1 arcsecond.
- **Access (no account):** Planetary Computer STAC collection `nasadem`. Items `NASADEM_HGT_n28e084`,
  `n27e084`, `n28e085`, `n27e085`. Blob reads need a SAS token. The token comes without an account from
  `https://planetarycomputer.microsoft.com/api/sas/v1/token/nasadem` (tested, HTTP 200). Tile
  `NASADEM_HGT_n28e084.tif` is 23,486,092 bytes. The LP DAAC route needs an Earthdata login, so do not use that
  route.
- **Licence:** The collection links LP DAAC "Data Citation and Policies", which now redirects to NASA Earthdata
  "Data Use and Citation Guidance". That page says data from a NASA-led mission without a use-restriction label are
  "licensed as Creative Commons Zero (CC0)", and it asks users to acknowledge NASA and cite the dataset.
- **Attribution:** "NASADEM: NASA JPL (2020), NASADEM Merged DEM Global 1 arc second V001, NASA EOSDIS LP DAAC,
  doi:10.5067/MEaSUREs/NASADEM/NASADEM_HGT.001". The DOI is the standard LP DAAC product DOI. I did not open the
  LP DAAC product page.
- **Verdict:** USE as an independent cross-check of Copernicus DEM. It shows the year-2000 valley floor, before
  the 2015 Gorkha earthquake landslides.

### 3.4 ALOS AW3D30 — USE WITH CARE

- **What:** JAXA ALOS PRISM optical-stereo DSM. Version on Planetary Computer: `AW3D30_global`.
- **Resolution:** 1 arcsecond.
- **Access (no account):** Planetary Computer collection `alos-dem`. Items `ALPSMLC30_N028E084_DSM` and so on.
  Anonymous SAS token. `ALPSMLC30_N028E084_DSM.tif` is 32,270,283 bytes.
- **Licence:** "Terms of Use of Research Data", JAXA Space Technology Directorate I
  (https://earth.jaxa.jp/en/data/policy/, read in full).
  - Users may "use, modify or distribute to the third party the Research Data … without a fee".
  - Credit is required, also for derivatives. Example credit line: "Credit: XXXX (JAXA)". For our case:
    "Credit: AW3D30 (JAXA)".
  - Section 2.3: commercial use is allowed without a fee, "however, the user needs to notify JAXA thereof in
    advance".
  - Section 2.5: the terms may change without notice.
- **Verdict:** USE WITH CARE. Use it for cross-checks only. Do not ship it in the app. If the tool is ever
  used commercially, JAXA must get a notice first.

### 3.5 FABDEM — DO NOT USE

The bare-earth version of Copernicus GLO-30 would solve the canopy problem. Secondary catalogues label it
CC BY-NC-SA 4.0. The University of Bristol resource pages for V1-0 reportedly say "Non-Commercial Government
Licence". I did not read the V1-2 licence field myself. Both labels are non-commercial, so it fails the rule either
way.

### 3.6 DSM versus DTM in steep forested valleys

- **Copernicus DEM is a DSM.** The bucket readme says it "represents the surface of the Earth including buildings,
  infrastructure and vegetation". The lower Budhi Gandaki (below about 1,500 m) and the Trishuli valley around
  Betrawati carry subtropical forest. Canopy raises slopes and narrow valley floors by up to the tree height, a
  few metres to more than 20 m. X-band (TanDEM-X) penetrates the canopy less than SRTM C-band does.
- **Gorges are narrower than a few pixels.** The Budhi Gandaki between Machhakhola and Jagat and the Bhote Koshi
  between Timure and Syaprubesi are in places tens of metres wide. At 30 m the channel bottom is smoothed and
  usually too high. Cross-sections, and therefore flow area, depth and wave speed, are biased. Burn the river line
  (OSM waterway) into the DEM, or adjust cross-sections to observed widths from Sentinel-2. State the bias in the
  uncertainty band.
- **Radar layover and shadow on steep slopes.** These areas are filled or edited. Use the `FLM` and `EDM` masks
  to grade confidence per pixel, and use `HEM` as the height error.
- **Data epoch.** TanDEM-X acquisitions are from about 2011 to 2015. The DEM therefore misses later landslide
  scars, the 2026 deposits, and new hydropower works. NASADEM shows the year 2000. Show every DEM-derived number
  with its epoch.
- Hydrological conditioning (sink filling, flow direction) must be done by us (see section 6), because the
  conditioned hydrography products fail the licence rule.

## 4. Optical imagery

### 4.1 Sentinel-2 L2A via Element 84 Earth Search — USE

- **What:** Copernicus Sentinel-2A, -2B and -2C, Level-2A surface reflectance, Collection 1 reprocessing
  (`processing:version` 05.13). Sentinel-2A, -2B and -2C were all acquiring in 2026.
- **Resolution:** 10 m (B02, B03, B04, B08, and the TCI true-colour image), 20 m (SWIR and the SCL scene class).
- **Access (no account):** STAC API `https://earth-search.aws.element84.com/v1/search`, collection
  `sentinel-2-c1-l2a`. Assets are public HTTPS COGs on
  `e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com`. The true-colour COG is the `visual` asset:
  `.../sentinel-2-c1-l2a/45/R/<TM|UM|UL|TL>/<YYYY>/<M>/<item id>/TCI.tif` (the month has no leading zero). Other
  assets per item: `scl`, `cloud`, `snow`, the single bands, `thumbnail`, `preview`. A browser can read a COG window
  by HTTP range request, so the app does not need the full 100 to 300 MB file.
- **Licence:** The collection's STAC `license` link points to the Sentinel Data Legal Notice. I read it at
  https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice (the old sentinel.esa.int
  host no longer resolves). Text: EU law "grants free access to Copernicus Sentinel Data and Service Information
  for the purpose of the following use in so far as it is lawful: (a) reproduction; (b) distribution; (c)
  communication to the public; (d) adaptation, modification and combination with other data and information; (e)
  any combination of points (a) to (d)". The notice does not limit commercial use. The Copernicus Data Space Terms
  and Conditions say Sentinel data use is governed by this notice.
- **Attribution (exact):** "Copernicus Sentinel data [Year]" for unmodified data, and "Contains modified
  Copernicus Sentinel data [Year]" for adapted data. Our use: "Contains modified Copernicus Sentinel data 2026".
  For EMS products the notice gives "Copernicus Service information [Year]".
- **Caveat on cloud numbers:** `eo:cloud_cover` is for the whole 110 km tile, not the valley. Valleys can be clear
  while ridges are cloudy, and the reverse. ESA published a Betrawati to Gerkhu pair from 12 August and 27
  August, and 27 August has 54 to 78 % tile cloud. The candidates below must be checked visually (thumbnail or a
  small window read) before we commit to them. This was not done in this pass, which made no image downloads (2026-10-17).
  Snow cover in October tiles (20 to 50 %) is mostly high peaks, not valley floors.

#### Budhi Gandaki (event 11 October 2026; landslide reported about 04:22 NPT, see `events.md`)

Point searches at Chumchet and at Aarughat both return tile **45RTM** (bbox 83.924 to 85.067 E, 27.903 to
28.914 N). The confluence with the Trishuli is in **45RTL**.

| Role | Item id | Date, time (UTC) | Tile cloud % | TCI size (bytes) |
|---|---|---|---|---|
| Clearest recent pre-event | `S2C_T45RTM_20261001T050516_L2A` | 2026-10-01 05:10 | 17.2 | 196,973,287 |
| Pre-event | `S2A_T45RTM_20261003T050648_L2A` | 2026-10-03 05:11 | 29.1 | not checked |
| **Last pre-event** | `S2B_T45RTM_20261006T050354_L2A` | 2026-10-06 05:10 | 29.7 | 185,523,107 |
| **First post-event** | `S2C_T45RTM_20261011T050657_L2A` | 2026-10-11 05:10 (10:55 NPT, same day, about 6.5 h after the reported landslide) | 20.4 | 196,951,247 |
| Post-event, confluence | `S2C_T45RTL_20261011T050657_L2A` | 2026-10-11 05:11 | 2.3 | 301,133,388 |
| Second post-event | `S2B_T45RTM_20261016T050607_L2A` | 2026-10-16 05:10 | 36.2 | 195,117,485 |

Pre-event 45RTL for the lower reach: `S2C_T45RTL_20261001T050516_L2A` (48.0 %, 243,429,527 bytes).

#### Bhote Koshi / Trishuli (event 26 August 2026; river rise from about 09:00 NPT per ICIMOD)

There are two Sentinel-2 swaths over tile **45RUM**:

- The swath at about 05:10 UTC covers Rasuwagadhi, Syaprubesi and Betrawati. Its tile no-data is about 9 %.
- The swath at about 05:00 UTC covers only the east part of the tile. Its tile no-data is about 42 %. It includes
  Langtang Lirung (28.256 N, 85.519 E) but not Rasuwagadhi.

Tile **45RUL** covers Betrawati to Trishuli Bazar.

| Role | Item id | Date, time (UTC) | Tile cloud % | TCI size (bytes) | Notes |
|---|---|---|---|---|---|
| Clear pre-event | `S2A_T45RUL_20260811T045240_L2A` | 2026-08-11 05:01 | 13.4 | 253,409,586 | Lower valley |
| **Clear pre-event, whole corridor** | `S2C_T45RUM_20260812T050239_L2A` | 2026-08-12 05:10 | 18.7 | 265,243,901 | ESA used 12 Aug as the pre-event image near Betrawati |
| Same date, lower valley | `S2C_T45RUL_20260812T050239_L2A` | 2026-08-12 05:11 | 27.9 | 207,422,216 | |
| **Last pre-event, source area** | `S2B_T45RUM_20260824T045006_L2A` | 2026-08-24 05:00 | 38.6 | 127,724,485 | East swath only; ESA used 24 Aug for a pre-event SWIR view |
| Last pre-event, west swath | `S2A_T45RUM_20260824T050638_L2A` | 2026-08-24 05:11 | 51.0 | 190,557,676 | Covers Rasuwagadhi |
| **First post-event** | `S2B_T45RUM_20260827T051017_L2A` | 2026-08-27 05:10 | 78.5 | 99,336,848 | Cloudy tile, but ESA shows Betrawati to Gerkhu clear enough |
| First post-event, lower valley | `S2B_T45RUL_20260827T051017_L2A` | 2026-08-27 05:11 | 54.3 | 152,549,135 | |
| First clear post-event, lower valley | `S2C_T45RUL_20260921T050555_L2A` | 2026-09-21 05:11 | 16.2 | 198,051,357 | |
| **First clear post-event, source area** | `S2C_T45RUM_20260928T045730_L2A` | 2026-09-28 05:00 | 1.6 | 98,197,040 | East swath; no Rasuwagadhi |
| Same date, lower valley | `S2C_T45RUL_20260928T045730_L2A` | 2026-09-28 05:01 | 7.9 | 256,369,798 | |
| **First clear post-event, Rasuwagadhi to Betrawati** | `S2C_T45RUM_20261001T050516_L2A` | 2026-10-01 05:10 | 6.9 | 177,817,651 | |

Between 27 August and 20 September every 45RUM scene has 53 to 93 % tile cloud (monsoon).

- **Bands used in the app (2026-10-18):** besides the true-colour `visual` asset, data/build_layers.py reads the
  `red` (B04), `nir` (B08) and `scl` assets of the same scenes for the vegetation-loss layer, only over the 36 detail
  tiles along the Rasuwa corridor. Reflectance = DN x scale + offset from each asset's `raster:bands`. Reads are
  cached in out/cache/s2/ (not committed).

### 4.2 Landsat 8/9 Collection 2 — USE

- **What:** USGS Landsat 8 OLI and Landsat 9 OLI-2, Level-2 surface reflectance and Level-1.
- **Resolution:** 30 m, 15 m panchromatic (Level-1 only).
- **Access (no account):** USGS STAC `https://landsatlook.usgs.gov/stac-server`, collections `landsat-c2l2-sr` and
  `landsat-c2l1`. Assets are public HTTPS under `https://landsatlook.usgs.gov/data/collection02/...`. Earth Search
  `landsat-c2-l2` lists the same scenes, but its asset links point to the requester-pays bucket
  `s3://usgs-landsat`, which needs an AWS account. Use the LandsatLook HTTPS links.
- **Scenes:**

  | Event | Item | Time | Tile cloud % | Use |
  |---|---|---|---|---|
  | Rasuwa | `LC09_L2SP_141040_20260826_20260827_02_T1` | 2026-08-26 04:47 UTC (10:32 NPT) | 47.5 | **During the event**, about 1.5 h after the river rise began. ESA published a SWIR view of this scene. |
  | Rasuwa | `LC09_L2SP_141041_20260826_20260827_02_T1` | 2026-08-26 04:48 UTC | 67.8 | Lower Trishuli on the same pass |
  | Rasuwa | `LC09_L2SP_141040_20260810_02_T1` | 2026-08-10 04:47 UTC | 49.4 | Pre-event |
  | Budhi Gandaki | `LC08_L2SP_141040_20261005_20261009_02_T1` | 2026-10-05 04:47 UTC | 8.1 | **Clear pre-event** (also covers Rasuwa: first clear Landsat after that event) |
  | Budhi Gandaki | `LC09_L2SP_142040_20261004_02_T1` | 2026-10-04 04:54 UTC | 12.6 | Pre-event |
  | Budhi Gandaki | `LC09_L1TP_141040_20261013_20261013_02_T1` | 2026-10-13 04:48 UTC | 10.3 | **First post-event**. Level-1 only; Level-2 not yet processed on 2026-10-17. |

- **Licence:** The USGS FAQ "Are there any restrictions on the use or redistribution of Landsat data?" says: "There
  are no restrictions on Landsat data downloaded from the USGS; it can be used or redistributed as desired." It
  asks for a statement of the data source.
- **Attribution:** "Landsat 8/9 data courtesy of the U.S. Geological Survey". This is common practice. The exact
  wording on the EROS citation page was not read.

## 5. Radar (Sentinel-1)

### 5.1 Sentinel-1 GRD via Planetary Computer — USE

- **What:** C-band SAR, IW mode, GRDH, dual polarisation VV and VH. Only Sentinel-1D scenes were returned for
  these points.
- **Access:**
  - Earth Search `sentinel-1-grd` lists the scenes, but its assets are in the requester-pays bucket
    `s3://sentinel-s1-l1c` (`storage:requester_pays: true`). That needs an AWS account, so do not use it.
  - Planetary Computer `sentinel-1-grd` holds the same scenes as COGs. It works with an anonymous SAS token from
    `/api/sas/v1/token/sentinel-1-grd` (tested).
  - Size per scene: VV about 668 MB and VH about 578 MB (checked for the 11 October scene). This is a large
    download.
  - Planetary Computer `sentinel-1-rtc` (terrain-corrected, CC BY 4.0) states that "A Planetary Computer account
    is required", so it fails the no-account rule.
- **Licence:** The Planetary Computer GRD collection links the Copernicus Sentinel Data Legal Notice (section 4.1).
  Attribution: "Contains modified Copernicus Sentinel data 2026".
- **Scenes:**

  | Event | Pre-event | Post-event | Notes |
  |---|---|---|---|
  | Budhi Gandaki | `S1D_IW_GRDH_1SDV_20260929T001845_..._008F91` (desc., orbit 19); `S1D_..._20261003T122142_..._0091DF` (asc., orbit 85) | `S1D_IW_GRDH_1SDV_20261011T001845_20261011T001910_004960_0095BA` (desc., orbit 19, **00:18 UTC = 06:03 NPT on 11 Oct**); `S1D_..._20261015T122142_..._0097FB` (asc., orbit 85) | The 11 Oct pass is about 1.7 h after the reported landslide time and before the Aarughat gauge rose (06:40 NPT). It may show the dam and the impoundment. The pair 29 Sep / 11 Oct has the same geometry, which allows change detection. |
  | Rasuwa | `S1D_..._20260824T001844_..._007D5D` (desc., 19); `S1D_..._20260819T001036_..._007ABD` (desc., 121); `S1D_..._20260816T122141_..._007980` (asc., 85) | `S1D_..._20260828T122141_20260828T122206_004326_007FA4` (asc., 85, 18:06 NPT on 28 Aug); `S1D_..._20260831T001037_..._0080EC` (desc., 121); `S1D_..._20260905T001844_..._00837B` (desc., 19) | Same-geometry pairs: 16 Aug / 28 Aug, 19 Aug / 31 Aug, 24 Aug / 5 Sep. |

- **Caveat:** In steep Himalayan valleys, layover and radar shadow hide much of the valley floor in one look
  direction. Use both ascending and descending passes. GRD needs terrain correction (we would do it with
  Copernicus DEM). This is real work. Treat SAR as optional and cloud-independent support, not the primary layer.

## 6. Rivers and catchments

### 6.1 HydroSHEDS v1, HydroRIVERS, HydroBASINS — DO NOT USE

- **What:** WWF hydrography derived from SRTM: conditioned DEM, flow direction, river network, nested basins
  (levels 1 to 12).
- **Resolution:** 3 to 30 arcsec rasters. HydroRIVERS comes from 15 arcsec (about 500 m) data.
- **Coverage:** Global, both areas.
- **Access:** Direct download without an account. Example: `HydroRIVERS_v10_as_shp.zip` (Asia, 91 MB) and
  `hybas_as_lev01-12_v1c.zip` from data.hydrosheds.org.
- **Licence:** The product pages say the data are "freely available for scientific, educational and commercial
  use" under "the same license agreement as the HydroSHEDS core products". The agreement itself is Appendix A of
  the HydroSHEDS Technical Documentation v1.4. I read it in full. It is not a CC licence. Key terms:
  - 2.1.2: distribution is allowed only "incorporated into any Derivative Works to End Users, subject to the terms
    and conditions of an end user license agreement with terms that are at least as protective". "In no event shall
    Licensee license or distribute the Licensed Materials as a stand-alone product."
  - 2.1.3: no decompiling or reverse engineering. The licensee must protect against unauthorised copying.
  - 7.1: the licence terminates "in the sole discretion of WWF".
  - 10.7: the licensee must keep records and allow WWF audits.
  - Exhibit B: a long copyright statement is required ("This product … incorporates data from the HydroSHEDS
    version 1 database which is © World Wildlife Fund, Inc. (2006-2022) …", with USGS, NASA, ESRI, CIAT,
    UNEP-WCMC and other credits).
  - The general hydrosheds.org website terms also call site materials, including "data", "personal, non-commercial
    use only". That clause is overridden for downloaded products by the product licence.
- **Verdict:** DO NOT USE in the app. Commercial use is allowed, but serving HydroRIVERS or HydroBASINS vectors to
  browsers needs an end-user licence at least as protective as WWF's. This is not "free reuse with attribution".
  Instead, derive streams and catchments ourselves from Copernicus DEM (D8 or D-infinity flow routing in the
  data scripts), and use OSM waterways for river lines and names.

### 6.2 MERIT Hydro — DO NOT USE

- 3 arcsecond hydrography (flow direction, upstream area, river width, HAND). Global.
- **Licence**, from the project page (https://global-hydrodynamics.github.io/MERIT_Hydro/): "MERIT Hydro is
  licensed under either of the following licenses": CC BY-NC 4.0 or ODbL 1.0. Under ODbL, data derived from it
  must also be published under ODbL. The page asks users not to redistribute the original data in full.
- **Access:** Registration through a Google Form, then a password by e-mail. This fails the no-account rule.
- **Verdict:** DO NOT USE. The access needs registration, and it gives little over our own routing on Copernicus
  DEM.

## 7. Settlements, roads, bridges, hydropower

### 7.1 OpenStreetMap via Overpass — USE

- **What:** Buildings, places, roads, bridges, waterways, power plants, dams.
- **Access (no account):** Overpass API `https://overpass-api.de/api/interpreter`. The public server was often
  overloaded on 2026-10-17 and returned 502 "at capacity". The queries succeeded after retries with exponential
  backoff. For the app, extract once in a data script and ship static files. Do not query Overpass from viewers'
  browsers.
- **Counts:** Run on 2026-10-17. OSM base timestamp 20:40 UTC.

  Valley corridors are boxes of about ±600 m along the OSM river line, sampled every about 1.5 km:
  - Budhi Gandaki: OSM ways named "Budhi Gandaki" from about 28.69 N down to the Trishuli confluence, about 110 km.
  - Rasuwa: "भोटे कोशी / Bhote Koshi" from Rasuwagadhi, then "Trishuli River" and "Trishuli Ganga River" down to about
    27.86 N 85.09 E (below Trishuli Bazar), about 55 km. The OSM-named reach does not reach Galchhi.

  | Feature | Budhi Gandaki corridor | Rasuwa corridor | Budhi Gandaki wide box 27.78-28.75 N, 84.68-85.10 E | Rasuwa wide box 27.78-28.45 N, 84.95-85.60 E |
  |---|---|---|---|---|
  | Buildings (`building=*`) | 3,897 | 8,451 | 151,996 | 228,214 |
  | Highway ways with `bridge=*` | 61 | 24 | 303 | 447 |
  | Place nodes (village, hamlet, town, isolated dwelling) | 39 | 16 | 575 (incl. locality) | 639 (incl. locality) |
  | Power plants or generators | 0 | 15 | 2 (hydro-tagged) | 9 (hydro-tagged) |
  | Dams or weirs (`waterway=dam/weir`) | not counted | not counted | 6 | 10 |

  The OSM river geometry also shows hydropower features in the Rasuwa corridor: "Trishuli Hydro Power Dam" and its
  canal (27.925 N, 85.147 E), "Upper Trishuli-3 Hydropower Project" (`waterway=construction`), Upper Trishuli
  canals and tunnel, and the Upper Trishuli-3 surge tank. The Budhi Gandaki corridor has no OSM power plant. The
  hydropower site reported as damaged (see `events.md`) must be mapped by hand, with a source.
- **Caveats:**
  - OSM shows the pre-event state unless mappers updated it after the floods. Destroyed bridges and buildings may
    still be in OSM.
  - Completeness differs by village. Rural Nepal building coverage comes from HOT and Microsoft/Google imports of
    mixed quality.
  - Use OSM for exposure ("mapped buildings within X m of the channel"), not as a damage count.
- **Licence:** ODbL 1.0. The OSM copyright page says: "OpenStreetMap is open data, licensed under the Open Data
  Commons Open Database License (ODbL)". If you alter or build upon the data, you may distribute the result only
  under the same licence. This is share-alike for derived databases. The brief allows ODbL explicitly.
- **Attribution:** The OSMF Attribution Guidelines need the name "OpenStreetMap", a statement that the data is
  under the ODbL, and a link to https://www.openstreetmap.org/copyright. On interactive maps, put the credit in a
  map corner. It may collapse after 5 seconds if it stays easy to find. Wording for the app: "© OpenStreetMap
  contributors, data available under the Open Database License (link to /copyright)".
- **Verdict:** USE. Publish our OSM-derived exposure layers (for example buildings per river kilometre) under ODbL,
  as separate files. Do not merge them into a database under a different licence.

- **Used in the app (2026-10-18):** data/build_layers.py queries Overpass once for all features within 2 km of
  the Rasuwa corridor (one point per km): 83,795 buildings (`out center`; facilities mapped
  as buildings counted once, as the facility) and 770 other features. OSM base timestamp
  2026-10-18T10:36:06Z. Raw answers in out/raw/osm/ (not committed). The derived exposure files
  (app/data/rasuwa/layers/osm.json, buildings.bin) are published under the ODbL with the credit above.

### 7.2 GHSL (Global Human Settlement Layer) — USE

- **What:** JRC/Copernicus layers: built-up surface (GHS-BUILT-S, epochs to 2025 and 2030), building height
  (GHS-BUILT-H), population grid (GHS-POP), settlement model (GHS-SMOD).
- **Resolution:** 3 arcsec (about 90 m) in EPSG:4326, or 100 m / 1 km in Mollweide (EPSG:54009).
- **Access (no account):** `https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/`. Example:
  `GHS_BUILT_S_GLOBE_R2023A/GHS_BUILT_S_E2020_GLOBE_R2023A_4326_3ss/V1-0/tiles/GHS_BUILT_S_E2020_GLOBE_R2023A_4326_3ss_V1_0_R7_C27.zip`
  (66,169,566 bytes). R7_C27 most likely covers 80 to 90 E, 20 to 30 N. That is inferred from the 10° tile
  numbering and not yet checked against the tile schema. Release R2023A also has an E2025 epoch.
- **Licence:** The GHSL "how to cite" page says: "The GHSL data are provided under the Creative Commons Attribution
  4.0 International (CC BY 4.0) license", and "© European Union, 1995-2025. Reuse of this data is authorised with
  proper acknowledgment of the source", with a link to the EC reuse notice (https://data.jrc.ec.europa.eu/licence/com_reuse).
  - The page says "appropriate credit" needs a citation of the peer-reviewed reference publication. A generic
    website citation is called insufficient.
- **Attribution:** "GHSL data © European Union, 1995-2025, CC BY 4.0. Pesaresi, M. et al. (2024), Advances on the
  Global Human Settlement Layer by joint assessment of Earth Observation and population survey data,
  International Journal of Digital Earth 17(1), doi:10.1080/17538947.2024.2390454". Add the product-specific
  citation from the product download page.
- **Verdict:** USE for population and built-up density context, at about 90 m. It is too coarse for single
  houses in a gorge.

## 8. Hydrology: Nepal water-level stations

### 8.1 Real-time water levels (DHM network, served by hydrology.gov.np and mirrored by BIPAD) — USE WITH CARE

- **Organisation:** The hydrological network was run by the Department of Hydrology and Meteorology (DHM). The
  Charter page for activation 1052 names "Department of Hydrology and Meteorology (DHM), Ministry of Energy,
  Water Resources and Irrigation" as requester. The dhm.gov.np site now carries the header and copyright "Nepal
  Meteorological Department". The current split of hydrology and meteorology needs checking before we name the
  agency on screen.
- **Access (no account):** The BIPAD API mirrors hydrology.gov.np readings (`dataSource: "hydrology.gov.np"`).
  - Station list: `https://bipadportal.gov.np/api/v1/river-stations/?format=json&limit=500`
  - Readings: `https://bipadportal.gov.np/api/v1/river/?format=json&station=<id>&water_level_on__gt=<ISO>&water_level_on__lt=<ISO>`
  - Filters that work: `station`, `station_series_id`, `water_level_on__gt/__lt`, `water_level__gt/__lt`. The
    camelCase filter names are silently ignored.
  - Times are NPT (+05:45). Interval is about 10 minutes.
  - Daily aggregates: `/api/v1/river-trimed/`.
  - hydrology.gov.np itself is a JavaScript app over `https://hydrology.gov.np/gss/api` and socket.io. I did not
    map its endpoints.
- **Stations:**

  | BIPAD id | Station | Lon, lat | Warning / danger (m) | Data around the event |
  |---|---|---|---|---|
  | 100 | Budhi Gandaki at Aarughat (DHM index 445, drainage area 4,270 km² per DHM station list via search) | 84.816, 28.046 | 4.5 / 5.0 | 11 Oct: about 2.4 m until 06:20 NPT; 3.56 m at 06:40; 5.01 m at 07:50; 6.22 m at 08:30; **8.43 m at 08:40, the last reading** (station stopped reporting) |
  | 67 | Trishuli River at Kali Khola (below the Budhi Gandaki confluence) | 84.546, 27.833 | 10.8 / 12.1 | 11 Oct: max 4.89 m at 14:50 |
  | 35 | Trishuli River at Bhorle | 84.45, 27.82 | 9.5 / none | 11 Oct: max 4.26 m at 15:30 |
  | 171 | Bhotekoshi at Rasuwagadi | 85.3776, 28.2713 | 6.0 / 7.0 | 26 Aug: last reading 1.62 m at 08:40 NPT, no rise recorded |
  | 74 | Bhote Koshi at Shyaprubesi | 85.3426, 28.1707 | 5.5 / none | 26 Aug: last reading 3.80 m at 08:50 |
  | 105 | Trishuli Khola at Dhunche (tributary) | 85.3186, 28.0982 | 3.2 / none | 26 Aug: 2.4 m, steady to 09:20 |
  | 137 | Trishuli at Betrawati (DHM index 447) | 85.18, 27.97 | 4.1 / 5.0 | 26 Aug: last reading 3.549 m at 09:20 |
  | 79 | Phalakhu Khola at Betrawati (tributary) | 85.1858, 27.9743 | 2.6 / 3.1 | 26 Aug: last reading 09:20 |
  | 261 | Trishuli at Furke Khola (Malekhu) | 84.8441, 27.8024 | 7.0 / 8.0 | 26 Aug: 4.42 m at 06:00; **10.48 m at 11:40, the last reading** |
  | 281 | Trishuli at Galchi | 85.0031, 27.8023 | 367 (elevation datum) | No BIPAD readings on 26 Aug; series starts 2026-08-28 16:50 |

  The upper stations (Rasuwagadhi, Syaprubesi, Betrawati) stopped before the wave was recorded. News reports and
  ICIMOD say these stations were lost in the flood. ICIMOD's "9 m in 30 minutes at Galchhi" figure is not in the
  BIPAD mirror. It must come from another DHM record; see `events.md`.
- **Licence:** None found. hydrology.gov.np shows no terms. dhm.gov.np has only a data-request form with an
  unpublished "I accept these terms and conditions" box. BIPAD shows no licence for the API.
- **Verdict:** USE WITH CARE.
  - Cite single readings (station, time, value, warning and danger level) as facts with source and retrieval date.
  - Do not redistribute the bulk series in the app.
  - Grade gauge-derived numbers LIKELY, not SOLID: they are stage, not discharge; there is no rating curve; and
    stations failed during the peak.
  - Ask DHM before showing full hydrographs.

### 8.2 Historical data (rating curves, discharge series) — DO NOT USE (paid)

The DHM Data page lists a "Hydrological Data Request Form" and a "Hydrological Data Rate" document. Data are paid
and supplied on request after an identity and purpose form. This fails the no-paid rule, so paid
DHM data were not used. Published station metadata is free to cite: DHM "Published Station List 2019", PDF on dhm.gov.np.

## 9. Disaster datasets

### 9.1 BIPAD portal API (NDRRMA) — USE WITH CARE

- **What:** Government disaster information system, run by the Ministry of Home Affairs and NDRRMA. 145
  endpoints, including `incident`, `loss`, `loss-people`, `loss-infrastructure`, `event`, `alert`, `river`,
  `rain`, `earthquake`, `situation-report`, `bipad-bulletin`.
- **Access:** `https://bipadportal.gov.np/api/v1/` (JSON, no key needed for reading).
- **Licence:** No terms of use or licence found on the API root, the portal menus, or in a web search. Secondary
  reports describe the data as "openly available to everyone using the portal". That is not a licence.
- **Verdict:** USE WITH CARE. Cite counts and incident facts with source, endpoint and retrieval time. Do not
  copy whole tables into the app. BIPAD also embeds OSM-derived layers, which carry ODbL.

### 9.2 GEE community catalog `nepal_floods_2026` — DO NOT USE

- **What:** Very-high-resolution imagery of the Rasuwa event only, curated by Samapriya Roy.
  - Vantor (Maxar) Open Data, WorldView-2, WorldView-3 and Legion, 0.35 to 0.65 m. Post-event 27 and 28 August
    over Syabrubesi, Timure and Bidur (all nine post-event strips heavily clouded over the river). Pre-event
    baselines from 2021 to February 2026.
  - Planet: PlanetScope (pre-event 27 May; post-event 26 and 28 Aug), SkySat (27 Aug), Pelican (27 Aug).
  - OmniCloudMask cloud bands added.
- **Access:** Earth Engine only:
  - `projects/sat-io/open-datasets/VANTOR-DISASTER-DATA/NEPAL_FLOOD_2026`
  - `projects/sat-io/open-datasets/PLANET-DISASTER-DATA/NEPAL_FLOOD_2026`

  Earth Engine needs a Google account and project.
- **Licence:** "Both collections on this page are released under Creative Commons Attribution Non Commercial 4.0."
- **Verdict:** DO NOT USE (NC licence and account needed). It is fine to view as a reference when we interpret our
  own Sentinel-2 maps, without copying.

### 9.3 Planet Crisis Response on Source Cooperative — DO NOT USE

`https://source.coop/planet/disasterdata/nepal-flash-flood-2026-08-26`. 29 scenes in 7 collections: PlanetScope 27
May, 26 Aug and 28 Aug; SkySat 27 and 31 Aug; Pelican 27 Aug and 1 Sep. The README says: "licensed CC-BY-NC-4.0 —
attribution required, non-commercial use only". It fails the rule. There is no equivalent for the Budhi Gandaki
event.

### 9.4 International Charter Space and Major Disasters, activation 1052 — DO NOT USE

- Activation 1052 "Flood in Nepal" is dated 26 August 2026. The centre point is 28.0108 N, 85.0658 E, and the
  external reference is ACT-1209.
  - Requesters: ADRC on behalf of DHM, and UNOSAT on behalf of UNOCHA. Project manager: UNITAR.
  - About 23 value adders, including NRSC/ISRO, BGS, SERTIT, Copernicus EMS, ICIMOD, Univ. Ljubljana and K-water.
  - The page reports 40 products, for example "Nepal, Timure-Syaburbensi - Impact map" (28 Aug) and NRSC
    pre/post maps of Nuwakot (28 and 29 Aug).
- No Charter activation exists for the October Budhi Gandaki event. The activation list on 2026-10-17 shows 1053
  Senegal, 1054 Panama and 1055 Türkiye after 1052.
- **Terms:** The Charter terms and conditions, section 4, say: "Users are not permitted to reproduce or distribute
  such content without the explicit permission of the content owners."
- **Verdict:** DO NOT USE the images or maps. Products can be viewed. Facts from them may be cited with the
  product title and producer.

### 9.5 Copernicus EMS Rapid Mapping, EMSR927 — USE WITH CARE

- **What:** EMSR927 "Flood in Nepal", flash flood. Event time 2026-08-25 22:00 UTC (as entered by CEMS).
  Activated 2026-08-26 09:53 UTC by DG ECHO. Closed. GDACS id FL1104124. Six areas of interest, all grading
  products (GRA):
  - AOI01 Syapru Besi: WorldView-3, 27 Aug 05:05 UTC.
  - AOI02 Timure: WorldView Legion, 27 Aug.
  - AOI03 Bidur: Satellogic, BlackSky, PeruSAT-1, Resurs-P, 27 and 28 Aug; plus a monitoring product.
  - AOI04 Bharatpur: no image listed.
  - AOI05 Phosretar: Pleiades and Pleiades Neo on 31 Aug; Legion and Pleiades Neo on 5 Sep (monitoring).
  - AOI06 Kyundi: no image listed.

  AOI01 statistics, for example: 392 of 517 residential buildings affected; 5 of 5 bridges; 5.4 of 5.4 km primary
  road; estimated population 450 of 750 affected; landslide area 111.1 ha.
- **No CEMS activation exists for the Budhi Gandaki event.** The public list on 2026-10-17 ends at EMSR934
  (Panama, 9 Oct).
- **Access (no account):**
  - Activation JSON: `https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations/?code=EMSR927`.
  - Vector layers as JSON/SLD on `rapidmapping-viewer.s3.eu-west-1.amazonaws.com/EMSR927/...` (builtUp,
    facilities, observedEvent, transportation).
  - Product zips, for example `.../backend/EMSR927/AOI01/GRA_PRODUCT/EMSR927_AOI01_GRA_PRODUCT_v1.zip`. The zips
    redirect, so their size was not read.
  - Story map: storymaps.arcgis.com/stories/f76baefadfa74d6d9a18265875f48870.
- **Licence:** CEMS On-Demand Mapping terms and conditions (mapping.emergency.copernicus.eu/terms-and-conditions)
  grant free access for reproduction, distribution, communication to the public, and adaptation. They do not mention
  commercial use. They say third-party material "may be subject to different license terms". The legal basis is the
  Copernicus regulation. The Sentinel legal notice (section 4.1) gives the notice "Copernicus Service information
  [Year]". The CEMS citation guidelines page linked from the terms returns 404, so the CEMS-preferred wording
  could not be verified.
- **Attribution (proposed):** "Contains modified Copernicus Service information 2026 (Copernicus Emergency
  Management Service, EMSR927)".
- **Verdict:** USE WITH CARE.
  - Use the vector delineations and statistics.
  - Do not reuse the very-high-resolution ortho images (WorldView, Pleiades and others) inside the products. They
    are third-party commercial imagery under different terms.

### 9.6 UNOSAT products — DO NOT USE

- UNOSAT is project manager for Charter 1052. Secondary sources mention a UNOSAT flood assessment that uses
  Landsat-9 imagery of 26 August. I could not reach a UNOSAT product page: unosat.org serves an empty app shell.
- The UNITAR legal page says extracts may be reproduced "for research or private study but not for sale or for use
  in conjunction with commercial purposes". It also says reproduction of substantial portions or other uses
  "require explicit, prior authorization in writing".
- **Verdict:** DO NOT USE maps or images. Facts may be cited with attribution.

### 9.7 NASA Earth Observatory — not applicable

- No NASA Earth Observatory image of either 2026 event was found. I searched science.nasa.gov/earth-observatory
  and the web on 2026-10-17.
- The nearest item is "Rains Swamp the Gandak River" (Image of the Day, 2 Oct 2026). It is MODIS, 20 and 29
  September, of the Gandak/Narayani downstream, so it is a different event. Credit: "NASA Earth Observatory images
  by Lauren Dauphin, using MODIS data from NASA EOSDIS LANCE and GIBS/Worldview". There are no third-party credits.
- NASA material is generally not copyrighted (Earthdata guidance). The credit line must still be kept.

### 9.8 Other event imagery seen (for reference only)

- ESA: "Nepal flash flood imaged by satellites", 31 Aug 2026. Sentinel-2 pairs 12/27 Aug and 24 Aug, plus
  Landsat-9 26 Aug. The page shows no licence line. ESA multimedia is often CC BY-SA 3.0 IGO (share-alike). That
  is not verified for this page, so do not copy it. We can make the same views ourselves from sections 4.1 and 4.2.
- Copernicus "Image of the day" (eu-space.europa.eu) and the CEMS GloFAS news item 259 "Floods in Nepal and Tibet,
  August 2026": these count as Copernicus content, but I did not read their licences. Cite them as text sources only.
- NRSC/ISRO maps, for example `Map_Trishuli_Hydropower_27aug26.pdf` and the Cartosat-3 lake maps: licence not
  checked. Cite only.

## 10. Landslide susceptibility

### 10.1 Kincey et al. national rainfall-triggered landslide susceptibility — USE

- **What:** Fuzzy-logic susceptibility model for rainfall-triggered landslides in Nepal, trained on a mapped
  landslide polygon inventory. Values run from 0 (very weakly anticipated) to 1 (very highly anticipated).
  - Zenodo record 8307964 (v1, 2023-09-01), DOI 10.5281/zenodo.8307964.
  - Data for the paper Kincey et al. (2024), "National-Scale Rainfall-Triggered Landslide Susceptibility and
    Exposure in Nepal", Earth's Future 12(2).
- **Resolution:** 30 m. **Coverage:** all of Nepal, so both valleys. Tibetan source areas are not covered.
- **Access:** `LandslideSusceptibility30m.zip`, 721,651,692 bytes. This is a large download and was not
  fetched. `ReadMe_Kincey et al.docx` is 19 kB. The CRS is not stated on the record page; read it from the
  ReadMe.
- **Licence:** The Zenodo record shows "Creative Commons Attribution 4.0 International" with a link to the CC BY 4.0
  legal code.
- **Attribution:** "Kincey, M., Rosser, N., Swirad, Z., Robinson, T., Shrestha, R., Singh-Pujara, D., Basyal, G.,
  Densmore, A., Arrell, K., Oven, K., Dunant, A. (2023). National-scale rainfall-triggered landslide susceptibility
  and exposure in Nepal [dataset]. Zenodo. doi:10.5281/zenodo.8307964. CC BY 4.0."
- **Verdict:** USE. It is relative susceptibility, not probability of occurrence, and it covers rainfall triggers
  only. Neither 2026 event was rainfall-triggered, according to DHM for Rasuwa. Label it as context.

### 10.2 BGS METEOR susceptibility maps — USE (secondary)

- Zenodo 18891753 is rainfall-triggered; Zenodo 18892781 is seismic-triggered. Both cover Nepal at 90 m, UTM 45N,
  and are CC BY 4.0 (verified on the record page). The rainfall zip is 64,959,388 bytes; the seismic zip is
  120,209,263 bytes. Authors: Dashwood, Ciurean, Smith (BGS). They are a cross-check for Kincey et al.

## 11. Licence blockers and open decisions

1. **HydroSHEDS / HydroRIVERS / HydroBASINS:** The custom WWF licence needs an end-user licence agreement and bans
   stand-alone distribution. Decision: derive our own drainage from Copernicus DEM. This needs a flow-routing step
   in `data/`.
2. **MERIT Hydro, FABDEM, all VHR event imagery (Vantor, Planet), UNOSAT and Charter maps:** These are NC,
   registration-only or permission-only. They are excluded. The best open post-event imagery is therefore
   Sentinel-2 (10 m) and Landsat (15 to 30 m). The 27 August VHR views of Syabrubesi and Timure cannot be shown.
3. **DHM and BIPAD water levels:** There is no licence. We cite readings as facts. Before full hydrographs are plotted,
   DHM should be asked for permission (open).
4. **ALOS AW3D30:** Commercial use needs advance notice to JAXA. Keep it for internal cross-checks only.
5. **Large downloads not fetched:**

   | Item | Source | Size |
   |---|---|---|
   | Copernicus DEM GLO-30, 4 tiles | AWS | about 170 MB |
   | Copernicus DEM HEM masks, 4 tiles | AWS | about 160 MB (optional) |
   | Sentinel-2 TCI COGs | AWS | 98 to 301 MB each (prefer windowed reads) |
   | Sentinel-1 GRD | Planetary Computer | about 1.25 GB per scene, VV + VH |
   | Kincey susceptibility | Zenodo | 722 MB |
   | GHSL R7_C27 tile | JRC | 66 MB |

6. **Open checks:** visual cloud check of the candidate scenes in section 4.1; the GHSL tile schema; which agency
   name to show for the hydrological network.

## 12. Sources

1. Copernicus DEM on AWS, bucket readme (structure, DSM statement, licence link): https://copernicus-dem-30m.s3.amazonaws.com/readme.html (read 2026-10-17)
2. Licence for Copernicus DEM instance COP-DEM-GLO-30-F (Copernicus WorldDEM-30): https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf and identical copy https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N28_00_E084_00_DEM/INFO/eula_F.pdf
3. Licence for COP-DEM-GLO-90-F (bucket copy): https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N28_00_E084_00_DEM/INFO/eula_F.pdf
4. Copernicus Data Space, DEM documentation (licence links): https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM.html
5. Legal notice on the use of Copernicus Sentinel Data and Service Information: https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice
6. Copernicus Data Space Ecosystem, Terms and Conditions: https://dataspace.copernicus.eu/terms-and-conditions
7. Element 84 Earth Search STAC API: https://earth-search.aws.element84.com/v1 (collections `sentinel-2-c1-l2a`, `landsat-c2-l2`, `sentinel-1-grd`, `cop-dem-glo-30`), queried 2026-10-17
8. USGS LandsatLook STAC server: https://landsatlook.usgs.gov/stac-server (collections `landsat-c2l2-sr`, `landsat-c2l1`), queried 2026-10-17
9. USGS FAQ, restrictions on use or redistribution of Landsat data: https://www.usgs.gov/faqs/are-there-any-restrictions-use-or-redistribution-landsat-data
10. Microsoft Planetary Computer STAC and SAS token API: https://planetarycomputer.microsoft.com/api/stac/v1 and https://planetarycomputer.microsoft.com/api/sas/v1/token/{collection} (collections `sentinel-1-grd`, `sentinel-1-rtc`, `nasadem`, `alos-dem`, `cop-dem-glo-30`)
11. NASA Earthdata, Data Use and Citation Guidance (CC0 statement): https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance
12. JAXA, Terms of Use of Research Data: https://earth.jaxa.jp/en/data/policy/
13. FABDEM licence labels (secondary): https://gee-community-catalog.org/projects/fabdem/ and https://data.bris.ac.uk/data/dataset/25wfy0f9ukoge2gs7a5mqpq2j7 (not read directly)
14. HydroSHEDS Technical Documentation v1.4, Appendix A licence agreement: https://data.hydrosheds.org/file/technical-documentation/HydroSHEDS_TechDoc_v1_4.pdf
15. HydroRIVERS product page: https://www.hydrosheds.org/products/hydrorivers ; HydroBASINS: https://www.hydrosheds.org/products/hydrobasins ; site terms: https://www.hydrosheds.org/terms-of-use
16. MERIT Hydro project page (licence, registration): https://global-hydrodynamics.github.io/MERIT_Hydro/
17. OpenStreetMap copyright and licence: https://www.openstreetmap.org/copyright
18. OSMF Attribution Guidelines: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
19. Overpass API: https://overpass-api.de/api/interpreter (count queries run 2026-10-17, OSM base 20:11 to 20:41 UTC)
20. GHSL, how to cite and licence: https://human-settlement.emergency.copernicus.eu/GHSLhowToCite.php ; data: https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/
21. BIPAD portal API root, river stations and readings: https://bipadportal.gov.np/api/v1/ (queried 2026-10-17)
22. DHM / Nepal Meteorological Department, data page: https://dhm.gov.np/bhasa/pages_data/en ; station pages and Published Station List 2019: https://dhm.gov.np/assets/vendors/fileman/Uploads/Published_Station_List_2019_Final1.pdf (via search result, not opened)
23. hydrology.gov.np real-time portal: https://hydrology.gov.np/
24. ICIMOD press release on the Rasuwa flood: https://www.icimod.org/press-release/major-flash-flood-sweeps-through-nepals-rasuwa-district-raising-fears-of-further-downstream-flooding/
25. GEE community catalog, Nepal Floods 2026: https://gee-community-catalog.org/projects/nepal_floods_2026/
26. Planet Crisis Response, Source Cooperative README: https://data.source.coop/planet/disasterdata/nepal-flash-flood-2026-08-26/README.md
27. International Charter, activations list and activation 1052: https://disasterscharter.org/activations and https://disasterscharter.org/activations/flood-in-nepal-activation-1052-
28. International Charter, terms and conditions: https://disasterscharter.org/terms-and-conditions
29. Copernicus EMS Rapid Mapping API, EMSR927: https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations/?code=EMSR927 and list https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/
30. Copernicus EMS On-Demand Mapping, Terms and Conditions: https://mapping.emergency.copernicus.eu/terms-and-conditions/
31. UNITAR legal page: https://www.unitar.org/legal
32. NASA Earth Observatory, "Rains Swamp the Gandak River": https://science.nasa.gov/earth/earth-observatory/rains-swamp-the-gandak-river/
33. ESA, "Nepal flash flood imaged by satellites": https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2/Nepal_flash_flood_imaged_by_satellites
34. Kincey et al., Zenodo record 8307964: https://zenodo.org/records/8307964
35. BGS METEOR susceptibility, Zenodo records: https://zenodo.org/records/18891753 and https://zenodo.org/records/18892781
36. Eos, Kathmandu Post and other news used only to locate the events (timing details belong in events.md): https://eos.org/?p=251642 ; https://kathmandupost.com/national/2026/10/11/five-things-to-know-about-the-budhi-gandaki-flash-flood
