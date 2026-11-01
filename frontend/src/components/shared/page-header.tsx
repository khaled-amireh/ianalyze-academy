import { Sparkles, type LucideIcon } from 'lucide-react';
import { MixedText } from './mixed-text';

export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon = Sparkles,
}: {
  title: string;
  description: string;
  eyebrow: string;
  icon?: LucideIcon;
}) {
  return (
    <header className="page-heading">
      <div
        className="stagger-enter"
        onFocusCapture={(event) =>
          event.currentTarget
            .getAnimations({ subtree: true })
            .forEach((animation) => animation.cancel())
        }
      >
        <p className="eyebrow">
          <Icon aria-hidden="true" />
          <span>
            <MixedText>{eyebrow}</MixedText>
          </span>
        </p>
        <h1 id="page-title" tabIndex={-1}>
          <MixedText>{title}</MixedText>
        </h1>
        <p className="lede">
          <MixedText>{description}</MixedText>
        </p>
      </div>
      <div className="heading-art" aria-hidden="true">
        <Icon />
        <i />
        <i />
      </div>
    </header>
  );
}
