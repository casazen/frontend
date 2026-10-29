# Schematic maps of the public site (DB-19a, DB-19b)

The public site of a host (`/book/:orgSlug/...`) shows maps that **we draw ourselves**: SVG strings made by pure TypeScript
functions. There is no tile provider, no map library, no API key and no request to a third party, and a map never shows an exact
position (the server publishes coordinates rounded to two decimals, about 1 km). The maps are a help: whatever a map shows is
also in the text of the page (the list of houses, the list of points of interest).

```
src/features/site-maps/
  engine/            pure modules: no DOM, no state except a small cache, same input = same drawing
    numeric.ts       random generators, noise, number and text helpers
    geometry.ts      curves, path writers, polygon toolbox
    style.ts         fonts and colours of the labels, the counter of the SVG ids (resetMapIds)
    local/           neighbourhood maps: generators (coast, historic centre, countryside), drawing, localMapSvg, localPlace
  mount-svg.ts       puts the SVG text in a page element as real SVG nodes (parsed as XML, nothing can run)
  index.ts           the public API
```

`/dev/maps` (dev server only, not in the build) shows every map for the review by image.

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

- **Privacy:** the engine never receives an address, an interior or exact coordinates; points of interest have no coordinates,
  only a bearing and a distance.
- **No network:** nothing in the engine or in the SVG it writes fetches anything.
- **Deterministic:** the same input gives the same SVG, except the counter of the ids in the `defs`; `resetMapIds()` zeroes the
  counter (snapshots).
