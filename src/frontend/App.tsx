import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Moon, RefreshCw, ShieldCheck, SunMedium } from 'lucide-react';
import { CategorySelect } from './components/CategorySelect';
import { CitySelect } from './components/CitySelect';
import { ExportButton } from './components/ExportButton';
import { LogPanel } from './components/LogPanel';
import { ImportButton } from './components/ImportButton';
import { NetworkSelect } from './components/NetworkSelect';
import { ProgressBar } from './components/ProgressBar';
import { ResultsTable } from './components/ResultsTable';
import { RunParserButton } from './components/RunParserButton';
import type { NetworkConfig, ParseError, ParseResult, PriceRow } from './types';

interface AppConfig {
  networks: NetworkConfig[];
  categories: string[];
  cities: string[];
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>({ networks: [], categories: [], cities: [] });
  const [networks, setNetworks] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [exportUrl, setExportUrl] = useState('');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((response) => response.json())
      .then((data: AppConfig) => {
        setConfig(data);
        const firstActive = data.networks.find((item) => item.parser_status !== 'inactive')?.network_name;
        setNetworks(firstActive ? [firstActive] : []);
        setCity(data.cities[0] ?? '');
        setCategory(data.categories[0] ?? '');
      })
      .catch(() => setLogs((current) => [...current, 'Не вдалося завантажити конфігурацію']));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setProgress((value) => Math.min(value + 7, 92));
    }, 320);
    return () => window.clearInterval(id);
  }, [running]);

  const selectedNetworks = useMemo(
    () => config.networks.filter((item) => networks.includes(item.network_name)),
    [config.networks, networks]
  );

  const visibleCities = useMemo(() => unique(selectedNetworks.flatMap((item) => item.supported_cities)).length ? unique(selectedNetworks.flatMap((item) => item.supported_cities)) : config.cities, [config.cities, selectedNetworks]);
  const visibleCategories = useMemo(() => unique(selectedNetworks.flatMap((item) => item.supported_categories)).length ? unique(selectedNetworks.flatMap((item) => item.supported_categories)) : config.categories, [config.categories, selectedNetworks]);
  const runnableNetworks = selectedNetworks.filter((item) => item.parser_status !== 'inactive');

  useEffect(() => {
    if (visibleCities.length && !visibleCities.includes(city)) setCity(visibleCities[0]);
  }, [city, visibleCities]);

  useEffect(() => {
    if (visibleCategories.length && !visibleCategories.includes(category)) setCategory(visibleCategories[0]);
  }, [category, visibleCategories]);

  async function runParser() {
    setRunning(true);
    setProgress(8);
    setExportUrl('');
    setRows([]);
    setErrors([]);
    setLogs([`Batch запуск: ${runnableNetworks.map((item) => item.network_name).join(', ')} / ${city} / ${category}`]);
    const allRows: PriceRow[] = [];
    const allErrors: ParseError[] = [];
    const allLogs: string[] = [];
    try {
      for (const [index, item] of runnableNetworks.entries()) {
        if (item.supported_cities.length && !item.supported_cities.includes(city)) {
          allErrors.push({
            date: new Date().toISOString(),
            network: item.network_name,
            city,
            category,
            url: item.website_url,
            errorType: 'UNSUPPORTED_CITY',
            errorText: `${item.network_name} не підтримує місто ${city} у поточній конфігурації`,
            manualReview: true
          });
          continue;
        }

        setLogs((current) => [...current, `Старт мережі ${index + 1}/${runnableNetworks.length}: ${item.network_name}`]);
        const response = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ network: item.network_name, city, category })
        });
        if (!response.ok) throw new Error(`${item.network_name}: API error ${response.status}`);
        const result = (await response.json()) as ParseResult;
        allRows.push(...result.rows);
        allErrors.push(...result.errors);
        allLogs.push(...result.logs);
        setRows([...allRows]);
        setErrors([...allErrors]);
        setLogs((current) => [...current, ...result.logs]);
        setProgress(Math.min(95, Math.round(((index + 1) / runnableNetworks.length) * 100)));
      }
      setRows(allRows);
      setErrors(allErrors);
      setLogs([...allLogs, `Batch завершено: ${allRows.length} SKU, ${allErrors.length} errors`]);
      setProgress(100);
    } catch (error) {
      setErrors([
        {
          date: new Date().toISOString(),
          network: networks.join(', '),
          city,
          category,
          url: '',
          errorType: 'FRONTEND_API_ERROR',
          errorText: error instanceof Error ? error.message : String(error),
          manualReview: true
        }
      ]);
      setLogs((current) => [...current, `ERROR: ${error instanceof Error ? error.message : String(error)}`]);
      setProgress(100);
    } finally {
      setRunning(false);
    }
  }

  async function exportExcel() {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, errors })
    });
    const data = (await response.json()) as { downloadUrl: string };
    setExportUrl(data.downloadUrl);
    window.location.href = data.downloadUrl;
  }

  async function importExcel(file: File) {
    setLogs((current) => [...current, `Manual import started: ${file.name}`]);
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      body: await file.arrayBuffer()
    });
    if (!response.ok) {
      const message = await response.text();
      setLogs((current) => [...current, `ERROR: ${message}`]);
      return;
    }
    const data = (await response.json()) as Pick<ParseResult, 'rows' | 'errors' | 'logs'>;
    setRows(data.rows);
    setErrors(data.errors);
    setLogs((current) => [...current, ...data.logs]);
  }

  const promoCount = rows.filter((row) => row.promoFlag === 'так').length;
  const manualCount = rows.filter((row) => row.sourceStatus === 'потребує ручної перевірки').length;
  const avgDiscount = average(rows.map((row) => row.discountPct));

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Retail Price Monitor</h1>
          <p>Збір цін для RGM, комерції, маркетингу та трейд-маркетингу</p>
        </div>
        <button className="icon-button" aria-label="Перемкнути тему" onClick={() => setDark((value) => !value)}>
          {dark ? <SunMedium size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="workspace">
        <aside className="control-rail">
          <div className="rail-title">
            <RefreshCw size={18} />
            <span>Параметри збору</span>
          </div>
          <NetworkSelect networks={config.networks} value={networks} onChange={setNetworks} />
          <CitySelect cities={visibleCities} value={city} onChange={setCity} />
          <CategorySelect categories={visibleCategories} value={category} onChange={setCategory} />
          <RunParserButton disabled={running || !runnableNetworks.length || !city || !category} onClick={runParser} />
          <ExportButton disabled={!rows.length || running} onClick={exportExcel} />
          <ImportButton disabled={running} onImport={importExcel} />
          {runnableNetworks.length > 0 && (
            <div className="adapter-note">
              <strong>{runnableNetworks.length} мереж</strong>
              <span>{runnableNetworks.map((item) => `${item.network_name}: ${item.parser_type}`).join(' / ')}</span>
            </div>
          )}
          {exportUrl && <a className="download-link" href={exportUrl}>Останній Excel export</a>}
        </aside>

        <section className="content-area">
          <div className="kpi-grid">
            <Kpi icon={<Activity size={18} />} label="SKU" value={rows.length.toString()} />
            <Kpi icon={<ShieldCheck size={18} />} label="Промо SKU" value={promoCount.toString()} />
            <Kpi icon={<AlertTriangle size={18} />} label="Manual required" value={manualCount.toString()} />
            <Kpi icon={<RefreshCw size={18} />} label="Середня знижка" value={avgDiscount === null ? '-' : `${avgDiscount}%`} />
          </div>
          <ProgressBar value={progress} label={running ? 'Парсинг виконується' : 'Стан виконання'} />
          <ResultsTable rows={rows} />
          <LogPanel logs={logs} errors={errors} />
        </section>
      </main>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="kpi-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function average(values: Array<number | null>) {
  const clean = values.filter((value): value is number => typeof value === 'number');
  return clean.length ? Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(1)) : null;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
