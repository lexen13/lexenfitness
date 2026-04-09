// ═══════════════════════════════════════════
//  LEXENFITNESS — APP LOGIC
// ═══════════════════════════════════════════

firebase.initializeApp({
  apiKey:"AIzaSyCbH-A7pp1xrtwHSaVUKlPA0hR2skHu9iY",authDomain:"lexenfitness.firebaseapp.com",
  projectId:"lexenfitness",storageBucket:"lexenfitness.firebasestorage.app",
  messagingSenderId:"570672585202",appId:"1:570672585202:web:ce329745b0282ee86c736b"
});
const auth = firebase.auth(), db = firebase.firestore();

// ── STATE ──
let U = null, userData = {}, workoutLog = [], savedInputs = {};
let currentDay = 'day1', currentPage = 'workout', logFilter = 'all';
let editTarget = null, addDayIdx = null;
let selectedClass = null, selectedSub = null, selectedProgram = null;

// ═══════════ AUTH ═══════════
function showLogin() { $('loginForm').style.display = ''; $('signupForm').style.display = 'none'; }
function showSignup() { $('loginForm').style.display = 'none'; $('signupForm').style.display = ''; }

async function doLogin() {
  const e = $('loginEmail').value.trim(), p = $('loginPass').value;
  $('loginError').textContent = '';
  try { await auth.signInWithEmailAndPassword(e, p); }
  catch (err) { $('loginError').textContent = friendlyErr(err.code); }
}

async function doSignup() {
  const f = $('signupFirst').value.trim(), l = $('signupLast').value.trim();
  const uname = $('signupUsername').value.trim().toLowerCase();
  const e = $('signupEmail').value.trim(), p = $('signupPass').value;
  $('signupError').textContent = '';
  if (!f) { $('signupError').textContent = 'First name required'; return; }
  if (!uname || uname.length < 3) { $('signupError').textContent = 'Username must be 3+ characters'; return; }
  if (/[^a-z0-9_]/.test(uname)) { $('signupError').textContent = 'Username: letters, numbers, underscores only'; return; }

  // Check username uniqueness
  const uCheck = await db.collection('usernames').doc(uname).get();
  if (uCheck.exists) { $('signupError').textContent = 'Username taken'; return; }

  try {
    const cred = await auth.createUserWithEmailAndPassword(e, p);
    const displayName = f + (l ? ' ' + l : '');
    await cred.user.updateProfile({ displayName });
    const friendCode = genFriendCode();
    await db.collection('users').doc(cred.user.uid).set({
      name: displayName, username: uname, email: e,
      friendCode, xp: 0, achievements: [], stats: {},
      profilePic: '', class: '', subclass: '', program: [],
      friends: [], privacy: { hideName: false, hideStats: false },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Reserve username
    await db.collection('usernames').doc(uname).set({ uid: cred.user.uid });
    // Reserve friend code
    await db.collection('friendCodes').doc(friendCode).set({ uid: cred.user.uid });
  } catch (err) { $('signupError').textContent = friendlyErr(err.code); }
}

async function resetPassword() {
  const email = $('loginEmail').value.trim();
  if (!email) { $('loginError').textContent = 'Enter your email first'; return; }
  try {
    await auth.sendPasswordResetEmail(email);
    $('loginError').style.color = 'var(--green)';
    $('loginError').textContent = 'Reset link sent! Check inbox.';
    setTimeout(() => { $('loginError').style.color = ''; $('loginError').textContent = ''; }, 4000);
  } catch (err) { $('loginError').textContent = friendlyErr(err.code); }
}

function doLogout() { auth.signOut(); }

function friendlyErr(c) {
  const m = { 'auth/invalid-email':'Invalid email', 'auth/user-not-found':'No account found',
    'auth/wrong-password':'Wrong password', 'auth/email-already-in-use':'Email taken',
    'auth/weak-password':'Password must be 6+', 'auth/invalid-credential':'Invalid email or password',
    'auth/too-many-requests':'Too many attempts' };
  return m[c] || 'Something went wrong';
}

// ── AUTH STATE ──
auth.onAuthStateChanged(async u => {
  $('loadingScreen').style.display = 'none';
  if (u) {
    U = u; await loadUserData();
    if (!userData.class) { showScreen('classScreen'); buildClassSelect(); }
    else { showScreen('appScreen'); initApp(); }
  } else { U = null; showScreen('authScreen'); }
});

function showScreen(id) {
  ['authScreen','classScreen','appScreen'].forEach(s => {
    $(s).classList.remove('active'); $(s).style.display = 'none';
  });
  $(id).style.display = ''; $(id).classList.add('active');
}

// ═══════════ FIRESTORE ═══════════
async function loadUserData() {
  const doc = await db.collection('users').doc(U.uid).get();
  if (doc.exists) {
    userData = doc.data();
  } else {
    userData = { name: U.displayName || '', username: '', xp: 0, achievements: [], stats: {}, profilePic: '', friends: [], privacy: { hideName: false, hideStats: false } };
  }
  if (!userData.achievements) userData.achievements = [];
  if (!userData.friends) userData.friends = [];
  if (!userData.privacy) userData.privacy = { hideName: false, hideStats: false };
  if (!userData.stats) userData.stats = {};

  const logSnap = await db.collection('users').doc(U.uid).collection('log').orderBy('date', 'desc').limit(200).get();
  workoutLog = []; logSnap.forEach(d => workoutLog.push({ _id: d.id, ...d.data() }));

  const iDoc = await db.collection('users').doc(U.uid).collection('meta').doc('inputs').get();
  savedInputs = iDoc.exists ? (iDoc.data().data || {}) : {};
}

async function saveUser(fields) {
  await db.collection('users').doc(U.uid).update(fields);
  Object.assign(userData, fields);
}

async function saveLeaderboard() {
  const r = getRank(userData.xp);
  await db.collection('leaderboard').doc(U.uid).set({
    username: userData.username || userData.name,
    xp: userData.xp, class: userData.class, subclass: userData.subclass || '',
    rank: r.name, profilePic: userData.profilePic || '',
    friendCode: userData.friendCode || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ═══════════ CLASS & PROGRAM SELECT ═══════════
function buildClassSelect() {
  $('classGrid').innerHTML = CLASSES.map(c =>
    `<div class="class-card" data-cls="${c.id}" onclick="pickClass('${c.id}')">
      <div class="cc-icon">${c.icon}</div><div class="cc-name">${c.id.toUpperCase()}</div>
      <div class="cc-desc">${c.desc}</div><div class="cc-bonus">${c.bonus}</div></div>`
  ).join('');
}

function pickClass(id) {
  selectedClass = id; selectedSub = null; selectedProgram = null;
  document.querySelectorAll('.class-card').forEach(c => c.classList.toggle('selected', c.dataset.cls === id));
  const cls = CLASSES.find(c => c.id === id);

  // Subclass area
  const area = $('subclassArea');
  if (cls.subclasses) {
    area.classList.add('show');
    $('subOptions').innerHTML = cls.subclasses.map(s =>
      `<div class="sub-opt" onclick="pickSub(this,'${s}')">${s}</div>`).join('');
  } else { area.classList.remove('show'); }

  // Program area
  const pArea = $('programArea');
  if (id === 'Custom') {
    pArea.classList.add('show');
    $('programGrid').innerHTML = Object.entries(PROGRAMS).map(([k, p]) =>
      `<div class="prog-card" data-prog="${k}" onclick="pickProgram('${k}')">
        <span class="prog-icon">${p.icon}</span>
        <div class="prog-name">${p.name}</div>
        <div class="prog-desc">${p.desc}</div></div>`
    ).join('') + `<div class="prog-card" data-prog="blank" onclick="pickProgram('blank')">
      <span class="prog-icon">📝</span><div class="prog-name">Blank Template</div>
      <div class="prog-desc">Start from scratch — add your own days & exercises</div></div>`;
  } else {
    pArea.classList.remove('show');
    selectedProgram = id; // use class program
  }

  updateConfirmBtn();
}

function pickSub(el, s) {
  selectedSub = s;
  document.querySelectorAll('.sub-opt').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  if (!selectedProgram && selectedClass !== 'Custom') selectedProgram = selectedClass;
  updateConfirmBtn();
}

function pickProgram(key) {
  selectedProgram = key;
  document.querySelectorAll('.prog-card').forEach(c => c.classList.toggle('selected', c.dataset.prog === key));
  updateConfirmBtn();
}

function updateConfirmBtn() {
  const cls = CLASSES.find(c => c.id === selectedClass);
  let ready = !!selectedClass;
  if (cls && cls.subclasses && !selectedSub) ready = false;
  if (selectedClass === 'Custom' && !selectedProgram) ready = false;
  $('csConfirm').disabled = !ready;
}

async function confirmClass() {
  if (!selectedClass) return;
  let prog;
  if (selectedProgram === 'blank') {
    prog = [
      { id:'day1', title:'DAY 1', subtitle:'Add your exercises', exercises:[] },
      { id:'day2', title:'DAY 2', subtitle:'Add your exercises', exercises:[] },
      { id:'day3', title:'DAY 3', subtitle:'Add your exercises', exercises:[] },
      { id:'day4', title:'DAY 4', subtitle:'Add your exercises', exercises:[] }
    ];
  } else if (PROGRAMS[selectedProgram]) {
    prog = JSON.parse(JSON.stringify(PROGRAMS[selectedProgram].days));
  } else if (PROGRAMS[selectedClass]) {
    prog = JSON.parse(JSON.stringify(PROGRAMS[selectedClass].days));
  } else {
    prog = JSON.parse(JSON.stringify(PROGRAMS.UpperLower.days));
  }

  await saveUser({ class: selectedClass, subclass: selectedSub || '', program: prog });
  await saveLeaderboard();
  showScreen('appScreen'); initApp();
}

// ═══════════ INIT APP ═══════════
function initApp() {
  document.querySelectorAll('.nav-item').forEach(n =>
    n.addEventListener('click', () => switchPage(n.dataset.page)));
  updateTopBar(); switchPage('workout');
}

function updateTopBar() {
  const r = getRank(userData.xp);
  $('tbXp').textContent = userData.xp + ' XP';
  const rb = $('tbRank');
  rb.textContent = r.name; rb.style.color = r.color;
  rb.style.background = r.color + '22'; rb.style.border = '1px solid ' + r.color + '44';
}

function switchPage(p) {
  currentPage = p;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === p));
  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
  $('page-' + p).classList.add('active');
  if (p === 'workout') buildWorkout();
  if (p === 'log') renderLog();
  if (p === 'profile') renderProfile();
  if (p === 'achievements') renderAchievements();
  if (p === 'leaderboard') renderLeaderboard();
}

// ═══════════ WORKOUT PAGE ═══════════
function buildWorkout() {
  const prog = userData.program || [];
  if (!prog.length) return;
  $('workoutTitle').textContent = (userData.class || 'WORKOUT').toUpperCase();
  $('workoutSub').textContent = (userData.subclass ? userData.subclass + ' — ' : '') + getRank(userData.xp).name;
  $('dayTabs').innerHTML = prog.map(d =>
    `<div class="dtab${d.id === currentDay ? ' active' : ''}" data-d="${d.id}" onclick="switchDay('${d.id}')">${d.title}</div>`
  ).join('');
  renderDay();
}

function switchDay(id) {
  currentDay = id;
  document.querySelectorAll('.dtab').forEach(t => t.classList.toggle('active', t.dataset.d === id));
  renderDay();
}

function renderDay() {
  const prog = userData.program || [], day = prog.find(d => d.id === currentDay);
  if (!day) return;
  const di = prog.indexOf(day);
  let h = '';
  day.exercises.forEach((ex, ei) => {
    h += `<div class="exercise"><div class="ex-header"><span class="ex-num">${ei + 1}</span><span class="ex-name">${ex.name}</span><button class="ex-edit" onclick="openEdit(${di},${ei})">✏️</button></div><div class="sets-grid">`;
    for (let s = 0; s < ex.sets; s++) {
      const wK = day.id + '_e' + ei + '_s' + s + '_w', rK = day.id + '_e' + ei + '_s' + s + '_r', cK = day.id + '_e' + ei + '_s' + s + '_c';
      if (ex.isTime) h += `<div class="set-row"><label>S${s+1}</label><input type="number" id="${rK}" placeholder="sec" value="${savedInputs[rK]||''}"><span class="sep">sec</span><input type="checkbox" id="${cK}" ${savedInputs[cK]?'checked':''}><span class="target">${ex.reps}</span></div>`;
      else h += `<div class="set-row"><label>S${s+1}</label><input type="number" id="${wK}" placeholder="lbs" value="${savedInputs[wK]||''}"><span class="sep">×</span><input type="number" id="${rK}" placeholder="reps" value="${savedInputs[rK]||''}"><input type="checkbox" id="${cK}" ${savedInputs[cK]?'checked':''}><span class="target">${ex.reps}</span></div>`;
    }
    h += '</div></div>';
  });
  h += `<button class="add-ex" onclick="openAdd(${di})">+ Add Exercise</button>`;
  $('dayContent').innerHTML = h;
}

// ── EDIT / ADD EXERCISE ──
function openEdit(di, ei) { editTarget = {di,ei}; const ex = userData.program[di].exercises[ei]; $('editName').value = ex.name; $('editSets').value = ex.sets; $('editReps').value = ex.reps; $('editModal').classList.add('open'); }
function closeEdit() { $('editModal').classList.remove('open'); }
async function saveEdit() { if (!editTarget) return; captureInputs(); const ex = userData.program[editTarget.di].exercises[editTarget.ei]; ex.name = $('editName').value.trim() || ex.name; ex.sets = parseInt($('editSets').value) || ex.sets; ex.reps = $('editReps').value.trim() || ex.reps; ex.isTime = /sec|s$/i.test(ex.reps); await saveUser({program:userData.program}); closeEdit(); renderDay(); unlockAch('customize'); toast('Updated!'); }
async function deleteEx() { if (!editTarget || !confirm('Remove?')) return; captureInputs(); userData.program[editTarget.di].exercises.splice(editTarget.ei,1); await saveUser({program:userData.program}); closeEdit(); renderDay(); toast('Removed.'); }
function openAdd(di) { addDayIdx = di; $('addName').value = ''; $('addSets').value = 3; $('addReps').value = ''; $('addModal').classList.add('open'); }
function closeAdd() { $('addModal').classList.remove('open'); }
async function saveAdd() { if (addDayIdx === null) return; const name = $('addName').value.trim(); if (!name) { toast('Enter a name'); return; } captureInputs(); const sets = parseInt($('addSets').value) || 3, reps = $('addReps').value.trim() || '8-12'; userData.program[addDayIdx].exercises.push({name,sets,reps,isTime:/sec|s$/i.test(reps)}); await saveUser({program:userData.program}); closeAdd(); renderDay(); toast('Added!'); }

// ── INPUTS ──
function captureInputs() { document.querySelectorAll('#dayContent input[type=number]').forEach(el => { if (el.id) savedInputs[el.id] = el.value; }); document.querySelectorAll('#dayContent input[type=checkbox]').forEach(el => { if (el.id) savedInputs[el.id] = el.checked; }); }
async function saveInputs() { captureInputs(); await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs}); toast('Saved!'); }
function clearInputs() { if (!confirm('Clear inputs?')) return; document.querySelectorAll('#dayContent input[type=number]').forEach(el => el.value = ''); document.querySelectorAll('#dayContent input[type=checkbox]').forEach(el => el.checked = false); toast('Cleared.'); }

// ═══════════ LOG WORKOUT ═══════════
async function logWorkout() {
  const prog = userData.program || [], day = prog.find(d => d.id === currentDay);
  if (!day) { toast('Pick a day!'); return; }
  captureInputs();
  const entry = { dayId:day.id, dayTitle:day.title, date:new Date().toISOString(), exercises:[] };
  let hasData = false, allDone = true, maxWeight = 0;
  day.exercises.forEach((ex, ei) => {
    const sets = [];
    for (let s = 0; s < ex.sets; s++) {
      const wEl = $(day.id+'_e'+ei+'_s'+s+'_w'), rEl = $(day.id+'_e'+ei+'_s'+s+'_r'), cEl = $(day.id+'_e'+ei+'_s'+s+'_c');
      const w = wEl ? wEl.value : '', r = rEl ? rEl.value : '', d = cEl ? cEl.checked : false;
      if (w || r) hasData = true; if (!d) allDone = false; if (parseInt(w) > maxWeight) maxWeight = parseInt(w);
      sets.push({weight:w, reps:r, done:d, isTime:!!ex.isTime});
    }
    entry.exercises.push({name:ex.name, sets});
  });
  if (!hasData) { toast('Fill in some sets!'); return; }

  const ref = await db.collection('users').doc(U.uid).collection('log').add(entry);
  entry._id = ref.id; workoutLog.unshift(entry);

  let xpGain = 50;
  if (allDone) xpGain += 50;
  const hour = new Date().getHours();
  const wc = workoutLog.length;
  if (wc >= 1) unlockAch('first_workout'); if (wc >= 10) unlockAch('workouts_10'); if (wc >= 25) unlockAch('workouts_25'); if (wc >= 50) unlockAch('workouts_50'); if (wc >= 100) unlockAch('workouts_100');
  if (hour < 7) unlockAch('early_bird'); if (hour >= 21) unlockAch('night_owl');
  if (allDone) unlockAch('all_sets_done');
  if (maxWeight >= 200) unlockAch('heavy_day'); if (maxWeight >= 315) unlockAch('monster_lift'); if (maxWeight >= 405) unlockAch('titan_lift');
  const dayIds = new Set(workoutLog.map(e => e.dayId)); if (dayIds.size >= 4) unlockAch('variety');
  const streak = calcStreak(); if (streak >= 7) unlockAch('streak_7'); if (streak >= 30) unlockAch('streak_30');
  const fw = calcFullWeeks(); if (fw >= 1) unlockAch('full_week'); if (fw >= 5) unlockAch('full_week_5');
  const newXp = userData.xp + xpGain;
  if (newXp >= 500) unlockAch('rank_d'); if (newXp >= 1500) unlockAch('rank_c'); if (newXp >= 3500) unlockAch('rank_b'); if (newXp >= 7000) unlockAch('rank_a'); if (newXp >= 15000) unlockAch('rank_s');
  await saveUser({xp:newXp}); await saveLeaderboard(); updateTopBar();
  toast(day.title + ' logged! +' + xpGain + ' XP');
}

function calcStreak() { const dates = [...new Set(workoutLog.map(e => new Date(e.date).toDateString()))].sort((a,b) => new Date(b)-new Date(a)); let s = 0; for (let i = 0; i < dates.length; i++) { const exp = new Date(); exp.setDate(exp.getDate()-i); if (dates[i] === exp.toDateString()) s++; else break; } return s; }
function calcFullWeeks() { const w = {}; workoutLog.forEach(e => { const m = getMonday(new Date(e.date)).toISOString().slice(0,10); if (!w[m]) w[m] = new Set(); w[m].add(e.dayId); }); return Object.values(w).filter(s => s.size >= 4).length; }

// ═══════════ ACHIEVEMENTS ═══════════
async function unlockAch(id) { if (userData.achievements.includes(id)) return; userData.achievements.push(id); const a = ACHIEVEMENTS.find(x => x.id === id); if (a && a.xp > 0) userData.xp += a.xp; await saveUser({achievements:userData.achievements, xp:userData.xp}); await saveLeaderboard(); updateTopBar(); }
function renderAchievements() {
  const ul = userData.achievements || [];
  $('achSub').textContent = ul.length + ' / ' + ACHIEVEMENTS.length + ' unlocked';
  $('achGrid').innerHTML = ACHIEVEMENTS.map(a => { const u = ul.includes(a.id); return `<div class="ach-card${u?' unlocked':''}"><span class="ach-icon">${a.icon}</span><div class="ach-info"><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div>${a.xp?'<div class="ach-xp">+'+a.xp+' XP</div>':''}</div></div>`; }).join('');
}

// ═══════════ PROFILE ═══════════
function renderProfile() {
  const r = getRank(userData.xp), nr = getNextRank(userData.xp);
  const pct = nr ? Math.min(100, ((userData.xp - r.min) / (nr.min - r.min)) * 100) : 100;
  const title = (r.title && r.title[userData.class]) || r.name;
  const st = userData.stats || {};
  const priv = userData.privacy || {};
  let h = `<div class="profile-card">
    <div class="profile-pic-wrap" onclick="document.getElementById('picInput').click()">
    ${userData.profilePic ? '<img src="'+userData.profilePic+'">' : '<div class="pp-placeholder">👤</div>'}
    </div>
    <div class="profile-name">${userData.name || 'Hunter'}</div>
    <div class="profile-username">@${userData.username || '???'}</div>
    <div class="profile-friend-code">Friend Code: <strong>${userData.friendCode || '------'}</strong></div>
    <div class="profile-class">${userData.class}${userData.subclass ? ' — '+userData.subclass : ''}</div>
    <div class="profile-rank-badge" style="color:${r.color};background:${r.color}22;border:1px solid ${r.color}44">${r.name} — ${title}</div>
    <div class="xp-bar-wrap"><div class="xp-bar-label"><span>${userData.xp} XP</span><span>${nr?nr.min+' XP':'MAX'}</span></div><div class="xp-bar"><div class="xp-bar-fill" style="width:${pct}%"></div></div></div>
  </div>`;
  h += `<div class="stats-grid"><div class="stat-card"><div class="sv">${st.height||'—'}</div><div class="sl">Height</div></div><div class="stat-card"><div class="sv">${st.weight||'—'}</div><div class="sl">Weight</div></div><div class="stat-card"><div class="sv">${st.age||'—'}</div><div class="sl">Age</div></div></div>`;
  h += `<button class="edit-stats-btn" onclick="openStats()">Edit Stats</button>`;
  h += `<div class="stats-grid"><div class="stat-card"><div class="sv">${workoutLog.length}</div><div class="sl">Workouts</div></div><div class="stat-card"><div class="sv">${calcStreak()}</div><div class="sl">Streak</div></div><div class="stat-card"><div class="sv">${(userData.achievements||[]).length}</div><div class="sl">Achieve.</div></div></div>`;

  // Privacy toggles
  h += `<div class="section-title" style="margin:1rem 0 .5rem">PRIVACY</div>`;
  h += `<label class="toggle-row"><input type="checkbox" class="toggle-cb" ${priv.hideName?'checked':''} onchange="togglePrivacy('hideName',this.checked)"><span>Hide real name on leaderboard (show username only)</span></label>`;
  h += `<label class="toggle-row"><input type="checkbox" class="toggle-cb" ${priv.hideStats?'checked':''} onchange="togglePrivacy('hideStats',this.checked)"><span>Hide stats from profile</span></label>`;

  // Friends section
  h += `<div class="section-title" style="margin:1rem 0 .5rem">FRIENDS (${(userData.friends||[]).length})</div>`;
  h += `<div class="friend-add-row"><input type="text" id="friendCodeInput" class="auth-input" placeholder="Enter friend code" maxlength="6" style="margin:0;flex:1"><button class="m-save-btn" style="flex:0 0 auto;padding:10px 16px;border-radius:8px" onclick="addFriend()">Add</button></div>`;
  h += `<div id="friendsList" style="margin-top:.6rem"></div>`;

  // Actions
  h += `<button class="edit-stats-btn" onclick="changeProgram()" style="margin-top:1rem">🔄 Change Program</button>`;
  h += `<button class="edit-stats-btn" onclick="doLogout()" style="color:var(--red);border-color:var(--red)">Sign Out</button>`;

  $('profileContent').innerHTML = h;
  loadFriendsList();
}

async function togglePrivacy(key, val) {
  const p = userData.privacy || {};
  p[key] = val;
  await saveUser({ privacy: p });
  await saveLeaderboard();
  toast('Privacy updated');
}

function changeProgram() {
  // Go back to class select
  selectedClass = null; selectedSub = null; selectedProgram = null;
  showScreen('classScreen'); buildClassSelect();
}

// ── STATS ──
function openStats() { const s = userData.stats || {}; $('statHeight').value = s.height || ''; $('statWeight').value = s.weight || ''; $('statAge').value = s.age || ''; $('statsModal').classList.add('open'); }
function closeStats() { $('statsModal').classList.remove('open'); }
async function saveStats() { const s = { height:$('statHeight').value.trim(), weight:$('statWeight').value.trim(), age:$('statAge').value.trim() }; await saveUser({stats:s}); closeStats(); renderProfile(); toast('Stats updated!'); }

// ── PROFILE PIC ──
document.getElementById('picInput').addEventListener('change', async function() {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    const img = new Image(); img.onload = async function() {
      const canvas = document.createElement('canvas'); const max = 200;
      let w = img.width, h = img.height;
      if (w > h) { h = h*(max/w); w = max; } else { w = w*(max/h); h = max; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const data = canvas.toDataURL('image/jpeg', 0.7);
      await saveUser({profilePic:data}); await saveLeaderboard(); renderProfile(); toast('Photo updated!');
    }; img.src = e.target.result;
  }; reader.readAsDataURL(file);
});

// ═══════════ FRIENDS ═══════════
async function addFriend() {
  const code = $('friendCodeInput').value.trim().toUpperCase();
  if (code.length !== 6) { toast('Enter a 6-character code'); return; }
  if (code === userData.friendCode) { toast("That's your own code!"); return; }

  // Look up friend code
  const codeDoc = await db.collection('friendCodes').doc(code).get();
  if (!codeDoc.exists) { toast('Friend code not found'); return; }
  const friendUid = codeDoc.data().uid;

  if ((userData.friends || []).includes(friendUid)) { toast('Already friends!'); return; }

  // Add to both users' friends lists
  const friends = userData.friends || [];
  friends.push(friendUid);
  await saveUser({ friends });

  // Add current user to friend's list too
  await db.collection('users').doc(friendUid).update({
    friends: firebase.firestore.FieldValue.arrayUnion(U.uid)
  });

  unlockAch('add_friend');
  if (friends.length >= 5) unlockAch('friends_5');

  $('friendCodeInput').value = '';
  toast('Friend added!');
  loadFriendsList();
}

async function loadFriendsList() {
  const list = $('friendsList');
  if (!list) return;
  const friends = userData.friends || [];
  if (!friends.length) { list.innerHTML = '<p style="color:var(--muted);font-size:.78rem">No friends yet. Share your code!</p>'; return; }

  let h = '';
  for (const fid of friends.slice(0, 20)) {
    try {
      const doc = await db.collection('users').doc(fid).get();
      if (!doc.exists) continue;
      const f = doc.data();
      const r = getRank(f.xp || 0);
      h += `<div class="friend-row">
        <div class="lb-pic">${f.profilePic ? '<img src="'+f.profilePic+'">' : '👤'}</div>
        <div class="lb-info"><div class="lb-name">@${f.username || f.name}</div><div class="lb-class">${f.class || ''}</div></div>
        <div class="lb-xp">${f.xp||0}</div>
        <div class="lb-rank" style="color:${r.color}">${r.name}</div>
      </div>`;
    } catch(e) {}
  }
  list.innerHTML = h;
}

// ═══════════ LEADERBOARD ═══════════
let lbMode = 'all';
async function renderLeaderboard() {
  let list = [];
  if (lbMode === 'friends') {
    const fids = [U.uid, ...(userData.friends || [])];
    // Fetch friends from leaderboard
    for (const fid of fids.slice(0, 30)) {
      try { const d = await db.collection('leaderboard').doc(fid).get(); if (d.exists) list.push({uid:d.id,...d.data()}); } catch(e) {}
    }
    list.sort((a,b) => b.xp - a.xp);
  } else {
    const snap = await db.collection('leaderboard').orderBy('xp','desc').limit(50).get();
    snap.forEach(d => list.push({uid:d.id,...d.data()}));
  }

  let h = `<div class="log-filters" style="margin-bottom:.8rem">
    <div class="log-filter ${lbMode==='all'?'active':''}" onclick="lbMode='all';renderLeaderboard()">All Hunters</div>
    <div class="log-filter ${lbMode==='friends'?'active':''}" onclick="lbMode='friends';renderLeaderboard()">Friends Only</div>
  </div>`;

  h += list.length ? list.map((u, i) => {
    const isMe = U && u.uid === U.uid; const r = getRank(u.xp);
    const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    return `<div class="lb-row${isMe?' me':''}"><span class="lb-pos ${posClass}">${i+1}</span><div class="lb-pic">${u.profilePic?'<img src="'+u.profilePic+'">':'👤'}</div><div class="lb-info"><div class="lb-name">@${u.username||'hunter'}</div><div class="lb-class">${u.class}${u.subclass?' • '+u.subclass:''}</div></div><div class="lb-xp">${u.xp}</div><div class="lb-rank" style="color:${r.color}">${r.name}</div></div>`;
  }).join('') : '<p style="color:var(--muted);font-size:.82rem">No hunters ranked yet.</p>';

  $('lbList').innerHTML = h;
}

// ═══════════ LOG ═══════════
function renderLog() {
  const c = $('logContent'); if (!workoutLog.length) { c.innerHTML = '<p style="color:var(--muted);font-size:.82rem">No workouts logged yet.</p>'; return; }
  const prog = userData.program || [];
  const filtered = logFilter === 'all' ? workoutLog : workoutLog.filter(e => e.dayId === logFilter);
  const weeks = {};
  filtered.forEach(e => { const d = new Date(e.date), m = getMonday(d), k = m.toISOString().slice(0,10); if (!weeks[k]) weeks[k] = {monday:m,entries:[]}; weeks[k].entries.push(e); });
  const sorted = Object.values(weeks).sort((a,b) => b.monday - a.monday);
  let h = '<div class="log-filters"><div class="log-filter'+(logFilter==='all'?' active':'')+'" onclick="setFilter(\'all\')">All</div>';
  prog.forEach(d => h += '<div class="log-filter'+(logFilter===d.id?' active':'')+'" onclick="setFilter(\''+d.id+'\')">'+d.title+'</div>');
  h += '</div>';
  sorted.forEach(week => {
    const sun = new Date(week.monday); sun.setDate(sun.getDate()+6);
    const fmt = d => d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const wn = getWeekNum(week.monday);
    h += '<div class="week-group"><div class="week-header" onclick="toggleWk(this)"><span>WEEK '+wn+' <span class="wk-dates">'+fmt(week.monday)+' – '+fmt(sun)+'</span></span><span style="color:var(--muted);font-size:.72rem">▼</span></div><div class="week-body">';
    week.entries.sort((a,b) => new Date(a.date) - new Date(b.date));
    week.entries.forEach(entry => {
      const d = new Date(entry.date), ds = d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
      const maxS = Math.max(...entry.exercises.map(x => x.sets.length));
      h += '<div class="day-log"><div class="day-log-head"><span class="day-log-title">'+entry.dayTitle+'</span><span><span class="day-log-date">'+ds+'</span> <button class="btn-del" onclick="delLog(\''+entry._id+'\')">✕</button></span></div>';
      h += '<div class="log-table-wrap"><table class="log-table"><thead><tr><th>Exercise</th>';
      for (let i = 0; i < maxS; i++) h += '<th>S'+(i+1)+'</th>'; h += '</tr></thead><tbody>';
      entry.exercises.forEach(ex => { if (!ex.sets.some(s => s.reps || s.weight)) return; h += '<tr><td style="font-weight:600;font-size:.74rem;max-width:120px;overflow:hidden;text-overflow:ellipsis">'+ex.name+'</td>';
        for (let i = 0; i < maxS; i++) { const s = ex.sets[i]; if (!s || (!s.reps && !s.weight)) { h += '<td class="c-empty">—</td>'; continue; } const cls = s.done ? 'c-done' : 'c-miss'; h += s.isTime ? '<td class="'+cls+'">'+(s.reps||0)+'s'+(s.done?' ✓':'')+'</td>' : '<td class="'+cls+'">'+(s.weight||0)+'×'+(s.reps||0)+(s.done?' ✓':'')+'</td>'; } h += '</tr>'; });
      h += '</tbody></table></div></div>';
    }); h += '</div></div>';
  });
  c.innerHTML = h;
}
function setFilter(f) { logFilter = f; renderLog(); }
function toggleWk(el) { const b = el.nextElementSibling; if (b.style.maxHeight && b.style.maxHeight !== '0px') { b.style.maxHeight = '0px'; b.style.overflow = 'hidden'; } else { b.style.maxHeight = b.scrollHeight + 'px'; b.style.overflow = 'visible'; } }
async function delLog(id) { if (!confirm('Delete?')) return; await db.collection('users').doc(U.uid).collection('log').doc(id).delete(); workoutLog = workoutLog.filter(e => e._id !== id); renderLog(); toast('Deleted.'); }
function getMonday(d) { const dt = new Date(d); const day = dt.getDay(); dt.setDate(dt.getDate()-day+(day===0?-6:1)); dt.setHours(0,0,0,0); return dt; }
function getWeekNum(mon) { if (!workoutLog.length) return 1; const dates = workoutLog.map(e => getMonday(new Date(e.date)).getTime()); return Math.round((mon - new Date(Math.min(...dates))) / (7*864e5)) + 1; }

// ═══════════ UTILS ═══════════
function $(id) { return document.getElementById(id); }
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
