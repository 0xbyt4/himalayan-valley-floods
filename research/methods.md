# Methods: landslide-dam breach floods in steep Himalayan valleys

Status: research note, 2026-10-17. Scope: methods that we can run in a browser (JavaScript, real time) or precompute
in a short Python step, to estimate what a landslide-dam or avalanche-dam breach does downstream, with honest
uncertainty.

Conventions in this file:

- Units are SI unless stated: m, m3, m3/s, s, h (hours), J.
- Confidence grades follow BRIEF.md: SOLID, LIKELY, UNCERTAIN, DISPUTED.
- "Seen: full text" means we read the equation or number in the paper or an open copy of it. "Seen: abstract" means we
  saw only the abstract. "Seen: secondary" means we saw the value only in another paper that cites it. Numbers
  marked "verify" must be checked against the original before they go on screen.
- Source numbers in square brackets refer to the numbered list at the end.

---

## 1. Landslide or avalanche deposit

### 1.1 Volume from area (area-volume scaling)

Form:

    V = alpha * A^gamma

- V: landslide volume (m3). A: area of the landslide **source scar** (m2), not the deposit area.
- Larsen et al. (2010) [1] compiled 4,231 landslides. Soil landslides fit gamma = 1.1 to 1.3. Landslides that involve
  bedrock fit gamma = 1.3 to 1.6. Seen: abstract only. Grade: SOLID for the ranges.
- The fitted alpha values and the single best-fit gamma per class are in the paper's table. We could not read it
  (paywall). Do not put a single alpha on screen until someone reads Table 1 of [1]. Grade: UNCERTAIN (verify).
- Guzzetti et al. (2009) [2]: 677 slide-type landslides in Umbria, gamma = 1.450 over 8 orders of magnitude of area.
  Seen: secondary and abstract; the prefactor was not visible to us (verify).

Use in the tool:

1. Map the source scar on Sentinel-2 imagery (pre- and post-event).
2. Compute V for gamma = 1.3, 1.45 and 1.6 with the prefactor from [1] once verified.
3. Show the result as a range, not as one number.

Error to expect: at a fixed area the scatter in the compilations is about half an order of magnitude to one order of
magnitude (factor 3 to 10). For very large rock and ice avalanches (10^7 to 10^8 m3) the relation is extrapolated
and the entrained ice, snow and valley sediment are not in it. For the Rasuwa 2026 event, published volume estimates
already differ by a factor of about 2 to 5 (about 100 x 10^6 m3 versus 197 to 492 x 10^6 m3 in commentary sources;
see the event chronology note). Grade for any single Rasuwa volume: DISPUTED.

Better option when data exist: DEM differencing (post-event DEM minus pre-event DEM) over the scar and over the
deposit. This needs a post-event DEM (stereo optical or radar). It removes the scaling step but has its own error of
several metres per pixel in steep terrain.

### 1.2 Runout from the angle of reach (Fahrboschung)

Definition (Heim 1932, formalised by Scheidegger 1973 [3]):

    tan(theta) = H / L

- H: vertical drop from the top of the source to the distal end of the deposit (m).
- L: horizontal travel distance along the path (m). theta: angle of reach (Fahrboschung).
- Scheidegger (1973) [3] and Corominas (1996) [4] fit log10(H/L) = a + b * log10(V). Corominas used 204 landslides
  of all sizes and found that the angle of reach decreases with volume for all mechanisms. Seen: abstracts. We could
  not read the coefficient tables; verify before use.

First-order values from the GAPHAZ technical guidance (2017) [5], which cites Huggel et al. (2004) [6] for the Alps
and Schneider et al. (2011) [7] for large rock-ice avalanches. Seen: full text of [5].

| Process                                   | Angle of reach | H/L          | Grade  |
|-------------------------------------------|----------------|--------------|--------|
| Ice avalanche (Alps)                      | about 17 deg   | about 0.31   | LIKELY |
| Debris flow (Alps)                        | about 11 deg   | about 0.19   | LIKELY |
| Flood with little debris (Alps)           | 2 to 3 deg     | 0.035-0.05   | LIKELY |
| Largest rock(-ice) avalanches (global)    | as low as 6 deg| about 0.10   | LIKELY |

Rock-ice avalanches are more mobile than rock avalanches of the same volume. A review cited in [8] reports up to
25 to 30 % more mobility for comparable events (Sosio 2015, seen: secondary).

Use in the tool: a plausibility check only. Draw the runout cone L = H / tan(theta) for theta = 6, 11 and 17 deg.
Say clearly that a 100 km "runout" such as Rasuwa 2026 is a process chain (avalanche, then debris flow, then flood),
not the runout of the avalanche itself.

Inundation of a channelised flow by volume (browser-friendly, from USGS LAHARZ):

    A_cross = c1 * V^(2/3)        B_plan = c2 * V^(2/3)

- A_cross: maximum valley cross-section area inundated (m2). B_plan: total planimetric area inundated (m2).
- Lahars: c1 = 0.05, c2 = 200 (Iverson et al. 1998 [9], 27 paths at 9 volcanoes). Seen: secondary and USGS pages.
- Non-volcanic debris flows: c1 = 0.1, c2 = 20. Rock avalanches: c1 = 0.2, c2 = 20 (Griswold & Iverson 2008 [10]).
  Seen: secondary summary of the USGS report.
- This is a good fast method for the avalanche and debris-flow part of the chain. It does not give time or discharge.
  Grade: LIKELY.

---

## 2. Landslide dam and lake

### 2.1 Dam height and length from deposit volume and valley geometry

No reliable general regression links deposit volume to dam height; the share of the deposit that stays in the
channel varies widely. Use geometry instead.

Method (precompute in Python, show in the browser):

1. Take the river centreline from the DEM (flow accumulation on Copernicus GLO-30).
2. At the blockage, extract cross-sections every 50 to 100 m along the valley.
3. For a trial crest elevation z_c, compute the fill volume between the valley floor and z_c over the dam length L_d.
4. Choose z_c so that fill volume = f * V_deposit, with f = share of the deposit in the channel (scenario values,
   for example 0.2, 0.5, 0.8).
5. Dam height H_d = z_c - z_bed. Dam length (along the river) L_d from the mapped deposit footprint.

Independent check that is usually better: the lake shoreline on Sentinel-2 imagery. The shoreline elevation read on
the pre-event DEM is a lower bound for the crest height at that time.

Error to expect: DEM floor error of 5 to 15 m in narrow gorges (see 4.4) maps directly into H_d. Expect H_d within
about +/-30 to 50 % unless a field or imagery measurement exists. Grade of any model-derived H_d: UNCERTAIN.

### 2.2 Lake volume and filling time from a DEM

Lake volume for a water level h (flood fill of the connected basin upstream of the dam):

    V_lake(h) = sum over cells i with z_i < h and connected to the dam:  (h - z_i) * cell_area

Filling time to the crest:

    dV/dt = Q_in - Q_seep - Q_out(h)        t_fill ~ V_lake(z_c) / (Q_in - Q_seep)

- Q_in: inflow discharge (m3/s) from a gauge, a regional regression or a seasonal climatology.
- Q_seep: seepage through the dam; usually unknown, so treat t_fill as a lower bound on time to overtopping when
  Q_seep is set to 0.

Error to expect:

- The DEM records the pre-event water surface or a blurred floor, not the true bed. For small lakes (area < 1 km2)
  this gives a volume error of tens of percent or more.
- Cross-check: lake area A_lake(h) from the DEM must match the Sentinel-2 lake area on the same date. For Rasuwa 2026 a
  blog reconstruction measured about 0.06 km2 on 29 August, and Chinese reports gave 0.11 km2 on 27 August
  (see chronology note). A lake of 0.1 km2 and mean depth 10 to 15 m holds only about 1 to 1.5 x 10^6 m3.
- Chen et al. (2025) [11] use the simple form V = (2/3) * d * a for glacial lakes with a Bayesian depth-area model.
  For a valley lake behind a landslide dam, the DEM method above is better.

### 2.3 Dam stability indices

These indices classify a dam as likely stable, uncertain or likely unstable. Their predictive power is low and the
thresholds depend on the region (O'Connor et al. 2022 [12], seen: full text). Use them only as a labelled hint.

Dimensionless Blockage Index, Ermini & Casagli (2003) [13]:

    DBI = log10( A_b * H_d / V_d )

- A_b: catchment area upstream of the dam (km2; verify unit in [13]). H_d: dam height (m). V_d: dam volume (m3).
- Thresholds (84 cases worldwide): DBI < 2.75 stable, 2.75 to 3.08 uncertain, DBI > 3.08 unstable.
  Seen: secondary tables. Grade: LIKELY.
- Other calibrations: Korup (2004) [14], New Zealand: < 3 stable, 3 to 5 uncertain, > 5 unstable. Tacconi
  Stefanelli et al. (2016) [15], Italy: < 2.43 stable, 2.43 to 3.98 uncertain, > 3.98 unstable.

Hydromorphological Dam Stability Index (HDSI), Tacconi Stefanelli et al. (2016) [15]:

- Combines landslide volume with a stream-power proxy (catchment area times local channel slope). The exact formula
  must be taken from [15] (we saw only secondary summaries).
- Thresholds (Italy, about 300 cases): HDSI < 5.74 unstable, 5.74 to 7.44 uncertain, > 7.44 stable. A Peru
  calibration gives 5.26 and 8.07. Reported forecasting skill is modest. Grade: LIKELY for thresholds.

### 2.4 Time to failure statistics

| Dataset                                  | Result                                                                 | Seen      | Grade  |
|------------------------------------------|------------------------------------------------------------------------|-----------|--------|
| Costa & Schuster (1988) [16], 73 failed dams | 27 % failed within 1 day, 85 % within 1 year                        | secondary | LIKELY |
| Shen et al. (2020), 352 dams              | 29.8 % lasted < 1 day, 84.4 % < 1 year                                | secondary | LIKELY |
| Fan et al. (2020) [17], 410 dams > 10^6 m3 since 1900 | about 80 % of dams that produced outburst floods did so within 1 year; rock avalanche and rockslide dams last longest | O'Connor 2022 [12] and abstract | LIKELY |
| Costa & Schuster (1991) compilation, 340 dams | about 75 % breached                                                  | [12]      | LIKELY |
| Ermini & Casagli (2003), 282 dams         | 67 % breached cataclysmically                                          | [12]      | LIKELY |
| Korup (2004), 232 NZ dams                 | about 37 % failed                                                      | [12]      | LIKELY |

Caveat for the screen: the compilations over-represent dams that failed, because failures get reported (O'Connor et
al. 2022 [12]). Most failures are by overtopping; one study of 144 dams found 91 % overtopping, 8 % piping and 1 %
slope failure (seen: secondary).

---

## 3. Peak breach discharge

### 3.1 Empirical relations

Notation: Q_p peak discharge (m3/s); H_d dam height (m); h_w or d water depth above the breach invert or drop in lake
level (m); V_l or V_w lake volume released (m3, unless stated); PE potential energy (J) = H_d * V_l * rho_w * g;
W_d dam width along the river (m); V_d dam volume (m3); H_r = 1 m; g = 9.81 m/s2.

| # | Relation | Inputs | Basis | Error reported | Seen | Grade |
|---|----------|--------|-------|----------------|------|-------|
| E1 | Costa (1985): Q_p = 6.3 H_d^1.59 | H_d | 10 landslide dams | not stated | secondary (equation set in [18]) | LIKELY |
| E2 | Costa (1985): Q_p = 672 V_l^0.56, V_l in 10^6 m3 | V_l | 10 landslide dams | not stated | secondary [18] | LIKELY |
| E3 | Costa (1985): Q_p = 181 (H_d V_l)^0.43, V_l in 10^6 m3 | H_d, V_l | 10 landslide dams | not stated | secondary [18] | LIKELY |
| E4 | Costa & Schuster (1988), regression: Q_p = 0.0158 PE^0.41 | H_d, V_l | 12 landslide dams | not stated | secondary [18] | LIKELY |
| E5 | Costa & Schuster (1988), envelope: Q_p = 0.063 PE^0.42 | H_d, V_l | envelope | upper bound | secondary [18] | LIKELY |
| E6 | Walder & O'Connor (1997), landslide dams, regression: Q_p = 1.60 V_l^0.46 | V_l | 18 breached landslide dams | R2 about 0.73 | secondary [18] | UNCERTAIN (verify) |
| E7 | Walder & O'Connor (1997), landslide dams, envelope: Q_p = 46 V_l^0.46 | V_l | envelope | upper bound | secondary [18] | UNCERTAIN (verify) |
| E8 | Froehlich (1995b): Q_p = 0.607 V_w^0.295 h_w^1.24 | V_w, h_w | 32 embankment dams | 95 % band x0.53 to x2.3 (Wahl 2004) | full text [19] | SOLID (for embankments) |
| E9 | Peng & Zhang (2012), full: Q_p / (g^0.5 H_d^2.5) = (H_d/H_r)^-1.417 (H_d/W_d)^-0.265 (V_d^(1/3)/H_d)^-0.471 (V_l^(1/3)/H_d)^1.569 e^a; a = 1.276 (high erodibility), -0.336 (medium), -1.532 (low) | H_d, W_d, V_d, V_l, erodibility class | 52 breached landslide dams | R2 = 0.946 (in log space) | equations as reproduced in [18] | LIKELY |
| E10 | Peng & Zhang (2012), simplified: Q_p / (g^0.5 H_d^2.5) = (H_d/H_r)^-1.371 (V_l^(1/3)/H_d)^1.536 e^a; a = 1.236 (high), -0.380 (medium), -1.615 (low) | H_d, V_l, erodibility class | 52 cases | R2 = 0.939 (in log space) | equations as reproduced in [18] | LIKELY |
| E11 | Froehlich (2022): Q_p = f(blockage type, H_d, V_l) with prediction limits | H_d, V_l, blockage type (3 classes from landslide type, material and travel distance) | 42 landslide-dam outburst floods | prediction limits given | abstract only [20] | UNCERTAIN (coefficients not seen) |
| E12 | Froehlich (2016): two models (empirical and semi-theoretical) for gradual breaches | V_w, h_w, breach geometry | 41 embankment dams | "more accurate" than older methods | abstract only [21] | UNCERTAIN |

Notes on the table:

- E6 and E7 come from the reproduction in Shafieiganjeh et al. (2025) [18]. The original table in Walder & O'Connor
  (1997) [22] lists regression and envelope coefficients and exponents in separate columns. A search snippet of the
  original suggests a regression exponent that may differ from 0.46. Read the original before using E6 or E7.
- Peng & Zhang erodibility classes: high = mostly soil, medium = soil and boulders mixed, low = mostly large blocks
  (seen: secondary). A rock-ice avalanche deposit with much fine debris and ice is probably "medium" to "high".
  This is a judgement; show all three.
- Wahl (2004) [23] tested peak-flow equations on 30 to 40 embankment-dam failures (seen: full text). Most equations
  have a 95 % uncertainty band of 0.5 to 1 order of magnitude. Froehlich (1995b) had the smallest band, 0.32 log
  cycles (prediction interval x0.53 to x2.3 around the predicted value). Walder & O'Connor had about 0.68 to 0.75 log
  cycles (x0.16 to x3.6). Costa (1985) dam-failure equations had 0.72 to 1.02 log cycles. These numbers are for
  constructed dams; landslide dams are more variable.
- Shafieiganjeh et al. (2025) [18] tested landslide-dam equations against 28 Alpine cases (geometry) and one case
  study. Regression-based peaks spanned 150 to 1,190 m3/s for their dam; envelope equations gave 5,000 to 33,000 m3/s,
  far outside the plausible range; the high-erodibility Peng & Zhang result was 2,500 to 4,300 m3/s. A physically
  based model gave 200 to 500 m3/s. Seen: full text.
- O'Connor et al. (2022) [12]: regressions and envelope curves give only order-of-magnitude estimates. Part of the
  scatter is in the observed peaks themselves, which are measured at different distances downstream of the breach.
  Seen: full text.

### 3.2 Physically based parametric breach model (recommended core)

Walder & O'Connor (1997) [22] show that the breach hydrograph depends mainly on (seen: abstract and [11], [12], [23]):

    eta = k * V_0 / ( g^(1/2) * d^(7/2) )

- k: mean vertical erosion rate of the breach (m/s). V_0: lake volume released (m3). d: drop in lake level (m).
- eta >> 1 ("large reservoir" or fast erosion): the breach reaches full depth before the lake drops much. The peak is
  near critical flow through the final breach and is insensitive to k. For a breach about as wide as it is deep:

      Q_p ~ g^(1/2) * h^(5/2)        (larger by about b/h for a breach of width b)

  For tectonic and caldera lakes, observed peaks lie between 1 and 20 g^(1/2) h^(5/2) (O'Connor & Beebee 2009, in
  [12]).
- eta << 1 ("small reservoir" or slow erosion): the lake drops while the breach grows. The peak comes before full
  breach depth and depends almost linearly on k. Landslide dams in deep, narrow valleys are often in or near this
  regime (O'Connor et al. 2022 [12]).
- Erosion rate: Walder & O'Connor suggest 10 to 100 m/h for reconnaissance work (Wahl 2004 [23]). Observed rates
  span 4 x 10^-4 to 1 x 10^-1 m/s, that is 1.4 to 360 m/h (O'Connor & Beebee 2009, in [12]). Grade: LIKELY.

Browser implementation (time-stepping, about 1,000 steps per run, fast enough for 1,000 Monte Carlo runs):

1. Lake: stage-volume curve V_lake(h) from 2.2.
2. Breach: trapezoid with bottom width b(t), side slope z (horizontal:vertical), invert z_b(t) = z_c - k * t, down
   to a final invert z_c - h_b. Let b grow with depth (b = r * (z_c - z_b), r from 0.5 to 3).
3. Outflow: broad-crested weir with head H = h - z_b:

       Q = 1.7 * b * H^1.5 + 1.35 * z * H^2.5        (SI; NWS BREACH/DAMBRK form)

4. Mass balance: dh/dt = (Q_in - Q) / A_lake(h).
5. Record Q(t). Repeat with sampled k, h_b, r, z, initial level and V_lake curve.

Veh et al. (2020) [24] and Chen et al. (2025) [11] use a Bayesian version of the Walder & O'Connor scaling with
lognormal k for Himalayan moraine lakes. That approach is a good template for our sampling.

### 3.3 Worked example (for tests, not for a real site)

H_d = 30 m, V_l = 5 x 10^6 m3, full breach (h_w = 30 m). Computed here with the equations above.

| Relation | Q_p (m3/s) |
|----------|-----------:|
| E1 Costa 1985, H only | 1,406 |
| E2 Costa 1985, V only | 1,655 |
| E3 Costa 1985, H*V | 1,561 |
| E4 Costa & Schuster 1988, regression | 1,540 |
| E5 Costa & Schuster 1988, envelope | 8,125 |
| E6 Walder & O'Connor 1997, regression | 1,930 |
| E7 Walder & O'Connor 1997, envelope (verify) | 55,499 |
| E8 Froehlich 1995b (band x0.53 to x2.3) | 3,900 (2,070 to 8,970) |
| E10 Peng & Zhang simplified, low / medium / high erodibility | 420 / 1,444 / 7,266 |
| Critical flow, breach width = depth: g^0.5 h^2.5 | 15,440 |
| Weir 1.7 b H^1.5 with b = 3 h | 25,140 |

Reading: the regressions cluster at 1,400 to 2,000 m3/s; erodibility alone moves Peng & Zhang by a factor of 17; the
E7 envelope exceeds the critical-flow bound and must not be shown as a plausible value.

### 3.4 Recommendation

1. Use the parametric breach model (3.2) as the main estimate. Show its 5th, 50th and 95th percentiles.
2. Show Peng & Zhang (E10, all three erodibility classes) and Costa & Schuster (E4) as independent empirical markers.
   They are the only landslide-dam-specific relations whose equations we have seen.
3. Show Froehlich (1995b) with the Wahl band as a cross-check, and say that it is calibrated on constructed dams.
4. Use the critical-flow value g^0.5 h^2.5 (times b/h) as a physical upper reference. Do not show envelope curves as
   estimates.
5. Never average the equations. Plot them on a log axis with the ensemble band. Expect the full spread to be a factor
   of 3 to 10 (0.5 to 1 order of magnitude).
6. If the breach depth is unknown, sample h_b from 0.3 to 1.0 times H_d. Breach depth is the strongest control
   (Q ~ h^2.5 in the large-lake limit).

Himalaya-calibrated relations: we found no landslide-dam peak-discharge regression calibrated on Himalayan cases
only. Himalayan GLOF work (Veh et al. 2020 [24]; Chen et al. 2025 [11]) uses the Walder & O'Connor physics with
Bayesian sampling. Froehlich (2022) [20] is the newest landslide-dam-specific regression with prediction limits; we
should get its full text.

---

## 4. Routing the flood wave down the river

### 4.1 Options

| Option | What it solves | Browser cost | Good for | Limits |
|--------|----------------|--------------|----------|--------|
| Kinematic wave | Q(x,t) moves at celerity c, no attenuation except numerical | trivial | arrival times in steep reaches | no peak attenuation; no backwater |
| Variable-parameter Muskingum-Cunge | kinematic wave plus physical diffusion matched to channel | trivial (explicit, per reach) | peak attenuation and timing over tens of km | fails for very sharp dam-break fronts near the breach, backwater, supercritical jumps |
| 1D diffusive wave on DEM sections | St Venant without inertia terms | small (implicit or explicit, 100s of nodes) | storage in wide reaches, confluences | needs care with steep slopes and wetting fronts |
| Dimensionless dam-break attenuation (Ponce et al. 2003 [25]) | peak vs distance from slope and volume | trivial | quick check | analytic idealisation; we saw abstract only |
| Full 2D (HEC-RAS 2D, HiPIMS, r.avaflow, RAMMS) | full shallow water or multiphase flow | not in browser; hours of precompute | reference runs for validation | needs good DEM and calibration |

Recommendation: variable-parameter Muskingum-Cunge, precomputed reach geometry, run in JavaScript. Start the routing
1 to 2 km below the breach, where the wave is no longer a pure dam-break front.

### 4.2 Equations

Manning (SI), wide channel approximation R ~ h:

    v = (1/n) * R^(2/3) * S^(1/2)        Q = A * v

Kinematic celerity for a general section and for a wide channel:

    c = dQ/dA = (1/B) * dQ/dh        c ~ (5/3) * v    (wide channel, Manning)

Muskingum-Cunge (Cunge 1969 [26]; variable-parameter form as in Ponce's work):

    K = dx / c
    X = 0.5 * (1 - q / (S_0 * c * dx))        q = Q / B  (unit-width discharge, m2/s)
    D = 2*K*(1 - X) + dt
    C0 = (dt - 2*K*X) / D
    C1 = (dt + 2*K*X) / D
    C2 = (2*K*(1 - X) - dt) / D
    Q[j+1][n+1] = C0*Q[j][n+1] + C1*Q[j][n] + C2*Q[j+1][n]

- dx: reach length (m), dt: time step (s), S_0: bed slope, B: top width (m).
- Accuracy: keep the Courant number c*dt/dx near 1 and X between 0 and 0.5. Recompute c and X from the local Q at
  each step (variable parameter).
- The hydraulic diffusivity is nu = q / (2 S_0). Steep reaches (S_0 = 0.01 to 0.05) give small diffusion and little
  attenuation. This matches the Sikkim 2023 reconstruction, where steep reaches "prevent attenuation of the flood
  peak" and attenuation happens mainly downstream (Sattar et al. 2025 [27], seen: full text).

Peak attenuation over tens of km depends on three things (GAPHAZ [5]; Sattar et al. [27]; O'Connor et al. [12]):

1. Hydrograph volume and duration: short, small-volume outbursts attenuate fastest.
2. Channel slope and valley width: storage in wide, flat reaches attenuates; steep gorges do not.
3. Sediment: bulking can raise the peak by a factor of up to 10 in the first 10 km (moraine and landslide
   outbursts); deposition in gentler reaches then lowers volume and peak (O'Connor et al. 2022 [12]). Debris flows
   need channel slopes above about 0.10 to 0.15 (O'Connor et al. [12]) or 6 to 9 deg (GAPHAZ [5]).

A simple hydrograph for the routing input when only Q_p and V are known (used by Chen et al. 2025 [11]):

    triangle with peak Q_p and duration T = 2 * V / Q_p

### 4.3 Manning's n for steep boulder-bed Himalayan rivers

Jarrett (1984) [28], 75 measurements on 21 high-gradient streams in Colorado (seen: secondary and abstract):

    n = 0.39 * S^0.38 * R^-0.16     (R in feet)
    n = 0.32 * S^0.38 * R^-0.16     (R in metres; our unit conversion of the same equation, verify)

- S: energy slope (taken as bed slope). R: hydraulic radius.
- Validity: S > 0.002 (data reach about 0.04 to 0.09; sources differ), R about 0.15 to 2.1 m (0.5 to 7 ft).
- Average standard error 28 %. A later test gave R2 = 0.58 on validation data (Azamathulla & Jarrett 2013, seen:
  secondary).
- Outburst floods have depths of 5 to 20 m, far above the calibrated R range. Values are extrapolated.

Values from the Jarrett equation (computed here):

| S | R (m) | n |
|---|------:|----:|
| 0.005 | 3 | 0.036 |
| 0.01 | 5 | 0.043 |
| 0.02 | 10 | 0.050 |
| 0.04 | 2 | 0.084 |

Values used in published Himalayan outburst-flood reconstructions: n = 0.05 for the 67.5 km Sikkim routing
(Sattar et al. 2025 [27]); n = 0.04 for the Yigong 2000 outburst, with low sensitivity reported in narrow bedrock
canyons (Dong et al. 2024 [29]); n by land-cover class with field checks for the Seti (Fischer et al. 2022 [30]).

Alternative: Ferguson (2007) [31] variable-power equation uses grain size D84 as the roughness scale and is more
physical for boulder beds. We have no D84 for our reaches, so we do not recommend it for version 1.

Recommendation: sample n uniformly or log-uniformly from 0.035 to 0.07 for the main channel. For a wide channel at
fixed Q, velocity scales as n^-0.6, so a +/-30 % change in n gives about +/-15 to 20 % in wave speed and arrival time.

### 4.4 Cross-sections from a 30 m DEM and their errors

Procedure (Python precompute):

1. Take Copernicus GLO-30 (licence check in data_sources.md). Hydro-condition it: fill pits along the centreline and
   force a monotone bed profile.
2. Extract the centreline from flow accumulation. Smooth it.
3. Every 200 to 500 m, sample a transect perpendicular to the centreline, 1 to 2 km wide.
4. For each section, store tables of top width B(h), area A(h) and wetted perimeter P(h) for stages above the lowest
   DEM point.
5. Compute the bed slope over windows of at least 1 km.

Errors and how to handle them:

- Copernicus GLO-30 has a specified absolute vertical accuracy of < 4 m (LE90) overall. Errors are larger in steep
  terrain, with radar layover, shadow and filled voids (Hawker et al. 2018 [32]; product handbook, verify the exact
  figure on the source page).
- The DEM does not see the bed below the water. In gorges narrower than 2 to 3 pixels (60 to 90 m), the pixel
  averaging raises the floor and widens the section. This makes modelled depths too low for a given discharge.
- Fischer et al. (2022) [30] needed field corrections of DEM sections in narrow gorges and reported ponding artefacts
  there, even with a 5 m DEM.
- Watson et al. (2015) [33] show that DEM uncertainty and model choice change GLOF inundation and impact estimates;
  they recommend stochastic DEM error in routing.
- Mitigation: add a sub-grid rectangular channel with the low-flow width from Sentinel-2 and a depth from base flow
  (Manning inversion); run a sensitivity case with the bed lowered by 5 m; show stage results as ranges of several
  metres.

### 4.5 Celerity and arrival time over tens of km

Example celerities from the wide-channel formula (computed here):

| n | h (m) | S | v (m/s) | c = 5/3 v (m/s) |
|---|------:|---|--------:|----------------:|
| 0.045 | 8 | 0.01 | 8.9 | 14.8 |
| 0.05 | 5 | 0.02 | 8.3 | 13.8 |
| 0.04 | 6 | 0.005 | 5.8 | 9.7 |

Observed mean front speeds (see Section 5): about 20 to 23 m/s in the first tens of km after very large avalanche
inputs (Rasuwa 2026, Melamchi 2021); 8 to 13 m/s for large outbursts over 20 to 70 km (Sikkim 2023, Seti 2012,
Chamoli 2021); 4 to 6 m/s in the lower Trishuli valley (Rasuwa 2026). The model should reproduce this drop of speed
with distance; a constant celerity will not.

---

### 4.6 What the code does (model/route.mjs) and the Rasuwa check

Implementation choices, each one found necessary in testing (tests: model/route.test.mjs):

1. Conveyance per strip. data/hydraulics.py sums a_i r_i^(2/3) over 30 m vertical strips (as HEC-RAS does for
   subdivided sections). With one hydraulic radius for the whole section, discharge fell each time the water spread
   onto a wider bench; 299 of 299 Rasuwa sections had such flat or falling rows, and the routed flow collapsed for a
   step and then overshot (found by the independent review).
2. Nonlinear storage form. The storage of a reach is the water in it, S = dx A(Qw), with Qw = X I + (1 - X) O and A
   the mean area of its two sections. Each step solves continuity, S_new = S_old + dt (I - O) with trapezoid
   averages, for O. The water balance is exact. A first version used S = K Qw with K = dx / c; K then jumped tenfold
   where c changed fast, and so did the outflow. The linear coefficient form in 4.2 gained 9 % of the volume over
   40 km in a test valley.
3. X from Cunge's formula, held between 0 and 0.5 (X < 0 in flat reaches is unstable). While a front enters a reach,
   X is lowered to the largest value that keeps the outflow from falling. Without this, a steep front (Rasuwa: 400
   to 25,000 m3/s in one minute) made the outflow dip to zero (the negative C0 of the linear method; Ponce and
   Theurer 1982).
4. Tributaries join at the downstream end of a reach, after routing. An earlier version counted them again in every
   step, and base flow then grew without a flood.
5. An optional loss term removes a fraction of the flow above base per km from what leaves each reach (not from its
   storage), so the flood volume falls as exp(-loss x distance). It stands for deposition and valley storage, which
   a water-only model lacks. It is sampled from near zero, so the data can reject it.
6. Time step 15 s. Between 15 and 30 s, peaks change by up to 1.3 % (at Betrawati) and hydrographs stay
   single-peaked. At 60 s the Betrawati peak changes by up to 16 %, so 60 s is too long for the steep upper river.

Manning's n is an effective value. It also absorbs the DSM sections (no channel below the water surface) and the
sediment load. Two model structures are tested:

- uniform: one n for the whole river;
- jarrett: n scaled with the local slope, n = n_ref (S / S_median)^0.38 (the slope exponent of Jarrett 1984, 4.3),
  so steep gorges are rougher than the flat lower Trishuli.

Both sample n (n_ref for jarrett) from 0.02 to 0.10 and the loss from 1e-5 to 0.03 per km, log-uniform. Narrower
ranges, used first, put the accepted runs against a limit (n at 0.035 and at 0.07, loss at 0.01); a parameter
pressed against its limit gives a band that reflects the limit, not the data.

Rasuwa check (model/validate_rasuwa.mjs, 8,000 runs per structure, seed 2026; the flood enters at Syabrubesi,
km 35.7, and runs to Devghat, km 192.7). Eight observations (research/events.md, Part E1):

| Check | Observed | uniform, 5 / 50 / 95 % | jarrett, 5 / 50 / 95 % |
|-------|----------|------------------------|------------------------|
| Betrawati front | 09:05 to 09:30 | 09:13 / 09:18 / 09:23 | 09:21 / 09:26 / 09:30 |
| Galchhi front | 10:15 to 10:40 | 10:23 / 10:29 / 10:36 | 10:30 / 10:34 / 10:39 |
| Galchhi peak time | 10:35 to 11:05 | 10:36 / 10:42 / 10:51 | 10:39 / 10:44 / 10:49 |
| Malekhu (Phurke) front | 11:10 to 11:40 | 11:19 / 11:32 / 11:39 | 11:20 / 11:24 / 11:32 |
| Malekhu (Phurke) peak time | 11:30 to 12:00 | 11:33 / 11:46 / 11:54 | 11:30 / 11:35 / 11:43 |
| Mugling front | 11:45 to 13:00 | 12:48 / 13:13 / 13:34 | 12:34 / 12:49 / 12:59 |
| Devghat peak time | 15:15 to 16:45 | 14:55 / 15:40 / 16:26 | 14:12 / 14:37 / 14:58 |
| Devghat peak discharge | 5,850 m3/s +/- 25 % | 4,595 / 5,838 / 7,218 m3/s | 4,658 / 5,908 / 7,039 m3/s |

With one roughness for the whole river (uniform), 8 runs meet all eight checks, and 151 runs meet both the Mugling
front and the Devghat peak time. With roughness scaled by slope (jarrett), no run meets all eight: its Devghat peak
comes 16 to 69 min before 15:15 (median 39 min), while it meets Mugling. The jarrett structure is therefore less
consistent with the record than the uniform one.

Correction (18 Oct 2026). An earlier version of this check placed Devghat at an OSM admin centroid about 12 km from
the gauge, in the hills; the corridor then left the river below Mugling and its last sections had beds of 375 to
679 m instead of about 180 to 190 m. With that error no run of either structure met both the Mugling front and the
Devghat peak time, and this section called the two reports inconsistent. That statement is withdrawn: with the gauge
at its DHM location (events.md B2), the uniform structure meets both.

Fewer than 20 runs meet all eight, so the bands come from runs that meet the six other checks and at least one of
the Mugling front and the Devghat peak time (uniform 328 runs, jarrett 83 runs). In the uniform pool, 265 runs meet
the Devghat peak time and reach Mugling 0 to 42 min late (median 17 min); 55 meet Mugling and peak at Devghat 0 to
29 min early (median 13 min); 8 meet both and all the other checks. The table above shows these pools. Other results
(5 / 50 / 95 %):

| Result | uniform | jarrett |
|--------|---------|---------|
| Peak entering at Syabrubesi (m3/s) | 5,200 / 10,200 / 48,500 | 6,300 / 27,200 / 66,400 |
| Flood volume above base (10^6 m3) | 17 / 36 / 113 | 17 / 32 / 97 |
| Peak at Galchhi (m3/s) | 4,300 / 6,400 / 11,400 | 4,900 / 7,900 / 13,300 |
| Stage rise at Galchhi (m) | 4.2 / 6.5 / 11.0 | 4.1 / 7.5 / 11.3 |
| Effective n (n_ref for jarrett) | 0.032 / 0.041 / 0.057 | 0.027 / 0.037 / 0.045 |
| Loss per km | 0 / 0.0004 / 0.0052 | 0 / 0.0014 / 0.0073 |

What holds in both structures:

- The Galchhi peak is about 6,000 to 8,000 m3/s (median), 4,300 to 13,300 m3/s (5 to 95 %). The ICIMOD preliminary
  value of about 17,000 m3/s is reached by none of the 328 uniform runs and by 2 of the 83 jarrett runs in these
  pools.
- The modelled Galchhi rise (median 6.5 to 7.5 m) is lower than the observed +8.5 m (CLaSH) and about 8.9 m (ICIMOD),
  which lie inside the upper half of the band. DSM sections give stages that are too low (4.4), so this is
  expected.
- The peak entering at Syabrubesi is poorly constrained (a factor of ten); the downstream record constrains the
  flood volume better than the peak.
- The loss term is weakly constrained: the uniform runs spread over the sampled range; the jarrett runs lean to
  0.001 to 0.01 per km.

The app (model/export_app.mjs) pools the runs of both structures (328 uniform, 83 jarrett) and shows 5 / 50 / 95 %
of the pool at every section and minute; each structure is weighted by its number of runs. It draws the water at
the rise above the lowest point of each DEM section, which is the normal river as the surface model sees it.

Limits: front times use a 1 m stage rise, and stages come from DSM sections, so they are too low (4.4). The
Betrawati time is DISPUTED (events.md). Base flows are sampled, not measured; tributary floods on the day are not
modelled. An earlier version of this section, built on a routing code with the faults listed in items 1 to 3,
reported 80 accepted runs and a Galchhi peak below 17,000 m3/s in every one of them; the first statement is
withdrawn, and the second now rests on the corrected code above.

### 4.7 Budhi Gandaki: can the Syar pond explain the flood? (data/syar_pond.py, model/check_budhi.mjs)

Observed: debris blocked the Ungdilung - Syar confluence at about 2,000 m; water ponded about 1.5 km up the Syar;
the largest surge, 20-25 m high, reached Salleri at about 06:30 (NDRRMA SitRep 3 and 4). No dam size or pond volume
is published.

1. Confluence on our corridor: km 8.5, DEM bed 2,006 m (NDRRMA: about 2,000 m).
2. Pond from the pre-event DEM, by dam height: a pond of 1.0 km or more needs a blockage of at least 70 m and holds
   at least 4 x 10^6 m3; a 1.5 km pond needs about 83 m and 6.2 x 10^6 m3. In the DEM the pond stops growing at
   1.75 km (a step in the valley floor), so a 2 km pond is not reached below 120 m. The DEM shows a steep lower Syar
   (about 6 % over the first 1.5 km).
3. That volume cannot fill in time. The Syar Khola at the Chumchet headworks (565 to 574 km2) has an adopted
   October mean flow of 20.92 m3/s and a 100-year flood of 486 m3/s (1,582 m3/s in the earlier desk study)
   (Chilime [47], p. 25 and 31). With an inflow of 10 to 100 m3/s for 1 to 2.2 h, the pond holds at most 0.04 to
   0.79 x 10^6 m3, behind 7 to 33 m of debris, and reaches 0.2 to 0.65 km. A 1.5 km pond in 1 to 2.2 h needs 790
   to 1,730 m3/s of inflow: 40 to 80 times the October mean, and more than the adopted 100-year flood (486 m3/s).
4. Breach of the largest such pond (33 m, 0.79 x 10^6 m3): ensemble 310 / 580 / 1,360 m3/s; empirical markers
   160 to 2,700 m3/s. For comparison, the pond that matches the reported 1.5 km (83 m, 6.2 x 10^6 m3), if it could
   have filled: ensemble 730 / 1,630 / 4,330 m3/s; markers 310 to 5,400 m3/s, and 14,800 m3/s for Froehlich (built
   for constructed dams).
5. A 20-25 m flood surface at Salleri (km 23, slope 0.018) in our section needs 18,000 to 82,000 m3/s of clear
   water for n = 0.10 to 0.035.

Result: water released from the Syar pond explains a few per cent of the discharge the Salleri flood level needs.
This supports the NDRRMA statement that debris from the Ungdilung made more of the flood height than the ponded
water. The result rests on step 3, the inflow limit: a pond as long as reported could not have filled with water
in the time available. Without that step, the length-matched pond would still give a median breach peak below
10 % of the lowest needed discharge, but its Froehlich marker comes close to it. Grade: LIKELY for the conclusion;
UNCERTAIN for each number.

Limits: the Salleri level of a mudflow is not a clear-water level (a dense, bulked flow stands higher for the same
water discharge), and the DEM section misses the channel under water. The pond observation may include mud and
debris, not water only. A water-only routing model is not the right tool for this event; the app shows the
blockage-and-surge sequence with these numbers and does not route a Budhi Gandaki flood.

### 4.8 Map layers in the app (data/build_layers.py)

Reported front above Syabrubesi. The model does not run above km 35.7. The app shows the reported front times there
instead: 08:37:10 at the source (SOLID), Gyirong port at about 08:44 to 08:45 (km 21.5, LIKELY), Rasuwagadhi 08:40
to 09:05, Timure 08:43 (08:53 minus 10 min) to 09:25 and Syabrubesi 08:50 to 09:00 (all DISPUTED). The earliest times are
made to rise downstream and the latest times to fall upstream (a front cannot reach a place before a place above
it). In practice the Gyirong and Syabrubesi reports bound the result, and some reports (Timure 09:10 to 09:25,
Rasuwagadhi 09:00 to 09:05) fall outside it. The envelope: km 22.2 between 08:44 and 09:00, km 35.7 between 08:50 and 09:00. The app marks the stretch of river
where the front could be at each minute. Reported flow heights (40 to 134 m at the border, about 70 m in the gorges,
run-up of about 450 m near the source) are shown as points with their grades, not as a water surface.

Exposure (OpenStreetMap, ODbL, Overpass query of 2026-10-18). Buildings, bridges, main roads, power
plants, dams and weirs, monitoring stations, schools and health sites within 2 km of the river. A feature counts as
reached by a band (5, 50 or 95 %) if two things hold at the nearest corridor station: its DEM height is at or below
the corridor bed plus the modelled peak rise of that band, and its distance from the centreline is within half the
modelled water width at that rise plus one 30 m cell. Lines (roads, bridges) are reached if any vertex is. A
facility mapped as a building (a school, a powerhouse) counts once, as the facility; relations are placed at the
centre of their bounds. Tests: data/test_build_layers.py.

| Feature | in OSM | above Syabrubesi (not modelled) | reached, 5 / 50 / 95 % |
|---|---|---|---|
| Buildings | 83,795 | 1,492 | 119 / 359 / 655 |
| Bridges (ways) | 215 | 6 | 24 / 25 / 33 |
| Main roads (ways) | 223 | 6 | 3 / 6 / 14 |
| Power plants, generators, substations | 24 | 0 | 1 / 1 / 10 |
| Dams and weirs | 7 | 0 | 1 / 2 / 2 |
| Schools | 274 | 6 | 0 / 1 / 2 |
| Health sites | 24 | 0 | 0 / 0 / 0 |
| Monitoring stations | 3 | 0 | 0 / 0 / 0 |

The reports give far larger numbers: 7,570 affected private buildings in five districts and 37 motorable bridges
plus 68 trail bridge spans (RDNA, SOLID); 4,685 buildings in the Copernicus EMS mapping of 5 Sep (LIKELY). Even at
its 95 % band the model reaches 655 buildings, under a tenth of the RDNA count. Reasons, all known: the model carries water only
(no debris, sediment or bank erosion); DSM sections make its levels low (4.4); the debris-flow reach above
Syabrubesi is not modelled; OSM may be incomplete and may have lost destroyed buildings since. The counts are a lower
bound from the water alone, not a damage estimate. The model reproduces most front times and the Devghat peak flow (4.6),
but not the reach of the damage; the app says so next to the counts.

Vegetation loss (Sentinel-2 L2A, our analysis). For each detail tile, NDVI before (scenes of 16 Oct to 10 Nov 2025)
and after (28 Sep to 16 Oct 2026), each pixel from the first scene in which the scene classification layer marks it
as vegetation, bare soil, water or unclassified (clouds, shadows and snow left out). Loss: NDVI before at least
0.35 and a drop of at least 0.25, on the valley floor only
(within 1500 m of the river and up to 150 m above its
bed). Result: 1,706 ha of loss; 1,373 ha of valley floor had no clear view on
one of the dates. By 10 km reach (ha): km 0-10 333, km 10-20 167, km 20-30 114, km 30-40 97, km 40-50 52, km 50-60 83, km 60-70 217, km 70-80 204, km 80-90 183, km 90-100 54, km 100-110 37, km 110-120 28, km 120-130 22, km 130-140 22, km 140-150 24, km 150-160 13, km 160-170 3, km 170-180 6, km 180-190 35, km 190-200 12.

The loss is largest near the source (km 0-10, the avalanche run-out) and between Betrawati and Devighat (km 60-90),
and small below Galchhi. Between km 20 and 90 it adds up to about 950 ha; the RDNA maps 1,926 ha (Rasuwa) and
1,100 ha (Nuwakot) of affected land in the assessed wards, which also counts bare river bed, settlements and
debris that had no vegetation to lose. Limits: harvested or fallow fields and landslides that are not flood damage
also lower NDVI; bare banks, roads and roofs cannot show a vegetation loss; thresholds are our choice and were not
calibrated against a damage map. Grade: UNCERTAIN.

### 4.9 Where the water spreads: the 2-D model (model/swe2d.py, model/flood2d_rasuwa.py)

The 1-D model (4.6) gives levels along the river but not where the water goes. The 2-D model solves the shallow-water
equations on the 30 m DEM grid, so the water can leave the channel, fill side valleys and flats, and narrow and widen
with the valley. It runs offline (Python with numba); the app plays its stored frames.

Solver (model/swe2d.py). First-order finite volumes on the masked grid cells. Fluxes: HLL (Harten, Lax and van Leer
1983 [48]) with the hydrostatic reconstruction of Audusse et al. (2004) [49], so a lake at rest stays at rest over
uneven ground and cells dry and wet without negative depths. A cell face on the edge of the domain is a wall, with
its pressure term; faces between active cells, wet or dry, exchange HLL fluxes. Friction: Manning, semi-implicit, so it cannot reverse the flow. Time step from CFL 0.45, at most 5 s.
Tests (model/test_swe2d.py, all pass):

| Test | Check |
|---|---|
| Lake at rest over a bump | unit discharges stay below 1e-9 m2/s; the level stays flat |
| Closed box | volume conserved to 1e-9; no negative depth |
| Dam break on a dry bed (Ritter 1892 [50]) | depth at the dam 4/9 of the lake depth within 3 %; L1 error under 8 %; the 5 cm front within 10 % |

Domain (flood2d_rasuwa.py). DEM cells within 2 km of the river and at most 60 m above its bed, from Syabrubesi
(km 35.5) to below Devghat, as one connected area. The river is burned in at the corridor bed: the active channel
mapped from Sentinel-2 (data/channel.py: NDVI below 0.2 before the flood, within 400 m of the centreline, at most
20 m above the bed, connected to the centreline; with the 45 m band around the centreline that is always kept,
26,948 cells over km 0 to 193, mean widths 83 to 231 m per 10 km) and a band of half width B around the
centreline. Inflow at Syabrubesi: the 1-D pulse (straight rise in 5 min, exponential fall
that releases the volume V). Tributary base flows (Tadi and others to Galchhi, Budhi Gandaki, Marsyangdi) enter as
sources, as in the 1-D runs. Outflow: below km 192.5 the edge cells lose water at normal flow, unit discharge
h^(5/3) S^(1/2) / n with the bed slope of the last 7.5 km (0.0008).

Start. The river at base flow settles for 16 hours from normal depth (cached per terrain, outflow rule, settling
time, roughness and base flows). The largest level change in the last of those hours is 0.03 m for B = 110 and
130 m and 0.05 m for B = 150 m (stored with the cached state and in each run's record), so the flood starts on a
steady river. A first version held the water below Devghat at its base level (a sponge); in a test run the lower
50 km then still fell by 0.2 to 0.3 m per hour at the start (seen in the run log, not stored). The normal-flow
outflow replaced it. Each run records its volume balance: start + inflow - outflow - end, as a fraction of the
inflow.

Effective channel width. The 30 m grid resolves the 80 to 230 m channel with three to eight cells, and the DSM
puts its bed at the water surface. The channel then carries too little, the water spreads early and the wave is far
too slow. With B = 40 m no run reaches Mugling before 15:14 and at most 1 of the 9 checks is met. B is therefore an
effective conveyance parameter, calibrated with V and the inflow peak Q at n = 0.03. The checks are the eight of
4.6 plus the Galchhi stage rise (+7.0 to +10.4 m: the reported +8.5 to +8.9 m, with 1.5 m allowed for the surface
model). First grid (sponge outflow; out/derived/rasuwa/flood2d_calibration.json): B 40, 75, 110, 150 m; V 20 to
90 million m3; Q 10,000 to 50,000 m3/s. Best runs met 1, 4, 6 and 7 of 9 checks. Second grid (normal-flow outflow; flood2d_calibration_fine.json; FLOOD2D_WIDTHS=110,130,150
FLOOD2D_VOLUMES=45,60,75,90 FLOOD2D_PEAKS=40,60,80), most checks met (of 12 runs each):

| B (m) | runs meeting 7 of 9 | best runs (V million m3, Q thousand m3/s) |
|---|---|---|
| 110 | 2 | V 75 Q 80, V 90 Q 80 |
| 130 | 6 | V 60 to 90, Q 60 to 80 |
| 150 | 2 | V 60 Q 60, V 60 Q 80 |

No run meets more than 7. The checks pull against each other. A run that brings the front to Mugling by 13:00 has
a Devghat peak above 7,300 m3/s (the FFD report: about 5,850 m3/s, see events.md). A run with a Devghat peak inside its
window reaches Mugling 13 to 48 minutes late; among those that meet 7 checks, 13 to 21 minutes late. The Malekhu peak also comes close to or after the window end (12:00).
B = 130 m is chosen because most runs meet 7 checks there.

Runs shown in the app (B = 130 m, n = 0.03; `flood2d_rasuwa.py shown`, then `export_flood2d.py` per run):

| Run | V (million m3) | Q (m3/s) | Betrawati front | Galchhi front / peak / rise | Malekhu front / peak | Mugling front | Devghat peak / flow | Checks missed |
|---|---|---|---|---|---|---|---|---|
| lower | 60 | 60,000 | 09:19 | 10:22 / 10:42 / +6.6 m | 11:24 / 11:57 | 13:20 | 16:43 / 6,655 | Mugling front, Galchhi rise |
| central | 75 | 60,000 | 09:19 | 10:20 / 10:42 / +7.4 m | 11:20 / 11:55 | 13:11 | 16:30 / 7,636 | Mugling front, Devghat flow |
| upper | 90 | 80,000 | 09:16 | 10:14 / 10:37 / +8.6 m | 11:11 / 11:47 | 12:57 | 16:11 / 8,797 | Galchhi front (1 min early), Devghat flow |
| reports | | | 09:05-09:30 | 10:15-10:40 / 10:35-11:05 / +7.0 to +10.4 m | 11:10-11:40 / 11:30-12:00 | 11:45-13:00 | 15:15-16:45 / 4,390-7,310 | |

The 2-D runs need 60 to 90 million m3 at Syabrubesi. The 1-D pool behind the bands (411 runs) spans 15 to 148
million m3 (5 to 95 %: 17 to 113, median 35), and its three runs nearest the 5, 50 and 95 % Galchhi peaks have
22, 21 and 45 million m3. So the 2-D runs sit in the upper part of the 1-D range. In 2-D the water also fills side
valleys and flats, and that storage slows and lowers the wave. Their Galchhi peak, 12,800 to 18,900 m3/s across a 100 m band of cells, is above the 1-D band (4,400 to 11,900 m3/s) and
close to ICIMOD's preliminary 17,000 m3/s (4.6). No report gives the volume that passed Syabrubesi, so neither
model pins it down.

The runs are a spread of runs that fit the reports, not a probability band like the 1-D bands. Export
(model/export_flood2d.py): the depth of every cell every 3 minutes, its highest depth and speed and the time of a
0.5 m rise. The app shows depths against its own terrain (the DEM with a 40 m band and the mapped channel burned in),
not against the wider model channel, and none where the water stays below that terrain.

Limits.

- B is a calibrated stand-in for the channel, and a coarse one. Burning a 260 m wide band down to the bed also
  cuts into the valley walls where the valley is narrower than that. Of the 113,066 model cells, 26,188 lie more
  than 1 m below the app ground, 10,025 more than 30 m and 4,696 more than 50 m (99th percentile 83 m). Of the
  47,739 cells wet at base flow, 25,422 (53 %) have their base water level below the app ground. The model gauges
  are the lowest cell within 60 m of each gauge, so the Galchhi stage rise is measured in this trench, not in the
  real section; that check depends on the trench geometry.
- Water only: no debris, sediment, bank erosion or blocked bridges, which made the real flood higher and slower.
- The DSM sees trees, roofs and bridge decks as ground.
- One roughness for the whole valley.

Grade: UNCERTAIN.

## 5. Validation cases

Table of numbers we can test against. Distances along the river must be measured on our own centreline before use.
"Mean front speed" is distance divided by time between reported events; it is our calculation.

| Event | Source process | Water released | Peak discharge and place | Timing and distance | Mean front speed | Grade | Sources |
|-------|----------------|----------------|--------------------------|---------------------|------------------|-------|---------|
| South Lhonak, Sikkim, 3-4 Oct 2023 | 14.7 x 10^6 m3 lateral moraine collapse into lake; tsunami; frontal moraine breach 55 m deep | about 50 x 10^6 m3 (52.3 to 52.8 x 10^6 m3) | modelled 48,500 m3/s water (+10,300 m3/s sediment) at lake outlet; modelled 5,340 m3/s at Chungthang, 67.5 km | collapse 22:12:20 IST (seismic); ITBP camp, 7.12 km, reported about 22:30; Chungthang reported about 00:35 IST | about 6.7 m/s to ITBP; about 7.9 m/s to Chungthang | LIKELY (peaks modelled; times observed) | [27] full text |
| Gongbatongsha, Bhote Koshi, 5 Jul 2016 | slope failure into small moraine lake | 1.1 to 1.7 x 10^5 m3 | modelled 618 m3/s at lake; rose to 4,123 m3/s at Zhangzangbo-Bhotekoshi confluence by bulking | damage to about 40 km downstream; 26 landslides, 11 m mean channel widening | average flow velocity about 5.5 m/s (model) | LIKELY | [34] full text; [35] abstract |
| Seti Khola, 5 May 2012 | rock and ice avalanche from Annapurna IV (22 to 33 x 10^6 m3, secondary) | unknown | 1,000 to 12,300 m3/s in the literature; 8,400 m3/s often quoted; 3,700 m3/s best fits mapped sediment in the Karuwa-Kharapani reach (8.4 km) | Kharapani, about 23 km downstream, reached about 30 min after the failure; city entry about 35 km from Sabche Cirque | about 13 m/s to Kharapani | DISPUTED (peak); LIKELY (timing) | [30] full text |
| Melamchi, 15 Jun 2021 | cascade: glacial lake breach, landslides, valley-fill erosion | unknown | 7,162 m3/s at Nakote (Chen et al. 2024); 4,400 +/- 1,800 m3/s; 2,700 m3/s (ADB) | ADB: wave at about 22 m/s reached headworks in 12 min | about 22 m/s (reported) | DISPUTED | [36] abstract; secondary for others |
| Chamoli, 7 Feb 2021 | about 27 x 10^6 m3 rock and ice avalanche | not a lake outburst | 8,200 to 14,200 m3/s near Raini attributed to Shugar et al. (secondary; others give higher) | failure about 10:21 IST; flow through Tapovan HPP by 10:42 IST | mean about 12 m/s (secondary) | UNCERTAIN | [37] abstract; secondary |
| Rasuwa / Bhote Koshi-Trishuli, 26 Aug 2026 | ice-rock avalanche, temporary blockage (18 to 19 h blockage claimed by one analysis; others read the 08:37 signal as the collapse itself) | unknown; about 20 x 10^6 m3 of "additional water" passed Devghat (DHM preliminary) | about 5,850 m3/s at Devghat (FFD technical report, cited by the RDNA; see events.md); no upstream peak recorded | seismic 08:37; Syafrubesi gauge last value 08:40 (1.62 m), stopped 08:50; Betrawati last value 09:20 (3.55 m), stopped; Galchhi 10:28 (rise to 9 m in 30 min); Malekhu Bazaar 11:50; Mugling 13:00; Kalikhola above danger 14:14, peak 12.3 m; Devghat arrival 15:20, peak 6.57 m at 16:00, back to about 4 m at 18:30 | ICIMOD: Rasuwagadhi 08:40 to Betrawati 09:20, 56 km, gives about 23 m/s (ICIMOD states about 20 m/s); 4 to 6 m/s in the Trishuli valley | times LIKELY (DHM via press); peak SOLID as the official number | ICIMOD page; DHM report via Onlinekhabar and Ratopati (see chronology note) |
| Yigong, Tibet, 10 Jun 2000 (large-dam check) | landslide dam about 55 m high | about 2 x 10^9 m3 impounded | about 1.2 x 10^5 m3/s at Tongmai Bridge, 17 km downstream (another value 5 x 10^4 m3/s in the gorge) | about 10 h of flood flow | not given | LIKELY (peak values conflict) | [29] full text |

How to use the table:

1. Sikkim 2023 is the best timing test: an observed start (seismic), two observed arrivals and a published routed
   hydrograph with n = 0.05 on a 4 m DEM.
2. Rasuwa 2026 is the best long-distance timing test (Syafrubesi to Devghat; we have no published river distance,
   so measure it on our centreline). Use arrival times, not the peak.
3. Seti 2012 and Gongbatongsha 2016 test the sediment-bulking problem. A water-only model will under-predict near
   the source.
4. Do not tune the model to a single disputed peak value.

---

## 6. Uncertainty communication

What hazard scientists do:

- Scenarios: GAPHAZ (2017) [5] recommends three scenarios (small, medium, large), each with a stated likelihood, plus
  an explicit worst case where authorities want one. It asks for the time horizon of each scenario to be stated, and
  for uncertainties to be communicated "in a clear, open, transparent and reproducible way". Seen: full text.
- Probability maps: Chen et al. (2025) [11] run about 100 weighted scenarios per lake and show inundation probability
  maps at 5, 50, 75 and 90 %.
- Example scenarios with explicit limits: the USGS Mount Rainier lahar simulations (2022) state that the simulations
  "do not predict when the next large lahar will occur", and the map caption warns that real lahars may be larger or
  smaller and that arrival times will vary. Seen: USGS news page.
- Agency event pages: ICIMOD's page on the Rasuwa 2026 event uses hedged verbs ("may have", "suggests"), gives the
  instrument behind each time (seismic signal) and reports the disagreement between analyses openly.
- Research on communication: Spiegelhalter et al. (2011) [38] say that the best visual depends on the purpose and the
  audience, and that deep uncertainty is the hardest to show. van der Bles et al. (2019) [39] find that stating
  numeric uncertainty does not necessarily reduce trust in the source.
- Calibrated words: IPCC AR5 guidance (Mastrandrea et al. 2010 [40]) maps words to probabilities: virtually certain
  99-100 %, very likely 90-100 %, likely 66-100 %, about as likely as not 33-66 %, unlikely 0-33 %, very unlikely
  0-10 %.

Recommended display rules for our tool:

1. Show every modelled quantity as a band (5th to 95th percentile) with the median as a thin line. Never show a lone
   number.
2. Plot discharge on a log axis. Put empirical equations as labelled markers next to the band.
3. For arrival time, lead with the earliest plausible arrival (fast end of the band). People need the worst timing.
4. Offer three named scenarios (small, medium, large) for the breach, each with its inputs listed.
5. Use calibrated words only with their numeric meaning, and link to the definition.
6. Repeat on every result screen: "This is a simplified model for learning. It is not a warning system and not an
   official hazard map."
7. Where sources disagree (for example Rasuwa avalanche volume, Seti peak), show the range and name each source.

Suggested wording for non-specialists (ours, based on the patterns above):

- "If a dam like this breaks, the peak flow at the dam could be between X and Y cubic metres per second. The most
  likely value in our model is Z."
- "The front of the flood could reach [place] between T1 and T2 after the breach. It could come sooner."
- "These numbers come from a simplified model. Real floods carry rock and mud and can be larger or smaller."

---

## 7. Recommended minimal model chain

Each step lists the inputs we must obtain and the expected uncertainty. Steps 1 to 4 are precomputed in Python per
site; steps 5 to 7 run in the browser.

1. **Terrain and river geometry.** Inputs: Copernicus GLO-30 DEM, Sentinel-2 imagery, our centreline. Output:
   hydro-conditioned bed profile, cross-section tables every 200 to 500 m, bed slopes. Uncertainty: bed elevation
   +/-5 to 15 m in gorges; slope over 1 km windows +/-20 %.
2. **Source volume (context only).** Inputs: mapped scar area or published volumes. Output: volume range with gamma =
   1.3 to 1.6. Uncertainty: factor 3 to 10; for Rasuwa 2026 the published range already spans about a factor of 5.
   Runout check with H/L = 0.10 to 0.31.
3. **Dam and lake.** Inputs: blockage location, deposit footprint, lake outline on Sentinel-2, DEM. Output: dam crest
   height H_d (scenarios), stage-volume curve V_lake(h), area check against imagery, fill time for a given Q_in.
   Uncertainty: H_d +/-30 to 50 %; lake volume factor about 2 for small lakes.
4. **Stability and timing (labels only).** Inputs: A_b, H_d, V_d. Output: DBI and HDSI class with their regional
   thresholds, plus the global time-to-failure statistics (about 27 to 30 % within a day, about 85 % within a year).
   Uncertainty: indices have low skill; show as a hint.
5. **Breach hydrograph (Monte Carlo, about 1,000 runs).** Inputs: V_lake(h), H_d, inflow Q_in; sampled breach depth
   (0.3 to 1.0 H_d), erosion rate k (log-uniform, 10 to 100 m/h, with a wide case of 1.4 to 360 m/h), breach width
   ratio (0.5 to 3), side slope. Output: Q_p percentiles and hydrographs. Cross-check markers: Peng & Zhang E10 (three
   erodibility classes), Costa & Schuster E4, Froehlich E8 with the Wahl band, critical-flow bound. Uncertainty:
   factor 3 to 10 on Q_p.
6. **Routing.** Inputs: hydrograph ensemble, section tables, n sampled 0.035 to 0.07, base flow. Method:
   variable-parameter Muskingum-Cunge from 1 to 2 km below the dam; stage from the section tables. Optional bulking
   scenario: volume x1.0 to x1.5 in reaches steeper than 0.10. Output: Q(x,t), stage(x,t), arrival of front and peak.
   Uncertainty: arrival time +/-20 to 50 %; downstream peak factor 2 to 3; stage +/- several metres.
7. **Display.** Bands, scenarios, source labels and the disclaimer from Section 6. Validate steps 5 and 6 on Sikkim
   2023 (timing to Chungthang) and Rasuwa 2026 (arrival times down to Devghat) before any site is shown.

Open items before implementation:

- Read the original tables of Larsen et al. 2010 (alpha values), Walder & O'Connor 1997 (landslide-dam regression and
  envelope), Froehlich 2022 (landslide-dam equation and prediction limits), Corominas 1996 (H/L coefficients),
  Ermini & Casagli 2003 (units of A_b) and Tacconi Stefanelli 2016 (HDSI formula).
- Get the official NDRRMA or DHM text for the Rasuwa 2026 Devghat peak.
- Measure the river distances for the Rasuwa 2026 stations on our own centreline.

---

## Sources

1. Larsen, I.J., Montgomery, D.R., Korup, O. (2010). Landslide erosion controlled by hillslope material. Nature
   Geoscience 3, 247-251. doi:10.1038/ngeo776. Seen: abstract.
2. Guzzetti, F., Ardizzone, F., Cardinali, M., Rossi, M., Valigi, D. (2009). Landslide volumes and landslide
   mobilization rates in Umbria, central Italy. Earth and Planetary Science Letters 279, 222-229.
   doi:10.1016/j.epsl.2009.01.005. Seen: secondary.
3. Scheidegger, A.E. (1973). On the prediction of the reach and velocity of catastrophic landslides. Rock Mechanics
   5, 231-236. doi:10.1007/BF01301796. Seen: secondary.
4. Corominas, J. (1996). The angle of reach as a mobility index for small and large landslides. Canadian Geotechnical
   Journal 33, 260-271. doi:10.1139/t96-005. Seen: abstract.
5. GAPHAZ (2017). Assessment of glacier and permafrost hazards in mountain regions: technical guidance document.
   Prepared by Allen, S., Frey, H., Huggel, C. et al. Standing Group on Glacier and Permafrost Hazards in Mountains
   (IACS/IPA), Zurich and Lima. No DOI. Seen: full text.
6. Huggel, C., Haeberli, W., Kaab, A., Bieri, D., Richardson, S. (2004). An assessment procedure for glacial hazards
   in the Swiss Alps. Canadian Geotechnical Journal 41, 1068-1083. doi:10.1139/t04-053. Seen: via [5].
7. Schneider, D., Huggel, C., Haeberli, W., Kaitna, R. (2011). Unraveling driving factors for large rock-ice
   avalanche mobility. Earth Surface Processes and Landforms 36, 1948-1966. doi:10.1002/esp.2218. Seen: via [5].
8. Chen, R., Chen, J., Shi, L., Cui, Z., Chen, S. (2023). Geomorphological characteristics and the kinematic process
   of the Ganheba rock-ice avalanche in Yulong Mountain, China. Frontiers in Earth Science 11.
   doi:10.3389/feart.2023.1017207. Seen: full text (cites Sosio 2015).
9. Iverson, R.M., Schilling, S.P., Vallance, J.W. (1998). Objective delineation of lahar-inundation hazard zones.
   GSA Bulletin 110, 972-984. doi:10.1130/0016-7606(1998)110<0972:ODOLIH>2.3.CO;2. Seen: secondary.
10. Griswold, J.P., Iverson, R.M. (2008, ver. 1.1 2014). Mobility statistics and automated hazard mapping for debris
    flows and rock avalanches. USGS Scientific Investigations Report 2007-5276. doi:10.3133/sir20075276. Seen:
    secondary summary.
11. Chen, H., Liang, Q., Zhao, J., Maharjan, S.B. (2025). Assessing national exposure to and impact of glacial lake
    outburst floods considering uncertainty under data sparsity. Hydrology and Earth System Sciences 29, 733-752.
    doi:10.5194/hess-29-733-2025. Seen: full text (summary).
12. O'Connor, J.E., Clague, J.J., Walder, J.S., Manville, V., Beebee, R.A. (2022). Outburst floods. In: Shroder,
    J.F. (Ed.), Treatise on Geomorphology, 2nd ed., vol. 6, 765-819. Elsevier.
    doi:10.1016/B978-0-12-818234-5.00007-9. Seen: full text (author copy).
13. Ermini, L., Casagli, N. (2003). Prediction of the behaviour of landslide dams using a geomorphological
    dimensionless index. Earth Surface Processes and Landforms 28, 31-47. doi:10.1002/esp.424. Seen: secondary.
14. Korup, O. (2004). Geomorphometric characteristics of New Zealand landslide dams. Engineering Geology 73, 13-35.
    doi:10.1016/j.enggeo.2003.11.003. Seen: secondary.
15. Tacconi Stefanelli, C., Segoni, S., Casagli, N., Catani, F. (2016). Geomorphic indexing of landslide dams
    evolution. Engineering Geology 208, 1-10. doi:10.1016/j.enggeo.2016.04.024. Seen: secondary.
16. Costa, J.E., Schuster, R.L. (1988). The formation and failure of natural dams. GSA Bulletin 100, 1054-1068.
    doi:10.1130/0016-7606(1988)100<1054:TFAFON>2.3.CO;2. Seen: secondary.
17. Fan, X., Dufresne, A., Siva Subramanian, S., et al. (2020). The formation and impact of landslide dams: state of
    the art. Earth-Science Reviews 203, 103116. doi:10.1016/j.earscirev.2020.103116. Seen: abstract and [12].
18. Shafieiganjeh, R., Schneider-Muntau, B., Ostermann, M., Gems, B. (2025). Estimation of dam breach parameters and
    simulation of flood propagation due to overtopping failure in long-existing landslide dams. Natural Hazards 121,
    21405-21439. doi:10.1007/s11069-025-07628-y. Seen: full text (open access). Source of equations E1-E7, E9, E10.
19. Froehlich, D.C. (1995). Peak outflow from breached embankment dam. Journal of Water Resources Planning and
    Management 121(1), 90-97. doi:10.1061/(ASCE)0733-9496(1995)121:1(90). Seen: equation in [23].
20. Froehlich, D.C. (2022). Peak flood discharge from a landslide dam outburst. Natural Hazards Review 23(2).
    doi:10.1061/(ASCE)NH.1527-6996.0000545. Seen: abstract.
21. Froehlich, D.C. (2016). Predicting peak discharge from gradually breached embankment dam. Journal of Hydrologic
    Engineering 21(11). doi:10.1061/(ASCE)HE.1943-5584.0001424. Seen: abstract.
22. Walder, J.S., O'Connor, J.E. (1997). Methods for predicting peak discharge of floods caused by failure of natural
    and constructed earthen dams. Water Resources Research 33(10), 2337-2348. doi:10.1029/97WR01616. Seen: abstract.
23. Wahl, T.L. (2004). Uncertainty of predictions of embankment dam breach parameters. Journal of Hydraulic
    Engineering 130(5), 389-397. doi:10.1061/(ASCE)0733-9429(2004)130:5(389). Seen: full text (USBR copy).
24. Veh, G., Korup, O., Walz, A. (2020). Hazard from Himalayan glacier lake outburst floods. PNAS 117(2), 907-912.
    doi:10.1073/pnas.1914898117. Seen: via [11] and [12].
25. Ponce, V.M., Taher-shamsi, A., Shetty, A.V. (2003). Dam-breach flood wave propagation using dimensionless
    parameters. Journal of Hydraulic Engineering 129(10), 777-782. doi:10.1061/(ASCE)0733-9429(2003)129:10(777).
    Seen: abstract.
26. Cunge, J.A. (1969). On the subject of a flood propagation computation method (Muskingum method). Journal of
    Hydraulic Research 7(2), 205-230. doi:10.1080/00221686909500264. Seen: metadata only (standard method).
27. Sattar, A., Cook, K.L., Rai, S.K., et al. (2025). The Sikkim flood of October 2023: drivers, causes and impacts of
    a multihazard cascade. Science 387(6740), eads2659. doi:10.1126/science.ads2659. Seen: full text (accepted
    version, White Rose, CC BY).
28. Jarrett, R.D. (1984). Hydraulics of high-gradient streams. Journal of Hydraulic Engineering 110(11), 1519-1539.
    doi:10.1061/(ASCE)0733-9429(1984)110:11(1519). Seen: secondary and abstract.
29. Dong, X., Wang, X., Yang, L., et al. (2024). Quantitative assessment of the erosion and deposition effects of
    landslide-dam outburst flood, Eastern Himalaya. Scientific Reports 14, 7038. doi:10.1038/s41598-024-57894-2.
    Seen: full text (summary).
30. Fischer, M., Brettin, J., Roessner, S., Walz, A., Fort, M., Korup, O. (2022). Rare flood scenarios for a rapidly
    growing high-mountain city: Pokhara, Nepal. Natural Hazards and Earth System Sciences 22, 3105-3123.
    doi:10.5194/nhess-22-3105-2022. Seen: full text.
31. Ferguson, R. (2007). Flow resistance equations for gravel- and boulder-bed streams. Water Resources Research 43,
    W05427. doi:10.1029/2006WR005422. Seen: abstract.
32. Hawker, L., Bates, P., Neal, J., Rougier, J. (2018). Perspectives on digital elevation model (DEM) simulation for
    flood modeling in the absence of a high-accuracy open access global DEM. Frontiers in Earth Science 6.
    doi:10.3389/feart.2018.00233. Seen: metadata only.
33. Watson, C.S., Carrivick, J., Quincey, D. (2015). An improved method to represent DEM uncertainty in glacial lake
    outburst flood propagation using stochastic simulations. Journal of Hydrology 529, 1373-1389.
    doi:10.1016/j.jhydrol.2015.08.046. Seen: abstract.
34. Sattar, A., Haritashya, U.K., Kargel, J.S., et al. (2022). Transition of a small Himalayan glacier lake outburst
    flood to a giant transborder flood and debris flow. Scientific Reports 12, 12421. doi:10.1038/s41598-022-16337-6.
    Seen: full text.
35. Cook, K.L., Andermann, C., Gimbert, F., Adhikari, B.R., Hovius, N. (2018). Glacial lake outburst floods as drivers
    of fluvial erosion in the Himalaya. Science 362, 53-57. doi:10.1126/science.aat4981. Seen: abstract (via
    secondary).
36. Chen, C.-M., Hollingsworth, J., Clark, M.K., et al. (2024). Erosional cascade during the 2021 Melamchi flood.
    Nature Geoscience. doi:10.1038/s41561-024-01596-x. Seen: abstract (NSF PAR record).
37. Shugar, D.H., Jacquemart, M., Shean, D., et al. (2021). A massive rock and ice avalanche caused the 2021 disaster
    at Chamoli, Indian Himalaya. Science 373, 300-306. doi:10.1126/science.abh4455. Seen: abstract and secondary.
38. Spiegelhalter, D., Pearson, M., Short, I. (2011). Visualizing uncertainty about the future. Science 333,
    1393-1400. doi:10.1126/science.1191181. Seen: abstract.
39. van der Bles, A.M., van der Linden, S., Freeman, A.L.J., et al. (2019). Communicating uncertainty about facts,
    numbers and science. Royal Society Open Science 6, 181870. doi:10.1098/rsos.181870. Seen: abstract.
40. Mastrandrea, M.D., et al. (2010). Guidance note for lead authors of the IPCC Fifth Assessment Report on consistent
    treatment of uncertainties. IPCC. No DOI. Seen: not re-read for this file (standard reference; verify wording).
41. Costa, J.E. (1985). Floods from dam failures. USGS Open-File Report 85-560. doi:10.3133/ofr85560. Seen: equations
    via [18] and [23].
42. ICIMOD (2026). Kyirong-Rasuwa flood 2026 (Nepal-China border). https://www.icimod.org/kyirong-rasuwa-flood-2026-nepal-china-border/
    Accessed 2026-10-17. Agency web page.
43. Department of Hydrology and Meteorology, Flood Forecasting Division (2026). Preliminary technical report on the
    Bhotekoshi-Trishuli flood, as reported by Onlinekhabar (27 Aug 2026,
    https://english.onlinekhabar.com/technical-report-rasuwa-flood.html) and Ratopati
    (https://english.ratopati.com/story/76572/). Original report not seen.
44. NDRRMA (2026). Rasuwa flood situation report (Devghat peak about 5,850 m3/s, as cited in search results; the same value is in the FFD report, see events.md).
    https://ndrrma.gov.np/mediafiles/rasuwa/Rasuwa_Flood_SitRep_Temp_ENG_01_01092026.pdf. Text could not be read
    (2026-10-17); verify.
45. USGS (2022). USGS offers emergency managers a new tool to assess lahar hazards at Mount Rainier (news, 29 Apr
    2022; report OFR 2021-1118 by George, Iverson, Cannon).
    https://www.usgs.gov/news/featured-story/usgs-offers-emergency-managers-a-new-tool-assess-lahar-hazards-mount-rainier
    Seen: web page.
46. Asian Development Bank (2024). Mapping hazards in Nepal's Melamchi river catchment.
    https://www.adb.org/sites/default/files/publication/927371/mapping-hazards-nepal-melamchi-river.pdf. Seen: search
    snippet only.
47. Chilime Hydropower Company. Chumchet Syar Khola Hydroelectric Project (49-page project presentation).
    Desk study: catchment 531 km2, mean annual flow 24.49 m3/s, 100-year flood 1,582 m3/s (p. 10). Detailed study:
    headworks catchment 565 to 574 km2 (p. 23, 31), adopted monthly flows with October 20.92 m3/s and an average
    of 22.16 m3/s (p. 25), 100-year flood 486 m3/s at the headworks and 529 m3/s at the powerhouse (p. 31).
    https://www.chilime.com.np/media/publications/Chumchet_Syar_Khola_Hydroelectric_Project.pdf. Seen: full PDF.
    No licence stated: cited as facts only.
48. Harten, A., Lax, P.D., van Leer, B. (1983). On upstream differencing and Godunov-type schemes for hyperbolic
    conservation laws. SIAM Review 25(1), 35-61. doi:10.1137/1025002. Seen: Crossref record checked; text not re-read
    (standard reference).
49. Audusse, E., Bouchut, F., Bristeau, M.-O., Klein, R., Perthame, B. (2004). A fast and stable well-balanced scheme
    with hydrostatic reconstruction for shallow water flows. SIAM Journal on Scientific Computing 25(6), 2050-2065.
    doi:10.1137/S1064827503431090. Seen: Crossref record checked; text not re-read (standard reference).
50. Ritter, A. (1892). Die Fortpflanzung der Wasserwellen. Zeitschrift des Vereines Deutscher Ingenieure 36(33),
    947-954. Seen: citation and solution as given in the secondary literature; original not seen.
