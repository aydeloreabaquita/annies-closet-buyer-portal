const money=c=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(c/100);
async function api(p,o={}){const r=await fetch(p,o);const j=await r.json();if(!r.ok)throw Error(j.error||'Failed');return j}
async function load(){
  const claims=await api('/api/admin/claims');
  document.querySelector('#claims').innerHTML=claims.length?claims.map(c=>`<div class="review"><div><strong>${c.buyer_name}</strong><small> Messenger ID: ${c.messenger_psid}</small></div><div><button onclick="claim('${c.id}','approve')">Approve</button><button class="danger" onclick="claim('${c.id}','reject')">Reject</button></div></div>`).join(''):'<p>No pending account links.</p>';
  const pays=await api('/api/admin/payments');
  document.querySelector('#payments').innerHTML=pays.length?pays.map(p=>`<div class="review"><div><strong>${p.buyer_name}</strong><div>${money(p.amount_centavos)}</div><a target="_blank" href="/api/admin/receipt/${p.id}">View receipt</a></div><div><button onclick="payment('${p.id}','approve')">Approve</button><button class="danger" onclick="payment('${p.id}','reject')">Reject</button></div></div>`).join(''):'<p>No pending receipts.</p>';
}
async function claim(id,action){await api('/api/admin/claims/'+id,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});load()}
async function payment(id,action){const note=action==='reject'?prompt('Optional note for buyer:')||'':'';await api('/api/admin/payments/'+id,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,note})});load()}
load().catch(e=>document.body.insertAdjacentHTML('beforeend',`<p>${e.message}</p>`));
