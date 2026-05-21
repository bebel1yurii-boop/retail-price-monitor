import { createParser } from '../parsers/parserFactory';
import { createExcelExport } from '../services/excelService';
import { LoggerService } from '../services/loggerService';

const network = process.env.NETWORK ?? 'АТБ МАРКЕТ';
const city = process.env.CITY ?? 'Київ';
const category = process.env.CATEGORY ?? 'М’ясо птиці';

const logger = new LoggerService();
const parser = createParser({ network, city, category }, logger);
const result = await parser.parse();
const exported = await createExcelExport(result.rows, result.errors);

console.log(JSON.stringify({ rows: result.rows.length, errors: result.errors.length, export: exported.filePath }, null, 2));
