import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import categories from './config/categories.json' with { type: 'json' };
import cities from './config/cities.json' with { type: 'json' };
import networks from './config/networks.json' with { type: 'json' };
import { findProductionAdapter } from './parsers/adapterConfigs';
import { exportRouter } from './routes/export';
import { importRouter } from './routes/import';
import { parseRouter } from './routes/parse';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/exports', express.static(path.resolve(process.cwd(), 'exports')));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/config', (_req, res) =>
  res.json({
    networks: networks.map((network) => {
      const adapter = findProductionAdapter(network.network_name);
      return adapter
        ? {
            ...network,
            parser_type: adapter.parserType,
            parser_status: adapter.parserType === 'manual' ? 'inactive' : 'active',
            website_url: adapter.websiteUrl,
            notes:
              adapter.notes && adapter.notes !== 'Production search adapter'
                ? adapter.notes
                : adapter.parserType === 'manual'
                ? 'Production: manual required або потрібен окремий discovery/API adapter.'
                : `Production: ${adapter.parserType} search adapter. Якщо сайт не віддає публічні дані, результат буде MANUAL_REQUIRED.`
          }
        : { ...network, parser_status: network.parser_type === 'manual' ? 'inactive' : 'active' };
    }),
    categories,
    cities
  })
);
app.use('/api/parse', parseRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);

const distDir = path.resolve(__dirname, '../../dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(port, host, () => {
  console.log(`Retail Price Monitor running on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
  console.log(`For colleagues on the same network use http://<this-computer-ip>:${port}`);
});
