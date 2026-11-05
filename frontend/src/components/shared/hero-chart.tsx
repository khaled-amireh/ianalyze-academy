/** Decorative, animated chart for the home hero. Purely visual: no real data. */
const bars = [38, 62, 48, 80, 66, 92];

export function HeroChart() {
  return (
    <div className="s-hero-chart" aria-hidden="true">
      <div className="s-hero-chart-top">
        <span className="s-dot" />
        <span className="s-dot" />
        <span className="s-dot" />
        <code dir="ltr">df.plot()</code>
      </div>
      <div className="s-hero-bars">
        {bars.map((height, index) => (
          <span
            key={index}
            className="s-bar"
            style={{ '--h': `${height}%`, '--i': index } as React.CSSProperties}
          />
        ))}
        <svg className="s-hero-line" viewBox="0 0 300 120" preserveAspectRatio="none">
          <polyline points="0,96 60,70 120,82 180,40 240,52 300,14" />
        </svg>
      </div>
    </div>
  );
}
