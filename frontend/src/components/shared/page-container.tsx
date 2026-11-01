import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function PageContainer({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('page-container', className)} {...props} />;
}
export function ResponsiveGrid({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3', className)} {...props} />
  );
}
