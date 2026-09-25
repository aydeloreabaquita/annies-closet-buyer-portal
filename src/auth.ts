import type { Env } from './env';
import { json, normalizeName, now, otpCode, hmacHex, equal, randomToken, sha256 } from './utils';
import { readLoginLink, sendMessenger } from './messenger';

export async function authRoute(req:Request,env:Env,url:URL){
 if(url.pathname==='/api/auth/context'&&req.method==='POST'){
  const {token}=await req.json<any>();
  if(!token)return json({error:'Missing login token'},400);
  const l=await readLoginLink(env,token);
  if(!l||l.expires_at<now())return json({error:'This Messenger link has expired.'},401);
  const b=await env.DB.prepare("SELECT id,buyer_name FROM buyers WHERE messenger_psid=? AND link_status='linked'").bind(l.messenger_psid).first<any>();
  return json({linked:!!b,buyerName:b?.buyer_name||null,needsClaim:!b});
 }

 if(url.pathname==='/api/auth/request-otp'&&req.method==='POST'){
  const body=await req.json<any>();
  const l=body.token&&await readLoginLink(env,body.token);
  if(!l||l.expires_at<now())return json({error:'Messenger link expired'},401);
  let b=await env.DB.prepare("SELECT id,buyer_name FROM buyers WHERE messenger_psid=? AND link_status='linked'").bind(l.messenger_psid).first<any>();
  if(!b&&body.buyerName){
   const m=await env.DB.prepare('SELECT id,buyer_name FROM buyers WHERE normalized_name=? LIMIT 2').bind(normalizeName(body.buyerName)).all();
   if(m.results.length===1)b=m.results[0];
  }
  const code=otpCode(),id=crypto.randomUUID(),hash=await hmacHex(env.META_APP_SECRET,`${id}:${code}`),exp=now()+Number(env.OTP_MINUTES||10)*60;
  await env.DB.prepare('INSERT INTO otp_challenges (id,messenger_psid,buyer_id,code_hash,expires_at) VALUES (?,?,?,?,?)').bind(id,l.messenger_psid,b?.id||null,hash,exp).run();
  await sendMessenger(env,l.messenger_psid,`Your Annie's Closet verification code is ${code}. It expires in ${env.OTP_MINUTES||10} minutes.`);
  return json({challengeId:id});
 }

 if(url.pathname==='/api/auth/verify-otp'&&req.method==='POST'){
  const body=await req.json<any>();
  const c=body.challengeId&&await env.DB.prepare('SELECT * FROM otp_challenges WHERE id=?').bind(body.challengeId).first<any>();
  if(!c||c.used_at||c.expires_at<now())return json({error:'Code expired'},401);
  if(c.attempts>=5)return json({error:'Too many attempts'},429);
  const hash=await hmacHex(env.META_APP_SECRET,`${c.id}:${body.code||''}`);
  if(!equal(hash,c.code_hash)){
   await env.DB.prepare('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?').bind(c.id).run();
   return json({error:'Incorrect code'},401);
  }
  await env.DB.prepare('UPDATE otp_challenges SET used_at=? WHERE id=?').bind(now(),c.id).run();

  let b=c.buyer_id?await env.DB.prepare('SELECT * FROM buyers WHERE id=?').bind(c.buyer_id).first<any>():null;
  if(!b&&body.buyerName){
   const m=await env.DB.prepare('SELECT * FROM buyers WHERE normalized_name=? LIMIT 2').bind(normalizeName(body.buyerName)).all();
   if(m.results.length===1)b=m.results[0];
  }
  if(!b)return json({error:'Buyer record not found'},404);
  if(b.messenger_psid&&b.messenger_psid!==c.messenger_psid)return json({error:'This buyer account is already linked to another Messenger account.'},409);

  if(!b.messenger_psid||b.link_status!=='linked'){
   const x=await env.DB.prepare("SELECT id FROM buyer_claims WHERE buyer_id=? AND messenger_psid=? AND status='pending'").bind(b.id,c.messenger_psid).first();
   if(!x)await env.DB.prepare('INSERT INTO buyer_claims (id,buyer_id,messenger_psid) VALUES (?,?,?)').bind(crypto.randomUUID(),b.id,c.messenger_psid).run();
   await env.DB.prepare("UPDATE buyers SET link_status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=? AND messenger_psid IS NULL").bind(b.id).run();
   return json({pendingClaim:true,message:"Your Messenger account is verified. Annie's Closet must approve this first-time account link before your balance is shown."});
  }

  const raw=randomToken(),sh=await sha256(raw),exp=now()+Number(env.SESSION_HOURS||12)*3600;
  await env.DB.prepare('INSERT INTO sessions (session_hash,buyer_id,messenger_psid,expires_at) VALUES (?,?,?,?)').bind(sh,b.id,c.messenger_psid,exp).run();
  return json({ok:true},200,{'set-cookie':`ac_session=${encodeURIComponent(raw)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Number(env.SESSION_HOURS||12)*3600}`});
 }

 return null;
}
