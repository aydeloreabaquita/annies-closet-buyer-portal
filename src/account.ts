import type { Env } from './env';
import { json } from './utils';
import { requireSession } from './session';

export async function summary(env:Env,buyerId:string){
 const i=await env.DB.prepare('SELECT item_name,amount_centavos,initial_payment_centavos FROM buyer_items WHERE buyer_id=? ORDER BY created_at').bind(buyerId).all();
 const p=await env.DB.prepare('SELECT id,amount_centavos,status,submitted_at,reviewed_at FROM payments WHERE buyer_id=? ORDER BY submitted_at DESC').bind(buyerId).all();
 const items=i.results as any[],payments=p.results as any[];
 const total=items.reduce((n,x)=>n+Number(x.amount_centavos||0),0);
 const initial=items.reduce((n,x)=>n+Number(x.initial_payment_centavos||0),0);
 const approved=payments.filter(x=>x.status==='approved').reduce((n,x)=>n+Number(x.amount_centavos||0),0);
 return{items,payments,total_centavos:total,paid_centavos:initial+approved,balance_centavos:Math.max(0,total-initial-approved)};
}

export async function accountRoute(req:Request,env:Env,url:URL){
 const s=await requireSession(req,env);
 if(!s)return json({error:'Not signed in'},401);

 if(url.pathname==='/api/account'&&req.method==='GET'){
  const a=await env.DB.prepare('SELECT * FROM addresses WHERE buyer_id=?').bind(s.buyer_id).first();
  return json({buyerName:s.buyer_name,...await summary(env,s.buyer_id),address:a});
 }

 if(url.pathname==='/api/payment'&&req.method==='POST'){
  const f=await req.formData(),file=f.get('receipt'),amount=Number(f.get('amount'));
  if(!(file instanceof File)||!file.type.startsWith('image/'))return json({error:'Please upload an image receipt.'},400);
  if(!Number.isFinite(amount)||amount<=0)return json({error:'Enter a valid payment amount.'},400);
  if(file.size>8*1024*1024)return json({error:'Receipt image must be 8 MB or smaller.'},413);
  const id=crypto.randomUUID();
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const key=`receipts/${s.buyer_id}/${id}.${ext}`;
  await env.RECEIPTS.put(key,file.stream(),{httpMetadata:{contentType:file.type}});
  await env.DB.prepare('INSERT INTO payments (id,buyer_id,amount_centavos,receipt_key) VALUES (?,?,?,?)').bind(id,s.buyer_id,Math.round(amount*100),key).run();
  return json({ok:true,paymentId:id});
 }

 if(url.pathname==='/api/address'&&req.method==='POST'){
  const x=await summary(env,s.buyer_id);
  if(!(x.payments as any[]).some(p=>p.status==='approved'))return json({error:'Address entry opens after an approved payment.'},403);
  const b=await req.json<any>();
  for(const k of ['recipientName','mobile','addressLine','city','province'])if(!String(b[k]||'').trim())return json({error:`Missing ${k}`},400);
  await env.DB.prepare(`INSERT INTO addresses (buyer_id,recipient_name,mobile,address_line,barangay,city,province,postal_code,updated_at)
   VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
   ON CONFLICT(buyer_id) DO UPDATE SET recipient_name=excluded.recipient_name,mobile=excluded.mobile,address_line=excluded.address_line,barangay=excluded.barangay,city=excluded.city,province=excluded.province,postal_code=excluded.postal_code,updated_at=CURRENT_TIMESTAMP`)
   .bind(s.buyer_id,b.recipientName,b.mobile,b.addressLine,b.barangay||null,b.city,b.province,b.postalCode||null).run();
  return json({ok:true});
 }
 return null;
}
