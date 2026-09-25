import type { Env } from './env';
import { equal, hmacHex } from './utils';
import { createLoginLink, sendMessenger } from './messenger';

export async function webhook(req:Request,env:Env){
 if(req.method==='GET'){
  const u=new URL(req.url);
  const mode=u.searchParams.get('hub.mode');
  const token=u.searchParams.get('hub.verify_token');
  const challenge=u.searchParams.get('hub.challenge');
  return mode==='subscribe'&&token===env.META_VERIFY_TOKEN&&challenge
   ?new Response(challenge)
   :new Response('Forbidden',{status:403});
 }

 const raw=await req.text();
 const sig=req.headers.get('x-hub-signature-256')||'';
 const expected=`sha256=${await hmacHex(env.META_APP_SECRET,raw)}`;
 if(!equal(sig,expected))return new Response('Bad signature',{status:401});

 const p=JSON.parse(raw);
 for(const entry of p.entry||[]){
  for(const event of entry.messaging||[]){
   const psid=event?.sender?.id;
   if(!psid||!event?.message||event.message.is_echo)continue;
   const link=await createLoginLink(env,psid);
   const b=await env.DB.prepare("SELECT buyer_name FROM buyers WHERE messenger_psid=? AND link_status='linked'").bind(psid).first<any>();
   const greeting=b?`Hi ${b.buyer_name}!`:'Hi!';
   await sendMessenger(env,psid,`${greeting} Open your secure Annie's Closet portal here: ${link}\n\nThe website will send a 6-digit code back to this Messenger chat before showing your balance.`);
  }
 }
 return new Response('EVENT_RECEIVED');
}
