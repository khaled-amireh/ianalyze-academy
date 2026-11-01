import type { ReactNode } from 'react';
import { MixedText } from './mixed-text';

export function SectionHeading({
  title,
  eyebrow,
  description,
  action,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && (
          <p className="eyebrow">
            <MixedText>{eyebrow}</MixedText>
          </p>
        )}
        <h2>
          <MixedText>{title}</MixedText>
        </h2>
        {description && (
          <p className="text-muted-foreground">
            <MixedText>{description}</MixedText>
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
