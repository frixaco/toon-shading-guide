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
  const sections = [...content.querySelectorAll<HTMLElement>('section[data-state]')];
  viewer.setState(JSON.parse(sections[0].dataset.state!) as ViewState);
  sections[0].classList.add('active');
  observer?.disconnect();
  // the section crossing a line 40% down the window drives the 3D view
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
    { rootMargin: '-40% 0px -59% 0px' },
  );
  sections.forEach((s) => observer!.observe(s));
}

const route = () => show(Math.min(STEPS.length - 1, Math.max(0, parseInt(location.hash.slice(2)) || 0)));
addEventListener('hashchange', route);
route();

// click a screenshot to see it full size
const box = document.getElementById('lightbox')!;
content.addEventListener('click', (e) => {
  const img = e.target as HTMLImageElement;
  if (img.tagName !== 'IMG' || !img.closest('figure')) return;
  (box.querySelector('img') as HTMLImageElement).src = img.src;
  box.hidden = false;
});
box.onclick = () => (box.hidden = true);
addEventListener('keydown', (e) => e.key === 'Escape' && (box.hidden = true));
