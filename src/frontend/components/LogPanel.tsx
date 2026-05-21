import type { ParseError } from '../types';

interface Props {
  logs: string[];
  errors: ParseError[];
}

export function LogPanel({ logs, errors }: Props) {
  return (
    <section className="log-panel">
      <div className="section-title">
        <h2>Журнал виконання</h2>
        <span>{errors.length} помилок</span>
      </div>
      <div className="log-list">
        {logs.length === 0 && <p className="empty">Логи зʼявляться після запуску парсингу.</p>}
        {logs.map((entry) => (
          <div className="log-entry" key={entry}>
            {entry}
          </div>
        ))}
        {errors.map((error) => (
          <div className="log-entry log-error" key={`${error.date}-${error.errorType}`}>
            {error.errorType}: {error.errorText}
          </div>
        ))}
      </div>
    </section>
  );
}
