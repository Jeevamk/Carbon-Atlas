"""
Turn Our World in Data's CO2 dataset into a compact JSON file for the app.

Usage:
    curl -L -o raw/owid-co2-data.csv https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv
    curl -L -o raw/continents.csv "https://raw.githubusercontent.com/owid/owid-datasets/master/datasets/Countries%20Continents/Countries%20Continents.csv"
    python scripts/prepare_data.py
"""
import csv, json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
OUT = ROOT / "public" / "data" / "co2.json"
START_YEAR = 1950
# Names the continent file spells differently or leaves out.
ALIASES = {"East Timor": "Asia", "Faroe Islands": "Europe"}

# Columns kept per country-year, in this order.
FIELDS = ["population", "gdp", "co2", "co2_per_capita", "cumulative_co2",
          "coal_co2", "oil_co2", "gas_co2", "cement_co2", "share_global_co2"]

def num(v, digits):
    if v in ("", None):
        return None
    x = float(v)
    if math.isnan(x):
        return None
    return round(x, digits) if digits else round(x)

def main():
    continents = {}
    with open(RAW / "continents.csv", newline="") as f:
        for row in csv.DictReader(f):
            continents[row["Entity"]] = row["Countries Continents"]

    countries, rows = {}, []
    with open(RAW / "owid-co2-data.csv", newline="") as f:
        for r in csv.DictReader(f):
            iso = r["iso_code"]
            if len(iso) != 3 or iso.startswith("OWID"):
                continue  # skip aggregates like "World" or "Europe"
            year = int(r["year"])
            if year < START_YEAR:
                continue
            cont = continents.get(r["country"]) or ALIASES.get(r["country"])
            if not cont:
                continue
            countries[iso] = {"name": r["country"], "continent": cont}
            digits = {"population": 0, "gdp": 0, "share_global_co2": 3}
            values = [num(r[k], digits.get(k, 3)) for k in FIELDS]
            if values[2] is None:  # no CO2 figure, nothing to show
                continue
            rows.append([iso, year] + values)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "Our World in Data, CO2 and Greenhouse Gas Emissions (github.com/owid/co2-data)",
        "fields": ["iso", "year"] + FIELDS,
        "countries": countries,
        "rows": rows,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    years = sorted({r[1] for r in rows})
    print(f"{len(countries)} countries, {len(rows)} rows, {years[0]}-{years[-1]}, "
          f"{OUT.stat().st_size/1024:.0f} KB -> {OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
