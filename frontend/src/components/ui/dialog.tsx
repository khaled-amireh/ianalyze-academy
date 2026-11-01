import * as React from 'react';
import { Dialog as Primitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
const Dialog = Primitive.Root;
const DialogTrigger = Primitive.Trigger;
const DialogClose = Primitive.Close;
const DialogPortal = Primitive.Portal;
function DialogOverlay({ className, ...props }: React.ComponentProps<typeof Primitive.Overlay>) {
  return <Primitive.Overlay className={cn('academy-overlay', className)} {...props} />;
}
function DialogContent({
  className,
  children,
  closeLabel,
  ...props
}: React.ComponentProps<typeof Primitive.Content> & { closeLabel: string }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <Primitive.Content className={cn('academy-dialog', className)} {...props}>
        {children}
        <Primitive.Close asChild>
          <Button variant="ghost" size="icon" className="dialog-close" aria-label={closeLabel}>
            <X aria-hidden="true" />
          </Button>
        </Primitive.Close>
      </Primitive.Content>
    </DialogPortal>
  );
}
function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('dialog-header', className)} {...props} />;
}
function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('dialog-footer', className)} {...props} />;
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className={cn('dialog-title', className)} {...props} />;
}
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description className={cn('text-muted-foreground', className)} {...props} />;
}
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
