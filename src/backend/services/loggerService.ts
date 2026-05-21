import fs from 'node:fs';
import path from 'node:path';

const logDir = path.resolve(process.cwd(), 'logs');

export class LoggerService {
  private entries: string[] = [];

  info(message: string) {
    this.write('INFO', message);
  }

  warn(message: string) {
    this.write('WARN', message);
  }

  error(message: string) {
    this.write('ERROR', message);
  }

  getEntries() {
    return this.entries;
  }

  private write(level: string, message: string) {
    const line = `${new Date().toISOString()} [${level}] ${message}`;
    this.entries.push(line);
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'parser.log'), `${line}\n`, 'utf8');
  }
}
