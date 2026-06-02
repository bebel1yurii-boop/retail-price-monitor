import type { NetworkConfig } from '../types';

interface Props {
  networks: NetworkConfig[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function NetworkSelect({ networks, value, onChange }: Props) {
  const selected = new Set(value);
  const groups = [
    { key: 'primary', label: 'Основні мережі', items: networks.filter((network) => !network.source_group) },
    {
      key: 'gotoshop-promo',
      label: 'GoToShop промо',
      items: networks.filter((network) => network.source_group === 'gotoshop-promo')
    }
  ].filter((group) => group.items.length);

  function toggle(networkName: string) {
    const next = selected.has(networkName)
      ? value.filter((item) => item !== networkName)
      : [...value, networkName];
    onChange(next);
  }

  return (
    <label className="field">
      <span>Мережі</span>
      <div className="network-picker" role="group" aria-label="Мережі">
        {groups.map((group) => (
          <div className="network-group" key={group.key}>
            <strong className="network-group-label">{group.label}</strong>
            {group.items.map((network) => (
              <label
                key={network.network_name}
                className={`network-option${network.parser_status === 'inactive' ? ' network-option-disabled' : ''}`}
                title={network.notes}
              >
                <input
                  type="checkbox"
                  checked={selected.has(network.network_name)}
                  disabled={network.parser_status === 'inactive'}
                  onChange={() => toggle(network.network_name)}
                />
                <span>{network.network_name}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </label>
  );
}
