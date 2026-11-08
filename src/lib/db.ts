import 'dotenv/config';
import { Pool, PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
const globalDb = globalThis as unknown as { millsPool?: Pool };
export const pool = globalDb.millsPool ?? new Pool({connectionString:process.env.DATABASE_URL,max:12,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,statement_timeout:15000});
if(process.env.NODE_ENV !== 'production') globalDb.millsPool = pool;
export const db = drizzle(pool,{schema});
export async function transaction<T>(fn:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await pool.connect();
 try {await c.query('BEGIN'); const result=await fn(c); await c.query('COMMIT');return result;}
 catch(e){await c.query('ROLLBACK');throw e;} finally{c.release();}
}
