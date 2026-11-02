import { ArrowRight, Code2, Database, ChartNoAxesCombined, FolderCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MixedText } from './mixed-text';

const topics = [
  { icon: Code2, id: 'python1', weeks: '01 / 02' },
  { icon: Database, id: 'pandas', weeks: '03 / 04' },
  { icon: ChartNoAxesCombined, id: 'visualization', weeks: '05' },
  { icon: FolderCheck, id: 'project', weeks: '06' },
] as const;

/** Navigable overview of the real public syllabus, not student progress. */
export function DataStory() {
  const { t } = useTranslation();
  return (
    <aside className="learning-preview" aria-labelledby="learning-preview-title">
      <div className="learning-preview-heading">
        <span className="course-monogram" aria-hidden="true">
          EDA
        </span>
        <span className="course-level">{t('academy.home.beginnerLabel')}</span>
      </div>
      <h2 id="learning-preview-title">{t('redesign.courseTitle')}</h2>
      <p>{t('redesign.courseDescription')}</p>
      <ol className="learning-path">
        {topics.map(({ icon: Icon, id, weeks }) => (
          <li key={id}>
            <Icon aria-hidden="true" />
            <span>
              <MixedText>{t(`redesign.path.${id}`)}</MixedText>
            </span>
            <span className="path-week">
              <span>{t('academy.week')}</span> <bdi dir="ltr">{weeks}</bdi>
            </span>
          </li>
        ))}
      </ol>
      <Link className="course-link" to="/eda">
        <MixedText>{t('academy.fullSyllabus')}</MixedText>
        <ArrowRight className="directional" aria-hidden="true" />
      </Link>
    </aside>
  );
}
