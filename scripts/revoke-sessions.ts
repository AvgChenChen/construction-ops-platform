import 'dotenv/config';
import { pool } from '../src/lib/db';
const target=process.argv[2];if(target!=='--all'&&!/^oidc:[a-f0-9]{32}$/.test(target??''))throw new Error('Use --all or an audited oidc actor ID');
async function main(){const result=target==='--all'?await pool.query('DELETE FROM auth_session'):await pool.query('DELETE FROM auth_session WHERE actor_id=$1',[target]);await pool.query("INSERT INTO task_event(actor,type,detail) VALUES('administrator','SESSIONS_REVOKED',$1)",[JSON.stringify({count:result.rowCount})]);console.log(JSON.stringify({revoked:result.rowCount}));await pool.end();}main().catch(()=>{console.error('Session revocation failed');process.exitCode=1;});
