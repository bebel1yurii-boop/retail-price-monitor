export const zakazChainByNetwork: Array<{ network: string; chain: string }> = [
  { network: 'МЕТРО', chain: 'metro' },
  { network: 'АШАН', chain: 'auchan' },
  { network: 'НОВУС', chain: 'novus' },
  { network: 'ТАВРІЯ В', chain: 'tavriav' },
  { network: 'МЕГА-МАРКЕТ', chain: 'megamarket' },
  { network: 'УЛЬТРАМАРКЕТ', chain: 'ultramarket' },
  { network: 'ВОСТОРГ', chain: 'vostorg' },
  { network: 'ЧУДО МАРКЕТ', chain: 'chudomarket' },
  { network: 'ЕПІЦЕНТР', chain: 'epicentr' },
  { network: 'ІДЕАЛ', chain: 'ideal' }
];

export function getZakazChainForNetwork(network: string) {
  const normalized = normalize(network);
  return zakazChainByNetwork.find((item) => normalized.includes(normalize(item.network)))?.chain ?? null;
}

function normalize(value: string) {
  return value.toUpperCase().replace(/'/g, '’').replace(/\s+/g, ' ').trim();
}
