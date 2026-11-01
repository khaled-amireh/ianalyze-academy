import { useEffect, useRef, type PropsWithChildren } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

export function Reveal({ children, className }: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  useEffect(() => {
    const element = ref.current;
    if (!element || reduced || !('IntersectionObserver' in window)) return;
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (!element.contains(document.activeElement))
          animation = element.animate(
            [
              { opacity: 0, transform: 'translateY(12px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            { duration: 520, easing: 'cubic-bezier(.22,.7,.2,1)' },
          );
        observer.disconnect();
      },
      { rootMargin: '0px 0px -24px 0px' },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      animation?.cancel();
    };
  }, [reduced]);
  return (
    <div
      data-reveal
      ref={ref}
      className={cn('min-w-0', className)}
      onFocusCapture={() => ref.current?.getAnimations().forEach((animation) => animation.cancel())}
    >
      {children}
    </div>
  );
}
