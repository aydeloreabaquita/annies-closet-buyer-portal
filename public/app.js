const $ = (id) => document.getElementById(id);
const money = (centavos) => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format((centavos||0)/100);
const token = new URLSearchParams(location.search).get('token');
let challengeId = null;
let linked = false;

async function api(path, options={}) {
  const r = await fetch(path, options);
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function init() {
  try {
    const me = await api('/api/account');
    showAccount(me); return;
  } catch (_) {}
  if (!token) { $('sendCode').disabled = true; $('loginMsg').textContent = 'Please message Annie\'s Closet on Facebook and use the secure link sent in Messenger.'; return; }
  try {
    const c = await api('/api/auth/context',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});
    linked = c.linked;
    if (linked) $('loginIntro').textContent = `Welcome back${c.buyerName ? ', '+c.buyerName : ''}. Send a one-time code to your Messenger.`;
    else $('claimField').classList.remove('hidden');
  } catch (e) { $('sendCode').disabled = true; $('loginMsg').textContent = e.message; }
}

$('sendCode').onclick = async () => {
  $('loginMsg').textContent='';
  try {
    const buyerName = $('buyerName').value.trim();
    if (!linked && !buyerName) throw new Error('Enter your buyer name first.');
    const r = await api('/api/auth/request-otp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,buyerName})});
    challengeId = r.challengeId; $('otpArea').classList.remove('hidden'); $('loginMsg').textContent='Code sent to your Facebook Messenger.';
  } catch(e) { $('loginMsg').textContent=e.message; }
};

$('verifyCode').onclick = async () => {
  try {
    const r = await api('/api/auth/verify-otp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({challengeId,code:$('otp').value.trim(),buyerName:$('buyerName').value.trim()})});
    if (r.pendingClaim) { $('loginMsg').textContent = r.message; $('sendCode').disabled=true; $('verifyCode').disabled=true; return; }
    const me = await api('/api/account'); showAccount(me);
  } catch(e) { $('loginMsg').textContent=e.message; }
};

function showAccount(me) {
  $('loginCard').classList.add('hidden'); $('accountCard').classList.remove('hidden'); $('paymentCard').classList.remove('hidden');
  $('buyerGreeting').textContent=me.buyerName; $('balance').textContent=money(me.balance_centavos);
  $('items').innerHTML = me.items.length ? me.items.map(x=>`<div class="listrow"><span>${esc(x.item_name)}</span><strong>${money(x.amount_centavos)}</strong></div>`).join('') : '<p>No items found.</p>';
  $('payments').innerHTML = me.payments.length ? me.payments.map(x=>`<div class="listrow"><span>${money(x.amount_centavos)} <small>${esc(x.status)}</small></span><span>${new Date(x.submitted_at+'Z').toLocaleDateString()}</span></div>`).join('') : '<p>No uploaded payments yet.</p>';
  if (me.payments.some(x=>x.status==='approved')) $('addressCard').classList.remove('hidden');
  if (me.address) for (const [k,v] of Object.entries({recipientName:me.address.recipient_name,mobile:me.address.mobile,addressLine:me.address.address_line,barangay:me.address.barangay,city:me.address.city,province:me.address.province,postalCode:me.address.postal_code})) { const el=$('addressForm').elements[k]; if(el) el.value=v||''; }
}
const esc = (s='') => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

$('paymentForm').onsubmit = async e => { e.preventDefault(); $('payMsg').textContent='Uploading…'; try { await api('/api/payment',{method:'POST',body:new FormData(e.target)}); $('payMsg').textContent='Receipt submitted. Annie\'s Closet will review it.'; e.target.reset(); } catch(err){ $('payMsg').textContent=err.message; } };
$('addressForm').onsubmit = async e => { e.preventDefault(); const b=Object.fromEntries(new FormData(e.target)); try { await api('/api/address',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}); $('addressMsg').textContent='Delivery address saved.'; } catch(err){ $('addressMsg').textContent=err.message; } };
init();
