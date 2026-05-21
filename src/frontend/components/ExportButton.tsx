import { FileSpreadsheet } from 'lucide-react';

interface Props {
  disabled: boolean;
  onClick: () => void;
}

export function ExportButton({ disabled, onClick }: Props) {
  return (
    <button className="button button-secondary" disabled={disabled} onClick={onClick}>
      <FileSpreadsheet size={16} />
      Експорт в Excel
    </button>
  );
}
