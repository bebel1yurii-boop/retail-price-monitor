import { Play } from 'lucide-react';

interface Props {
  disabled: boolean;
  onClick: () => void;
}

export function RunParserButton({ disabled, onClick }: Props) {
  return (
    <button className="button button-primary" disabled={disabled} onClick={onClick}>
      <Play size={16} />
      Запустити парсинг
    </button>
  );
}
