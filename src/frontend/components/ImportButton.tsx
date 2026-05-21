import { Upload } from 'lucide-react';

interface Props {
  disabled: boolean;
  onImport: (file: File) => void;
}

export function ImportButton({ disabled, onImport }: Props) {
  return (
    <label className={`button button-secondary import-button ${disabled ? 'disabled' : ''}`}>
      <Upload size={16} />
      Імпорт Excel вручну
      <input
        type="file"
        accept=".xlsx"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.currentTarget.value = '';
        }}
      />
    </label>
  );
}
