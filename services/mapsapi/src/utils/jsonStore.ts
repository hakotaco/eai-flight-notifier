import { promises as fs } from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

async function ensureDir() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch {}
}

export class JsonStore<T extends object> {
  private filePath: string;
  private initial: T;

  constructor(filename: string, initial: T) {
    this.filePath = path.join(dataDir, filename);
    this.initial = initial;
  }

  async read(): Promise<T> {
    await ensureDir();
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(data) as T;
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        await this.write(this.initial);
        return this.initial;
      }
      throw e;
    }
  }

  async write(value: T): Promise<void> {
    await ensureDir();
    const json = JSON.stringify(value, null, 2);
    await fs.writeFile(this.filePath, json, 'utf8');
  }
}
