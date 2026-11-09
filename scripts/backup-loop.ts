import 'dotenv/config';
import { createBackup, recordOpsEvent } from '../src/lib/ops/backup';
let stopped=false;process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
async function main(){while(!stopped){let delay=86400;try{if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL_REQUIRED');await createBackup(process.env.DATABASE_URL,process.env.BACKUP_DIR??'/backups');console.log(JSON.stringify({event:'BACKUP_COMPLETED',time:new Date().toISOString()}));}catch{console.error(JSON.stringify({event:'BACKUP_FAILED',time:new Date().toISOString()}));await recordOpsEvent('BACKUP_FAILED');delay=300;}for(let i=0;i<delay&&!stopped;i++)await new Promise(r=>setTimeout(r,1000));}}
main();
