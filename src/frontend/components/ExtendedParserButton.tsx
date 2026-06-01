import { ScanSearch } from 'lucide-react';

interface Props {
  disabled: boolean;
  onClick: () => void;
}

export function ExtendedParserButton({ disabled, onClick }: Props) {
  return (
    <button className="button button-extended" disabled={disabled} onClick={onClick}>
      <ScanSearch size={16} />
      Розширений парсинг
    </button>
  );
}
