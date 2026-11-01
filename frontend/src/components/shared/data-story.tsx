import { BookOpen, ChartNoAxesColumn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MixedText } from './mixed-text';

export function DataStory() {
  const { t } = useTranslation();
  return (
    <div className="hero-visual">
      <div className="data-dots" aria-hidden="true" />
      <div className="insight-board">
        <div className="board-top">
          <span className="board-symbol">
            <ChartNoAxesColumn aria-hidden="true" />
          </span>
          <span>{t('home.journey')}</span>
          <span className="board-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="board-body">
          <p className="small-label">{t('home.illustration')}</p>
          <h2>{t('home.chartTitle')}</h2>
          <svg
            className="data-chart"
            viewBox="0 0 440 206"
            role="img"
            aria-label={t('home.chartAlt')}
          >
            <g className="chart-grid" strokeDasharray="2 6">
              <path d="M10 35H430M10 85H430M10 135H430M10 185H430" />
            </g>
            <g className="chart-bars">
              {[82, 105, 75, 128, 103, 151, 130].map((height, i) => (
                <rect key={i} x={22 + i * 60} y={185 - height} width="28" height={height} rx="5" />
              ))}
            </g>
            <path
              className="chart-line"
              d="M36 87 96 63 156 79 216 39 276 49 336 14 396 25"
              fill="none"
              strokeWidth="3"
            />
            <g className="chart-points">
              {[
                [36, 87],
                [156, 79],
                [276, 49],
                [396, 25],
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="6" />
              ))}
            </g>
          </svg>
          <div className="journey-steps">
            {[0, 1, 2].map((i) => (
              <span key={i}>
                <b dir="ltr">0{i + 1}</b>
                <span>{t('home.steps', { returnObjects: true })[i]}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="board-foot">
          <span aria-hidden="true" />
          <bdi dir="ltr" lang="en">
            {t('home.toolkit')}
          </bdi>
        </div>
      </div>
      <div className="notebook-note" aria-hidden="true">
        <span className="note-icon">
          <BookOpen />
        </span>
        <div>
          <small>{t('home.noteLabel')}</small>
          <strong>
            <MixedText>{t('home.note')}</MixedText>
          </strong>
        </div>
        <span dir="ltr">01</span>
      </div>
    </div>
  );
}
