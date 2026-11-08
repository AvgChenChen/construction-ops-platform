import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db,pool } from '../src/lib/db';
async function main(){await migrate(db,{migrationsFolder:'./db/migrations'});console.log('Migrations applied');await pool.end();}main().catch(e=>{console.error(e.message);process.exit(1);});
