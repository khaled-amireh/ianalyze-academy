/** Preserve Latin phrases (including punctuation) as one bidi-isolated run. */
export function splitMixedText(text: string) {
  return text
    .split(
      /([A-Za-z][A-Za-z0-9 \t.,:&/+'\u2019"!?()\u00b7\u2013\u2014-]*|[0-9]+(?:[.:/\u2013\u2014-][0-9]+)*(?:\s*[+*/=\u2013\u2014-]\s*[0-9]+(?:[.:/\u2013\u2014-][0-9]+)*)*)/g,
    )
    .map((value, index) => ({ value, isolated: index % 2 === 1 }));
}
