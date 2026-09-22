(() => {
 const C=window.HUNS_AUTH_CONFIG||{}, K=C.SESSION_KEY||'huns_board_session_v1';
 try{localStorage.removeItem(K)}catch(_){} // remove old R1 persistent session
 async function rpc(n,b={}){const r=await fetch(`${C.SUPABASE_URL}/rest/v1/rpc/${n}`,{method:'POST',headers:{'Content-Type':'application/json','apikey':C.SUPABASE_ANON_KEY,'Authorization':`Bearer ${C.SUPABASE_ANON_KEY}`},body:JSON.stringify(b)});const d=await r.json();if(!r.ok)throw new Error(d?.message||`HTTP ${r.status}`);return d}
 const one=d=>Array.isArray(d)?d[0]:d; const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const msg=t=>document.getElementById('m').textContent=t||'';
 async function login(){try{const d=one(await rpc('login_user',{p_username:u.value.trim(),p_password:p.value}));if(!d?.ok)throw new Error(d?.message||'로그인 실패');if(d.role!=='admin')throw new Error('관리자 계정이 아닙니다.');sessionStorage.setItem(K,d.token);await openPanel(d)}catch(e){msg(e.message)}}
 async function openPanel(me){login.hidden=true;panel.hidden=false;who.textContent=`관리자: ${me.username}`;await load()}
 async function load(){const t=sessionStorage.getItem(K);try{const rows=await rpc('admin_list_users',{p_token:t});users.innerHTML=(rows||[]).map(x=>`<div class="user"><div><b>${esc(x.username)}</b><div class="muted">가입 ${esc(x.created_at)} · ${esc(x.role)}</div></div><div class="badge">${esc(x.status)}</div><div class="row">${x.status!=='APPROVED'?`<button class="ok" data-id="${x.id}" data-a="APPROVE">승인</button>`:`<button data-id="${x.id}" data-a="REVOKE">승인취소</button>`}${x.status!=='REJECTED'?`<button class="danger" data-id="${x.id}" data-a="REJECT">거절</button>`:''}</div></div>`).join('')||'<div class="muted">회원이 없습니다.</div>'; users.querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>act(b.dataset.id,b.dataset.a));}catch(e){alert(e.message)}}
 async function act(id,a){if(!confirm(`${a} 처리할까요?`))return;await rpc('admin_set_user_status',{p_token:sessionStorage.getItem(K),p_user_id:id,p_action:a});await load()}
 async function restore(){const t=sessionStorage.getItem(K);if(!t)return;try{const d=one(await rpc('verify_session',{p_token:t}));if(d?.ok&&d.role==='admin')await openPanel(d)}catch(e){sessionStorage.removeItem(K)}}
 go.onclick=login;refresh.onclick=load;logout.onclick=()=>{sessionStorage.removeItem(K);location.reload()};restore();
})();
