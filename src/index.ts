import type { Env } from './env';
import { json } from './utils';
import { webhook } from './webhook';
import { authRoute } from './auth';
import { accountRoute } from './account';
import { adminRoute } from './admin';

export default {
 async fetch(req:Request,env:Env):Promise<Response>{
  const url=new URL(req.url);
  if(url.pathname==='/meta/webhook')return webhook(req,env);
  if(url.pathname.startsWith('/api/auth/'))return (await authRoute(req,env,url))||json({error:'Not found'},404);
  if(['/api/account','/api/payment','/api/address'].includes(url.pathname))return (await accountRoute(req,env,url))||json({error:'Not found'},404);
  if(url.pathname.startsWith('/api/admin/'))return (await adminRoute(req,env,url))||json({error:'Not found'},404);
  if(url.pathname.startsWith('/api/'))return json({error:'Not found'},404);
  return env.ASSETS.fetch(req);
 }
};
