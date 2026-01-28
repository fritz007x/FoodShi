import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './index';

async function migrate() {
  console.log('Running database migrations...');

  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    await pool.query(schema);

    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
