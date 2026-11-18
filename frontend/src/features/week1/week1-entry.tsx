import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useWeek1Copy } from './copy';
export function Week1Entry() {
  const { c } = useWeek1Copy();
  return (
    <section className="s-section" aria-labelledby="week1-entry">
      <div className="s-card">
        <p className="s-eyebrow">{c.studyPlan}</p>
        <h2 id="week1-entry">{c.title}</h2>
        <p>{c.description}</p>
        <Button asChild>
          <Link to="/eda/week-1">{c.week}</Link>
        </Button>
      </div>
    </section>
  );
}
