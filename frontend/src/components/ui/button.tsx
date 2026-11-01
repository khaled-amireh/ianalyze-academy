import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';
const buttonVariants = cva(
  'academy-button inline-flex max-w-full items-center justify-center gap-2 rounded-xl border font-semibold text-sm text-center whitespace-normal outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        outline: 'border-input bg-card text-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        ghost: 'border-transparent bg-transparent text-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        link: 'border-transparent text-primary underline underline-offset-4',
      },
      size: {
        default: 'min-h-12 px-5 py-3',
        sm: 'min-h-11 px-4 py-2',
        xs: 'min-h-11 px-3 py-2',
        lg: 'min-h-14 px-6 py-3',
        icon: 'size-11 shrink-0',
        'icon-sm': 'size-11 shrink-0',
        'icon-xs': 'size-11 shrink-0',
        'icon-lg': 'size-12 shrink-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
export { Button, buttonVariants };
