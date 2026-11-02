import { useEffect, useRef, type PropsWithChildren } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { animate } from 'motion/mini';

export function Reveal({ children, className }: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  useEffect(() => {
    const element = ref.current;
    if (!element || reduced || !('IntersectionObserver' in window)) return;
    let animation: ReturnType<typeof animate> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (!element.contains(document.activeElement))
          animation = animate(
            element,
            { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0)'] },
            { duration: 0.42, ease: [0.22, 0.7, 0.2, 1] },
          );
        observer.disconnect();
      },
      { rootMargin: '0px 0px -24px 0px' },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      animation?.stop();
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
