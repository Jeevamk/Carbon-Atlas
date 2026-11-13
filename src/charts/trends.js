import * as d3 from 'd3';
import { METRICS } from '../config.js';
import { tickTonnes, fmtPerPerson, fmtShare } from '../format.js';
import { tipHtml } from '../tooltip.js';

const MARGIN = { top: 16, right: 116, bottom: 32, left: 56 };
const TICK_FORMAT = {
  co2: tickTonnes,
  cumulative_co2: tickTonnes,
  co2_per_capita: (v) => fmtPerPerson(v),
  share_global_co2: (v) => fmtShare(v),
};

/** Lines for the compared countries, with a marker that follows the year slider. */
export function createTrends(host, data, { tooltip, onYear, seriesIndex, reducedMotion }) {
  const svg = d3.select(host).append('svg').attr('class', 'chart')
    .attr('role', 'img').attr('aria-label', 'Line chart of emissions over time for the compared countries');

  const plot = svg.append('g');
  const gridG = plot.append('g').attr('class', 'grid');
  const xAxisG = plot.append('g').attr('class', 'axis');
  const yAxisG = plot.append('g').attr('class', 'axis');
  const yTitle = plot.append('text').attr('class', 'axis-title');
  const markerG = plot.append('g').attr('class', 'year-marker');
  const markerLine = markerG.append('line');
  const markerYear = markerG.append('text').attr('class', 'year-marker-label').attr('text-anchor', 'middle');
  const linesG = plot.append('g').attr('class', 'lines');
  const dotsG = plot.append('g');
  const labelsG = plot.append('g');
  const overlay = plot.append('rect').attr('class', 'overlay');
  const empty = plot.append('text').attr('class', 'empty-note').attr('text-anchor', 'middle');

  const x = d3.scaleLinear().domain([data.firstYear, data.lastYear]);
  const y = d3.scaleLinear();

  function update(state, duration) {
    const { width, height } = host.getBoundingClientRect();
    const narrow = width < 520;
    const margin = { ...MARGIN, right: narrow ? 84 : MARGIN.right };
    const iw = Math.max(160, width - margin.left - margin.right);
    const ih = Math.max(160, height - margin.top - margin.bottom);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    plot.attr('transform', `translate(${margin.left},${margin.top})`);

    const key = state.metric;
    const metric = METRICS[key];
    const series = state.selected.map((iso) => ({
      iso,
      name: data.countries.get(iso).name,
      cls: `s${seriesIndex(iso)}`,
      values: (data.byCountry.get(iso) ?? []).filter((d) => d[key] != null),
    }));

    x.range([0, iw]);
    y.domain([0, d3.max(series, (s) => d3.max(s.values, (d) => d[key])) || 1]).range([ih, 0]).nice();

    const t = svg.transition('frame').duration(duration)
      .ease(state.playing ? d3.easeLinear : d3.easeCubicInOut);

    xAxisG.attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(iw / 80))).tickFormat(d3.format('d')).tickSizeOuter(0).tickPadding(8));
    yAxisG.transition(t).call(d3.axisLeft(y).ticks(6).tickFormat(TICK_FORMAT[key]).tickSizeOuter(0).tickPadding(6));
    gridG.transition(t).call(d3.axisLeft(y).ticks(6).tickSize(-iw).tickFormat(''));
    yTitle.attr('x', 8).attr('y', 4).text(metric.axis);

    const line = d3.line()
      .defined((d) => d[key] != null)
      .x((d) => x(d.year))
      .y((d) => y(d[key]))
      .curve(d3.curveMonotoneX);

    linesG.selectAll('path')
      .data(series, (s) => s.iso)
      .join(
        (enter) => enter.append('path')
          .attr('d', (s) => line(s.values))
          .each(function () {
            // Draw new lines on from left to right.
            if (reducedMotion()) return;
            const len = this.getTotalLength();
            d3.select(this)
              .attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
              .transition().duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0)
              .on('end interrupt', function () { d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null); });
          }),
        (upd) => upd.call((u) => u.transition(t).attr('d', (s) => line(s.values))),
        (exit) => exit.call((e) => e.transition(t).style('opacity', 0).remove()),
      )
      .attr('class', (s) => `trend-line ${s.cls}`);

    // Year marker
    const mx = x(state.year);
    markerLine.transition(t).attr('x1', mx).attr('x2', mx).attr('y1', 14).attr('y2', ih);
    markerYear.transition(t).attr('x', mx).attr('y', 6);
    markerYear.text(state.year);

    const atYear = series
      .map((s) => ({ ...s, d: s.values.find((v) => v.year === state.year) }))
      .filter((s) => s.d);
    dotsG.selectAll('circle')
      .data(atYear, (s) => s.iso)
      .join((enter) => enter.append('circle').attr('r', 0).attr('cx', mx).attr('cy', (s) => y(s.d[key])))
      .attr('class', (s) => `trend-dot ${s.cls}`)
      .transition(t)
      .attr('r', 4.5).attr('cx', mx).attr('cy', (s) => y(s.d[key]));

    // End labels, nudged apart so they never overlap.
    const labels = series
      .filter((s) => s.values.length)
      .map((s) => ({ ...s, ty: y(s.values.at(-1)[key]) }))
      .sort((a, b) => a.ty - b.ty);
    const gap = 15;
    for (let i = 1; i < labels.length; i++) labels[i].ty = Math.max(labels[i].ty, labels[i - 1].ty + gap);
    for (let i = labels.length - 1; i >= 0; i--) {
      const limit = i === labels.length - 1 ? ih : labels[i + 1].ty - gap;
      labels[i].ty = Math.min(labels[i].ty, limit);
    }
    labelsG.selectAll('text')
      .data(labels, (s) => s.iso)
      .join((enter) => enter.append('text').attr('x', iw + 8).attr('y', (s) => s.ty).style('opacity', 0))
      .attr('class', (s) => `trend-label ${s.cls}`)
      .attr('dy', '0.35em')
      .text((s) => (narrow && s.name.length > 10 ? `${s.name.slice(0, 9)}…` : s.name))
      .transition(t)
      .attr('x', iw + 8).attr('y', (s) => s.ty).style('opacity', 1);

    // Hover for exact values, click to move the year.
    const yearAt = (ev) => Math.round(x.invert(d3.pointer(ev, plot.node())[0]));
    overlay.attr('width', iw).attr('height', ih)
      .on('pointermove', (ev) => {
        if (!series.length) return;
        const yr = Math.max(data.firstYear, Math.min(data.lastYear, yearAt(ev)));
        const rows = series
          .map((s) => ({ s, d: s.values.find((v) => v.year === yr) }))
          .sort((a, b) => (b.d?.[key] ?? -1) - (a.d?.[key] ?? -1))
          .map(({ s, d }) => [s.name, d ? metric.fmt(d[key]) : 'No data', `has-swatch ${s.cls}`]);
        tooltip.show(ev, tipHtml({ title: String(yr), sub: metric.label, rows, hint: 'Click to jump to this year' }));
      })
      .on('pointerleave', tooltip.hide)
      .on('click', (ev) => onYear(yearAt(ev)));

    empty.attr('x', iw / 2).attr('y', ih / 2)
      .text(series.length ? '' : 'Add a country on the right to see its history.');
  }

  return { update };
}
