import type { Env } from './env';
import { now, randomToken, sha256 } from './utils';

export async function sendMessenger(env:Env,psid:string,text:string){
  const u=`https://graph.facebook.com/${env.META_GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(env.META_PAGE_ACCESS_TOKEN)}`;
  const r=await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({recipient:{id:psid},messaging_type:'RESPONSE',message:{text}})});
  if(!r.ok)throw new Error(`Meta Send API ${r.status}`);
}

export async function createLoginLink(env:Env,psid:string){
  const raw=randomToken();
  const hash=await sha256(raw);
  await env.DB.prepare('INSERT INTO login_links (token_hash, messenger_psid, expires_at) VALUES (?, ?, ?)').bind(hash,psid,now()+900).run();
  return `${env.APP_URL.replace(/\/$/,'')}/?token=${encodeURIComponent(raw)}`;
}

export async function readLoginLink(env:Env,raw:string){
  return env.DB.prepare('SELECT messenger_psid, expires_at FROM login_links WHERE token_hash=?').bind(await sha256(raw)).first<{messenger_psid:string;expires_at:number}>();
}
