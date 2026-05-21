interface Props {
  value: number;
  label: string;
}

export function ProgressBar({ value, label }: Props) {
  return (
    <div className="progress-block">
      <div className="progress-meta">
        <span>{label}</span>
        <strong>{Math.round(value)}%</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
