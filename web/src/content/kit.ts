import type { ViewState } from '../viewer';

/** A text section. While it is being read, the 3D view shows `st`. */
export const sec = (st: ViewState, body: string) =>
  `<section data-state='${JSON.stringify(st).replace(/'/g, '&#39;')}'><div class="eye">3D view: ${st.label}</div>${body}</section>`;

export const shot = (name: string, cap: string, cls = '') =>
  `<figure class="${cls}"><img src="/shots/${name}.png" alt="${cap.replace(/<[^>]+>/g, '').replace(/"/g, '')}" loading="lazy"><figcaption>${cap}</figcaption></figure>`;

export const img = (src: string, cap: string, cls = '') =>
  `<figure class="${cls}"><img src="${src}" alt="" loading="lazy"><figcaption>${cap}</figcaption></figure>`;

export const box = (kind: 'do' | 'why' | 'num' | 'warn', title: string, html: string) =>
  `<div class="box ${kind}"><span class="t">${title}</span>${html}</div>`;

export const widget = (name: string) => `<div data-widget="${name}"></div>`;

/** socket dot in the node editor's colours */
export const s = (kind: 'shader' | 'color' | 'float' | 'vector') => `<span class="sock s-${kind}"></span>`;
