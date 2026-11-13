import * as d3 from 'd3';
import './style.css';
import { loadData } from './data.js';
import { createTooltip } from './tooltip.js';
import { createBubble } from './charts/bubble.js';
import { createBars } from './charts/bars.js';
import { createTrends } from './charts/trends.js';
import { CONTINENTS, METRICS, VIEWS, MAX_PICKED, SERIES_COUNT, continentClass } from './config.js';
import { escapeHtml } from './format.js';

const $ = (sel) => document.querySelector(sel);
const STEP_MS = 260; // one year per step while playing
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => motionQuery.matches;

const viewFromHash = () => {
  const v = location.hash.slice(1);
  return v in VIEWS ? v : 'wealth';
};

async function init() {
  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error(err);
    $('#loading').textContent =
      'The emissions data didn’t load. Run “npm run data” to create public/data/co2.json, then reload.';
    return;
  }
  $('#loading').remove();

  const state = {
    view: viewFromHash(),
    year: data.lastGdpYear,
    metric: 'co2',
    logY: true,
    continents: new Set(CONTINENTS),
    selected: [],
    playing: false,
  };

  // Each compared country keeps its colour until it is removed.
  const colourSlot = new Map();
  const seriesIndex = (iso) => colourSlot.get(iso) ?? 0;
  function pick(iso) {
    if (state.selected.includes(iso) || state.selected.length >= MAX_PICKED) return false;
    const used = new Set(colourSlot.values());
    colourSlot.set(iso, d3.range(SERIES_COUNT).find((i) => !used.has(i)));
    state.selected.push(iso);
    return true;
  }
  function unpick(iso) {
    state.selected = state.selected.filter((d) => d !== iso);
    colourSlot.delete(iso);
  }
  ['CHN', 'USA', 'IND', 'DEU'].forEach((iso) => data.countries.has(iso) && pick(iso));

  const stage = $('#charts');
  const tooltip = createTooltip(stage);
  const handlers = {
    tooltip,
    reducedMotion,
    seriesIndex,
    onToggle(iso) {
      if (state.selected.includes(iso)) unpick(iso);
      else if (!pick(iso)) return flashLimit();
      tooltip.hide();
      render();
    },
    onYear(year) {
      stop();
      setYear(year);
    },
  };

  const hosts = Object.fromEntries([...document.querySelectorAll('.chart-host')].map((el) => [el.dataset.chart, el]));
  const charts = {
    wealth: createBubble(hosts.wealth, data, handlers),
    ranking: createBars(hosts.ranking, data, handlers),
    trends: createTrends(hosts.trends, data, handlers),
  };

  // ---------- Controls ----------

  const continentBox = $('#continents');
  continentBox.innerHTML = CONTINENTS.map((c) => `
    <button type="button" class="chip" data-continent="${c}" aria-pressed="true">
      <span class="chip-dot ${continentClass(c)}" aria-hidden="true"></span>${c}
    </button>`).join('') +
    '<button type="button" class="chip-reset" id="showAll" hidden>Show all</button>';

  continentBox.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.id === 'showAll') CONTINENTS.forEach((c) => state.continents.add(c));
    else {
      const c = btn.dataset.continent;
      // Alt/Option-click shows only that continent.
      if (ev.altKey) { state.continents.clear(); state.continents.add(c); }
      else if (state.continents.has(c)) state.continents.delete(c);
      else state.continents.add(c);
    }
    render();
  });

  const metricSelect = $('#metric');
  metricSelect.innerHTML = Object.entries(METRICS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('');
  metricSelect.addEventListener('change', () => { state.metric = metricSelect.value; render(); });

  $('#logY').addEventListener('change', (ev) => { state.logY = ev.target.checked; render(); });

  const names = [...data.countries.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  $('#countryList').innerHTML = names.map(([, c]) => `<option value="${escapeHtml(c.name)}"></option>`).join('');
  const byName = new Map(names.map(([iso, c]) => [c.name.toLowerCase(), iso]));
  const search = $('#search');
  function addFromSearch() {
    const iso = byName.get(search.value.trim().toLowerCase());
    if (!iso) return;
    if (!state.selected.includes(iso) && !pick(iso)) return flashLimit();
    search.value = '';
    render();
  }
  search.addEventListener('change', addFromSearch);
  search.addEventListener('keydown', (ev) => ev.key === 'Enter' && addFromSearch());

  $('#picked').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-remove]');
    if (!btn) return;
    unpick(btn.dataset.remove);
    render();
    search.focus();
  });

  function flashLimit() {
    const cap = $('#pickedCaption');
    cap.textContent = `You can compare up to ${MAX_PICKED} countries. Remove one to add another.`;
    cap.classList.add('is-warning');
    setTimeout(() => cap.classList.remove('is-warning'), 2400);
  }

  // ---------- Timeline ----------

  const slider = $('#year');
  const playBtn = $('#play');
  let timer = null;
  const maxYear = () => (state.view === 'wealth' ? data.lastGdpYear : data.lastYear);

  slider.addEventListener('input', () => { stop(); setYear(+slider.value, reducedMotion() ? 0 : 120); });

  function setYear(year, duration = 450) {
    state.year = Math.max(data.firstYear, Math.min(maxYear(), year));
    render(duration);
  }

  function play() {
    if (state.year >= maxYear()) state.year = data.firstYear;
    state.playing = true;
    render(0);
    timer = d3.interval(() => {
      if (state.year >= maxYear()) return stop();
      setYear(state.year + 1, reducedMotion() ? 0 : STEP_MS);
    }, STEP_MS);
  }
  function stop() {
    if (!state.playing) return;
    timer?.stop();
    state.playing = false;
    syncTimeline();
  }
  playBtn.addEventListener('click', () => (state.playing ? stop() : play()));

  document.addEventListener('keydown', (ev) => {
    if (ev.code !== 'Space' || ev.target.closest('input, select, button, a, textarea')) return;
    ev.preventDefault();
    state.playing ? stop() : play();
  });

  // ---------- Views ----------

  window.addEventListener('hashchange', () => {
    stop();
    state.view = viewFromHash();
    render(0);
  });

  new ResizeObserver(() => requestAnimationFrame(() => render(0))).observe(stage);

  // ---------- Render ----------

  function syncTimeline() {
    const max = maxYear();
    slider.min = data.firstYear;
    slider.max = max;
    slider.value = state.year;
    slider.style.setProperty('--fill', `${((state.year - data.firstYear) / (max - data.firstYear)) * 100}%`);
    $('#yearMin').textContent = data.firstYear;
    $('#yearMax').textContent = max;
    $('#yearOut').textContent = state.year;
    playBtn.classList.toggle('is-playing', state.playing);
    playBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play through the years');

    const note = $('#timelineNote');
    note.hidden = !(state.view === 'wealth' && data.lastGdpYear < data.lastYear);
    note.textContent = `GDP figures run to ${data.lastGdpYear}, so this view stops there. The other views go to ${data.lastYear}.`;
  }

  function renderPicked() {
    const m = METRICS[state.metric];
    const key = state.view === 'wealth' ? 'co2_per_capita' : state.metric;
    const fmt = state.view === 'wealth' ? METRICS.co2_per_capita.fmt : m.fmt;
    const rows = data.byYear.get(state.year) ?? [];
    $('#picked').innerHTML = state.selected.map((iso) => {
      const c = data.countries.get(iso);
      const d = rows.find((r) => r.iso === iso);
      return `
        <li class="picked-item">
          <span class="swatch s${seriesIndex(iso)}" aria-hidden="true"></span>
          <span class="picked-name">${escapeHtml(c.name)}</span>
          <span class="picked-value">${d ? fmt(d[key]) : 'No data'}</span>
          <button type="button" class="picked-remove" data-remove="${iso}" aria-label="Stop comparing ${escapeHtml(c.name)}">
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg>
          </button>
        </li>`;
    }).join('');
    const cap = $('#pickedCaption');
    if (!cap.classList.contains('is-warning')) {
      cap.textContent = state.selected.length
        ? `${state.view === 'wealth' ? 'CO₂ per person' : m.label} in ${state.year}`
        : 'Nothing to compare yet. Search for a country above.';
    }
    search.disabled = state.selected.length >= MAX_PICKED;
    search.placeholder = search.disabled ? 'Remove a country to add more' : 'Add a country';
  }

  function render(duration = 450) {
    if (reducedMotion()) duration = 0;
    if (state.year > maxYear()) state.year = maxYear();

    document.querySelectorAll('.views [role="tab"]').forEach((a) => {
      const on = a.dataset.view === state.view;
      a.setAttribute('aria-selected', on);
      on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-show]').forEach((el) => {
      el.hidden = !el.dataset.show.split(' ').includes(state.view);
    });
    for (const [name, host] of Object.entries(hosts)) host.hidden = name !== state.view;

    continentBox.querySelectorAll('[data-continent]').forEach((b) =>
      b.setAttribute('aria-pressed', state.continents.has(b.dataset.continent)));
    $('#showAll').hidden = state.continents.size === CONTINENTS.length;
    metricSelect.value = state.metric;

    $('#viewNote').textContent = VIEWS[state.view].note(state);
    syncTimeline();
    renderPicked();
    charts[state.view].update(state, duration);
  }

  render(0);
}

init();
