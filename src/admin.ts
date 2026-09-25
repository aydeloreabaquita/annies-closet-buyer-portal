import type { Env } from './env';
import { json } from './utils';
import { createLoginLink, sendMessenger } from './messenger';

export async function adminRoute(req:Request,env:Env,url:URL){
 if(url.pathname==='/api/admin/claims'&&req.method==='GET'){
  const r=await env.DB.prepare(`SELECT c.id,c.status,c.created_at,b.buyer_name,c.messenger_psid FROM buyer_claims c JOIN buyers b ON b.id=c.buyer_id WHERE c.status='pending' ORDER BY c.created_at`).all();
  return json(r.results);
 }

 if(url.pathname.startsWith('/api/admin/claims/')&&req.method==='POST'){
  const id=url.pathname.split('/').pop()!;
  const {action}=await req.json<any>();
  const c=await env.DB.prepare("SELECT * FROM buyer_claims WHERE id=? AND status='pending'").bind(id).first<any>();
  if(!c)return json({error:'Claim not found'},404);
  if(action==='approve'){
   await env.DB.batch([
    env.DB.prepare("UPDATE buyer_claims SET status='approved',reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(id),
    env.DB.prepare("UPDATE buyers SET messenger_psid=?,link_status='linked',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(c.messenger_psid,c.buyer_id)
   ]);
   const link=await createLoginLink(env,c.messenger_psid);
   await sendMessenger(env,c.messenger_psid,`Your Annie's Closet account is now linked. View your balance here: ${link}`);
   return json({ok:true});
  }
  if(action==='reject'){
   await env.DB.prepare("UPDATE buyer_claims SET status='rejected',reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
   return json({ok:true});
  }
  return json({error:'Invalid action'},400);
 }

 if(url.pathname==='/api/admin/payments'&&req.method==='GET'){
  const r=await env.DB.prepare(`SELECT p.id,p.amount_centavos,p.status,p.submitted_at,b.buyer_name FROM payments p JOIN buyers b ON b.id=p.buyer_id WHERE p.status='pending' ORDER BY p.submitted_at`).all();
  return json(r.results);
 }

 if(url.pathname.startsWith('/api/admin/payments/')&&req.method==='POST'){
  const id=url.pathname.split('/').pop()!;
  const {action,note}=await req.json<any>();
  const p=await env.DB.prepare(`SELECT p.*,b.messenger_psid,b.buyer_name FROM payments p JOIN buyers b ON b.id=p.buyer_id WHERE p.id=?`).bind(id).first<any>();
  if(!p)return json({error:'Payment not found'},404);
  if(!['approve','reject'].includes(action))return json({error:'Invalid action'},400);
  const status=action==='approve'?'approved':'rejected';
  await env.DB.prepare('UPDATE payments SET status=?,note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,note||null,id).run();
  if(p.messenger_psid){
   const link=await createLoginLink(env,p.messenger_psid);
   const msg=action==='approve'
    ?`Thank you, ${p.buyer_name}! Your payment has been approved. You can now enter your delivery address: ${link}`
    :`Hi ${p.buyer_name}, your payment receipt needs attention. Please open your portal: ${link}`;
   try{await sendMessenger(env,p.messenger_psid,msg)}catch(e){console.error(e)}
  }
  return json({ok:true});
 }

 if(url.pathname.startsWith('/api/admin/receipt/')&&req.method==='GET'){
  const id=url.pathname.split('/').pop()!;
  const p=await env.DB.prepare('SELECT receipt_key FROM payments WHERE id=?').bind(id).first<any>();
  if(!p)return new Response('Not found',{status:404});
  const o=await env.RECEIPTS.get(p.receipt_key);
  if(!o)return new Response('Not found',{status:404});
  const h=new Headers();o.writeHttpMetadata(h);h.set('cache-control','private, no-store');
  return new Response(o.body,{headers:h});
 }
 return null;
}
