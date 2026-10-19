# Himalaya valley hazard explorer: brief

Started 2026-10-17.

## Goal

An interactive, scientific, visually rich browser tool about cascading hazards in Himalayan valleys: a landslide or
ice-rock avalanche blocks a river, a lake fills behind the debris, the dam breaches, and a flood wave runs down the
valley to villages, bridges and hydropower plants.

1. Reconstruct two 2026 events in Nepal from open data and published reports:
   - Budhi Gandaki, Gorkha district, 11 October 2026: a snow, ice and debris failure high in the Ungdilung Khola
     (USGS landslide signal 04:23:58 NPT) and repeated blockage at the Ungdilung-Syar confluence; first called a
     landslide dam, later an ice-rock avalanche (NDRRMA). Mechanism still open: see research/events.md.
   - Bhote Koshi / Trishuli, Rasuwa district, 26 August 2026: an ice-rock avalanche on the Langtang Himal side
     (USGS landslide signal 08:37:10 NPT, source height estimates 5,000-5,600 m), about 100 km runout. Whether a
     temporary dam held for hours before the flood (one rapid analysis says 18-19 h) is DISPUTED: USGS, CLaSH and
     ICIMOD describe the collapse as making the flood directly. See research/events.md.
2. Let a viewer explore what a breach at a given point would do downstream: peak discharge range, wave arrival times,
   reach of the flood along the river, exposed settlements and infrastructure.
3. Later: look at other valleys that published science names as dangerous.

## Rules

- Science first. Every number on screen has a source, a date and a confidence grade (SOLID, LIKELY, UNCERTAIN,
  DISPUTED). Where sources disagree, the tool shows the range and names the sources.
- Models are simplified and say so. Every result carries an uncertainty band. The tool states plainly that it is not a
  warning system and not an official hazard map.
- Data licences: public domain, CC0, CC BY, ODbL (with attribution) or licences that allow free reuse with
  attribution (Copernicus Sentinel and DEM). No NC, ND or SA image or data products. Check every licence on its
  source page and record it in research/data_sources.md.
- No accounts are created and no paid APIs are used. Large downloads are listed with name, source and size.
- Respect: people died and are missing. Calm, factual language; no dramatic framing.
- Repository text is in English.

## Layout

- research/: event chronology, data sources, methods, next-hazard literature, with sources.
- data/: scripts that fetch and prepare data (outputs go to out/, not committed).
- model/: breach and routing model with tests.
- app/: the browser tool.
