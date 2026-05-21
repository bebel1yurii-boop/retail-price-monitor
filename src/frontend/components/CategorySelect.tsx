interface Props {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
}

export function CategorySelect({ categories, value, onChange }: Props) {
  return (
    <label className="field">
      <span>Група товару</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </label>
  );
}
