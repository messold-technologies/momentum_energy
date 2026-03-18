#!/usr/bin/env node
/**
 * Run database migrations.
 * Usage: node scripts/migrate.js
 * Requires: DATABASE_URL in .env
 */
import dotenv from 'dotenv';
import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');

const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required. Add it to .env');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    for (const file of migrationFiles) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`Migration ${file} completed.`);
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
