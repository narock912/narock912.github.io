(() => {
  const C = window.HUNS_AUTH_CONFIG || {};
  const SESSION_KEY = C.SESSION_KEY || 'huns_board_session_v1';
  const state = { mode: 'login' };
  // R1B policy: session is tab/window-scoped. Old R1 persistent tokens are removed.
  try { localStorage.removeItem(SESSION_KEY); } catch (_) {}

  function configured() {
    return C.SUPABASE_URL && C.SUPABASE_ANON_KEY &&
      !C.SUPABASE_URL.includes('YOUR_PROJECT') && !C.SUPABASE_ANON_KEY.includes('YOUR_');
  }
  async function rpc(name, body={}) {
    const res = await fetch(`${C.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': C.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${C.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(body)
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    return data;
  }
  function row(data) { return Array.isArray(data) ? (data[0] || null) : data; }
  function esc(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

  function root() { return document.getElementById('auth-gate-root'); }
  function msg(text='', type='') {
    const el = document.getElementById('auth-msg');
    if (!el) return;
    el.textContent = text; el.className = `auth-msg ${type}`;
  }
  function lock() {
    document.body.classList.add('auth-locked');
    root()?.removeAttribute('hidden');
  }
  function unlock(user) {
    document.body.classList.remove('auth-locked');
    root()?.setAttribute('hidden','');
    addUserChip(user);
  }
  function addUserChip(user) {
    document.getElementById('auth-user-chip')?.remove();
    const chip = document.createElement('div'); chip.id = 'auth-user-chip';
    chip.innerHTML = `<span>${esc(user?.username || '')}</span><button type="button">로그아웃</button>`;
    chip.querySelector('button').onclick = () => { sessionStorage.removeItem(SESSION_KEY); location.reload(); };
    document.body.appendChild(chip);
  }
  function render(mode='login') {
    state.mode = mode;
    const r = root();
    const signup = mode === 'signup';
    r.innerHTML = `
      <div class="auth-card" role="dialog" aria-modal="true">
        <div class="auth-brand">${esc(C.SITE_NAME || 'HUNS ALPHA BOARD')}</div>
        <div class="auth-sub">회원 전용 실시간 현황판</div>
        <div class="auth-tabs">
          <button id="tab-login" class="${signup?'':'active'}">로그인</button>
          <button id="tab-signup" class="${signup?'active':''}">회원가입</button>
        </div>
        <form id="auth-form">
          <div class="auth-field"><label>아이디</label><input id="auth-user" autocomplete="username" maxlength="20" placeholder="예: 훈스123" required></div>
          <div class="auth-field"><label>비밀번호</label><input id="auth-pass" type="password" autocomplete="${signup?'new-password':'current-password'}" maxlength="72" required></div>
          ${signup?'<div class="auth-field"><label>비밀번호 확인</label><input id="auth-pass2" type="password" autocomplete="new-password" maxlength="72" required></div>':''}
          <button class="auth-submit" type="submit">${signup?'가입 신청':'로그인'}</button>
          <div id="auth-msg" class="auth-msg"></div>
        </form>
      </div>`;
    document.getElementById('tab-login').onclick = () => render('login');
    document.getElementById('tab-signup').onclick = () => render('signup');
    document.getElementById('auth-form').onsubmit = submit;
  }
  function renderPending(username) {
    const r = root();
    r.innerHTML = `<div class="auth-card"><div class="auth-pending"><strong>승인 대기 중</strong><div class="auth-sub"><b>${esc(username)}</b> 님의 가입 신청이 완료되었습니다.<br>관리자가 승인하면 로그인할 수 있습니다.</div><button id="pending-back" class="auth-submit" style="margin-top:18px">로그인 화면으로</button></div></div>`;
    document.getElementById('pending-back').onclick = () => render('login');
  }
  async function submit(e) {
    e.preventDefault();
    if (!configured()) return msg('auth-config.js에 Supabase URL과 ANON KEY를 먼저 입력하세요.', 'error');
    const username = document.getElementById('auth-user').value.trim();
    const password = document.getElementById('auth-pass').value;
    if (state.mode === 'signup') {
      if (password !== document.getElementById('auth-pass2').value) return msg('비밀번호가 서로 다릅니다.', 'error');
      msg('가입 신청 중...');
      try {
        const d = row(await rpc('signup_user', {p_username:username, p_password:password}));
        if (d?.ok) renderPending(username); else msg(d?.message || '가입에 실패했습니다.', 'error');
      } catch (err) { msg(err.message, 'error'); }
    } else {
      msg('확인 중...');
      try {
        const d = row(await rpc('login_user', {p_username:username, p_password:password}));
        if (!d?.ok) {
          if (d?.status === 'PENDING') return msg('관리자 승인 대기 중입니다.', 'error');
          if (d?.status === 'REJECTED') return msg('가입이 승인되지 않은 계정입니다.', 'error');
          return msg(d?.message || '아이디 또는 비밀번호를 확인하세요.', 'error');
        }
        sessionStorage.setItem(SESSION_KEY, d.token);
        unlock({username:d.username, role:d.role});
      } catch (err) { msg(err.message, 'error'); }
    }
  }
  async function restore() {
    lock(); render('login');
    if (!configured()) return msg('사이트 설정이 아직 완료되지 않았습니다.', 'error');
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;
    try {
      const d = row(await rpc('verify_session', {p_token:token}));
      if (d?.ok && d?.approved) return unlock(d);
    } catch (_) {}
    sessionStorage.removeItem(SESSION_KEY);
  }
  document.addEventListener('DOMContentLoaded', () => {
    const r = document.createElement('div'); r.id='auth-gate-root'; document.body.appendChild(r);
    restore();
  });
})();
