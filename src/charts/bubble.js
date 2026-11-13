import * as d3 from 'd3';
import { continentClass } from '../config.js';
import { fmtMoney, fmtPeople, fmtPerPerson } from '../format.js';
import { tipHtml } from '../tooltip.js';

const MARGIN = { top: 12, right: 16, bottom: 48, left: 52 };

/**
 * Gapminder-style bubble chart: GDP per person (x, log) against
 * CO₂ per person (y), circle area = population. Animated by year.
 */
export function createBubble(host, data, { tooltip, onToggle }) {
  const svg = d3.select(host).append('svg').attr('class', 'chart')
    .attr('role', 'img')
    .attr('aria-label', 'Bubble chart of GDP per person against CO₂ per person, sized by population');

  const watermark = svg.append('text').attr('class', 'year-watermark').attr('aria-hidden', 'true');
  const plot = svg.append('g');
  const gridG = plot.append('g').attr('class', 'grid');
  const xAxisG = plot.append('g').attr('class', 'axis');
  const yAxisG = plot.append('g').attr('class', 'axis');
  const xTitle = plot.append('text').attr('class', 'axis-title').attr('text-anchor', 'end');
  const yTitle = plot.append('text').attr('class', 'axis-title').text('CO₂ per person, tonnes');
  const dotsG = plot.append('g').attr('class', 'dots');
  const labelsG = plot.append('g').attr('class', 'dot-labels');
  const empty = plot.append('text').attr('class', 'empty-note').attr('text-anchor', 'middle');

  // Fixed domains across all years so motion means something.
  const valid = data.records.filter((d) => d.gdpPc && d.co2_per_capita > 0 && d.population);
  const yMax = d3.quantile(valid.map((d) => d.co2_per_capita).sort(d3.ascending), 0.999);
  const x = d3.scaleLog()
    .domain([d3.min(valid, (d) => d.gdpPc) * 0.85, d3.max(valid, (d) => d.gdpPc) * 1.15])
    .clamp(true);
  const yLog = d3.scaleLog().domain([0.01, yMax * 1.1]).clamp(true);
  const yLin = d3.scaleLinear().domain([0, yMax]).nice().clamp(true);
  const r = d3.scaleSqrt().domain([0, d3.max(valid, (d) => d.population)]);

  const tip = (d, picked) => tipHtml({
    title: d.name,
    sub: `${d.continent}, ${d.year}`,
    rows: [
      ['CO₂ per person', fmtPerPerson(d.co2_per_capita)],
      ['GDP per person', fmtMoney(d.gdpPc)],
      ['Population', fmtPeople(d.population)],
    ],
    hint: picked ? 'Click to stop comparing' : 'Click to compare',
  });

  function update(state, duration) {
    const { width, height } = host.getBoundingClientRect();
    const iw = Math.max(200, width - MARGIN.left - MARGIN.right);
    const ih = Math.max(180, height - MARGIN.top - MARGIN.bottom);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    plot.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const y = state.logY ? yLog : yLin;
    x.range([0, iw]);
    y.range([ih, 0]);
    r.range([0, Math.min(iw, ih) * 0.1]);
    const radius = (d) => Math.max(2.5, r(d.population));

    const t = svg.transition('frame').duration(duration)
      .ease(state.playing ? d3.easeLinear : d3.easeCubicOut);

    // Giant year behind the data: the anchor for everything that moves.
    watermark
      .attr('x', MARGIN.left + iw / 2)
      .attr('y', MARGIN.top + ih / 2)
      .style('font-size', `${Math.min(ih * 0.62, iw * 0.36)}px`)
      .text(state.year);

    // Axes
    const xTicks = (iw < 460 ? [1000, 10000, 100000] : [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000])
      .filter((v) => v >= x.domain()[0] && v <= x.domain()[1]);
    const yTicks = state.logY
      ? [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100].filter((v) => v <= yLog.domain()[1])
      : yLin.ticks(6);

    xAxisG.attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(x).tickValues(xTicks).tickFormat(d3.format('$~s')).tickSizeOuter(0).tickPadding(8));
    yAxisG.transition(t)
      .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(d3.format('~g')).tickSizeOuter(0).tickPadding(6));
    gridG.transition(t)
      .call(d3.axisLeft(y).tickValues(yTicks).tickSize(-iw).tickFormat(''));
    gridG.select('.domain').remove();
    xTitle.attr('x', iw).attr('y', ih + 40)
      .text(`GDP per person${iw < 460 ? '' : ', international $'} (log scale)`);
    yTitle.attr('x', 8).attr('y', 12);

    // Circles
    const picked = new Set(state.selected);
    const rows = (data.byYear.get(state.year) ?? [])
      .filter((d) => d.gdpPc && d.co2_per_capita > 0 && d.population && state.continents.has(d.continent))
      .sort((a, b) => b.population - a.population); // big circles underneath

    const cx = (d) => x(d.gdpPc);
    const cy = (d) => y(d.co2_per_capita);

    dotsG.selectAll('circle')
      .data(rows, (d) => d.iso)
      .join(
        (enter) => enter.append('circle')
          .attr('cx', cx).attr('cy', cy).attr('r', 0)
          .call((e) => e.transition(t).attr('r', radius)),
        (upd) => upd.call((u) => u.transition(t).attr('cx', cx).attr('cy', cy).attr('r', radius)),
        (exit) => exit.call((e) => e.transition(t).attr('r', 0).remove()),
      )
      .attr('class', (d) => `dot ${continentClass(d.continent)}${picked.has(d.iso) ? ' is-picked' : ''}`)
      .on('pointerenter pointermove', (ev, d) => tooltip.show(ev, tip(d, picked.has(d.iso))))
      .on('pointerleave', tooltip.hide)
      .on('click', (ev, d) => onToggle(d.iso))
      .order();

    // Name labels for compared countries
    // Big circles carry their name inside; small ones get it alongside.
    const inside = (d) => radius(d) > 22;
    const flip = (d) => cx(d) > iw * 0.78;
    const lx = (d) => (inside(d) ? cx(d) : cx(d) + (flip(d) ? -1 : 1) * (radius(d) + 5));
    labelsG.selectAll('text')
      .data(rows.filter((d) => picked.has(d.iso)), (d) => d.iso)
      .join(
        (enter) => enter.append('text').attr('x', lx).attr('y', cy).style('opacity', 0)
          .call((e) => e.transition(t).style('opacity', 1)),
        (upd) => upd.call((u) => u.transition(t).attr('x', lx).attr('y', cy)),
        (exit) => exit.remove(),
      )
      .attr('class', 'dot-label')
      .attr('dy', '0.32em')
      .attr('text-anchor', (d) => (inside(d) ? 'middle' : flip(d) ? 'end' : 'start'))
      .text((d) => d.name);

    empty.attr('x', iw / 2).attr('y', ih / 2)
      .text(rows.length ? '' : 'No countries to show. Turn a continent back on above.');
  }

  return { update };
}
