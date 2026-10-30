# Schematic maps of the public site (DB-19a, DB-19b)

The public site of a host (`/book/:orgSlug/...`) shows maps that **we draw ourselves**: SVG strings made by pure TypeScript
functions. There is no tile provider, no map library, no API key and no request to a third party, and a map never shows an exact
position (the server publishes coordinates rounded to two decimals, about 1 km). The maps are a help: whatever a map shows is
also in the text of the page (the list of houses, the list of points of interest).

```
src/features/site-maps/
  engine/            pure modules: no DOM, no state except the data that have been loaded, same input = same drawing
    numeric.ts       random generators, noise, number and text helpers
    geometry.ts      curves, path writers, polygon toolbox
    style.ts         fonts and colours of the labels, the counter of the SVG ids (resetMapIds)
    view.ts          views (centre, width in km, aspect), zoom, pan, projection to percent of the frame, the privacy guard
    snap.ts          snapToLand: a position rounded into the sea goes back to the shore
    local/           neighbourhood maps: generators (coast, historic centre, countryside), drawing, localMapSvg, localPlace
    region/          regional maps: the data model, the registry of what has been loaded, regionMapSvg
  data/
    italy.ts         the national base (generated, see below)
    puglia.ts        detail of Puglia of the prototype: towns, roads, railways, built-up areas, tints
    puglia-handmade-coast.ts   the old hand-made coast, only for the review page
  load.ts            loads the data on demand (loadRegionData, regionsForView)
  mount-svg.ts       puts the SVG text in a page element as real SVG nodes (parsed as XML, nothing can run)
  index.ts           the public API
```

`/dev/maps` (dev server only, not in the build) shows every map for the review by image.

## Regional maps

`regionMapSvg(view, { width, labels, highlight })` draws the background of a map: sea, land, coast, lakes, the dashed borders
between regions, towns with their names, and, close up and where a detail pack covers the area, built-up areas, roads, railways
and fields. It draws **no pins**: the pins are HTML put over it with `projectPoint(lat, lon, view)`, in percent of a box with the
aspect ratio of the view. Everything is already projected into the frame (viewBox = width × width / aspect), so strokes, dots and
text keep their size when zooming: pass as `width` the real width the map is shown at.

A view is `{ lat, lon, spanKm, aspect }`: the centre, the width of the frame in km and the ratio width over height. `fitView`
fits one to the pins with a margin, `zoomView` and `panView` move it (the projection is equirectangular with a fixed cos(40.8°), so
zoom and pan are linear and exact; the maps are schematic and no distance is ever read from them).

`labels`: `auto` (levels of detail and collisions: capitals always, the other towns as one gets closer), `major`, `all`, `none`.
`highlight` names towns to emphasise. `level` (0, 1, 2) forces a level of detail: it is for the review of the data.

### Data and levels of detail

The national base is **one file**, `data/italy.ts`, with three levels of detail of the same geometry, so the coast of a map is
always the coast of the base and nothing has to «match»:

| level | tolerance | units | used when the frame is about | content |
|---|---|---|---|---|
| 0 | 2 km | 1/100° (≈ 1 km) | wide (the whole country) | land and neighbouring lands, outline of Italy, lakes ≥ 100 km², region borders |
| 1 | 0.7 km | 1/100° (≈ 1 km) | a macro-region | islands ≥ 6 km², lakes ≥ 30 km² |
| 2 | 0.25 km | 1/1000° (≈ 100 m) | a few tens of km | islands ≥ 0.8 km², lakes ≥ 4 km² |

The level is the coarsest one whose simplification stays within about 2 px at the scale of the drawing. Near the frame, at the
finest scales, the corners of the coast are rounded with a Catmull-Rom curve. The coordinates of the level 2 have three decimals
and not two: with two, the coast would be made of steps of about 1 km, which at the zooms of a house page (12 to 60 km) are
80 to 20 px; the privacy of the houses has nothing to do with the coast, only the positions of the pins are rounded to two
decimals.

Sizes (production build, minified, gzip): engine **19.6 KB**; national base **30.5 KB** (levels 4.6 + 7.7 + 16.4 KB); detail pack of
Puglia **3.1 KB**. The tool refuses to write a base over 80 KB. Everything is loaded with `import()` by `loadRegionData`, only by
the pages that show a map. If one day a level outgrows its budget, the remedy is to split the file by macro-region (the loader
already takes a region).

**Detail packs** (`DetailPack` in `engine/region/model.ts`) add what the base does not have: towns of the second and third level,
the size of the built-up areas, roads, railways, names of territories, tints. Puglia has one, taken from the approved prototype;
its coast is **not** in it (the coast comes from the base): the old hand-made coast is kept in `puglia-handmade-coast.ts` and
drawn in magenta by the review page, to see how far it was from the real one (median 0.95 km, 90 % within 2.9 km).

### Regenerating the base

```
node tools/maps/build-italy.mjs <folder with the Natural Earth zips> [src/features/site-maps/data/italy.ts]
```

A development tool: it is not run by the build nor by the CI, and the raw files are never committed. The folder holds the zip
files (or the unzipped shapefiles) of Natural Earth 1:10m: `ne_10m_land`, `ne_10m_admin_0_countries`,
`ne_10m_admin_1_states_provinces`, `ne_10m_populated_places`, `ne_10m_lakes` and `ne_10m_lakes_europe`, from
https://www.naturalearthdata.com/downloads/. The tool reads them as data (a small shapefile reader of its own, no dependency),
keeps what is near Italy, simplifies with Douglas-Peucker at the three levels, quantises, codes the coordinates as differences and
writes the module. The region borders are the edges that two provinces of different regions share; the point where the name of a
region is written is the point of the region farthest from its edges. The version of every layer is read from its
`VERSION.txt` and written in the `source` field of the file.

The current file was made from: land, countries and states and provinces 5.1.1; populated places 5.1.2; lakes and lakes Europe
5.0.0 (the files downloaded on 30 October 2026 from `naturalearth.s3.amazonaws.com`).

### Licence and credits

Natural Earth is in the **public domain** (no restriction on use, no attribution required:
https://www.naturalearthdata.com/about/terms-of-use/). OpenStreetMap is not used (its licence, ODbL, would oblige us to
attribute and share). Credit line, ready for the footer of the pages that show a map: **«Mappe schematiche: dati Natural Earth»**
(see also `THIRD-PARTY.md`).

## Pins and privacy

- `publicPoint({ lat, lon })` is the guard at the door of the maps for the position of a house: two decimals at most. More decimals
  mean that an exact position got here by mistake, so in development and in tests it **throws**; in production it rounds and
  logs a warning without the numbers. `fitView` and `snapToLand` use it.
- `snapToLand({ lat, lon }, { maxKm = 1.5 })` moves a position that the rounding put in the sea (or in a lake) to the nearest
  shore, a little inside, and leaves it alone if no shore is that near. It works on the finest level whatever the view, so a pin
  does not jump when the map is zoomed.
- The engine never receives an address, an interior or exact coordinates.

## Neighbourhood maps

`localMapSvg({ kind, seed, width, labels })` draws a stylised 4:3 map of the area around a house; `kind` is `country`, `coast` or
`historic`, `seed` is any stable text (the slug of the house). The map is a **scheme generated from the seed, not the real
streets**: the page that shows it must say so («schema della zona, non una mappa stradale»). The house is at 50 %, 50 %.

`localPlace(spec, { bearingDeg, distM })` returns where a point of interest («east, 400 m») goes, in percent of the frame: always
on land and, when possible, on a street. The bearing is a compass bearing (0 = north, 90 = east); `spec.spanM` is the width of
the map in metres (1,500 by default).

On a `coast` map the sea is east, as in the approved prototype. `seaBearingDeg` (a compass bearing, 90 by default) turns the
drawing so that the sea is in another direction: the caller takes it from the direction of the «beach» point of interest of the
house, so that a house on the Tyrrhenian does not see the sea on the east. With the default the output is byte for byte the one
of the prototype (`redesign/assets/site-maps.js`).

The SVG is `aria-hidden` and `focusable="false"`; the only text in it is the labels the caller passes (escaped).

## Rules

- **Privacy:** see above; points of interest have no coordinates, only a bearing and a distance.
- **No network:** nothing in the engine, in the data or in the SVG fetches anything; the data are part of the build.
- **Deterministic:** the same input gives the same SVG, except the counter of the ids in the `defs`; `resetMapIds()` zeroes the
  counter (snapshots).
