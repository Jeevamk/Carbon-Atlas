import * as d3 from 'd3';
import { METRICS, PER_PERSON_MIN_POP, continentClass } from '../config.js';
import { fmtPeople, tickTonnes, fmtShare, fmtPerPerson } from '../format.js';
import { tipHtml } from '../tooltip.js';

const MARGIN = { top: 4, right: 72, bottom: 30, left: 132 };
const TICK_FORMAT = {
  co2: tickTonnes,
  cumulative_co2: tickTonnes,
  co2_per_capita: (v) => fmtPerPerson(v),
  share_global_co2: (v) => fmtShare(v),
};

/** Top-N ranking whose bars slide into their new order as the year changes. */
export function createBars(host, data, { tooltip, onToggle }) {
  const svg = d3.select(host).append('svg').attr('class', 'chart')
    .attr('role', 'img').attr('aria-label', 'Ranking of the countries with the highest emissions');

  const watermark = svg.append('text').attr('class', 'year-watermark year-watermark--corner').attr('aria-hidden', 'true');
  const plot = svg.append('g');
  const xAxisG = plot.append('g').attr('class', 'axis grid-axis');
  const barsG = plot.append('g');
  const empty = plot.append('text').attr('class', 'empty-note').attr('text-anchor', 'middle');
  const x = d3.scaleLinear();
  let lastMetric = null;

  function update(state, duration) {
    const { width, height } = host.getBoundingClientRect();
    const narrow = width < 520;
    const margin = { ...MARGIN, left: narrow ? 104 : MARGIN.left };
    const iw = Math.max(160, width - margin.left - margin.right);
    const ih = Math.max(180, height - margin.top - margin.bottom);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    plot.attr('transform', `translate(${margin.left},${margin.top})`);

    const key = state.metric;
    const metric = METRICS[key];
    const metricChanged = key !== lastMetric;
    lastMetric = key;
    const picked = new Set(state.selected);
    const count = Math.max(8, Math.min(15, Math.floor(ih / 24)));

    const rows = (data.byYear.get(state.year) ?? [])
      .filter((d) => d[key] > 0 && state.continents.has(d.continent))
      .filter((d) => key !== 'co2_per_capita' || d.population >= PER_PERSON_MIN_POP)
      .sort((a, b) => d3.descending(a[key], b[key]))
      .slice(0, count);

    // Each row keeps the same height even when filters leave fewer countries.
    const yBand = d3.scaleBand().domain(rows.map((d) => d.iso))
      .range([0, (ih * rows.length) / count]).paddingInner(0.24).paddingOuter(0.1);
    const bandH = yBand.bandwidth();
    x.domain([0, d3.max(rows, (d) => d[key]) || 1]).range([0, iw]).nice();

    const t = svg.transition('frame').duration(duration)
      .ease(state.playing ? d3.easeLinear : d3.easeCubicInOut);

    watermark.attr('x', margin.left + iw).attr('y', margin.top + ih - 8)
      .style('font-size', `${Math.min(ih * 0.34, iw * 0.3)}px`).text(state.year);

    xAxisG.attr('transform', `translate(0,${ih})`).transition(t)
      .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(iw / 110))).tickFormat(TICK_FORMAT[key])
        .tickSize(-ih).tickSizeOuter(0).tickPadding(8));

    const bars = barsG.selectAll('g.bar')
      .data(rows, (d) => d.iso)
      .join(
        (enter) => {
          const g = enter.append('g').attr('transform', `translate(0,${ih})`).style('opacity', 0);
          g.append('rect').attr('class', 'bar-rect').attr('width', 0);
          g.append('text').attr('class', 'bar-name').attr('x', -10).attr('text-anchor', 'end');
          g.append('text').attr('class', 'bar-value').attr('x', 6);
          return g;
        },
        (upd) => upd,
        (exit) => exit.call((e) => e.transition(t).attr('transform', `translate(0,${ih + 20})`).style('opacity', 0).remove()),
      )
      .attr('class', (d) => `bar ${continentClass(d.continent)}${picked.has(d.iso) ? ' is-picked' : ''}`)
      .on('pointerenter pointermove', (ev, d) => tooltip.show(ev, tipHtml({
        title: d.name,
        sub: `${d.continent}, ${d.year}`,
        rows: [
          [metric.label, metric.fmt(d[key])],
          ['Population', fmtPeople(d.population)],
        ],
        hint: picked.has(d.iso) ? 'Click to stop comparing' : 'Click to compare',
      })))
      .on('pointerleave', tooltip.hide)
      .on('click', (ev, d) => onToggle(d.iso));

    bars.transition(t).attr('transform', (d) => `translate(0,${yBand(d.iso)})`).style('opacity', 1);

    bars.select('.bar-rect').attr('height', bandH).attr('rx', 2)
      .transition(t).attr('width', (d) => Math.max(1, x(d[key])));

    bars.select('.bar-name').attr('y', bandH / 2).attr('dy', '0.35em')
      .text((d) => (narrow && d.name.length > 13 ? `${d.name.slice(0, 12)}…` : d.name));

    bars.select('.bar-value').attr('y', bandH / 2).attr('dy', '0.35em')
      .transition(t)
      .attr('x', (d) => x(d[key]) + 6)
      .textTween(function (d) {
        // Count the number up or down rather than snapping.
        const from = metricChanged || this.__v == null ? d[key] : this.__v;
        const i = d3.interpolateNumber(from, d[key]);
        this.__v = d[key];
        return (k) => metric.fmt(i(k));
      });

    empty.attr('x', iw / 2).attr('y', ih / 2)
      .text(rows.length ? '' : 'No countries to rank. Turn a continent back on above.');
  }

  return { update };
}
