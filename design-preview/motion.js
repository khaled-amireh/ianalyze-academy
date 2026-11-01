/* Native, bounded preview motion. No service calls or animation dependencies. */
(() => {
  'use strict';
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const ease = 'cubic-bezier(.22,.7,.2,1)';
  const active = new Set();
  const disclosures = new WeakMap();
  let observer, viewportCleanup, menuEffect;
  const reduced = () => preference.matches;

  function animate(element, frames, options) {
    if (!element || reduced() || !element.animate) return null;
    const effect = element.animate(frames, { duration: 500, easing: ease, ...options });
    active.add(effect);
    effect.finished.then(() => active.delete(effect), () => active.delete(effect));
    return effect;
  }
  function slide(element, delay = 0, duration = 540) {
    if (!element || element.contains(document.activeElement)) return;
    const base = getComputedStyle(element).transform;
    const transform = base === 'none' ? '' : base;
    animate(element, [
      { opacity: 0, transform: `translateY(16px) ${transform}` },
      { opacity: 1, transform: `translateY(0) ${transform}` }
    ], { delay, duration });
  }
  function reset() {
    observer?.disconnect();
    viewportCleanup?.();
    active.forEach(effect => effect.cancel());
    active.clear();
    menuEffect = null;
  }
  function mount(root) {
    reset();
    const nav = root.querySelector('#public-nav');
    const button = root.querySelector('#menu-toggle');
    const desktop = matchMedia('(min-width:1100px)');
    const sync = () => {
      menuEffect?.cancel();
      nav.classList.remove('open');
      nav.style.height = '';
      nav.style.overflow = '';
      nav.inert = !desktop.matches;
      button.setAttribute('aria-expanded', 'false');
    };
    sync();
    desktop.addEventListener('change', sync);
    viewportCleanup = () => desktop.removeEventListener('change', sync);
    if (reduced()) return;

    root.querySelectorAll('.hero-copy > *, .heading-copy > *').forEach((element, i) => slide(element, Math.min(i, 4) * 65));
    slide(root.querySelector('.hero-visual'), 170, 680);
    slide(root.querySelector('.heading-art'), 130, 640);
    const line = root.querySelector('.chart-line');
    if (line) {
      const length = line.getTotalLength();
      animate(line, [{ strokeDasharray: `${length}`, strokeDashoffset: length }, { strokeDasharray: `${length}`, strokeDashoffset: 0 }], { duration: 1100, delay: 240 });
    }
    const orbit = root.querySelector('.data-orbit');
    animate(orbit, [{ backgroundPosition: '0 0' }, { backgroundPosition: '6px -4px', offset: .5 }, { backgroundPosition: '0 0' }], { duration: 4600, easing: 'ease-in-out' });
    root.querySelectorAll('.data-orbit > span').forEach((element, i) => animate(element, [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)', offset: .5 }, { transform: 'translateY(0)' }], { duration: 3600, delay: i * 120, easing: 'ease-in-out' }));

    const reveal = element => {
      if (element.dataset.motionPlayed) return;
      element.dataset.motionPlayed = 'true';
      slide(element, 0, 560);
      element.querySelectorAll('.progress-track > span').forEach(bar => animate(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 90 }));
      element.querySelectorAll('.ring-value').forEach(ring => animate(ring, [{ strokeDashoffset: 100 }, { strokeDashoffset: 66.667 }], { duration: 900, delay: 90 }));
    };
    const targets = root.querySelectorAll('main > section:not(.hero), main > .content-split, main > .about-manifesto, main > .library-empty, main > .team-composition, main > .contact-layout, main > .grid, .dashboard-content > .student-bento, .dashboard-content > .stats, .dashboard-content > .dashboard-columns, .dashboard-content > .review-workspace, .dashboard-content > .admin-program-strip, .dashboard-content > .activity-plan, .dashboard-content > .section, .wire-sheet');
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      }), { threshold: 0, rootMargin: '0px 0px -32px 0px' });
      targets.forEach(element => { element.dataset.motion = 'reveal'; observer.observe(element); });
    } else targets.forEach(reveal);
  }
  function disclosure(summary) {
    const details = summary.closest('details');
    if (!details) return false;
    const expanded = details.dataset.expanded === undefined ? !details.open : details.dataset.expanded !== 'true';
    const from = details.getBoundingClientRect().height;
    const previous = disclosures.get(details);
    previous?.cancel();
    details.dataset.expanded = String(expanded);
    summary.setAttribute('aria-expanded', String(expanded));
    if (reduced() || !details.animate) {
      details.open = expanded;
      details.style.height = '';
      details.style.overflow = '';
      delete details.dataset.expanded;
      return true;
    }
    details.open = true;
    details.style.height = '';
    const border = parseFloat(getComputedStyle(details).borderTopWidth) + parseFloat(getComputedStyle(details).borderBottomWidth);
    const to = expanded ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height + border;
    details.style.overflow = 'hidden';
    const effect = animate(details, [{ height: `${from}px` }, { height: `${to}px` }], { duration: 240 });
    disclosures.set(details, effect);
    const finish = () => {
      if (disclosures.get(details) !== effect) return;
      details.open = expanded;
      details.style.height = '';
      details.style.overflow = '';
      delete details.dataset.expanded;
      disclosures.delete(details);
    };
    effect.finished.then(finish, finish);
    return true;
  }
  function menu(force) {
    const nav = document.getElementById('public-nav');
    const button = document.getElementById('menu-toggle');
    if (!nav || !button) return;
    const expanded = force ?? button.getAttribute('aria-expanded') !== 'true';
    const wasOpen = nav.classList.contains('open');
    const from = wasOpen ? nav.getBoundingClientRect().height : 0;
    menuEffect?.cancel();
    button.setAttribute('aria-expanded', String(expanded));
    nav.inert = !expanded;
    nav.classList.add('open');
    nav.style.height = '';
    const to = expanded ? nav.getBoundingClientRect().height : 0;
    const finish = effect => {
      if (effect && menuEffect !== effect) return;
      nav.classList.toggle('open', expanded);
      nav.style.height = '';
      nav.style.overflow = '';
      menuEffect = null;
    };
    if (reduced() || !nav.animate) { finish(null); return; }
    nav.style.overflow = 'hidden';
    const effect = animate(nav, [{ height: `${from}px`, opacity: expanded ? 0 : 1 }, { height: `${to}px`, opacity: expanded ? 1 : 0 }], { duration: 220 });
    menuEffect = effect;
    effect.finished.then(() => finish(effect), () => finish(effect));
  }
  preference.addEventListener('change', () => {
    if (reduced()) {
      active.forEach(effect => effect.cancel());
      observer?.disconnect();
    } else mount(document.getElementById('app'));
  });
  document.addEventListener('focusin', event => {
    // Never move a control or its focused ancestor while it is being used.
    active.forEach(effect => { if (effect.effect?.target?.contains(event.target)) effect.cancel(); });
  });
  window.AcademyMotion = { mount, reset, disclosure, menu };
})();
