import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { shouldTransitionPage } from '@/app/page-transition';
import iTeamLight from '@/assets/brand/iteam-logo-light.png';
import iTeamTransparent from '@/assets/brand/iteam-logo-transparent-ready.png';
import './page-transition.css';

export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(pathname);
  const content = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLDivElement>(null);

  // Start before paint, without intercepting navigation or retaining the old outlet.
  useLayoutEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (
      !shouldTransitionPage(previous, pathname, navigationType) ||
      motion.matches ||
      !content.current?.animate ||
      !overlay.current ||
      !logo.current
    )
      return;

    // Ease each moving segment separately so the 150–550ms hold stays exactly 400ms.
    const timing = { duration: 800, easing: 'linear' };
    const fadeInEnd = 150 / timing.duration;
    const fadeOutStart = 550 / timing.duration;
    const easing = 'cubic-bezier(0.22, 0.7, 0.2, 1)';
    const animations = [
      overlay.current.animate(
        [
          { opacity: 0, offset: 0, easing },
          { opacity: 1, offset: fadeInEnd },
          { opacity: 1, offset: fadeOutStart, easing },
          { opacity: 0, offset: 1 },
        ],
        timing,
      ),
      logo.current.animate(
        [
          { opacity: 0, transform: 'scale(0.97)', offset: 0, easing },
          { opacity: 1, transform: 'scale(1)', offset: fadeInEnd },
          { opacity: 1, transform: 'scale(1)', offset: fadeOutStart, easing },
          { opacity: 0, transform: 'scale(1)', offset: 1 },
        ],
        timing,
      ),
      content.current.animate(
        [
          { opacity: 0, transform: 'translateY(6px)', offset: 0 },
          { opacity: 0, transform: 'translateY(6px)', offset: fadeOutStart, easing },
          { opacity: 1, transform: 'translateY(0)', offset: 1 },
        ],
        timing,
      ),
    ];
    const cancel = () => animations.forEach((animation) => animation.cancel());
    const onMotionChange = () => {
      if (motion.matches) cancel();
    };
    motion.addEventListener('change', onMotionChange);
    return () => {
      cancel();
      motion.removeEventListener('change', onMotionChange);
    };
  }, [pathname, navigationType]);

  return (
    <>
      <div ref={content} className="page-transition-content">
        {children}
      </div>
      <div ref={overlay} className="page-transition-overlay" aria-hidden="true">
        <div className="page-transition-logo-position">
          <div ref={logo} className="page-transition-logo">
            <img
              className="page-transition-logo-light"
              src={iTeamLight}
              alt=""
              width={1536}
              height={668}
            />
            <img
              className="page-transition-logo-dark"
              src={iTeamTransparent}
              alt=""
              width={1902}
              height={827}
            />
          </div>
        </div>
      </div>
    </>
  );
}
