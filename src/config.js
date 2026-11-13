import { fmtTonnes, fmtPerPerson, fmtShare } from './format.js';

export const CONTINENTS = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania'];

/** CSS class that carries a continent's colour (see style.css). */
export const continentClass = (name) => 'c-' + name.toLowerCase().replace(/\s+/g, '-');

export const MAX_PICKED = 6;
export const SERIES_COUNT = 6; // .s0 … .s5 in style.css

/** Per-person rankings skip micro-states so the list stays meaningful. */
export const PER_PERSON_MIN_POP = 1_000_000;

export const METRICS = {
  co2: {
    label: 'Total CO₂',
    inline: 'total CO₂',
    axis: 'CO₂ emitted, million tonnes',
    fmt: fmtTonnes,
  },
  co2_per_capita: {
    label: 'CO₂ per person',
    inline: 'CO₂ per person',
    axis: 'CO₂ per person, tonnes',
    fmt: fmtPerPerson,
  },
  cumulative_co2: {
    label: 'Cumulative CO₂',
    inline: 'cumulative CO₂',
    axis: 'CO₂ emitted since 1750, million tonnes',
    fmt: fmtTonnes,
  },
  share_global_co2: {
    label: 'Share of world CO₂',
    inline: 'share of world CO₂',
    axis: 'Share of world emissions, %',
    fmt: fmtShare,
  },
};

export const VIEWS = {
  wealth: {
    note: () =>
      'Each circle is a country, sized by population. Richer countries sit further right, and countries that emit more per person sit higher up.',
  },
  ranking: {
    note: (s) => {
      const m = METRICS[s.metric];
      const extra = s.metric === 'co2_per_capita' ? ' Countries under 1 million people are left out.' : '';
      return `The 15 countries with the highest ${m.inline} in ${s.year}.${extra}`;
    },
  },
  trends: {
    note: (s) =>
      `${METRICS[s.metric].label} for the countries you’re comparing. Click the chart to jump to a year.`,
  },
};
