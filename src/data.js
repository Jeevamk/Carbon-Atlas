import * as d3 from 'd3';

/**
 * Loads public/data/co2.json (built by scripts/prepare_data.py) and indexes it.
 * A standalone build can inline the same payload as window.__CO2_DATA__.
 */
export async function loadData() {
  let raw = window.__CO2_DATA__;
  if (!raw) {
    const res = await fetch(`${import.meta.env.BASE_URL}data/co2.json`);
    if (!res.ok) throw new Error(`Data request failed with status ${res.status}`);
    raw = await res.json();
  }

  const countries = new Map(Object.entries(raw.countries));
  const fields = raw.fields;

  const records = raw.rows.map((row) => {
    const d = {};
    fields.forEach((key, i) => (d[key] = row[i]));
    const meta = countries.get(d.iso);
    d.name = meta.name;
    d.continent = meta.continent;
    d.gdpPc = d.gdp && d.population ? d.gdp / d.population : null;
    return d;
  });

  const byYear = d3.group(records, (d) => d.year);
  const byCountry = d3.group(records, (d) => d.iso);
  for (const rows of byCountry.values()) rows.sort((a, b) => a.year - b.year);

  const [firstYear, lastYear] = d3.extent(records, (d) => d.year);

  // GDP stops a few years before emissions do; find the last year with broad coverage.
  const gdpCoverage = d3.rollup(records.filter((d) => d.gdpPc), (v) => v.length, (d) => d.year);
  const lastGdpYear = d3.max([...gdpCoverage].filter(([, n]) => n >= 100), ([y]) => y) ?? lastYear;

  return { countries, records, byYear, byCountry, firstYear, lastYear, lastGdpYear, source: raw.source };
}
