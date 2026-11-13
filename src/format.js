import * as d3 from 'd3';

const f1 = d3.format(',.1f');
const f0 = d3.format(',.0f');

/** Million tonnes in, readable string out: "412 Mt", "11.9 Gt". */
export function fmtTonnes(mt) {
  if (mt == null) return '–';
  if (Math.abs(mt) >= 1000) return `${f1(mt / 1000)} Gt`;
  if (Math.abs(mt) >= 10) return `${f0(mt)} Mt`;
  return `${f1(mt)} Mt`;
}

export const fmtPerPerson = (t) => (t == null ? '–' : `${d3.format(t < 10 ? '.2~f' : ',.1~f')(t)} t`);
export const fmtShare = (p) => (p == null ? '–' : `${p < 0.1 ? d3.format('.2f')(p) : f1(p)}%`);
export const fmtMoney = (v) => (v == null ? '–' : `$${f0(Math.round(v / 100) * 100)}`);

export function fmtPeople(n) {
  if (n == null) return '–';
  if (n >= 1e9) return `${d3.format('.2f')(n / 1e9)} billion`;
  if (n >= 1e6) return `${d3.format('.3~r')(n / 1e6)} million`;
  return f0(n);
}

/** Axis tick formatter for million-tonne values. */
export const tickTonnes = (mt) => (mt === 0 ? '0' : mt >= 1000 ? `${d3.format('~g')(mt / 1000)} Gt` : `${d3.format('~s')(mt)} Mt`);

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
