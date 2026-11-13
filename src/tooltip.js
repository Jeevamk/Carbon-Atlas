import { escapeHtml } from './format.js';

/** One tooltip shared by every chart, positioned inside `container`. */
export function createTooltip(container) {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  container.appendChild(tip);

  function show(event, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    const box = container.getBoundingClientRect();
    const gap = 14;
    let x = event.clientX - box.left + gap;
    let y = event.clientY - box.top + gap;
    if (x + tip.offsetWidth > box.width) x = event.clientX - box.left - tip.offsetWidth - gap;
    if (y + tip.offsetHeight > box.height) y = event.clientY - box.top - tip.offsetHeight - gap;
    tip.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(0, y)}px)`;
  }

  const hide = () => (tip.hidden = true);
  return { show, hide };
}

/** Standard tooltip body: title, subtitle, a list of label/value rows, and a hint. */
export function tipHtml({ title, sub, rows = [], hint }) {
  const dl = rows.map(([k, v, cls = '']) => `<dt class="${cls}">${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('');
  return `
    <div class="tip-title">${escapeHtml(title)}</div>
    ${sub ? `<div class="tip-sub">${escapeHtml(sub)}</div>` : ''}
    ${dl ? `<dl>${dl}</dl>` : ''}
    ${hint ? `<div class="tip-hint">${escapeHtml(hint)}</div>` : ''}`;
}
