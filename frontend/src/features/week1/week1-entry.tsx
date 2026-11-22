import { Link } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWeek1Copy } from './copy';
export function Week1Entry() {
  const { c } = useWeek1Copy();
  return (
    <section className="s-section" aria-labelledby="week1-entry">
      <div className="s-card">
        <p className="s-eyebrow">{c.studyPlan}</p>
        <h2 id="week1-entry" className="week1-completed-title">
          {c.title}
          <span className="week1-completed-badge">
            <CheckCircle2 aria-hidden="true" />
            <span>{c.completedBadge}</span>
          </span>
        </h2>
        <p>{c.description}</p>
        <Button asChild>
          <Link to="/eda/week-1">{c.week}</Link>
        </Button>
      </div>
    </section>
  );
}
