import { bingoLine } from './domain';
// Presentation only. The parent waits for PostgreSQL to confirm each change.
export function BingoBoard({
  order,
  completed,
  challenges,
  label,
  disabled,
  onMark,
}: {
  order: number[];
  completed: number[];
  challenges: string[];
  label: string;
  disabled: boolean;
  onMark: (id: number) => void;
}) {
  const line = bingoLine(order, completed);
  return (
    <div className="week1-board" role="group" aria-label={label}>
      {order.map((id, position) => (
        <button
          type="button"
          key={id}
          className={`week1-square ${completed.includes(id) ? 'is-complete' : ''} ${line?.some((p) => p === position) ? 'is-winning' : ''}`}
          aria-pressed={completed.includes(id)}
          disabled={disabled}
          onClick={() => onMark(id)}
        >
          <span className="week1-square-number" aria-hidden="true">
            {completed.includes(id) ? '✓' : position + 1}
          </span>
          <span>{challenges[id]}</span>
        </button>
      ))}
    </div>
  );
}
