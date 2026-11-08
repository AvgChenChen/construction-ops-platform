import 'dotenv/config';
import { createBackup } from '../src/lib/ops/backup';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL_REQUIRED');createBackup(process.env.DATABASE_URL,process.env.BACKUP_DIR??'.local/backups').then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('Backup failed; inspect configuration and PostgreSQL client availability.');process.exitCode=1;});
