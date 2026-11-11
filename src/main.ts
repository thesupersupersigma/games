/* Everything that moves. The page itself is plain HTML (index.html plus the game rows
 * that vite.config.ts writes in), so if this file never runs you still get a working page. */
import '@fontsource-variable/archivo/wdth.css';
import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const root = document.documentElement;
const links = gsap.utils.toArray<HTMLAnchorElement>('.game-link');
const curtain = document.querySelector<HTMLElement>('.curtain')!;
const curtainTitle = curtain.querySelector<HTMLElement>('.curtain-title span')!;

// shortcut: read once at load, so changing the OS setting needs a refresh. Upgrade to gsap.matchMedia() if that matters.
const motionOK = matchMedia('(prefers-reduced-motion: no-preference)').matches;
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

// ------------------------------------------------------------ launching a game
let launching = false;

function launch(link: HTMLAnchorElement) {
  if (launching) return;
  if (!motionOK) return location.assign(link.href);
  launching = true;
  curtain.style.setProperty('--accent', link.parentElement!.style.getPropertyValue('--accent'));
  curtainTitle.textContent = link.dataset.title ?? '';
  gsap
    .timeline({ onComplete: () => location.assign(link.href) })
    .set(curtain, { autoAlpha: 1 })
    .fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.55, ease: 'expo.inOut' })
    .fromTo(curtainTitle, { yPercent: 105 }, { yPercent: 0, duration: 0.45, ease: 'expo.out' }, '-=0.2');
}

for (const link of links) {
  link.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // "open in new tab" keeps working
    e.preventDefault();
    launch(link);
  });
}

document.querySelector('#pick')!.addEventListener('click', () => launch(gsap.utils.random(links)));

// The back button can bring this page back exactly as it was left: with the curtain down.
addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  launching = false;
  gsap.set(curtain, { autoAlpha: 0 });
});

// -------------------------------------------------------------------- motion
if (motionOK) animate();

async function animate() {
  // Splitting text into letters before the font arrives measures the wrong font.
  await Promise.race([document.fonts.load('900 1em "Archivo Variable"'), new Promise((done) => setTimeout(done, 1500))]);
  root.classList.remove('pre');

  // Headline letters rise out of the baseline, then the small print follows.
  const letters = SplitText.create('.hero-line', { type: 'chars', mask: 'chars' }).chars;
  gsap
    .timeline({ defaults: { ease: 'expo.out' } })
    .from(letters, { yPercent: 110, duration: 0.9, stagger: 0.02 })
    .from('.bar > *, .hero-lede', { y: 14, autoAlpha: 0, duration: 0.6, stagger: 0.07 }, 0.4)
    .from('.ticker', { scaleY: 0, transformOrigin: 'top', duration: 0.5 }, 0.55);

  // Ticker: enough copies of the line to cover the widest the window can get, then slide
  // left by exactly one copy and repeat. Scrolling the page pushes it faster for a moment.
  const track = document.querySelector<HTMLElement>('.ticker-track')!;
  const line = track.firstElementChild as HTMLElement;
  for (let n = Math.ceil(screen.width / line.offsetWidth); n > 0; n--) track.append(line.cloneNode(true));
  const ticker = gsap.to(track, { x: -line.offsetWidth, duration: 22, ease: 'none', repeat: -1 });
  let push: gsap.core.Timeline | undefined;
  ScrollTrigger.create({
    onUpdate: (self) => {
      const speed = 1 + Math.min(Math.abs(self.getVelocity()) / 300, 6);
      push?.kill();
      push = gsap.timeline().to(ticker, { timeScale: speed, duration: 0.2 }).to(ticker, { timeScale: 1, duration: 0.9 });
    },
  });

  // Each row slides up the first time it scrolls into view. Rows already on screen
  // at load wait for the headline to finish first.
  for (const link of links) {
    gsap.from(link.querySelectorAll('.game-no, .game-title, .game-tagline, .game-foot, .game-cover'), {
      y: 36,
      autoAlpha: 0,
      duration: 0.7,
      delay: link.getBoundingClientRect().top < innerHeight ? 0.7 : 0,
      ease: 'expo.out',
      stagger: 0.06,
      scrollTrigger: { trigger: link, start: 'top 88%', once: true },
    });
  }

  if (canHover) links.forEach(addHover);
}

/** The accent colour wipes in from whichever edge the pointer crossed, and out the same way. */
function addHover(link: HTMLAnchorElement) {
  const wipe = link.querySelector('.game-wipe');
  const hover = gsap
    .timeline({ paused: true, defaults: { duration: 0.45, ease: 'expo.out' } })
    .fromTo(wipe, { scaleY: 0 }, { scaleY: 1 }, 0)
    .to(link.querySelector('.game-title'), { x: 20 }, 0)
    .to(link.querySelector('.game-go svg'), { x: 6 }, 0)
    .to(link.querySelectorAll('.game-cover'), { rotate: -2, scale: 1.04 }, 0); // All: a game may have no cover

  const aimWipe = (e: MouseEvent) => {
    const box = link.getBoundingClientRect();
    gsap.set(wipe, { transformOrigin: e.clientY < box.top + box.height / 2 ? 'top' : 'bottom' });
  };
  link.addEventListener('mouseenter', (e) => {
    aimWipe(e);
    hover.timeScale(1).play();
  });
  link.addEventListener('mouseleave', (e) => {
    aimWipe(e);
    hover.timeScale(1.7).reverse(); // leaving is quicker than arriving
  });
  link.addEventListener('focus', () => link.matches(':focus-visible') && hover.timeScale(1).play());
  link.addEventListener('blur', () => hover.timeScale(1.7).reverse());
}
