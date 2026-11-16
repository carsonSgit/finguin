# Bklit chart source

Source: https://ui.bklit.com/r/area-chart.json and https://ui.bklit.com/r/bar-chart.json, installed from the official registry on 2026-11-09 using `shadcn add @bklit/area-chart @bklit/bar-chart`. Upstream: https://github.com/bklit/bklit-ui. See `LICENSE` and the retained pattern licence under `src/charts/patterns`.

The registry installs shared chart modules along with both requested chart types. Preserve that generated source as a vendor unit; application code imports only the area, bar, grid, axis and tooltip modules it uses. Vite removes unused exports from production output.

The source is isolated as the Bun workspace package `@finguin/bklit`. It compiles with TypeScript strict mode using the upstream-compatible options. Finguin's additional `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` checks remain enabled for application code. Generated `dist` files are ignored.

Local change: imports of `@/lib/utils` use the equivalent relative path to this package's `src/lib/utils.ts`. Styling is supplied by `src/styles/bklit.css` in the application and mapped to Quiet Precision tokens.

To update, install the same two registry entries into a temporary shadcn project, replace this package's `src/charts`, `src/shimmering-text.tsx` and utility source, and rewrite that utility alias to a relative import. Review upstream changes before replacement. Run the root build, accounting tests and browser chart interaction checks after updating. Do not run registry overwrite directly against application components.
