import { Fragment } from 'react';
import { splitMixedText } from '@/lib/mixed-text';

/** Isolate technical terms and numeric expressions without inserting HTML. */
export function MixedText({ children }: { children: string }) {
  return (
    <span className="mixed-text">
      {splitMixedText(children).map(({ value: part, isolated }, index) =>
        isolated ? (
          <Fragment key={index}>
            <bdi dir="ltr" lang="en">
              {part.trimEnd()}
            </bdi>
            {part.match(/\s+$/)?.[0] ?? ''}
          </Fragment>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </span>
  );
}
