import { createHash,randomBytes,timingSafeEqual } from 'node:crypto';
import { pool } from './db';
import { appOrigin,localAllowed,oidcConfigured,oidcAllowedSubjects } from './ops/config';
export type Actor = { id: string; role: 'operator' | 'worker' | 'viewer' };
export const cookieName='mills_session';
export const loginDestinationCookie='mills_login_destination';
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function safeRedirectPath(value: string | null | undefined) {
  const destination = value ?? '/mills';
  if (!destination.startsWith('/') || destination.startsWith('//')) return '/mills';
  try {
    const origin = new URL(appOrigin());
    const resolved = new URL(destination, origin);
    if (resolved.origin !== origin.origin || resolved.pathname.startsWith('/api')) return '/mills';
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/mills';
  }
}
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function configured(){return oidcConfigured()||(localAllowed()&&!!process.env.DASHBOARD_PASSWORD);}
export function validPassword(value:string){return localAllowed()&&configured()&&equal(value,process.env.DASHBOARD_PASSWORD??'');}
export function cookieOptions(){return {httpOnly:true,sameSite:'lax' as const,secure:new URL(appOrigin()).protocol==='https:',path:'/',maxAge:28800};}
export async function makeSession(identity?:{issuer:string;subject:string}){if(!configured())throw new Error('AUTH_NOT_CONFIGURED');if(identity){if(!oidcConfigured()||identity.issuer!==process.env.OIDC_ISSUER||!oidcAllowedSubjects().includes(identity.subject))throw new Error('IDENTITY_NOT_ALLOWED');}else if(!localAllowed())throw new Error('LOCAL_LOGIN_DISABLED');const token=randomBytes(32).toString('base64url');const issuer=identity?.issuer??'local',subject=identity?.subject??'local-operator';const actorId=identity?'oidc:'+hash(issuer+'\0'+subject).slice(0,32):'local-operator';await pool.query("INSERT INTO auth_session(hash,actor_id,issuer,subject,mode,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '8 hours')",[hash(token),actorId,issuer,subject,identity?'oidc':'local']);await pool.query("INSERT INTO task_event(actor,type,detail) VALUES($1,'AUTH_SIGNED_IN',$2)",[actorId,JSON.stringify({mode:identity?'oidc':'local'})]);return token;}
export async function sessionActor(token:string|undefined):Promise<Actor|null>{if(!configured()||!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;const {rows:[s]}=await pool.query("SELECT * FROM auth_session WHERE hash=$1 AND expires_at>now() AND last_seen>now()-interval '30 minutes'",[hash(token)]);if(!s)return null;if(s.mode==='local'&&!localAllowed())return null;if(s.mode==='oidc'&&(!oidcConfigured()||s.issuer!==process.env.OIDC_ISSUER||!oidcAllowedSubjects().includes(s.subject)))return null;await pool.query('UPDATE auth_session SET last_seen=now() WHERE hash=$1',[hash(token)]);return {id:s.actor_id,role:'operator'};}
export async function validSession(token:string|undefined){return !!await sessionActor(token);}
export async function revokeSession(token:string|undefined){if(token){const {rows:[s]}=await pool.query('DELETE FROM auth_session WHERE hash=$1 RETURNING actor_id',[hash(token)]);if(s)await pool.query("INSERT INTO task_event(actor,type) VALUES($1,'AUTH_SIGNED_OUT')",[s.actor_id]);}}
export function validOrigin(request:Request){try{return request.headers.get('origin')===appOrigin();}catch{return false;}}
export async function allowLogin(key:string,limit=10){const {rows:[r]}=await pool.query("INSERT INTO auth_throttle(key,attempts,until) VALUES($1,1,now()+interval '1 minute') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_throttle.until<now() THEN 1 ELSE auth_throttle.attempts+1 END,until=CASE WHEN auth_throttle.until<now() THEN now()+interval '1 minute' ELSE auth_throttle.until END RETURNING attempts",[key]);return r.attempts<=limit;}
/** Security audit trail for failed sign-ins. Stores only the event type and mode, never the submitted value. */
export async function recordAuthFailure(mode:'local'|'oidc'){try{await pool.query("INSERT INTO task_event(actor,type,detail) VALUES('anonymous',$1,$2)",[mode==='oidc'?'AUTH_OIDC_FAILED':'AUTH_SIGN_IN_FAILED',JSON.stringify({mode})]);}catch{/* audit write must not turn a failed login into a 500 */}}
