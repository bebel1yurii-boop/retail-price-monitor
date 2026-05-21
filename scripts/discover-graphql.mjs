const endpoint = process.argv[2];
const queryType = process.argv[3] ?? 'RootSchemaQuery';
if (!endpoint) throw new Error('Usage: node scripts/discover-graphql.mjs <endpoint> [queryType]');

const query = `query IntrospectionFields {
  __type(name: "${queryType}") {
    fields {
      name
      args {
        name
        type { name kind ofType { name kind ofType { name kind } } }
      }
      type { name kind ofType { name kind ofType { name kind } } }
    }
  }
}`;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Mozilla/5.0 RetailPriceMonitor/0.1' },
  body: JSON.stringify({ query })
});
const payload = await response.json();
if (payload.errors) console.error(JSON.stringify(payload.errors, null, 2));
const fields = payload.data?.__type?.fields ?? [];
for (const field of fields.filter((item) => /product|categor|search|store|offer/i.test(item.name))) {
  console.log('\nFIELD', field.name);
  console.log('TYPE', JSON.stringify(field.type));
  console.log('ARGS', JSON.stringify(field.args));
}
