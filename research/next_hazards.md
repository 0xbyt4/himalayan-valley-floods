# Next cascading flood hazards in Nepal and the nearby Himalaya: literature review

Compiled 2026-10-17 for the Himalaya valley hazard explorer (see `../BRIEF.md`).

## How to read this file

- Every factual line ends with a tag: `[S<n> | date of source | GRADE]`. `S<n>` is the numbered source list at the end.
- Grades follow the brief: SOLID, LIKELY, UNCERTAIN, DISPUTED.
  - SOLID: peer-reviewed paper or agency report, read in full text or in the abstract, and no conflicting source found.
  - LIKELY: one agency or press source that is consistent with others, or a peer-reviewed number seen only through a summary.
  - UNCERTAIN: provisional figures, one press source, or a preprint.
  - DISPUTED: sources disagree; the range and the sources are given.
- "Abstract only" means the full text was not read in this pass.
- Numbers from 2026 events are provisional. Agencies still revise them.
- This file is research input. It is not a hazard map and not a warning.

---

## 1. Potentially dangerous glacial lakes (PDGLs): the ICIMOD/UNDP 2020 inventory

### 1.1 The report and its data

- Citation: Bajracharya, Maharjan, Shrestha, Sherpa, Wagle, Shrestha (2020), "Inventory of glacial lakes and identification of potentially dangerous glacial lakes in the Koshi, Gandaki, and Karnali River Basins of Nepal, the Tibet Autonomous Region of China, and India", ICIMOD and UNDP. Full text read. [S1 | 2020-09 | SOLID]
- The report has no DOI. The ICIMOD library record is lib.icimod.org/record/34905. [S1 | 2020 | SOLID]
- ICIMOD published two companion datasets on its Regional Database System (RDS):
  - Glacial lakes in the Koshi, Gandaki and Karnali basins, 2015: DOI 10.26066/RDS.1971946. [S2 | 2020-09-10 | SOLID]
  - Potentially dangerous glacial lakes in the same basins, with a hazard rank per lake: DOI 10.26066/RDS.1971950. [S3 | 2020-09-10 | SOLID]

### 1.2 Licences, and what they mean in practice

| Item | Licence (as shown on the source page) | What we may do |
|---|---|---|
| Research report (PDF) [S1] | CC BY-NC-ND 4.0 | Cite facts with attribution. Do not copy its maps, figures, photos or the descriptive text of Table 5.6. Do not publish an adapted version. |
| Glacial lake dataset, 2015 [S2] | CC BY 4.0 | Reuse and adapt with attribution ("ICIMOD (2020), DOI 10.26066/RDS.1971946"). |
| PDGL dataset [S3] | CC BY 4.0 | Reuse and adapt with attribution ("ICIMOD (2020), DOI 10.26066/RDS.1971950"). |

In practice:

1. Build the tool's lake layer from the CC BY datasets [S2, S3], not from the report's map (Figure 5.2) or tables.
2. State facts from the report (counts, criteria, ranks, lake IDs) in our own words, with the citation [S1].
3. Do not reproduce Table 5.6 as a table on screen, do not scan or trace Figure 5.2, and do not reuse report photos.
4. The NC term would make the report itself unusable as a data product if the tool is ever used commercially. The brief already forbids NC and ND products.
5. Before use, open the dataset download package and confirm that the licence file there also says CC BY 4.0. Record it in `research/data_sources.md`. (Not done in this pass.)
6. This is a practical reading of the licences, not legal advice.

### 1.3 Method and criteria

- Glacial lakes of 0.003 km² or larger were mapped for 2015 from Landsat OLI images. The 0.003 km² threshold equals about 4 Landsat pixels. [S1 | 2020 | SOLID]
- 3,624 lakes were mapped in the three basins: 2,070 in Nepal, 1,509 in the Tibet Autonomous Region (TAR) of China and 45 in India. [S1, S4 | 2020 | SOLID]
- 1,410 lakes are 0.02 km² or larger. The report treats this size as "large enough to cause a GLOF". [S1 | 2020 | SOLID]
- Filtering steps: lake characteristics (size, type, expansion, cascading lakes, supraglacial ponds), then dam characteristics, then source glacier activity, then surrounding slopes. [S1 | 2020 | SOLID]
- Lakes with no dam crest, old compacted dam material, dam length over 500 m and outer dam slope under 20° were treated as stable. This step removed 600 lakes and left 295. [S1 | 2020 | SOLID]
- After all filters, 52 lakes remained. Longitudinal dam profiles were drawn for them. 47 were classed as PDGLs. [S1 | 2020 | SOLID]
- Lakes more than 500 m from their glacier were not considered potentially dangerous. [S1 | 2020 | SOLID]
- The analysis does not consider earthquakes, extreme weather or human interference. [S1 | 2020 | SOLID]
- Dam parameters came from profiles drawn on Google Earth images and from ALOS DEMs (5 m for Nepal, 12.5 m for China and India). [S1, S3 | 2020 | SOLID]

### 1.4 Ranks

- Rank I: large lake that can still expand, calving glacier, lake close to a loose moraine, steep outlet slope, hanging source glacier, and slopes that can send avalanches or landslides into the lake. [S1 | 2020 | SOLID]
- Rank II: confined outlet, compact old moraine, hanging lake, seepage at the dam foot, gentle outer slope. [S1 | 2020 | SOLID]
- Rank III: confined outlet, gentle outer slope, large but shallow lake, moraine wider than 200 m. [S1 | 2020 | SOLID]
- Totals: 31 Rank I, 12 Rank II, 4 Rank III. [S1, S4 | 2020 | SOLID]
- The report says a precise ranking was not possible. It also says outbursts without precedent can occur. [S1 | 2020 | SOLID]

### 1.5 Counts by basin and country

- By basin: Koshi 42, Gandaki 3, Karnali 2. [S1, S4 | 2020 | SOLID]
- By country: TAR China 25, Nepal 21, India 1. The 25 TAR lakes drain across the border into Nepal. [S1 | 2020 | SOLID]
- By sub-basin, Nepal / TAR / India: Tamor 4/0/0, Arun 4/13/0, Dudh Koshi 9/0/0, Tama Koshi 1/7/0, Sun Koshi 0/4/0, Trishuli 1/1/0, Marsyangdi 1/0/0, Kali 0/0/1, Humla 1/0/0. [S1 | 2020 | SOLID]
- Nepal had 21 PDGLs in 2011 and 21 in 2020, but only 13 are the same lakes. Eight lakes left the list and eight new lakes joined it. [S1 | 2020 | SOLID]

### 1.6 The 21 PDGLs inside Nepal (facts only)

Coordinates are decoded from the lake ID. The ID format is `GLxxxxxxEyyyyyN`: the longitude and latitude of the lake centroid in thousandths of a degree [S1]. Names are given only where the report gives one. The ranks are also in the CC BY dataset [S3]. Grade for each row: SOLID for ID, sub-basin and rank (read from the report text). The PDF text extraction mixed the layout of rows 23 to 31, so the name-to-ID match for those rows is LIKELY.

| No. in report | Lake ID | Lon °E | Lat °N | Sub-basin | Rank | Name in report | On PDGL list before |
|---|---|---|---|---|---|---|---|
| 1 | GL087945E27781N | 87.945 | 27.781 | Tamor | I | – | – |
| 2 | GL087934E27790N | 87.934 | 27.790 | Tamor | III | – | – |
| 3 | GL087893E27694N | 87.893 | 27.694 | Tamor | III | – | – |
| 4 | GL087749E27816N | 87.749 | 27.816 | Tamor | I | – | – |
| 5 | GL087596E27705N | 87.596 | 27.705 | Arun | I | – | – |
| 6 | GL087632E27729N | 87.632 | 27.729 | Arun | III | – | – |
| 20 | GL087095E27829N | 87.095 | 27.829 | Arun | II | – | – |
| 21 | GL087092E27798N | 87.092 | 27.798 | Arun | I | Lower Barun | 2001, 2011 |
| 22 | GL086977E27711N | 86.977 | 27.711 | Dudh Koshi | I | – | – |
| 23 | GL086958E27755N | 86.958 | 27.755 | Dudh Koshi | II | Chamlang | 2011 |
| 24 | GL086957E27783N | 86.957 | 27.783 | Dudh Koshi | I | Hongu 2 | 2011 |
| 25 | GL086935E27838N | 86.935 | 27.838 | Dudh Koshi | I | Hongu 1 | 2011 |
| 26 | GL086928E27850N | 86.928 | 27.850 | Dudh Koshi | I | – | – |
| 27 | GL086917E27832N | 86.917 | 27.832 | Dudh Koshi | I | – | – |
| 28 | GL086858E27687N | 86.858 | 27.687 | Dudh Koshi | I | – | – |
| 29 | GL086925E27898N | 86.925 | 27.898 | Dudh Koshi | I | Imja Tsho | 2001, 2011 |
| 30 | GL086612E27779N | 86.612 | 27.779 | Dudh Koshi | I | Lumding | 2011 |
| 31 | GL086476E27861N | 86.476 | 27.861 | Tama Koshi | I | Tsho Rolpa | 2001, 2011 |
| 43 | GL085630E28162N | 85.630 | 28.162 | Trishuli | I | – | – |
| 45 | GL084485E28488N | 84.485 | 28.488 | Marsyangdi | I | Thulagi | 2001, 2011 |
| 46 | GL082673E29802N | 82.673 | 29.802 | Humla (report says Mugu) | II | – | – |

- Count check: 15 Rank I, 3 Rank II, 3 Rank III in Nepal; total 21. [derived from S1 | 2020 | SOLID]
- The UNDP foreword calls one lake "Chamlang North (Hongu II)". Other studies use "Chamlang North" and "Chamlang South" [S5]. The match of these names to IDs 23 and 24 is UNCERTAIN.
- Mitigation so far: Tsho Rolpa was lowered by more than 3 m in 2000. Imja Tsho was lowered by 3.4 m in 2016. Two TAR lakes (GL088066E27933N, GL088075E27946N) were also lowered. [S1 | 2020 | SOLID]
- Planned next: lowering of Lumding Tsho, Hongu-2, Lower Barun and Thulagi under the GLOF Sanjeevani project (Green Climate Fund, USD 36.16 million). The target depth is not set and construction will not start in 2026. [S34 | 2026-09-06 | LIKELY]

### 1.7 Other national rankings to show next to ICIMOD

- Rounce, Watson and McKinney (2017) assessed the 131 Nepal lakes larger than 0.1 km² in 2015. Full text read. [S5 | 2017 | SOLID]
  - Hazard: 19 very high, 26 high, 82 moderate, 4 low. [S5 | 2017 | SOLID]
  - Risk: 11 very high, 31 high, 84 moderate, 5 low. The Karnali basin had the most very high risk lakes (5). [S5 | 2017 | SOLID]
  - Highest-risk lakes named in the abstract: Phoksundo Tal, Tsho Rolpa, Chamlang North Tsho, Chamlang South Tsho, Lumding Tsho. [S5 | 2017 | SOLID]
  - Tsho Rolpa was rated high hazard, Thulagi and Imja moderate hazard, because no avalanche path reaches them. [S5 | 2017 | SOLID]
- The two rankings use different methods and size thresholds (ICIMOD screens lakes ≥ 0.02 km²; Rounce et al. ≥ 0.1 km²). The tool should show both and say that they differ.

---

## 2. Landslide dams and outburst floods in Nepal: recent events

| Date | Place (river, district) | Process and cause | Key numbers | Impacts | Sources, grade |
|---|---|---|---|---|---|
| 2012-05-05 | Seti Gandaki, Kaski (Sabche cirque to Kharapani and Pokhara) | Rock or rock-ice failure from the Annapurna IV flank. It became a hyperconcentrated flow. A short-lived impoundment in the gorge is argued but not proven. | Failed area about 32,000 m², from 6,850 m to 4,500 m [S22]. Flow reached Kharapani (1,100 m, 23 km downstream) in about 30 min [S21]. | 72 dead; roads, bridges and water pipelines destroyed [S21]. A pilot's radio warning likely limited deaths [S21]. | S21, S22. Deaths SOLID. Mechanism DISPUTED. |
| 2014-08-02 | Sun Koshi at Jure, Sindhupalchok | Rainfall-induced landslide dammed the river. | Dam about 50 m high; lake estimated at about 8 million m³ [S23] or 4.5 million m³ released [S24]; modelled breach peak 6,436 m³/s [S24]. | 156 dead [S23]. Sunkoshi hydropower barrage damaged. Effects more than 30 km downstream [S24]. | S23, S24. Deaths SOLID. Lake volume and breach timing DISPUTED: overflow after about 12 h [S23] versus a breach date of 7 Sept 2014 [S24]. |
| 2016-07 (night of an early-July day) | Bhote Koshi / Sun Koshi, Sindhupalchok | GLOF from Gongbatongsha Tsho, a small moraine-dammed lake in the Zhangzangbo valley, TAR. | About 1.1 × 10⁵ m³ released; peak about 2,400 m³/s at Khukundol, 30 km downstream [S19]. | 77 houses, 3 bridges, Araniko Highway damaged; Upper Bhote Koshi hydropower intake destroyed [S19]. The flood moved boulders and drove erosion for tens of km [S18]. | S18 (abstract only), S19 (snippet only). LIKELY. Exact date not checked. |
| 2017-04-20 | Langmale lake, Upper Barun, Sankhuwasabha | Rockfall into a small lake caused an outburst. | Lake smaller than 0.01 km² [S34, quoting A. Byers]. | Lasting erosion in the Barun valley [S1]. | S1, S20 (metadata only), S34. LIKELY. |
| 2021-06-15 (recurred 2021-07-31) | Melamchi, Sindhupalchok (Helambu) | Cascade: intense rainfall upstream, debris flows, bank erosion, likely short landslide damming. Not attributable to one factor [S25]. | – | Deaths: early report 3 dead and 17 missing [S26]; other counts differ. About 260 households affected and more than 600 people displaced (preliminary). Melamchi Water Supply Project damaged [S26]. Informal upstream warnings reduced losses [S25]. | S25, S26. Process LIKELY. Casualties DISPUTED. |
| 2024-08-16 | Thame, Bhote Koshi (Khumbu), Solukhumbu | Cascading GLOF: Upper Ngole lake (4,890 m) overtopped and caused failure of Lower Ngole lake (4,718 m). | Upper lake 0.11 km² before outburst; total release about 7.7 × 10⁵ m³; peak above 800 m³/s; flood reached Thame (9 km) in about 22 min [S8]. | No deaths; 135 people displaced; school, tea houses and trail destroyed; USD 6.18 million loss; erosion up to 50 km downstream [S8]. | S8. SOLID. |
| 2024-09-26 to 28 | Central Nepal: Kathmandu Valley, Kavre (Roshi), Lalitpur, Dhading, Sindhupalchok | Extreme rainfall: floods and many landslides. Mainly not a dam-break event. | – | About 200 dead (home ministry via AFP, early Oct); 246 cited by police later; 78 in Kavre alone [S47]. | S47. UNCERTAIN (press only; no peer-reviewed source checked). |
| 2025-07-08 | Lhende Khola / Bhote Koshi, Rasuwa | GLOF from a supraglacial lake on the Purepu Glacier, TAR. A smaller GLOF from Nielangpu Glacier occurred on 2025-07-07. | Purepu lake 0.68 km², 9.09 × 10⁶ m³; about 7.22 × 10⁶ m³ released over about 35 h [S27]. A preprint gives a 3.55 × 10⁶ m³ volume loss and a 2023 drainage too [S28]. | Miteri (Friendship) Bridge destroyed; Rasuwagadhi hydropower and dry port damaged. Deaths 9 to 11, missing 17 to 20 [S48]. Nepal learned of the flood only when it reached Betrawati [S48]. | S27 (abstract only), S28 (preprint), S48. Volume DISPUTED. Casualties UNCERTAIN. |
| 2026-08-26 | Lhende Khola, Bhote Koshi and Trishuli, Rasuwa, Nuwakot, Dhading and further downstream | Ice-rock avalanche from the north side of Langtang Lirung (about 28.285° N, 85.525° E per [S32]), at about 5,000 to 5,200 m. Seismic signal M5.2 (USGS) or M4.4 (Department of Mines and Geology). A temporary debris dam on the Lhende Khola is reported but its role is not settled. Not a GLOF [S29, S31, S32]. | Runout about 100 km [S29]. Volume first estimate about 100 million m³, "a lot of uncertainty" [S31]. | Provisional NDRRMA toll: 1,451 dead and 5,786 missing as of 20 Sept 2026 [S36]; 1,331 dead and 4,896 missing on 5 Sept [S35]. 13 hydropower plants damaged, about 431 MW off the grid [S33]. 37 motorable and 68 suspension bridges counted damaged on 4 Sept [S35]. | S29, S31 to S36. Process LIKELY. Dam role DISPUTED. Toll UNCERTAIN (provisional, internal inconsistencies noted in [S35]). |
| 2026-10-11 | Budhi Gandaki, Gorkha (Chumnubri and Dharche) | Landslide near Chumchet, on or near the Ungilung tributary, blocked the river; the blockage breached. Preliminary. | – | 35 to 40 houses swept away; several bridges lost, including Aarughat; Budhi Gandaki hydropower (341 MW) construction camp damaged; 5 people missing and 4 to 5 herders out of contact; no deaths confirmed in first reports [S37]. | S37. UNCERTAIN (preliminary; other press accounts place the blockage elsewhere). |

Notes:

- Same mountain, earlier event: the 2015 Gorkha earthquake triggered a debris avalanche from the same mountain as the 2026 source. It buried Langtang village and killed more than 200 people. [S29 | 2026-08-28 | LIKELY; S43 abstract only]
- Many earlier GLOFs exist. Nepal had 26 recorded GLOF events since 1977, 14 of them originating in Nepal. [S1 | 2020 | SOLID]
- HMAGLOFDB documents 697 GLOFs in High Mountain Asia between 1833 and 2022, with 6,906 fatalities in total. [S10 | 2023 | SOLID]

---

## 3. Recent disasters came from sources that were not on the hazard lists

### 3.1 Checking the claim "Nepal mapped 2,070 glacial lakes; the one that burst was not on the list"

| Part of the claim | Finding | Grade |
|---|---|---|
| "Nepal mapped 2,070 glacial lakes" | Correct. The ICIMOD/UNDP 2020 inventory counts 2,070 lakes ≥ 0.003 km² in Nepal (2015 imagery) [S1, S4]. The Kathmandu Post repeats the figure in its 2026 Rasuwa coverage [S33]. | SOLID |
| Thame 2024 lakes were not on the list | Correct for the PDGL list. Neither Ngole lake is among the 47 PDGL IDs [S1]. Khadka et al. state that national [S5] and basin-scale assessments missed both lakes because of minimum size thresholds [S8]. A researcher quoted by IPS said the lake "was not on the list of potentially dangerous lakes" [S44]. One regional study (Zhang et al. 2023) did include them and rated the upper lake high hazard [S8]. Whether the lakes are inside the 2,070-lake inventory was not checked. | SOLID (not a PDGL); UNCERTAIN (inventory membership) |
| 2025 Rasuwa lake was not on the list | The Purepu lake is in the TAR, so it is not one of Nepal's 2,070 lakes. It is not among the 25 TAR PDGLs as far as the IDs show; its coordinates were not found. ICIMOD said it began as a pond in December 2024 [S48], but a preprint reports a drainage in 2023 [S28]. | LIKELY; lake age DISPUTED |
| 2026 Rasuwa "lake that burst" | Misleading. The source was an ice-rock avalanche, not a glacial lake [S29, S31, S32]. A lake list cannot contain such a source by design. | SOLID that the source was not a glacial lake |
| 2026 Budhi Gandaki | A landslide dam, not a glacial lake [S37]. | LIKELY |

Verdict: no primary source states the sentence as one claim. The 2,070 figure is verified. The "not on the list" part is verified for Thame 2024 and likely for the 2025 lake. For 2026 the framing is wrong: the source was not a lake. The tool should not use the sentence as a quote. It can use the separate verified facts.

### 3.2 What scientists recommend instead

- Lower the size thresholds and include small lakes. Assess cascades where one lake fails into another. Monitor all lakes regardless of size. [S8 | 2026-08 | SOLID]
- Reduce exposure and vulnerability (land-use zoning, relocation, early warning) rather than rely on large engineering works. [S8 | 2026-08 | SOLID]
- Assess the whole process chain from source to downstream impact. Start with susceptibility of the source (where and how likely a failure is), then model impacts downstream. GAPHAZ guidance covers glacier and permafrost hazards and cascading processes. [S41 | 2017 | LIKELY (search summary only)]
- Treat ice-rock avalanches as a separate hazard class. Chamoli 2021: about 27 × 10⁶ m³ of rock and ice fell from Ronti Peak, became a debris flow, killed or left missing more than 200 people and damaged two hydropower projects. [S17 | 2021 | SOLID]
- Focus on how often and how strongly triggers occur, not only on growing lakes. Himalayan moraine-dam GLOFs average about 1.3 per year since the late 1980s with no credible trend, while lake area grew. [S12 | 2019 | SOLID (abstract only)]
- Include permafrost. In the Hindu Kush Himalaya, permafrost area exceeds glacier area in nearly all countries, but it is often overlooked. Permafrost thaw is expected to affect geohazards. [S42 | 2017 | SOLID (abstract)]
- After 2026: experts call for upstream sensors, automatic sirens, seismic classification that can flag mass movements, and binding cross-border warning protocols with China. [S33 | 2026-09-02 | LIKELY]
- Combine field observation, seismic monitoring and satellite data, and use drones for terrain that is hard to reach. [S50 | 2026 | UNCERTAIN (commentary)]
- Update the glacial lake inventory at least every five years. [S1 | 2020 | SOLID]
- Field study and depth measurements are needed for each lake, not remote sensing alone. A majority of Nepal's lakes have not been studied. [S34 | 2026-09-06 | LIKELY]
- Future outlook: GLOF risk across the Third Pole could almost triple as new lakes form; the current hotspot is the eastern Himalaya. [S13 | 2021 | LIKELY (abstract summary only)]

### 3.3 arXiv 2608.12422: "Which Site, and When"

- Authors: Matthew Kahn, Milan Arjel, Nirmala Adhikari, Mingmar Sherpa, James Pope. Submitted 2026-08-12. cs.LG with stat.AP. Licence CC BY 4.0. Preprint, not peer-reviewed. [S9 | 2026-08-12 | SOLID for metadata]
- Question: two separate questions per hazard. Which site is susceptible? When does a trigger arrive? [S9 | 2026-08 | UNCERTAIN]
- Hazards are kept separate: large moraine- and ice-dammed lake bursts; rainfall-triggered landslides; small floods from ponds on or near glaciers. [S9 | 2026-08 | UNCERTAIN]
- Data (all free; all through Google Earth Engine except InSAR): [S9 | 2026-08 | UNCERTAIN]
  - HMAGLOFDB: 589 dated outbursts after cleaning (DOI 10.5281/zenodo.18257243).
  - NASA Global Landslide Catalog (COOLR): several thousand landslides; 409 with full terrain features.
  - JRC Global Surface Water: 2,500 candidate high-elevation lakes as non-failed comparison sites.
  - Copernicus GLO-30 DEM (30 m): 3,000 steep-slope comparison sites.
  - WorldClim climate normals; CHIRPS and GPM IMERG rainfall; ERA5-Land.
  - Sentinel-1 radar (InSAR through ASF HyP3, LiCSBAS named as an alternative) and Sentinel-2 optical.
  - ICIMOD PDGL inventory (DOI 10.26066/RDS.1971950).
- Method: each event is matched with similar sites that did not fail. Spatial cross-validation holds out whole one-degree tiles. Five deep-learning models are compared with a gradient-boosted baseline and a three-rule decision tree. [S9 | 2026-08 | UNCERTAIN]
- Results (ROC AUC): [S9 | 2026-08 | UNCERTAIN]
  - Timing from antecedent weather: 0.73 large bursts, 0.83 landslides, 0.82 small floods.
  - Terrain susceptibility, naive: about 0.9, mostly because failures cluster in wetter ranges.
  - Terrain susceptibility against matched nearby sites: 0.76 bursts, 0.71 landslides, 0.54 small floods (no better than chance).
  - Burst signal inside Nepal only: 0.89.
  - Deep learning did not clearly beat the baseline. For lake hazards the baseline won; a three-rule tree matched it.
- Nepal watchlist: the top-ranked lakes are high, steep-sided lakes in the Arun, Tamor and Dudh Koshi basins. Names are only in figures, not in the text. The authors call it a prioritisation aid, not a prediction. [S9 | 2026-08 | UNCERTAIN]
- Limitations named by the authors: uneven event catalogues; unlabelled comparison sites; no lake volume; light InSAR chain; weather cannot see avalanche-triggered bursts; small floods show no susceptibility signal. [S9 | 2026-08 | UNCERTAIN]
- The companion feasibility study (Kahn 2026) is an unpublished manuscript. [S9 | 2026-08 | UNCERTAIN]
- Use for the tool: the method is reproducible with free data. Its main lesson for "other valleys" is that terrain alone ranks sites weakly once regional climate is controlled. The tool should not present any watchlist as a forecast.

---

## 4. Exposure: hydropower, roads, bridges and settlements

### 4.1 Region-wide studies

- 257 Himalayan hydropower projects were tested against modelled outbursts from more than 2,300 lakes. 66 % lie on potential GLOF tracks. Up to a third of those could see discharges well above their local design floods. [S15 | 2016 | SOLID (abstract)]
- Headwater siting roughly doubles the uncertainty of the GLOF peak discharge; peaks farther downstream are easier to predict because waves attenuate. [S15 | 2016 | SOLID (abstract)]
- Third Pole (Zhang, Wang, An, Wei 2023): about 6,353 km² of land at risk; threats to 55,808 buildings, 105 hydropower projects, 194 km² of farmland, 5,005 km of roads and 4,038 bridges. GLOF frequency has risen since 1980, with more activity at the China–Nepal border in the last decade. [S14 | 2023-12-12 | SOLID (abstract)]
- Global: about 15 million people are exposed to potential GLOFs. High Mountain Asia is the most exposed region; about 1 million people live within 10 km of a glacial lake there. [S16 | 2023-02-07 | SOLID (abstract)]

### 4.2 Nepal studies

- 21 Nepal PDGLs, full-breach scenarios (Chen, Liang, Zhao, Maharjan 2025): [S7 | 2025-02-07]
  - Tsho Rolpa, Thulagi and Lower Barun have the most serious impacts on buildings, roads and farmland. Thulagi could affect existing hydropower. (SOLID, abstract)
  - Six unnamed lakes (1 Trishuli, 2 Tamor, 3 Dudh Koshi) could each affect more than 200 buildings. The Trishuli lake could inundate existing hydropower. (SOLID, abstract)
  - Inundated buildings per lake range from 11 to 34,715. Thulagi, Tsho Rolpa and Lower Barun each exceed 5,000. Roads 4 to 646 km per lake; Tsho Rolpa highest. 49 hydropower plants lie near the flow paths: 5 operating, 44 with generation or survey licences. (LIKELY: main text seen through a summary)
- 131 Nepal lakes > 0.1 km² (Rounce et al. 2017): [S5 | 2017]
  - 121 lakes (92 %) would inundate at least one building; 64 (49 %) at least 20. Median 17 buildings, maximum 634. (SOLID)
  - 11 lakes (8 %) threaten a hydropower system. All 11 also inundate more than 20 buildings. (SOLID)
  - Bridges 0 to 25 per lake, median 4. Farmland 0 to 4.5 km², median 0.26 km². (SOLID)
  - The Gandaki basin has the most very-high-impact lakes (8), then Koshi (3). Tsho Rolpa and Thulagi are very high impact. (SOLID)
  - Caveat: the hydropower point data matched poorly to flood paths, so hydropower exposure is likely undercounted. (SOLID, stated by the authors)
- People and value at three lakes: about 96,767 people affected for Imja, 141,911 for Tsho Rolpa and 165,068 for Thulagi (ICIMOD 2011, cited in [S1]). Exposed value: Imja USD 35.5 million; Thulagi USD 415.35 million (UNDP foreword in [S1]). [S1 | 2020 | LIKELY: secondary citation of older studies]
- About 1.6 million people live within 3 km downstream of moraine-dammed lakes in Nepal (Ghimire 2004, cited in [S1] and [S7]). [S1, S7 | LIKELY: old secondary figure]
- Pokhara (Seti): simulated rare floods of 1,000 to 10,000 m³/s; about 1 % of the urban built-up area and the essential rural road network lie in the highest-hazard zones; population more than tripled in 30 years. [S21 | 2022-09-26 | SOLID (abstract)]

### 4.3 Event losses as a check on exposure

- 2026 Rasuwa: 13 hydropower plants damaged, about 431 MW disconnected [S33]. The power producers' association is reported to count 12. [S33 | 2026-09-02 | DISPUTED: 12 vs 13]
- 2026 Rasuwa: hydropower tunnel sites searched include Trishuli 3-A, Trishuli 3-B, Upper Trishuli-1, Chilime, Rasuwagadhi and Langtang. [S35 | 2026-09-05 | LIKELY]
- 2016 Bhote Koshi: Upper Bhote Koshi intake destroyed. [S19 | 2020 | LIKELY]
- 2026 Budhi Gandaki: construction camp of the 341 MW Budhi Gandaki project damaged. [S37 | 2026-10-11 | UNCERTAIN]

---

## 5. Monitoring and early warning, and known gaps

| System | What exists | Known gaps | Sources, grade |
|---|---|---|---|
| Tsho Rolpa (Rolwaling, Tama Koshi) | Lake lowered by more than 3 m in 2000 [S1]. A 1998 system relayed sensor alarms by VHF radio to about 17 to 19 warning stations along the Rolwaling and Tama Koshi valleys [S45]. DHM monitors Tsho Rolpa as a high-risk lake [S33]. | The 1998 system collapsed during the conflict years for lack of continuous monitoring [S45]. Current siren status not confirmed. Scientists say the 3 m lowering was set by budget, not hydrology [S34]. | S1 SOLID; S45 UNCERTAIN; S33, S34 LIKELY |
| Imja Tsho (Khumbu) | Lowered by 3.4 m in 2016. Sirens in six settlements; SMS alerts along about 50 km of river (DHM, UNDP, GEF) [S1, S46]. | April 2026 report: system no longer working properly; siren towers rusting, batteries missing, data transmission inconsistent; officials cite funding [S40]. | S1 SOLID; S46 LIKELY; S40 UNCERTAIN (one press source) |
| Bhote Koshi–Trishuli (Rasuwa) | DHM Flood Forecasting Division gauges, including Syafrubesi (warning level 6 m, danger level 9 m) [S39]. NDRRMA reviews satellite images of PDGLs daily [S33]. | 2026: the Syafrubesi gauge stopped at 8:40 at 1.62 m; text alerts went out at 9:15, about 38 min after the 8:37 collapse [S33, S39]. Four EWS stations in Rasuwa and one each in Nuwakot and Dhading were destroyed or damaged. No sirens on the Bhote Koshi are reported. No warning protocol with China. The area above Timure is a monitoring blind spot [S33]. The 2025 flood was noticed only at Betrawati [S48]. | S33, S39 LIKELY; S48 UNCERTAIN |
| Bhote Koshi (Sindhupalchok, after 2016) | Not found. | No source found for sirens installed after the 2016 GLOF. | UNVERIFIED |
| DHM flood forecasting (national) | River-stage and rainfall monitoring with mass SMS alerts; bilateral data exchange with India [S33]. | Gauges are designed for gradual rises and fail in flash floods; no system for non-meteorological floods from China [S33]. | S33 LIKELY |
| Seti / Pokhara | An early warning system existed after 2012. | "A lack of maintenance has rendered the early-warning system inoperable" [S21]. Authors advise gauges near the Sabche cirque and satellite monitoring of the headwaters. | S21 SOLID |
| Thame 2024 | No formal system. | Upstream word of mouth and temporary storage in the lower lake gave time to evacuate; no deaths [S8]. | S8 SOLID |
| Melamchi 2021 | No formal system for this hazard. | Informal warnings from upstream reduced losses; authors call for an early warning system [S25]. | S25 LIKELY |
| National programme | GLOF Sanjeevani project (DHM with UNDP; GCF USD 36.16 million plus about USD 13.8 million co-finance): lake lowering and a risk assessment of all glacial lakes, due "within this year" [S34]. | Not yet delivered. Lake lists cover lakes only, not ice-rock avalanche or landslide-dam sources. | S34 LIKELY |

Cross-cutting gaps:

1. Lists cover lakes above a size threshold. Small lakes, ice-rock avalanches and landslide dams fall outside them. [S8, S29, S37]
2. Warning chains depend on gauges that flash floods destroy, and on officials' judgement. [S33]
3. Sirens and sensors decay without maintenance budgets (Tsho Rolpa 1998, Imja, Pokhara). [S21, S40, S45]
4. There is no binding cross-border warning protocol with China, although several sources are in the TAR. [S33, S48]

---

## 6. Candidate valleys for the tool's "other valleys" view

Each candidate needs open data (CC BY lake layers [S2, S3], Copernicus DEM, OpenStreetMap) before it goes into the tool.

| # | Valley (river, district) | Why | Evidence grade | Main source |
|---|---|---|---|---|
| 1 | Rolwaling / Tama Koshi (Dolakha, Ramechhap) | Tsho Rolpa: Rank I PDGL; very high downstream impact; 646 km of road in the modelled flood path; old warning system in doubt. | SOLID | S1, S5, S7 |
| 2 | Dudh Koshi and the Hinku–Hongu side valleys (Solukhumbu) | Nine Nepal PDGLs, eight of them Rank I (Imja, Lumding, Hongu 1 and 2, Chamlang and others). Very high hazard lakes in Rounce et al. Thame 2024 shows that small lakes here can also fail. | SOLID | S1, S5, S8 |
| 3 | Barun / Arun (Sankhuwasabha) | Lower Barun: Rank I; more than 5,000 buildings in its modelled path; rockfall GLOF in 2017 nearby; 13 TAR PDGLs drain into the Arun; arXiv watchlist names the Arun. | SOLID (lake), UNCERTAIN (watchlist) | S1, S7, S20, S9 |
| 4 | Dona Khola / Marsyangdi (Manang, Lamjung) | Thulagi: Rank I; very high downstream impact; can affect existing hydropower; exposed value USD 415.35 million; planned for lowering. | SOLID | S1, S5, S7 |
| 5 | Lhende Khola / Bhote Koshi–Trishuli (Rasuwa, Nuwakot) | Three disasters from the same headwaters: 2015 Langtang avalanche, 2025 Purepu GLOF, 2026 ice-rock avalanche. Residual water in the Purepu lake; dense hydropower; no cross-border protocol. Already one of the two reconstructed events. | SOLID (history), UNCERTAIN (current lake state) | S27, S28, S29, S33 |
| 6 | Bhote Koshi / Sun Koshi (Sindhupalchok, Kodari) | 2014 Jure landslide dam; 2016 GLOF from the TAR; 4 TAR PDGLs in the Sun Koshi sub-basin and 7 in the Tama Koshi. | SOLID | S1, S18, S19, S23 |
| 7 | Seti Gandaki to Pokhara (Kaski) | 2012 rock-ice avalanche flow, 72 dead; fast-growing city; rare-flood scenarios of 1,000 to 10,000 m³/s; warning system inoperable. Not a lake hazard, so it shows the "beyond lake lists" point. | SOLID | S21, S22 |
| 8 | Tamor (Taplejung, Kanchenjunga) | Four Nepal PDGLs, two Rank I; two unnamed Tamor lakes could each affect more than 200 buildings; arXiv watchlist names the Tamor. | SOLID (PDGL), UNCERTAIN (watchlist) | S1, S7, S9 |
| 9 | Karnali headwaters (Phoksundo, Dolpa; Humla/Mugu) | Phoksundo Tal is among the five highest-risk lakes in Rounce et al. The Karnali basin has the most very high risk lakes (5). One Rank II PDGL in Humla. Few warning systems found. | LIKELY (one national study plus one PDGL) | S5, S1 |

Not on the list: Budhi Gandaki (Gorkha). It is already one of the two reconstructed events.

---

## Numbered sources

Licence is given where it was shown on the source page. "Abstract only" means the full text was not read.

1. Bajracharya, S.R., Maharjan, S.B., Shrestha, F., Sherpa, T.C., Wagle, N., Shrestha, A.B. (2020). Inventory of glacial lakes and identification of potentially dangerous glacial lakes in the Koshi, Gandaki, and Karnali River Basins of Nepal, the Tibet Autonomous Region of China, and India. ICIMOD and UNDP. No DOI. https://lib.icimod.org/record/34905 ; PDF https://nepal.un.org/sites/default/files/2020-10/Inventory_Glacial_Lakes_2020_Full2.pdf . CC BY-NC-ND 4.0. Full text read.
2. ICIMOD (2020). Glacial lakes in the Koshi, Gandaki, and Karnali river basins of Nepal, the TAR of China, and India (2015). DOI 10.26066/RDS.1971946. https://rds.icimod.org/Home/DataDetail?metadataId=1971946 . CC BY 4.0 (metadata page).
3. ICIMOD (2020). Potentially dangerous glacial lakes in the Koshi, Gandaki, and Karnali river basins. DOI 10.26066/RDS.1971950. https://rds.icimod.org/Home/DataDetail?metadataId=1971950 . CC BY 4.0 (metadata page).
4. ICIMOD news (2020-11-11). New glacial lake inventory report released: 47 potentially dangerous glacial lakes ranked. https://icimod.org/new-glacial-lake-inventory-report-released-47-potentially-dangerous-glacial-lakes-ranked/
5. Rounce, D.R., Watson, C.S., McKinney, D.C. (2017). Identification of hazard and risk for glacial lakes in the Nepal Himalaya using satellite imagery from 2000–2015. Remote Sensing 9(7), 654. DOI 10.3390/rs9070654. CC BY 4.0. Full text read (White Rose repository copy).
6. Rounce, D.R., McKinney, D.C., Lala, J.M., Byers, A.C., Watson, C.S. (2016). A new remote hazard and risk assessment framework for glacial lakes in the Nepal Himalaya. HESS 20, 3455–3475. DOI 10.5194/hess-20-3455-2016. CC BY 3.0. Metadata only.
7. Chen, H., Liang, Q., Zhao, J., Maharjan, S.B. (2025). Assessing national exposure to and impact of glacial lake outburst floods considering uncertainty under data sparsity. HESS 29, 733–752. DOI 10.5194/hess-29-733-2025 (discussion paper DOI 10.5194/hess-2023-260). CC BY 4.0. Abstract read; main-text numbers through a summary.
8. Khadka, N., Pandey, V.P., Watson, C.S., Zheng, G., Wu, T., Sharma, K., Rawlins, L.D., Allen, S., Gouli, M.R., Shrestha, D. (2026). The 2024 cascading glacial lake outburst flood in the Thame Valley of Everest region, Nepal: process, impacts and implications. NHESS 26, 4131–4152. DOI 10.5194/nhess-26-4131-2026. Published 2026-08-27. CC BY 4.0. Most of the full text read.
9. Kahn, M., Arjel, M., Adhikari, N., Sherpa, M., Pope, J. (2026). Which Site, and When: A Free-Satellite-Data Test of Himalayan Glacial Lake Bursts, Landslides, and Ice Floods. arXiv:2608.12422 (submitted 2026-08-12). https://arxiv.org/abs/2608.12422 . CC BY 4.0. Preprint; abstract and HTML text read through a summary.
10. Shrestha, F., Steiner, J.F., et al. (2023). A comprehensive and version-controlled database of glacial lake outburst floods in High Mountain Asia. ESSD 15, 3941–3961. DOI 10.5194/essd-15-3941-2023. CC BY 4.0. Abstract only.
11. Steiner, J., Shrestha, F. (2026). HMAGLOFDB v1.3.0. Zenodo. DOI 10.5281/zenodo.18257243. Published 2026-01-15. CC0 1.0. Record page only.
12. Veh, G., Korup, O., Specht, S., Roessner, S., Walz, A. (2019). Unchanged frequency of moraine-dammed glacial lake outburst floods in the Himalaya. Nature Climate Change 9, 379–383. DOI 10.1038/s41558-019-0437-5. Abstract only.
13. Zheng, G., et al. (2021). Increasing risk of glacial lake outburst floods from future Third Pole deglaciation. Nature Climate Change 11, 411–417. DOI 10.1038/s41558-021-01028-3. Abstract summary from search results only.
14. Zhang, T., Wang, W., An, B., Wei, L. (2023). Enhanced glacial lake activity threatens numerous communities and infrastructure in the Third Pole. Nature Communications. DOI 10.1038/s41467-023-44123-z. Published 2023-12-12. CC BY. Abstract only (Europe PMC).
15. Schwanghart, W., et al. (2016). Uncertainty in the Himalayan energy–water nexus: estimating regional exposure to glacial lake outburst floods. Environmental Research Letters 11, 074005. DOI 10.1088/1748-9326/11/7/074005. Abstract only; licence not checked.
16. Taylor, C., et al. (2023). Glacial lake outburst floods threaten millions globally. Nature Communications 14, 487. DOI 10.1038/s41467-023-36033-x. Published 2023-02-07. Abstract only.
17. Shugar, D.H., et al. (2021). A massive rock and ice avalanche caused the 2021 disaster at Chamoli, Indian Himalaya. Science 373, 300–306. DOI 10.1126/science.abh4455. Abstract only.
18. Cook, K.L., Andermann, C., Gimbert, F., Adhikari, B.R., Hovius, N. (2018). Glacial lake outburst floods as drivers of fluvial erosion in the Himalaya. Science. DOI 10.1126/science.aat4981. Abstract only.
19. Liu, M., Chen, N., Zhang, Y., Deng, M. (2020). Glacial lake inventory and lake outburst flood/debris flow hazard assessment after the Gorkha earthquake in the Bhote Koshi Basin. Water 12(2), 464. DOI 10.3390/w12020464. CC BY 4.0. Search snippets only.
20. Byers, A.C., Rounce, D.R., Shugar, D.H., Lala, J.M., Byers, E.A., Regmi, D. (2018). A rockfall-induced glacial lake outburst flood, Upper Barun Valley, Nepal. Landslides. DOI 10.1007/s10346-018-1079-9. CC BY 4.0. Metadata only.
21. Fischer, M., Brettin, J., Roessner, S., Walz, A., Fort, M., Korup, O. (2022). Rare flood scenarios for a rapidly growing high-mountain city: Pokhara, Nepal. NHESS 22, 3105–3123. DOI 10.5194/nhess-22-3105-2022. CC BY 4.0. Abstract and parts of the text through a summary.
22. Dwivedi, S., Neupane, Y. (2013). Cause and mechanism of the Seti River flood, 5th May 2012, western Nepal. Journal of Nepal Geological Society 46. DOI 10.3126/jngs.v46i0.31576. © Nepal Geological Society. Abstract only.
23. Acharya, T.D., Mainali, S.C., Yang, I.T., Lee, D.H. (2016). Analysis of Jure landslide dam, Sindhupalchowk using GIS and remote sensing. ISPRS Archives XLI-B6, 201–203. DOI 10.5194/isprs-archives-XLI-B6-201-2016. CC BY 3.0. Abstract through search only.
24. Shrestha, B., Nakagawa, H. (2016). Hazard assessment of the formation and failure of the Sunkoshi landslide dam in Nepal. Natural Hazards 82(3). DOI 10.1007/s11069-016-2283-3 (from search; not checked against the publisher). Abstract through ICIMOD library record only.
25. Maharjan, S.B., Steiner, J.F., et al. (2021). The Melamchi flood disaster: cascading hazard and the need for multihazard risk management. ICIMOD. DOI 10.53055/ICIMOD.981. CC BY-NC-ND 4.0. Record page only.
26. Petley, D. (2021-06-21). Melamchi: a landslide dam break flood in Nepal last week. AGU Landslide Blog. https://blogs.agu.org/landslideblog/2021/06/21/melamchi-a-landslide-dam-break-flood-in-nepal-last-week/ . Search snippet only.
27. Zhang, T.-G., Wang, W.-C., Khadka, N., et al. (2026). Transboundary outburst floods from giant supraglacial lakes over the Himalayan China–Nepal border. Advances in Climate Change Research, in press (online 2026-06-29). DOI 10.1016/j.accre.2026.06.022. https://eprints.whiterose.ac.uk/id/eprint/244178 . Abstract only; licence not stated.
28. Xu, Q., Kang, S., Du, W., et al. (2026). Brief communication: Repeated supraglacial lake drainage from the Purepu Glacier system, central Himalaya. EGUsphere preprint, posted 2026-08-12. DOI 10.5194/egusphere-2026-4065. CC BY 4.0. Abstract only; under review.
29. USGS Landslide Hazards Program (2026-08-27, updated 2026-08-28). 2026 Nepal debris avalanche and flash flood. https://www.usgs.gov/programs/landslide-hazards/science/2026-nepal-debris-avalanche-and-flash-flood . Preliminary; map image marked Public Domain.
30. ICIMOD media advisory (2026-08-26). Major flash flood sweeps through Nepal's Rasuwa district. https://www.icimod.org/press-release/major-flash-flood-sweeps-through-nepals-rasuwa-district-raising-fears-of-further-downstream-flooding/
31. Cook, S.J. (2026-09-10). The August 2026 Rasuwa disaster. Royal Scottish Geographical Society blog. https://www.rsgs.org/blog/the-august-2026-rasuwa-disaster
32. Davies, B. (2026-08-27). August 2026 Nepal–Tibet floods. AntarcticGlaciers.org. https://www.antarcticglaciers.org/2026/08/august-2026-nepal-tibet-floods/ . CC BY-NC-SA 3.0: cite only, do not reuse content.
33. The Kathmandu Post (2026-09-02). Nepal sent its disaster alert 38 minutes after the glacier collapse. It wasn't enough. https://kathmandupost.com/national/2026/09/02/nepal-sent-its-disaster-alert-38-minutes-after-the-glacier-collapse-it-wasn-t-enough
34. The Kathmandu Post (2026-09-06). Nepal is draining four glacial lakes. Scientists say it is not enough. https://kathmandupost.com/climate-environment/2026/09/06/nepal-is-draining-four-glacial-lakes-scientists-say-it-is-not-enough
35. Rural Reconstruction Nepal (2026-09-05). Rasuwa–Bhotekoshi flood: situation summary, based on NDRRMA Situation Report #15. https://rrn.org.np/?p=5567
36. ANI via Times of Oman (2026-09-21). Rasuwa floods: death toll rises to 1,451 in Nepal (NDRRMA figures as of 2026-09-20, 19:00). https://timesofoman.com/article/177199-rasuwa-floods-death-toll-rises-to-1451-in-nepal
37. The Kathmandu Post (2026-10-11). Five things to know about the Budhi Gandaki flash flood. https://kathmandupost.com/national/2026/10/11/five-things-to-know-about-the-budhi-gandaki-flash-flood
38. (not used)
39. Republica (2026-08-27). Early warning system saved many lives in Bhotekoshi flood: report (Flood Forecasting Division technical report). https://myrepublica.nagariknetwork.com/amp/news/early-warning-system-saved-many-lives-in-bhotekoshi-flood-report-50-97.html
40. The Bangladesh Monitor (2026-04-26). Everest region flood warning system falls into disrepair. https://bangladeshmonitor.com.bd/en/everest-region-flood-warning-system-falls-into-disrepair
41. GAPHAZ (2017). Assessment of glacier and permafrost hazards in mountain regions: technical guidance document. Prepared by Allen, S., Frey, H., Huggel, C., et al. IACS and IPA, Zurich and Lima. https://geoclimalp.irpi.cnr.it/wp-content/uploads/2020/08/gaphaz.pdf . Search summary only.
42. Gruber, S., et al. (2017). Review article: Inferring permafrost and permafrost thaw in the mountains of the Hindu Kush Himalaya region. The Cryosphere 11, 81–99. DOI 10.5194/tc-11-81-2017. CC BY 3.0. Abstract only.
43. Kargel, J.S., et al. (2016). Geomorphic and geologic controls of geohazards induced by Nepal's 2015 Gorkha earthquake. Science. DOI 10.1126/science.aac8353. Editor's summary only.
44. IPS News (2024-09). Small glacial lakes, mass destruction in the Himalayan community. https://www.ipsnews.net/2024/09/small-glacial-lakes-mass-destruction-in-the-himalayan-community/ . Search snippet only.
45. Asian Disaster Reduction Center. Countermeasures at the Tsho Rolpa glacier lake. https://www.adrc.asia/management/NPL/TSHO_ROLPA_GLACIER_LAKE.html ; with SciDev.Net coverage https://www.scidev.net/asia-pacific/news/nepal-scientists-warn-of-glacier-flood-threat-sa/ . Search snippets only; dates not checked.
46. EGU21-4163 (2021). Abstract and presentation on the Imja lake lowering and early warning project. https://meetingorganizer.copernicus.org/EGU21/EGU21-4163.html . Search snippet only.
47. Gulf News / AFP (2024-10). Nepal surveys flood wreckage as death toll reaches 200. https://gulfnews.com/world/asia/nepal-surveys-flood-wreckage-as-death-toll-reaches-200-1.104249940 ; Asia News Network (2024-10-08). Seventy-eight dead in recent floods and landslides in Nepal's Kavre. https://asianews.network/seventy-eight-dead-in-recent-floods-and-landslides-in-nepals-kavre/ . Search snippets only.
48. Stimson Center (2025). Investigating an emerging climate hazard: transboundary glacial floods on the China–Nepal border. https://www.stimson.org/?p=109604 ; The Week (2025-07-09). 9 killed, 19 missing after floods on Nepal–China border. https://www.theweek.in/wire-updates/international/2025/07/09/fgn81-nepal-ld-floods.html ; ICIMOD finding on the Purepu lake as reported by the press. Search snippets only.
49. (not used)
50. Monash Lens (2026). The collapse of a mountainside triggered Nepal's devastating floods. https://lens.monash.edu/the-collapse-of-a-mountainside-triggered-nepals-devastating-floods-as-the-regions-mountains-heat-up-it-wont-be-the-last/ . Search snippet only.
