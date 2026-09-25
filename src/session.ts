import type { Env } from './env';
import { now, sha256 } from './utils';
export async function requireSession(req:Request,env:Env){const c=req.headers.get('cookie')||'';const m=c.match(/(?:^|;\s*)ac_session=([^;]+)/);if(!m)return null;const h=await sha256(decodeURIComponent(m[1]));const s=await env.DB.prepare(`SELECT s.buyer_id,s.messenger_psid,s.expires_at,b.buyer_name FROM sessions s JOIN buyers b ON b.id=s.buyer_id WHERE s.session_hash=?`).bind(h).first<any>();return !s||s.expires_at<now()?null:s;}
