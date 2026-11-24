import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { __orbitMongo?: Cache };
const cache: Cache = (g.__orbitMongo ??= { conn: null, promise: null });

async function resolveUri(): Promise<string> {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  // Zero-config dev: embedded, persistent MongoDB stored in ./.data/mongo
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.join(process.cwd(), '.data', 'mongo');
  fs.mkdirSync(dbPath, { recursive: true });
  const lock = path.join(process.cwd(), '.data', 'mongo-uri.txt');
  if (fs.existsSync(lock)) {
    const uri = fs.readFileSync(lock, 'utf8').trim();
    try {
      const c = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 1500 }).asPromise();
      await c.close();
      return uri; // an embedded instance is already running (e.g. started by the seed script)
    } catch {
      /* stale – start a new one */
    }
  }
  const mem = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger', port: 27818 } });
  (globalThis as any).__orbitMem = mem;
  const uri = mem.getUri('orbit');
  fs.writeFileSync(lock, uri);
  return uri;
}

export async function connectDB() {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = resolveUri().then((uri) => mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'team-sprint', serverSelectionTimeoutMS: 15000, maxPoolSize: 20, minPoolSize: 4, retryReads: true }));
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

export async function closeDB() {
  await mongoose.disconnect();
  await (globalThis as any).__orbitMem?.stop({ doCleanup: false });
  try { fs.rmSync(path.join(process.cwd(), '.data', 'mongo-uri.txt')); } catch { /* ignore */ }
}
