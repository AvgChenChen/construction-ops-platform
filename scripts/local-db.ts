import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync } from 'node:fs';
mkdirSync('.local',{recursive:true});
const pg=new EmbeddedPostgres({databaseDir:'.local/postgres',user:'recruiting',password:'local-development-only',port:54329,persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1']});
async function main(){if(!existsSync('.local/postgres/PG_VERSION'))await pg.initialise();await pg.start();const client=pg.getPgClient();await client.connect();for(const name of ['recruiting','recruiting_test']){const r=await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[name]);if(!r.rowCount)await client.query(`CREATE DATABASE ${name}`);}await client.end();console.log('Local PostgreSQL ready on 127.0.0.1:54329. Ctrl-C stops the server; data persists.');}
process.on('SIGINT',async()=>{await pg.stop();process.exit();});process.on('SIGTERM',async()=>{await pg.stop();process.exit();});main().catch(e=>{console.error(e.message);process.exit(1);});
