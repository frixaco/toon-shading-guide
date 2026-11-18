import './style.css';
import { Viewer, type ViewState } from './viewer';
import { mountWidgets } from './widgets';
import { STEPS } from './content';

const nav = document.getElementById('nav')!;
const content = document.getElementById('content')!;
const viewer = new Viewer(document.getElementById('viewer')!);
let observer: IntersectionObserver | undefined;

function show(i: number) {
  const step = STEPS[i];
  nav.innerHTML =
    `<div class="brand">Toon shading<br><small>from zero · Blender 5.3</small></div>` +
    STEPS.map((s, k) => `<a href="#/${k}" class="${k === i ? 'on' : ''}"><span>${k}</span>${s.title}</a>`).join('') +
    `<p class="navnote">Each step ends with a finished .blend you can download.</p>`;
  const prev = i > 0 ? `<a href="#/${i - 1}">← Step ${i - 1}: ${STEPS[i - 1].title}</a>` : '<span></span>';
  const next = i < STEPS.length - 1 ? `<a href="#/${i + 1}">Step ${i + 1}: ${STEPS[i + 1].title} →</a>` : '<span></span>';
  content.innerHTML = `<header><div class="kicker">Step ${i}</div><h1>${step.title}</h1>
    <p class="dl">Finished file for this step: <a href="/blend/step${i}.blend" download>step${i}.blend</a></p></header>
    ${step.html}<footer class="pager">${prev}${next}</footer>`;
  mountWidgets(content);
  scrollTo(0, 0);
  const on = nav.querySelector<HTMLElement>('a.on')!;
  nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2; // phones: the step row scrolls sideways
  sections = [...content.querySelectorAll<HTMLElement>('section[data-state]')];
  viewer.setState(JSON.parse(sections[0].dataset.state!) as ViewState);
  sections[0].classList.add('active');
  watch();
}

// The section crossing a line 40% down the text you can see drives the 3D view. On a phone held
// upright the view covers the top half of the window, so the line sits at 70% instead.
let sections: HTMLElement[] = [];
const stacked = matchMedia('(max-width: 1100px) and (orientation: portrait)'); // as in style.css
function watch() {
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const sec = e.target as HTMLElement;
        if (sec.classList.contains('active')) continue;
        sections.forEach((s) => s.classList.remove('active'));
        sec.classList.add('active');
        viewer.setState(JSON.parse(sec.dataset.state!) as ViewState);
      }
    },
    { rootMargin: stacked.matches ? '-70% 0px -29% 0px' : '-40% 0px -59% 0px' },
  );
  sections.forEach((s) => observer!.observe(s));
}
stacked.addEventListener('change', watch);

const route = () => show(Math.min(STEPS.length - 1, Math.max(0, parseInt(location.hash.slice(2)) || 0)));
addEventListener('hashchange', route);
route();

// click a screenshot to see it full size
const box = document.getElementById('lightbox')!;
const big = box.querySelector('img') as HTMLImageElement;
content.addEventListener('click', (e) => {
  const img = e.target as HTMLImageElement;
  if (img.tagName !== 'IMG' || !img.closest('figure')) return;
  big.src = img.src;
  box.hidden = false;
  // on a phone the enlarged image is larger than the screen: start centred on the tapped spot
  const r = img.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  const centre = () => {
    big.style.setProperty('--nw', `${big.naturalWidth}px`); // style.css shows it at half this size on a phone
    box.scrollLeft = fx * big.offsetWidth - box.clientWidth / 2;
    box.scrollTop = fy * big.offsetHeight - box.clientHeight / 2;
  };
  big.onload = centre;
  if (big.complete) centre();
});
box.onclick = () => (box.hidden = true);
addEventListener('keydown', (e) => e.key === 'Escape' && (box.hidden = true));
