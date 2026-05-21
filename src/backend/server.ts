import { app } from './app';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

app.listen(port, host, () => {
  console.log(`Retail Price Monitor running on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
  console.log(`For colleagues on the same network use http://<this-computer-ip>:${port}`);
});
