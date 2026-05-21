import categories from '../src/backend/config/categories.json' with { type: 'json' };
import cities from '../src/backend/config/cities.json' with { type: 'json' };
import networks from '../src/backend/config/networks.json' with { type: 'json' };

const activeOverrides: Record<string, { parser_type: string; website_url: string; notes: string }> = {
  МЕТРО: {
    parser_type: 'api',
    website_url: 'https://stores-api.zakaz.ua',
    notes: 'Zakaz API adapter.'
  },
  АШАН: {
    parser_type: 'api',
    website_url: 'https://stores-api.zakaz.ua',
    notes: 'Zakaz API adapter.'
  },
  'ВЕЛИКА КИШЕНЯ': {
    parser_type: 'api',
    website_url: 'https://kishenya.ua',
    notes: 'WooCommerce Store API adapter.'
  },
  ВАРУС: {
    parser_type: 'api',
    website_url: 'https://varus.ua/api/catalog/vue_storefront_catalog_2/product_v2/_search',
    notes: 'Vue Storefront search adapter: Multisearch IDs + product_v2 catalog details.'
  },
  ВОСТОРГ: {
    parser_type: 'api',
    website_url: 'https://stores-api.zakaz.ua',
    notes: 'Zakaz API adapter.'
  },
  'ЧУДО МАРКЕТ': {
    parser_type: 'api',
    website_url: 'https://stores-api.zakaz.ua',
    notes: 'Zakaz API adapter.'
  },
  ЕПІЦЕНТР: {
    parser_type: 'api',
    website_url: 'https://stores-api.zakaz.ua',
    notes: 'Zakaz API adapter.'
  },
  'МЕГА-МАРКЕТ': {
    parser_type: 'api',
    website_url: 'https://stores-api.zakaz.ua',
    notes: 'Zakaz API adapter.'
  },
  УЛЬТРАМАРКЕТ: {
    parser_type: 'api',
    website_url: 'https://stores-api.zakaz.ua',
    notes: 'Zakaz API adapter.'
  },
  ІДЕАЛ: {
    parser_type: 'api',
    website_url: 'https://stores-api.zakaz.ua',
    notes: 'Zakaz API adapter.'
  },
  'ТАВРІЯ В': {
    parser_type: 'api',
    website_url: 'https://stores-api.zakaz.ua',
    notes: 'Zakaz API adapter.'
  },
  НОВУС: {
    parser_type: 'api',
    website_url: 'https://stores-api.zakaz.ua',
    notes: 'Zakaz API adapter.'
  },
  ФОЗЗІ: {
    parser_type: 'playwright',
    website_url: 'https://fozzyshop.ua',
    notes: 'Playwright DOM adapter. На Vercel може бути обмежений runtime; стабільніше на окремому backend worker.'
  },
  ФОРА: {
    parser_type: 'api',
    website_url: 'https://api.catalog.ecom.fora.ua/api/2.0/exec/EcomCatalogGlobal',
    notes: 'EcomCatalogGlobal adapter: GetSimpleCatalogItems.'
  },
  ТРАШ: {
    parser_type: 'api',
    website_url: 'https://thrash.ua/graphql',
    notes: 'GraphQL search adapter.'
  }
};

export default function handler(_req: unknown, res: { status: (code: number) => { json: (payload: unknown) => void } }) {
  res.status(200).json({
    networks: networks.map((network) => {
      const override = activeOverrides[network.network_name];
      const enabledOnVercel = network.network_name === 'ФОРА';
      return override
        ? {
            ...network,
            ...override,
            parser_status: enabledOnVercel ? 'active' : 'inactive',
            notes: enabledOnVercel
              ? override.notes
              : `${override.notes} На Vercel вимкнено: потрібен окремий backend worker/server для production parsing.`
          }
        : { ...network, parser_type: 'manual', parser_status: 'inactive' };
    }),
    categories,
    cities
  });
}
