# Third-party data of the schematic maps

| What | Source | Licence | Used for |
|---|---|---|---|
| Natural Earth 1:10m: land, admin 0 countries, admin 1 states and provinces (5.1.1), populated places (5.1.2), lakes and lakes Europe (5.0.0) | https://www.naturalearthdata.com (files from `naturalearth.s3.amazonaws.com`, downloaded on 30 October 2026) | Public domain: https://www.naturalearthdata.com/about/terms-of-use/ | Coast, islands, lakes, borders between regions and names of the towns in `src/features/site-maps/data/italy.ts` (simplified and re-coded by `tools/maps/build-italy.mjs`) |

Credit line for the footer of the pages that show a map (not required by the licence, but proper): «Mappe schematiche: dati Natural Earth».

Not used: OpenStreetMap (ODbL: attribution and share-alike of the derived data), tile or map services of any provider.
The raw Natural Earth files are not in the repository: only the simplified data generated from them.
