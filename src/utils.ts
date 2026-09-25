export const now = () => Math.floor(Date.now() / 1000);
export const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const json = (data: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(data), {status, headers:{"content-type":"application/json; charset=utf-8", ...headers}});
const enc = new TextEncoder();
export async function sha256(value: string) { const h=await crypto.subtle.digest("SHA-256",enc.encode(value)); return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
export async function hmacHex(secret:string,value:string){const k=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const s=await crypto.subtle.sign("HMAC",k,enc.encode(value));return [...new Uint8Array(s)].map(b=>b.toString(16).padStart(2,"0")).join("");}
export function equal(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
export function randomToken(bytes=32){const a=crypto.getRandomValues(new Uint8Array(bytes));return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
export const otpCode=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000).padStart(6,"0");
