interface Props {
  cities: string[];
  value: string;
  onChange: (value: string) => void;
}

export function CitySelect({ cities, value, onChange }: Props) {
  return (
    <label className="field">
      <span>Місто</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
    </label>
  );
}
