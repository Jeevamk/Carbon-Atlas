# Carbon Atlas

*Carbon, country by country.*

An interactive D3 explorer of fossil CO₂ emissions for every country from 1950 to 2025, built with vanilla JavaScript, D3 v7 and Vite.

## What it does

Three linked views share one year slider, one set of continent filters and one comparison list.

**Wealth and emissions** is a Gapminder-style bubble chart: GDP per person against CO₂ per person, with circle area showing population. Press play to watch 70 years of development unfold. A log/linear toggle animates the y axis.

**Biggest emitters** is a ranking of the top 15 countries by total, per-person, cumulative or share-of-world CO₂. Bars slide into their new order as the year changes, and the values count up and down instead of snapping.

**Country trends** draws a line for each compared country. New lines draw themselves in, a marker follows the year slider, and hovering shows exact values for any year. Click the chart to jump the slider to that year.

Click any circle or bar to add that country to the comparison (up to 6), or search for it in the side panel. Alt/Option-click a continent to show only that continent. Press Space to play or pause.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/, deployable to GitHub Pages, Netlify or Vercel
npm run build:standalone   # also writes dist/standalone.html with data and code inlined
```

The processed dataset is already in `public/data/co2.json`. To refresh it from the source:

```bash
mkdir -p raw
curl -L -o raw/owid-co2-data.csv https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv
curl -L -o raw/continents.csv "https://raw.githubusercontent.com/owid/owid-datasets/master/datasets/Countries%20Continents/Countries%20Continents.csv"
npm run data
```

## Project structure

```
index.html                 Page shell and controls
src/
  main.js                  State, controls, playback, hash routing (#wealth, #ranking, #trends)
  data.js                  Loads co2.json and indexes it by year and by country
  config.js                Metrics, continents, view descriptions
  format.js                Number formatting (Mt/Gt, tonnes, %, people)
  tooltip.js               Shared tooltip
  charts/
    bubble.js              Bubble chart (log scales, enter/update/exit joins)
    bars.js                Ranked bar chart (keyed reordering, textTween counters)
    trends.js              Line chart (path draw-in, label collision avoidance)
  style.css                Theme tokens with light and dark mode
public/data/co2.json       Compact dataset (generated)
scripts/
  prepare_data.py          CSV → compact JSON
  build-standalone.mjs     Inlines the build into one HTML file
```

## D3 techniques worth looking at

Every chart follows the same pattern: a module creates its SVG once, then exposes `update(state, duration)`. Calling it with a new state runs a keyed data join (`selection.join(enter, update, exit)`) inside one named transition, so all moving parts stay in sync. While playing, transitions use linear easing with a duration equal to the step interval, which makes the motion continuous rather than stop-start.

Other things to explore in the code: fixed scale domains across all years so movement is meaningful (`bubble.js`), `textTween` for animated numbers (`bars.js`), `stroke-dashoffset` for line drawing and a two-pass nudge for end labels (`trends.js`), a `ResizeObserver` that re-renders on layout changes, and `prefers-reduced-motion` support that turns every transition off.

## Ideas for extending it

- A world map view with `d3-geo` and a choropleth that shares the year slider
- A stacked area chart breaking a country’s emissions down by coal, oil, gas and cement (the fields are already in the dataset)
- Consumption-based emissions to show the effect of trade
- Shareable URLs that carry the year, metric and compared countries

## Data

[Our World in Data, CO₂ and Greenhouse Gas Emissions](https://github.com/owid/co2-data), licensed CC BY 4.0. Emissions are territorial fossil and industry CO₂ and exclude land use. GDP comes from the Maddison Project Database and ends a few years earlier than the emissions series, so the bubble chart stops at the last year with GDP for most countries.
