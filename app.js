// ═══════════════════════════════════════════
//  LEXENFITNESS — APP LOGIC v3
// ═══════════════════════════════════════════
firebase.initializeApp({apiKey:"AIzaSyCbH-A7pp1xrtwHSaVUKlPA0hR2skHu9iY",authDomain:"lexenfitness.firebaseapp.com",projectId:"lexenfitness",storageBucket:"lexenfitness.firebasestorage.app",messagingSenderId:"570672585202",appId:"1:570672585202:web:ce329745b0282ee86c736b"});
const auth=firebase.auth(),db=firebase.firestore();
const DEV_EMAIL='gabinglee11@gmail.com';
let U=null,userData={},workoutLog=[],savedInputs={},isDev=false;
let currentDay='day1',currentPage='profile',logFilter='all',lbMode='all';
let editTarget=null,addDayIdx=null,selectedClass=null,selectedSub=null,selectedProg=null;
let prevRankName=null;
let authLock=false;
const $=id=>document.getElementById(id);

// XSS protection: escape HTML in user/API-sourced strings
function esc(s){if(!s)return'';const d=document.createElement('div');d.textContent=String(s);return d.innerHTML}

// Cleanup: cap unbounded data to prevent Firestore bloat
async function cleanupOldData(){
  let dirty=false;
  if(userData.missionsCompleted){
    const cut=new Date();cut.setDate(cut.getDate()-90);const cs=cut.toISOString().slice(0,10);
    Object.keys(userData.missionsCompleted).forEach(k=>{if(k<cs){delete userData.missionsCompleted[k];dirty=true}});
  }
  if(userData.foodLog){
    const cut=new Date();cut.setDate(cut.getDate()-30);const cs=cut.toISOString().slice(0,10);
    Object.keys(userData.foodLog).forEach(k=>{if(k<cs){delete userData.foodLog[k];dirty=true}});
  }
  if(dirty)await saveUser({missionsCompleted:userData.missionsCompleted,foodLog:userData.foodLog||{}});
}

// ═══════════ AUTH ═══════════
const showLogin=()=>{$('loginForm').style.display='';$('signupForm').style.display='none'};
const showSignup=()=>{$('loginForm').style.display='none';$('signupForm').style.display=''};
async function doLogin(){const e=$('loginEmail').value.trim(),p=$('loginPass').value;$('loginError').textContent='';try{await auth.signInWithEmailAndPassword(e,p)}catch(err){$('loginError').textContent=friendlyErr(err.code)}}
async function doSignup(){
  const f=$('signupFirst').value.trim(),l=$('signupLast').value.trim(),uname=$('signupUsername').value.trim().toLowerCase(),e=$('signupEmail').value.trim(),p=$('signupPass').value;
  $('signupError').textContent='';
  if(!f){$('signupError').textContent='First name required';return}
  if(!uname||uname.length<3){$('signupError').textContent='Username must be 3+ characters';return}
  if(/[^a-z0-9_]/.test(uname)){$('signupError').textContent='Letters, numbers, underscores only';return}
  if(!e){$('signupError').textContent='Email required';return}
  if(!p||p.length<6){$('signupError').textContent='Password must be 6+ characters';return}
  try{
    authLock=true;
    // 1. Create auth account first (so we're authenticated for Firestore)
    const cred=await auth.createUserWithEmailAndPassword(e,p);
    // 2. Now check username availability (authenticated, rules allow read)
    const uc=await db.collection('usernames').doc(uname).get();
    if(uc.exists){
      // Username taken — delete the auth account we just created and bail
      await cred.user.delete();
      authLock=false;
      $('signupError').textContent='Username taken — try another';
      return;
    }
    // 3. All good — write everything
    const dn=f+(l?' '+l:'');
    await cred.user.updateProfile({displayName:dn});
    const fc=genFriendCode();
    await db.collection('users').doc(cred.user.uid).set({name:dn,username:uname,email:e,friendCode:fc,xp:0,achievements:[],stats:{},prs:{},profilePic:'',class:'',subclass:'',programKey:'',program:[],friends:[],privacy:{hideName:false,hideStats:false},goal:'',experience:'',missionsCompleted:{},missionStreak:0,trialsCompleted:[],createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    await db.collection('usernames').doc(uname).set({uid:cred.user.uid});
    await db.collection('friendCodes').doc(fc).set({uid:cred.user.uid});
    authLock=false;
    U=cred.user;isDev=(U.email===DEV_EMAIL);
    await loadUserData();
    prevRankName=getEffectiveRank().name;
    $('loadingScreen').style.display='none';
    showScreen('classScreen');buildClassSelect();
  }catch(err){
    authLock=false;
    $('signupError').textContent=friendlyErr(err.code);
  }
}
async function resetPassword(){const e=$('loginEmail').value.trim();if(!e){$('loginError').textContent='Enter email first';return}try{await auth.sendPasswordResetEmail(e);$('loginError').style.color='var(--green)';$('loginError').textContent='Reset link sent!';setTimeout(()=>{$('loginError').style.color='';$('loginError').textContent=''},4000)}catch(err){$('loginError').textContent=friendlyErr(err.code)}}
async function doGoogleLogin(){
  const provider=new firebase.auth.GoogleAuthProvider();
  try{await auth.signInWithPopup(provider)}catch(err){$('loginError').textContent=friendlyErr(err.code)}
}
const doLogout=()=>auth.signOut();
function friendlyErr(c){return{'auth/invalid-email':'Invalid email','auth/user-not-found':'No account','auth/wrong-password':'Wrong password','auth/email-already-in-use':'Email taken','auth/weak-password':'Password 6+ chars','auth/invalid-credential':'Invalid email or password','auth/too-many-requests':'Too many attempts','auth/requires-recent-login':'Sign out and back in first','auth/popup-closed-by-user':'Sign-in cancelled','auth/cancelled-popup-request':'Sign-in cancelled'}[c]||'Something went wrong'}

// Safety: if loading screen is still showing after 8 seconds, force show auth
setTimeout(()=>{if($('loadingScreen').style.display!=='none'){$('loadingScreen').style.display='none';showScreen('authScreen')}},8000);

auth.onAuthStateChanged(async u=>{
  if(authLock)return;
  try{
    if(u){
      U=u;isDev=(u.email===DEV_EMAIL);
      const doc=await db.collection('users').doc(U.uid).get();
      if(!doc.exists){
        const fc=genFriendCode();
        await db.collection('users').doc(U.uid).set({name:u.displayName||'',username:'',email:u.email,friendCode:fc,xp:0,achievements:[],stats:{},prs:{},profilePic:u.photoURL||'',class:'',subclass:'',programKey:'',program:[],friends:[],privacy:{hideName:false,hideStats:false},goal:'',experience:'',missionsCompleted:{},missionStreak:0,trialsCompleted:[],createdAt:firebase.firestore.FieldValue.serverTimestamp()});
        await db.collection('friendCodes').doc(fc).set({uid:U.uid});
      }
      await loadUserData();
      prevRankName=getEffectiveRank().name;
      $('loadingScreen').style.display='none';
      if(!userData.username){showScreen('usernameScreen');return}
      if(!userData.class){showScreen('classScreen');buildClassSelect()}
      else{showScreen('appScreen');initApp();checkWhatsNew()}
    }else{U=null;isDev=false;$('loadingScreen').style.display='none';showScreen('authScreen')}
  }catch(e){
    $('loadingScreen').style.display='none';
    showScreen('authScreen');
  }
});
function showScreen(id){['authScreen','classScreen','appScreen','usernameScreen'].forEach(s=>{$(s).classList.remove('active');$(s).style.display='none'});$(id).style.display='';$(id).classList.add('active')}

// ═══════════ USERNAME REQUIRED SCREEN ═══════════
async function submitUsername(){
  const uname=$('newUsername').value.trim().toLowerCase();
  $('usernameError').textContent='';
  if(!uname||uname.length<3){$('usernameError').textContent='Username must be 3+ characters';return}
  if(/[^a-z0-9_]/.test(uname)){$('usernameError').textContent='Letters, numbers, underscores only';return}
  const uc=await db.collection('usernames').doc(uname).get();
  if(uc.exists){$('usernameError').textContent='Username taken — try another';return}
  // Claim username
  await db.collection('usernames').doc(uname).set({uid:U.uid});
  await saveUser({username:uname});
  // Proceed to class select or app
  if(!userData.class){showScreen('classScreen');buildClassSelect()}
  else{showScreen('appScreen');initApp();checkWhatsNew()}
}

// ═══════════ FIRESTORE ═══════════
async function loadUserData(){
  const doc=await db.collection('users').doc(U.uid).get();
  userData=doc.exists?doc.data():{name:U.displayName||'',xp:0,achievements:[],stats:{},prs:{},friends:[],privacy:{hideName:false,hideStats:false},missionsCompleted:{},missionStreak:0,trialsCompleted:[],foodLog:{}};
  ['achievements','friends','trialsCompleted'].forEach(k=>{if(!userData[k])userData[k]=[]});
  ['stats','prs','privacy','missionsCompleted','foodLog'].forEach(k=>{if(!userData[k])userData[k]={}});
  if(!userData.missionStreak)userData.missionStreak=0;
  // Migrate: generate friend code if missing
  if(!userData.friendCode){
    const fc=genFriendCode();
    await db.collection('users').doc(U.uid).update({friendCode:fc});
    await db.collection('friendCodes').doc(fc).set({uid:U.uid});
    userData.friendCode=fc;
  }
  const ls=await db.collection('users').doc(U.uid).collection('log').orderBy('date','desc').limit(200).get();
  workoutLog=[];ls.forEach(d=>workoutLog.push({_id:d.id,...d.data()}));
  const iDoc=await db.collection('users').doc(U.uid).collection('meta').doc('inputs').get();
  savedInputs=iDoc.exists?(iDoc.data().data||{}):{};
  // Cleanup old data to prevent Firestore bloat
  await cleanupOldData();
}
async function saveUser(f){await db.collection('users').doc(U.uid).update(f);Object.assign(userData,f)}
async function saveLeaderboard(){const r=getEffectiveRank();await db.collection('leaderboard').doc(U.uid).set({username:userData.username||'hunter',xp:userData.xp,class:userData.class,subclass:userData.subclass||'',rank:r.name,profilePic:userData.profilePic||'',bio:userData.bio||'',workouts:workoutLog.length,updatedAt:firebase.firestore.FieldValue.serverTimestamp()})}

// ═══════════ RANK-UP SPLASH ═══════════
function checkRankUp(){
  const newRank=getEffectiveRank();
  if(prevRankName&&newRank.name!==prevRankName){
    const ri=RANKS.findIndex(r=>r.name===newRank.name);
    const prevRi=RANKS.findIndex(r=>r.name===prevRankName);
    if(ri>prevRi){showRankUpSplash(newRank)}
  }
  prevRankName=newRank.name;
}
function showRankUpSplash(rank){
  const title=(rank.title&&rank.title[userData.class])||rank.name;
  const overlay=$('rankUpSplash');
  $('splashRankName').textContent=rank.name;
  $('splashRankName').style.color=rank.color;
  $('splashTitle').textContent=title;
  $('splashTitle').style.color=rank.color;
  $('splashGlow').style.boxShadow=`0 0 120px 60px ${rank.color}44, 0 0 200px 100px ${rank.color}22`;
  $('splashGlow').style.background=`radial-gradient(circle, ${rank.color}33 0%, transparent 70%)`;
  // Generate particles
  const pc=$('splashParticles');pc.innerHTML='';
  for(let i=0;i<30;i++){
    const p=document.createElement('div');p.className='splash-particle';
    const angle=Math.random()*360,dist=80+Math.random()*120,dur=0.8+Math.random()*1.2;
    const x=Math.cos(angle*Math.PI/180)*dist,y=Math.sin(angle*Math.PI/180)*dist;
    p.style.cssText=`--tx:${x}px;--ty:${y}px;background:${rank.color};animation-duration:${dur}s;animation-delay:${Math.random()*0.3}s`;
    pc.appendChild(p);
  }
  overlay.classList.add('active');
  setTimeout(()=>overlay.classList.remove('active'),4000);
}

// ═══════════ XP BAR (smooth multi-fill) ═══════════
function getXpBarInfo(){
  const r=getEffectiveRank(),nr=getNextRank(userData.xp);
  if(!nr) return {pct:100,label:`${userData.xp} XP`,sublabel:'MAX RANK',color:r.color};
  const rangeXp=nr.min-r.min, progress=userData.xp-r.min;
  const pct=Math.min(100,(progress/rangeXp)*100);
  return {pct,label:`${userData.xp} XP`,sublabel:`${nr.min} XP to ${nr.name}`,color:r.color};
}

// ═══════════ CLASS & PROGRAM SELECT ═══════════
function buildClassSelect(){
  $('classGrid').innerHTML=CLASSES.map(c=>`<div class="class-card" data-cls="${c.id}" onclick="pickClass('${c.id}')"><div class="cc-icon">${c.icon}</div><div class="cc-name">${c.id.toUpperCase()}</div><div class="cc-desc">${c.desc}</div><div class="cc-bonus">${c.bonus}</div></div>`).join('');
}
function pickClass(id){
  selectedClass=id;selectedSub=null;selectedProg=null;
  document.querySelectorAll('.class-card').forEach(c=>c.classList.toggle('selected',c.dataset.cls===id));
  const cls=CLASSES.find(c=>c.id===id);
  const sa=$('subclassArea');
  if(cls.subclasses){sa.classList.add('show');$('subOptions').innerHTML=cls.subclasses.map(s=>`<div class="sub-opt" onclick="pickSub(this,'${s}')">${s}</div>`).join('')}else{sa.classList.remove('show')}
  const progs=CLASS_PROGRAMS[id]||[];
  const pa=$('programArea');pa.classList.add('show');
  $('programGrid').innerHTML=progs.map(p=>`<div class="prog-card" data-prog="${p.key}" onclick="pickProg('${p.key}')"><span class="prog-icon">${p.icon}</span><div class="prog-name">${p.name}</div><div class="prog-desc">${p.desc}</div></div>`).join('')+`<div class="prog-card" data-prog="blank" onclick="pickProg('blank')"><span class="prog-icon">📝</span><div class="prog-name">Build Your Own</div><div class="prog-desc">Start blank — add exercises</div></div>`;
  updateConfirmBtn();
}
function pickSub(el,s){selectedSub=s;document.querySelectorAll('.sub-opt').forEach(e=>e.classList.remove('active'));el.classList.add('active');updateConfirmBtn()}
function pickProg(key){selectedProg=key;document.querySelectorAll('.prog-card').forEach(c=>c.classList.toggle('selected',c.dataset.prog===key));updateConfirmBtn()}
function updateConfirmBtn(){const cls=CLASSES.find(c=>c.id===selectedClass);let ok=!!selectedClass&&!!selectedProg;if(cls&&cls.subclasses&&!selectedSub)ok=false;$('csConfirm').disabled=!ok}
async function confirmClass(){
  if(!selectedClass||!selectedProg)return;let prog;
  if(selectedProg==='blank'){prog=[{id:'day1',title:'DAY 1',subtitle:'Add exercises',exercises:[]},{id:'day2',title:'DAY 2',subtitle:'Add exercises',exercises:[]},{id:'day3',title:'DAY 3',subtitle:'Add exercises',exercises:[]},{id:'day4',title:'DAY 4',subtitle:'Add exercises',exercises:[]}]}
  else{const all=[...Object.values(CLASS_PROGRAMS).flat()];const found=all.find(p=>p.key===selectedProg);prog=found?JSON.parse(JSON.stringify(found.days)):[];}
  await saveUser({class:selectedClass,subclass:selectedSub||'',programKey:selectedProg,program:prog});
  await saveLeaderboard();showScreen('appScreen');initApp();checkWhatsNew();
}

// ═══════════ INIT ═══════════
function initApp(){document.querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',()=>switchPage(n.dataset.page)));updateTopBar();syncAcceptedRequests();checkUnreadChats();checkPassiveAchievements();initNotifications();
  // Handle PWA shortcut ?page= param
  const params=new URLSearchParams(window.location.search);const startPage=params.get('page');
  switchPage(startPage&&['train','missions','nutrition','chat','ranks','profile'].includes(startPage)?startPage:'profile');
}
function updateTopBar(){
  const r=getEffectiveRank(),info=getXpBarInfo(),cap=getXpCap();
  const capped=cap!==Infinity&&userData.xp>=cap;
  $('tbXp').textContent=capped?userData.xp+' XP 🔒':userData.xp+' XP';
  $('tbXp').style.color=capped?'var(--red)':'';
  const rb=$('tbRank');rb.textContent=r.name;
  // XP Multiplier banner
  let mb=$('xpMultBanner');if(!mb){mb=document.createElement('div');mb.id='xpMultBanner';mb.className='xp-mult-banner';const tb=document.querySelector('.top-bar');if(tb)tb.after(mb)}
  const xm=getXpMultiplier();mb.style.display=xm.label?'':'none';mb.textContent=xm.label||'';rb.style.color=r.color;rb.style.background=r.color+'22';rb.style.border='1px solid '+r.color+'44';
  const bar=$('tbXpBar');if(bar){bar.style.width=info.pct+'%';bar.style.background=capped?'var(--red)':`linear-gradient(90deg,${r.color},${r.color}cc)`}
}
function getEffectiveRank(){
  for(let i=RANKS.length-1;i>=0;i--){
    if(userData.xp>=RANKS[i].min){
      if(!RANKS[i].auto&&RANKS[i].trial&&!userData.trialsCompleted.includes(RANKS[i].trial)){
        return i>0?RANKS[i-1]:RANKS[0];
      }
      return RANKS[i];
    }
  }
  return RANKS[0];
}

// ═══════════ XP CAP SYSTEM ═══════════
// XP hard-caps at the next uncompleted trial threshold
function getXpCap(){
  for(let i=0;i<RANKS.length;i++){
    if(!RANKS[i].auto&&RANKS[i].trial&&!userData.trialsCompleted.includes(RANKS[i].trial)){
      return RANKS[i].min; // cap AT this rank's min (can reach it but not pass)
    }
  }
  return Infinity; // all trials done, no cap
}
function addXP(amount){
  const cap=getXpCap();
  const {mult}=getXpMultiplier();
  const boosted=Math.round(amount*mult);
  const before=userData.xp;
  userData.xp=Math.min(userData.xp+boosted,cap);
  const gained=userData.xp-before;
  if(gained<amount&&amount>0){
    // XP was capped — notify
    const trial=getAvailableTrial();
    if(trial)xpCappedMsg=`⚠️ XP CAPPED — Complete ${trial.trial.name} to continue gaining XP`;
    else xpCappedMsg='';
  }
  return gained; // actual XP gained after cap
}
let xpCappedMsg='';
function switchPage(p){currentPage=p;document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===p));document.querySelectorAll('.page').forEach(pg=>pg.classList.remove('active'));$('page-'+p).classList.add('active');
  if(p==='train')buildWorkout();if(p==='profile'){renderProfile();renderFriendsPage()}if(p==='missions'){renderMissions();renderAchievements()}
  if(p==='nutrition')renderNutritionPage();if(p==='ranks')renderLeaderboard();if(p==='chat')renderChatPage()}
function switchSubTab(page,tab){
  const container=$('page-'+page);if(!container)return;
  container.querySelectorAll('.stab').forEach(t=>t.classList.toggle('active',t.dataset.st===tab));
  container.querySelectorAll('.sub-page').forEach(p=>p.classList.remove('active'));
  const sp=$('sp-'+tab);if(sp)sp.classList.add('active');
  if(tab==='log')renderLog();if(tab==='rankinfo')$('rankInfoContent').innerHTML=renderRankInfo();if(tab==='leaderboard')renderLeaderboard();
  if(tab==='aicoach')renderAICoach();if(tab==='friendchat')renderChatList();
  if(tab==='friends')renderFriendsPage();if(tab==='mystats')renderProfile();
  if(tab==='updates')renderUpdatesTab();
}

// ═══════════ DAILY MISSIONS ═══════════
function renderMissions(){
  const today=getTodayStr();const missions=getDailyMissions(today,userData.class);
  const completed=userData.missionsCompleted[today]||[];
  const allDone=missions.every(m=>completed.includes(m.id));
  const cap=getXpCap();const capped=cap!==Infinity&&userData.xp>=cap;
  const {mult,label:multLabel}=getXpMultiplier();
  let h=`<div class="page-title">DAILY MISSIONS</div><div class="page-sub">${completed.length}/${missions.length} complete · Streak: ${userData.missionStreak} days</div>`;
  if(multLabel)h+=`<div class="xp-mult-badge">${multLabel}</div>`;
  if(capped){const trial=getAvailableTrial();h+=`<div class="gate-locked-banner">🔒 GATE LOCKED<br><span style="font-size:.72rem;font-family:var(--font-body);letter-spacing:0">XP capped at ${cap}. Complete the trial below to break through.</span></div>`}
  const trialInfo=getAvailableTrial();
  if(trialInfo)h+=renderTrialBanner(trialInfo);
  // ── Event Mission ──
  const evt=getEventMission(today);
  if(evt){
    const evtDone=(userData.eventsCompleted||{})[today];
    if(evtDone)h+=`<div class="event-card done"><div class="event-label">⚡ EVENT</div><div class="mission-icon">${evt.icon}</div><div class="mission-info"><div class="mission-name">${evt.name}</div><div class="mission-desc">${evt.desc}</div></div><div class="mission-xp locked">DONE</div></div>`;
    else h+=`<div class="event-card" onclick="completeEvent()"><div class="event-label">⚡ EVENT</div><div class="mission-icon">${evt.icon}</div><div class="mission-info"><div class="mission-name">${evt.name}</div><div class="mission-desc">${evt.desc}</div></div><div class="mission-xp">${capped?'🔒':'+'+Math.round(evt.xp*mult)+' XP'}</div></div>`;
  }
  // ── Daily Missions ──
  h+=missions.map(m=>{const done=completed.includes(m.id);
    if(done)return`<div class="mission-card done"><div class="mission-check">✅</div><div class="mission-icon">${m.icon}</div><div class="mission-info"><div class="mission-name">${m.name}</div><div class="mission-desc">${m.desc}</div></div><div class="mission-xp locked">DONE</div></div>`;
    return`<div class="mission-card" onclick="completeMission('${m.id}')"><div class="mission-check">⬜</div><div class="mission-icon">${m.icon}</div><div class="mission-info"><div class="mission-name">${m.name}</div><div class="mission-desc">${m.desc}</div></div><div class="mission-xp">${capped?'🔒':'+'+Math.round(m.xp*mult)+' XP'}</div></div>`;
  }).join('');
  if(allDone)h+=`<div class="mission-bonus">🌟 ALL MISSIONS COMPLETE! ${capped?'(XP capped)':'+50 BONUS XP'} 🌟</div>`;
  // ── Progression Track ──
  h+=renderProgressionTrack();
  $('missionsContent').innerHTML=h;
}
async function completeMission(mid){
  const today=getTodayStr();const missions=getDailyMissions(today,userData.class);
  let completed=userData.missionsCompleted[today]||[];
  if(completed.includes(mid))return;
  const m=missions.find(x=>x.id===mid);if(!m)return;
  if(!confirm(`✅ Complete "${m.name}"?\n\n${m.desc}\n\nThis locks in for today.`))return;
  completed.push(mid);const gained=addXP(m.xp);let bonusMsg='';
  if(missions.every(x=>completed.includes(x.id))){addXP(50);bonusMsg=' +50 BONUS!';unlockAch('missions_all')}
  if(completed.length>=3)unlockAch('missions_3');
  userData.missionsCompleted[today]=completed;
  userData.missionStreak=calcMissionStreak();
  if(userData.missionStreak>=7)unlockAch('mission_streak_7');
  if(userData.missionStreak>=14)unlockAch('missions_streak_14');
  await saveUser({missionsCompleted:userData.missionsCompleted,missionStreak:userData.missionStreak,xp:userData.xp});
  await saveLeaderboard();updateTopBar();checkRankUp();renderMissions();
  toast(`${m.icon} ${m.name} +${m.xp} XP${bonusMsg}`);
}
function calcMissionStreak(){let streak=0;const d=new Date();for(let i=0;i<365;i++){const ds=new Date(d);ds.setDate(ds.getDate()-i);const key=ds.toISOString().slice(0,10);const missions=getDailyMissions(key,userData.class);const comp=userData.missionsCompleted[key]||[];if(missions.every(m=>comp.includes(m.id)))streak++;else break}return streak}

// ═══════════ RANK TRIALS ═══════════
function getAvailableTrial(){for(let i=RANKS.length-1;i>=0;i--){if(userData.xp>=RANKS[i].min&&!RANKS[i].auto&&RANKS[i].trial&&!userData.trialsCompleted.includes(RANKS[i].trial)){return{rank:RANKS[i],trial:RANK_TRIALS[RANKS[i].trial]}}}return null}
function renderTrialBanner(info){
  const t=info.trial;const progress=getTrialProgress(t);
  let h=`<div class="trial-banner"><div class="trial-header"><span class="trial-icon">${t.icon}</span><div><div class="trial-name">${t.name}</div><div class="trial-desc">${t.desc}</div></div></div>`;
  t.tasks.forEach((task,i)=>{const p=progress[i];const pct=Math.min(100,(p/task.target)*100);
    h+=`<div class="trial-task"><div class="trial-task-desc">${task.desc}</div><div class="trial-bar"><div class="trial-bar-fill" style="width:${pct}%"></div></div><div class="trial-task-num">${p} / ${task.target}</div></div>`});
  const allDone=t.tasks.every((task,i)=>progress[i]>=task.target);
  if(allDone)h+=`<button class="trial-claim" onclick="claimTrial('${info.rank.trial}')">⚔️ CLAIM ${info.rank.name}</button>`;
  h+=`</div>`;return h;
}
function getTrialProgress(trial){return trial.tasks.map(task=>{switch(task.id){
  case 'perfect_weeks_3':return calcPerfectWeeks();case 'streak_14':case 'streak_30':return calcDayStreak();
  case 'log_pr':return Math.max(0,...workoutLog.flatMap(e=>e.exercises.flatMap(ex=>ex.sets.map(s=>parseInt(s.weight)||0))));
  case 'missions_7':return userData.missionStreak;case 'workouts_50':return workoutLog.length;default:return 0}})}
function calcPerfectWeeks(){const w={};workoutLog.forEach(e=>{const m=getMonday(new Date(e.date)).toISOString().slice(0,10);if(!w[m])w[m]={days:new Set(),allDone:true};w[m].days.add(e.dayId);if(!e.exercises.every(ex=>ex.sets.every(s=>s.done)))w[m].allDone=false});return Object.values(w).filter(wk=>wk.days.size>=4&&wk.allDone).length}
async function claimTrial(trialId){
  if(userData.trialsCompleted.includes(trialId))return;
  userData.trialsCompleted.push(trialId);
  const rank=RANKS.find(r=>r.trial===trialId);
  if(rank){if(rank.name==='B-RANK')unlockAch('rank_b');if(rank.name==='A-RANK')unlockAch('rank_a');if(rank.name==='S-RANK')unlockAch('rank_s')}
  await saveUser({trialsCompleted:userData.trialsCompleted});await saveLeaderboard();updateTopBar();checkRankUp();
  toast('⚔️ '+rank.name+' ACHIEVED!');switchPage('missions');
}

// TDEE/Nutrition functions moved to nutrition.js

// ═══════════ DEV TOOLS ═══════════
function renderDevTools(){
  if(!isDev)return'';
  const er=getEffectiveRank();const trial=getAvailableTrial();const cap=getXpCap();
  return`<div class="dev-panel">
    <div class="section-title" style="color:var(--red)">🔧 DEV TOOLS</div>
    <div style="font-size:.68rem;color:var(--muted);margin:.3rem 0">Current: ${er.name} · XP: ${userData.xp} · Cap: ${cap===Infinity?'∞':cap} · Trials: [${userData.trialsCompleted.join(', ')||'none'}]</div>
    <div style="font-size:.68rem;color:${trial?'var(--gold)':'var(--green)'};margin-bottom:.4rem">${trial?'🔒 GATE LOCKED — '+trial.trial.name+' (XP capped at '+cap+')':'✅ No gate blocking'}</div>
    <div class="dev-row">
      <button class="dev-btn" onclick="devSetXP(400)">400 (E)</button>
      <button class="dev-btn" onclick="devSetXP(1400)">1400 (D)</button>
      <button class="dev-btn" onclick="devSetXP(3400)">3400 (C)</button>
      <button class="dev-btn" onclick="devAddXP(500)">+500</button>
    </div>
    <div class="dev-row">
      <button class="dev-btn" onclick="devSetXP(3600)">3600 (→B)</button>
      <button class="dev-btn" onclick="devSetXP(7100)">7100 (→A)</button>
      <button class="dev-btn" onclick="devSetXP(15100)">15100 (→S)</button>
      <button class="dev-btn" style="color:var(--red)" onclick="devForceXP(parseInt(prompt('Force XP to:')||'0'))">Force XP ⚡</button>
    </div>
    <div class="dev-row" style="margin-top:.3rem;border-top:1px dashed var(--border);padding-top:.4rem">
      <button class="dev-btn" style="color:var(--gold)" onclick="devFakeIronGate()">Fake Iron Gate</button>
      <button class="dev-btn" style="color:var(--gold)" onclick="devFakeGauntlet()">Fake Gauntlet</button>
      <button class="dev-btn" style="color:var(--gold)" onclick="devFakeAwakening()">Fake Awakening</button>
    </div>
    <div class="dev-row">
      <button class="dev-btn" style="color:var(--cyan)" onclick="devInjectWorkouts(5)">+5 Logs</button>
      <button class="dev-btn" style="color:var(--cyan)" onclick="devInjectWorkouts(20)">+20 Logs</button>
      <button class="dev-btn" onclick="devTriggerSplash()">Test Splash</button>
    </div>
    <div class="dev-row">
      <button class="dev-btn" onclick="devResetTrials()">Reset Trials</button>
      <button class="dev-btn" style="color:var(--red)" onclick="devResetAll()">Full Reset</button>
    </div>
    <div class="dev-row" style="margin-top:.3rem;border-top:1px dashed var(--border);padding-top:.4rem">
      <button class="dev-btn" style="color:var(--green)" onclick="devPushProgram()">Push Program to User</button>
    </div>
  </div>`;
}
async function devSetXP(xp){
  const cap=getXpCap();userData.xp=Math.min(xp,cap);
  await saveUser({xp:userData.xp});await saveLeaderboard();updateTopBar();checkRankUp();renderProfile();
  toast(userData.xp<xp?`DEV: Capped at ${userData.xp} (trial blocks ${cap}+)`:`DEV: XP set to ${userData.xp}`);
}
async function devAddXP(xp){
  const gained=addXP(xp);await saveUser({xp:userData.xp});await saveLeaderboard();updateTopBar();checkRankUp();renderProfile();
  toast(gained<xp?`DEV: +${gained} XP (capped — trial needed)`:`DEV: +${gained} XP`);
}
async function devForceXP(xp){
  // Bypass cap entirely — for testing splash/rank display only
  userData.xp=xp;await saveUser({xp});await saveLeaderboard();updateTopBar();checkRankUp();renderProfile();
  toast('DEV: FORCED XP to '+xp+' (cap bypassed)');
}
async function devResetTrials(){userData.trialsCompleted=[];await saveUser({trialsCompleted:[]});updateTopBar();renderProfile();toast('DEV: Trials reset')}
async function devResetAll(){await saveUser({xp:0,achievements:[],trialsCompleted:[],missionsCompleted:{},missionStreak:0});userData.xp=0;userData.achievements=[];userData.trialsCompleted=[];updateTopBar();renderProfile();toast('DEV: Full reset')}

// Trial fakers — inject fake log data so trial progress checks pass
async function devFakeIronGate(){
  // Need 3 perfect weeks: inject 3 weeks of 4-day logs with all sets done
  const prog=userData.program||[];if(prog.length<4){toast('Need a program first');return}
  for(let w=0;w<3;w++){
    const weekStart=new Date();weekStart.setDate(weekStart.getDate()-(7*(w+1)));
    for(let d=0;d<4;d++){
      const date=new Date(weekStart);date.setDate(date.getDate()+d);
      const day=prog[d];
      const entry={dayId:day.id,dayTitle:day.title,date:date.toISOString(),exercises:day.exercises.map(ex=>({name:ex.name,sets:Array.from({length:ex.sets},()=>({weight:'135',reps:'8',done:true,isTime:!!ex.isTime}))}))};
      const ref=await db.collection('users').doc(U.uid).collection('log').add(entry);
      workoutLog.push({_id:ref.id,...entry});
    }
  }
  toast('DEV: Injected 3 perfect weeks (12 workouts). Check Missions → Iron Gate.');renderProfile();
}
async function devFakeGauntlet(){
  // Need 14-day streak + 225lb lift
  const prog=userData.program||[];if(!prog.length){toast('Need a program first');return}
  for(let i=0;i<14;i++){
    const date=new Date();date.setDate(date.getDate()-i);
    const day=prog[i%prog.length];
    const entry={dayId:day.id,dayTitle:day.title,date:date.toISOString(),exercises:[{name:'Heavy Squat',sets:[{weight:'245',reps:'5',done:true,isTime:false}]}]};
    const ref=await db.collection('users').doc(U.uid).collection('log').add(entry);
    workoutLog.push({_id:ref.id,...entry});
  }
  toast('DEV: Injected 14-day streak with 245lb lifts. Check Missions → Gauntlet.');renderProfile();
}
async function devFakeAwakening(){
  // Need 30-day streak + 7-day mission streak + 50 workouts
  const prog=userData.program||[];if(!prog.length){toast('Need a program first');return}
  // 30-day streak + pad to 50 workouts
  for(let i=0;i<50;i++){
    const date=new Date();date.setDate(date.getDate()-i);
    const day=prog[i%prog.length];
    const entry={dayId:day.id,dayTitle:day.title,date:date.toISOString(),exercises:[{name:'Training',sets:[{weight:'135',reps:'10',done:true,isTime:false}]}]};
    const ref=await db.collection('users').doc(U.uid).collection('log').add(entry);
    workoutLog.push({_id:ref.id,...entry});
  }
  // 7-day mission streak
  const mc={};
  for(let i=0;i<7;i++){
    const d=new Date();d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10);
    const missions=getDailyMissions(key,userData.class);mc[key]=missions.map(m=>m.id);
  }
  userData.missionsCompleted={...userData.missionsCompleted,...mc};
  userData.missionStreak=calcMissionStreak();
  await saveUser({missionsCompleted:userData.missionsCompleted,missionStreak:userData.missionStreak});
  toast('DEV: Injected 50 workouts (30-day streak) + 7-day missions. Check Missions → Awakening.');renderProfile();
}
async function devInjectWorkouts(n){
  const prog=userData.program||[];if(!prog.length){toast('Need a program first');return}
  for(let i=0;i<n;i++){
    const date=new Date();date.setDate(date.getDate()-i);
    const day=prog[i%prog.length];
    const entry={dayId:day.id,dayTitle:day.title,date:date.toISOString(),exercises:[{name:day.exercises[0]?.name||'Exercise',sets:[{weight:'135',reps:'10',done:true,isTime:false}]}]};
    const ref=await db.collection('users').doc(U.uid).collection('log').add(entry);
    workoutLog.push({_id:ref.id,...entry});
  }
  toast('DEV: +'+n+' fake workouts');renderProfile();
}
function devTriggerSplash(){
  // Test splash with whatever the next rank would be
  const r=getEffectiveRank();const ri=RANKS.findIndex(x=>x.name===r.name);
  const next=ri<RANKS.length-1?RANKS[ri+1]:RANKS[RANKS.length-1];
  showRankUpSplash(next);
}
async function devPushProgram(){
  const username=prompt('Username to push program to (lowercase):');if(!username)return;
  // Look up user by username
  const snap=await db.collection('usernames').doc(username.toLowerCase().trim()).get();
  if(!snap.exists){toast('Username not found: '+username);return}
  const uid=snap.data().uid;
  // Pick program
  const allProgs=[...SHARED_PROGRAMS,...Object.values(CLASS_PROGRAMS).flat()];
  const keys=allProgs.map(p=>p.key+' — '+p.name);
  const choice=prompt('Program key to push:\n\n'+keys.join('\n')+'\n\nEnter key:','fb_abc');
  if(!choice)return;
  const prog=allProgs.find(p=>p.key===choice.trim());
  if(!prog){toast('Program not found: '+choice);return}
  const programData=JSON.parse(JSON.stringify(prog.days));
  await db.collection('users').doc(uid).update({programKey:prog.key,program:programData});
  toast('Pushed "'+prog.name+'" to @'+username);
}

// ═══════════ WORKOUT ═══════════
function buildWorkout(){
  const prog=userData.program||[];
  $('workoutTitle').textContent=(userData.class||'WORKOUT').toUpperCase();
  $('workoutSub').textContent=(userData.subclass?userData.subclass+' — ':'')+getEffectiveRank().name;
  if(!prog.length){$('dayTabs').innerHTML='';$('dayContent').innerHTML='<p style="color:var(--muted);font-size:.82rem">No days in your program.</p><button class="add-ex" onclick="addWorkoutDay()" style="margin-top:.5rem">+ Add Workout Day</button>';return}
  if(!prog.find(d=>d.id===currentDay))currentDay=prog[0].id;
  $('dayTabs').innerHTML=prog.map(d=>`<div class="dtab${d.id===currentDay?' active':''}" data-d="${d.id}" onclick="switchDay('${d.id}')">${d.title}</div>`).join('')+`<div class="dtab" style="color:var(--green);border-color:var(--green)" onclick="addWorkoutDay()">+</div>`;
  renderDay();updateLogBtn();
}
async function addWorkoutDay(){
  const prog=userData.program||[];
  const num=prog.length+1;
  const title=prompt('Day name (e.g. "PUSH DAY", "DAY 5"):','DAY '+num);
  if(!title)return;
  const sub=prompt('Subtitle (e.g. "Monday — Chest & Tris"):','');
  captureInputs();
  prog.push({id:'day'+Date.now(),title:title.toUpperCase(),subtitle:sub||'',exercises:[]});
  await saveUser({program:prog});
  currentDay=prog[prog.length-1].id;
  buildWorkout();toast('Day added!');
}
async function removeWorkoutDay(){
  const prog=userData.program||[];
  const day=prog.find(d=>d.id===currentDay);
  if(!day)return;
  if(!confirm(`Remove "${day.title}"? This deletes all exercises in this day.`))return;
  captureInputs();
  const idx=prog.indexOf(day);prog.splice(idx,1);
  await saveUser({program:prog});
  currentDay=prog.length?prog[0].id:'';
  buildWorkout();toast('Day removed.');
}
async function renameWorkoutDay(){
  const prog=userData.program||[];
  const day=prog.find(d=>d.id===currentDay);if(!day)return;
  const title=prompt('New day name:',day.title);if(!title)return;
  const sub=prompt('New subtitle:',day.subtitle);
  day.title=title.toUpperCase();day.subtitle=sub||day.subtitle;
  await saveUser({program:prog});
  buildWorkout();toast('Day renamed!');
}
function switchDay(id){currentDay=id;document.querySelectorAll('.dtab').forEach(t=>t.classList.toggle('active',t.dataset.d===id));renderDay();updateLogBtn()}
function renderDay(){const prog=userData.program||[],day=prog.find(d=>d.id===currentDay);if(!day)return;const di=prog.indexOf(day);let h='';
  day.exercises.forEach((ex,ei)=>{h+=`<div class="exercise"><div class="ex-header"><span class="ex-num">${ei+1}</span><span class="ex-name">${ex.name}</span><button class="ex-edit" onclick="openEdit(${di},${ei})">✏️</button></div><div class="sets-grid">`;
    for(let s=0;s<ex.sets;s++){const wK=day.id+'_e'+ei+'_s'+s+'_w',rK=day.id+'_e'+ei+'_s'+s+'_r',cK=day.id+'_e'+ei+'_s'+s+'_c';
      if(ex.isTime)h+=`<div class="set-row"><label>S${s+1}</label><input type="number" id="${rK}" placeholder="sec" value="${savedInputs[rK]||''}"><span class="sep">sec</span><input type="checkbox" id="${cK}" ${savedInputs[cK]?'checked':''}><span class="target">${ex.reps}</span></div>`;
      else h+=`<div class="set-row"><label>S${s+1}</label><input type="number" id="${wK}" placeholder="lbs" value="${savedInputs[wK]||''}"><span class="sep">×</span><input type="number" id="${rK}" placeholder="reps" value="${savedInputs[rK]||''}"><input type="checkbox" id="${cK}" ${savedInputs[cK]?'checked':''}><span class="target">${ex.reps}</span></div>`}
    h+='</div></div>'});
  h+=`<button class="add-ex" onclick="openAdd(${di})">+ Add Exercise</button>`;
  h+=`<div class="day-manage"><button class="day-manage-btn" onclick="renameWorkoutDay()">✏️ Rename Day</button><button class="day-manage-btn" style="color:var(--red)" onclick="removeWorkoutDay()">🗑 Remove Day</button></div>`;
  $('dayContent').innerHTML=h}

function openEdit(di,ei){editTarget={di,ei};const ex=userData.program[di].exercises[ei];$('editName').value=ex.name;$('editSets').value=ex.sets;$('editReps').value=ex.reps;$('editModal').classList.add('open')}
function closeEdit(){$('editModal').classList.remove('open')}
async function saveEdit(){if(!editTarget)return;captureInputs();const ex=userData.program[editTarget.di].exercises[editTarget.ei];ex.name=$('editName').value.trim()||ex.name;ex.sets=parseInt($('editSets').value)||ex.sets;ex.reps=$('editReps').value.trim()||ex.reps;ex.isTime=/sec|s$/i.test(ex.reps);await saveUser({program:userData.program});closeEdit();renderDay();unlockAch('customize');toast('Updated!')}
async function deleteEx(){if(!editTarget||!confirm('Remove?'))return;captureInputs();userData.program[editTarget.di].exercises.splice(editTarget.ei,1);await saveUser({program:userData.program});closeEdit();renderDay();toast('Removed.')}
function openAdd(di){addDayIdx=di;$('addName').value='';$('addSets').value=3;$('addReps').value='';$('addModal').classList.add('open')}
function closeAdd(){$('addModal').classList.remove('open')}
async function saveAdd(){if(addDayIdx===null)return;const name=$('addName').value.trim();if(!name){toast('Enter a name');return}captureInputs();userData.program[addDayIdx].exercises.push({name,sets:parseInt($('addSets').value)||3,reps:$('addReps').value.trim()||'8-12',isTime:/sec|s$/i.test($('addReps').value)});await saveUser({program:userData.program});closeAdd();renderDay();toast('Added!')}
function captureInputs(){document.querySelectorAll('#dayContent input[type=number]').forEach(el=>{if(el.id)savedInputs[el.id]=el.value});document.querySelectorAll('#dayContent input[type=checkbox]').forEach(el=>{if(el.id)savedInputs[el.id]=el.checked})}
async function saveInputs(){captureInputs();await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs});toast('Saved!')}
function clearInputs(){if(!confirm('Clear inputs?'))return;document.querySelectorAll('#dayContent input[type=number]').forEach(el=>el.value='');document.querySelectorAll('#dayContent input[type=checkbox]').forEach(el=>el.checked=false);toast('Cleared.')}

// ═══════════ LOG WORKOUT ═══════════
let logLock=false;
async function logWorkout(){
  if(logLock)return;logLock=true;
  try{
  const prog=userData.program||[],day=prog.find(d=>d.id===currentDay);if(!day){toast('Pick a day!');logLock=false;return}
  captureInputs();const entry={dayId:day.id,dayTitle:day.title,date:new Date().toISOString(),exercises:[]};let hasData=false,allDone=true,maxW=0;
  day.exercises.forEach((ex,ei)=>{const sets=[];for(let s=0;s<ex.sets;s++){const wEl=$(day.id+'_e'+ei+'_s'+s+'_w'),rEl=$(day.id+'_e'+ei+'_s'+s+'_r'),cEl=$(day.id+'_e'+ei+'_s'+s+'_c');const w=wEl?wEl.value:'',r=rEl?rEl.value:'',d=cEl?cEl.checked:false;if(w||r)hasData=true;if(!d)allDone=false;if(parseInt(w)>maxW)maxW=parseInt(w);sets.push({weight:w,reps:r,done:d,isTime:!!ex.isTime})}entry.exercises.push({name:ex.name,sets})});
  if(!hasData){toast('Fill in sets!');return}
  const ref=await db.collection('users').doc(U.uid).collection('log').add(entry);entry._id=ref.id;workoutLog.unshift(entry);
  let xp=50;if(allDone)xp+=50;const hr=new Date().getHours(),wc=workoutLog.length;
  if(wc>=1)unlockAch('first_workout');if(wc>=10)unlockAch('workouts_10');if(wc>=25)unlockAch('workouts_25');if(wc>=50)unlockAch('workouts_50');if(wc>=100)unlockAch('workouts_100');if(wc>=200)unlockAch('workouts_200');
  if(hr<7)unlockAch('early_bird');if(hr>=21)unlockAch('night_owl');if(allDone)unlockAch('all_sets_done');
  if(maxW>=200)unlockAch('heavy_day');if(maxW>=315)unlockAch('monster_lift');if(maxW>=405)unlockAch('titan_lift');if(maxW>=500)unlockAch('heavy_500');
  const dids=new Set(workoutLog.map(e=>e.dayId));if(dids.size>=4)unlockAch('variety');
  const wkStreak=calcWeeklyStreak();
  if(wkStreak>=2)unlockAch('wk_streak_2');if(wkStreak>=4)unlockAch('wk_streak_4');if(wkStreak>=8)unlockAch('wk_streak_8');
  if(wkStreak>=12)unlockAch('wk_streak_12');if(wkStreak>=26)unlockAch('wk_streak_26');if(wkStreak>=52)unlockAch('wk_streak_52');
  const hr2=new Date().getHours();if(hr2>=0&&hr2<4)unlockAch('midnight');
  const fw=calcFullWeeks();if(fw>=1)unlockAch('full_week');if(fw>=5)unlockAch('full_week_5');if(fw>=10)unlockAch('full_week_10');if(fw>=20)unlockAch('full_week_20');
  // Weekend warrior check
  const dow=new Date().getDay();if(dow===0||dow===6){const thisWeekLogs=workoutLog.filter(e=>{const d=new Date(e.date);const wk=getMonday(d).toISOString().slice(0,10);return wk===getMonday(new Date()).toISOString().slice(0,10)});const wDays=new Set(thisWeekLogs.map(e=>new Date(e.date).getDay()));if(wDays.has(0)&&wDays.has(6))unlockAch('weekend_warrior')}
  // PR breaker check
  if(workoutLog.length>=2){const prevMax=Math.max(0,...workoutLog.slice(1).flatMap(e=>e.exercises.flatMap(ex=>ex.sets.map(s=>parseInt(s.weight)||0))));if(maxW>prevMax&&prevMax>0)unlockAch('pr_breaker')}
  const nx=userData.xp+xp;if(nx>=500)unlockAch('rank_d');if(nx>=1500)unlockAch('rank_c');
  const gained=addXP(xp);await saveUser({xp:userData.xp});await saveLeaderboard();updateTopBar();checkRankUp();
  let msg=day.title+' +'+gained+' XP';if(gained<xp)msg+=' (CAPPED — complete trial!)';if(xpCappedMsg)msg=xpCappedMsg;
  // Clear this day's inputs after logging
  day.exercises.forEach((ex,ei)=>{for(let s=0;s<ex.sets;s++){delete savedInputs[day.id+'_e'+ei+'_s'+s+'_w'];delete savedInputs[day.id+'_e'+ei+'_s'+s+'_r'];delete savedInputs[day.id+'_e'+ei+'_s'+s+'_c']}});
  await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs});
  renderDay();
  toast(msg)}finally{logLock=false}}
function updateLogBtn(){const prog=userData.program||[];const day=prog.find(d=>d.id===currentDay);const btn=$('logDayBtn');if(btn&&day)btn.textContent='📋 Log '+day.title}
async function logAllDays(){
  if(logLock)return;logLock=true;
  try{
  const prog=userData.program||[];if(!prog.length){toast('No program!');logLock=false;return}
  captureInputs();
  let logged=0,totalXp=0;
  for(const day of prog){
    // Check if this day has any filled-in data in savedInputs
    let hasData=false;
    day.exercises.forEach((ex,ei)=>{for(let s=0;s<ex.sets;s++){const wK=day.id+'_e'+ei+'_s'+s+'_w',rK=day.id+'_e'+ei+'_s'+s+'_r';if(savedInputs[wK]||savedInputs[rK])hasData=true}});
    if(!hasData)continue;
    // Build entry from savedInputs
    const entry={dayId:day.id,dayTitle:day.title,date:new Date().toISOString(),exercises:[]};let allDone=true,maxW=0;
    day.exercises.forEach((ex,ei)=>{const sets=[];for(let s=0;s<ex.sets;s++){const w=savedInputs[day.id+'_e'+ei+'_s'+s+'_w']||'',r=savedInputs[day.id+'_e'+ei+'_s'+s+'_r']||'',d=!!savedInputs[day.id+'_e'+ei+'_s'+s+'_c'];if(!d)allDone=false;if(parseInt(w)>maxW)maxW=parseInt(w);sets.push({weight:w,reps:r,done:d,isTime:!!ex.isTime})}entry.exercises.push({name:ex.name,sets})});
    const ref=await db.collection('users').doc(U.uid).collection('log').add(entry);entry._id=ref.id;workoutLog.unshift(entry);
    let xp=50;if(allDone)xp+=50;totalXp+=xp;logged++;
    // Clear savedInputs for this day after logging
    day.exercises.forEach((ex,ei)=>{for(let s=0;s<ex.sets;s++){delete savedInputs[day.id+'_e'+ei+'_s'+s+'_w'];delete savedInputs[day.id+'_e'+ei+'_s'+s+'_r'];delete savedInputs[day.id+'_e'+ei+'_s'+s+'_c']}});
  }
  if(!logged){toast('No filled-in days to log!');return}
  // Save cleared inputs
  await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs});
  // XP + achievements (run once at end)
  const wc=workoutLog.length;const hr=new Date().getHours();
  if(wc>=1)unlockAch('first_workout');if(wc>=10)unlockAch('workouts_10');if(wc>=25)unlockAch('workouts_25');if(wc>=50)unlockAch('workouts_50');if(wc>=100)unlockAch('workouts_100');if(wc>=200)unlockAch('workouts_200');
  if(hr<7)unlockAch('early_bird');if(hr>=21)unlockAch('night_owl');
  const dids=new Set(workoutLog.map(e=>e.dayId));if(dids.size>=4)unlockAch('variety');
  const wkStreak=calcWeeklyStreak();
  if(wkStreak>=2)unlockAch('wk_streak_2');if(wkStreak>=4)unlockAch('wk_streak_4');if(wkStreak>=8)unlockAch('wk_streak_8');
  if(wkStreak>=12)unlockAch('wk_streak_12');if(wkStreak>=26)unlockAch('wk_streak_26');if(wkStreak>=52)unlockAch('wk_streak_52');
  const hr2=new Date().getHours();if(hr2>=0&&hr2<4)unlockAch('midnight');
  const fw=calcFullWeeks();if(fw>=1)unlockAch('full_week');if(fw>=5)unlockAch('full_week_5');if(fw>=10)unlockAch('full_week_10');if(fw>=20)unlockAch('full_week_20');
  const gained=addXP(totalXp);await saveUser({xp:userData.xp});await saveLeaderboard();updateTopBar();checkRankUp();
  // Clear visible inputs and re-render
  renderDay();
  toast(`${logged} day${logged>1?'s':''} logged! +${gained} XP`);
  }finally{logLock=false}
}
function calcDayStreak(){const dates=[...new Set(workoutLog.map(e=>new Date(e.date).toDateString()))].sort((a,b)=>new Date(b)-new Date(a));let s=0;for(let i=0;i<dates.length;i++){const exp=new Date();exp.setDate(exp.getDate()-i);if(dates[i]===exp.toDateString())s++;else break}return s}
function calcWeeklyStreak(){
  // Streak = consecutive weeks with 3+ sessions
  const weeks={};workoutLog.forEach(e=>{const m=getMonday(new Date(e.date)).toISOString().slice(0,10);if(!weeks[m])weeks[m]=0;weeks[m]++});
  const thisMonday=getMonday(new Date()).toISOString().slice(0,10);
  let streak=0;const d=new Date();
  for(let i=0;i<104;i++){
    const wk=new Date(d);wk.setDate(wk.getDate()-(7*i));
    const key=getMonday(wk).toISOString().slice(0,10);
    // Current week: don't break streak if it's still in progress
    if(key===thisMonday){if((weeks[key]||0)>0)streak++;continue}
    if((weeks[key]||0)>=3)streak++;else break;
  }
  return streak;
}
function calcStreak(){return calcWeeklyStreak()}
function calcFullWeeks(){const w={};workoutLog.forEach(e=>{const m=getMonday(new Date(e.date)).toISOString().slice(0,10);if(!w[m])w[m]=new Set();w[m].add(e.dayId)});return Object.values(w).filter(s=>s.size>=4).length}

// ═══════════ ACHIEVEMENTS ═══════════
async function unlockAch(id){if(userData.achievements.includes(id))return;userData.achievements.push(id);const a=ACHIEVEMENTS.find(x=>x.id===id);if(a&&a.xp>0)addXP(a.xp);await saveUser({achievements:userData.achievements,xp:userData.xp});await saveLeaderboard();updateTopBar()}
function renderAchievements(){const ul=userData.achievements||[];$('achSub').textContent=ul.length+' / '+ACHIEVEMENTS.length+' unlocked';$('achGrid').innerHTML=ACHIEVEMENTS.map(a=>{const u=ul.includes(a.id);return`<div class="ach-card${u?' unlocked':''}"><span class="ach-icon">${a.icon}</span><div class="ach-info"><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div>${a.xp?'<div class="ach-xp">+'+a.xp+' XP</div>':''}</div></div>`}).join('')}

// ═══════════ PROFILE ═══════════
function renderProfile(){
  const r=getEffectiveRank(),info=getXpBarInfo();
  const title=(r.title&&r.title[userData.class])||r.name;const st=userData.stats||{};const prs=userData.prs||{};
  let h=`<div class="profile-card"><div class="profile-pic-wrap" onclick="document.getElementById('picInput').click()">${userData.profilePic?'<img src="'+userData.profilePic+'">':'<div class="pp-placeholder">👤</div>'}</div>
    <div class="profile-name">@${userData.username||'???'}</div>
    <div class="profile-realname">${userData.name||''} <span style="font-size:.6rem;color:var(--dim)">(only you see this)</span></div>
    <div class="profile-class">${userData.class}${userData.subclass?' — '+userData.subclass:''}</div>
    <div class="profile-rank-badge" style="color:${r.color};background:${r.color}22;border:1px solid ${r.color}44">${r.name} — ${title}</div>
    ${userData.bio?'<div class="profile-bio">'+esc(userData.bio)+'</div>':''}
    <div class="xp-bar-wrap"><div class="xp-bar-label"><span>${info.label}</span><span>${info.sublabel}</span></div><div class="xp-bar"><div class="xp-bar-fill" style="width:${info.pct}%;background:linear-gradient(90deg,${r.color},${r.color}cc)"></div></div></div></div>`;
  // Stats
  h+=`<div class="stats-grid"><div class="stat-card"><div class="sv">${st.height||'—'}</div><div class="sl">Height</div></div><div class="stat-card"><div class="sv">${st.weight?st.weight+' lbs':'—'}</div><div class="sl">Weight</div></div><div class="stat-card"><div class="sv">${st.age||'—'}</div><div class="sl">Age</div></div></div>`;
  h+=`<div class="stats-grid"><div class="stat-card"><div class="sv">${prs.bench||'—'}</div><div class="sl">Bench PR</div></div><div class="stat-card"><div class="sv">${prs.squat||'—'}</div><div class="sl">Squat PR</div></div><div class="stat-card"><div class="sv">${prs.deadlift||'—'}</div><div class="sl">Deadlift PR</div></div></div>`;
  h+=`<div class="stats-grid"><div class="stat-card"><div class="sv">${workoutLog.length}</div><div class="sl">Workouts</div></div><div class="stat-card"><div class="sv">${calcWeeklyStreak()}w</div><div class="sl">Wk Streak</div></div><div class="stat-card"><div class="sv">${(userData.achievements||[]).length}</div><div class="sl">Achieve.</div></div></div>`;
  // Streak warning
  const wkStreakP=calcWeeklyStreak();const thisWeekCount=workoutLog.filter(e=>{const m=getMonday(new Date(e.date)).toISOString().slice(0,10);return m===getMonday(new Date()).toISOString().slice(0,10)}).length;
  if(wkStreakP>0&&thisWeekCount<3){const need=3-thisWeekCount;h+=`<div class="streak-warning">🔥 <strong>${wkStreakP}-week streak!</strong> Need ${need} more session${need>1?'s':''} this week to keep it.</div>`}
  else if(wkStreakP===0&&workoutLog.length>0){h+=`<div class="streak-warning lost">💀 Streak broken. Get 3 sessions this week to start a new one.</div>`}
  h+=`<button class="edit-stats-btn" onclick="openSettings()">⚙️ Settings</button>`;
  h+=renderDevTools();
  $('profileContent').innerHTML=h;
}

// ═══════════ FRIENDS PAGE ═══════════
function renderFriendsPage(){
  const fc=userData.friendCode||'------';
  const friends=userData.friends||[];
  let h=`<div class="page-title">FRIENDS</div>`;
  h+=`<div class="profile-friend-code" style="text-align:center;margin:.5rem 0">Your Friend Code: <strong style="font-size:1.1rem;letter-spacing:2px;color:var(--gold)">${fc}</strong> <button class="copy-code-btn" onclick="copyFriendCode()">📋 Copy</button></div>`;
  h+=`<div class="friend-add-row" style="margin-bottom:.6rem"><input type="text" id="friendCodeInput" class="auth-input" placeholder="Enter friend code" maxlength="6" style="margin:0;flex:1" autocapitalize="characters"><button class="m-save-btn" style="flex:0 0 auto;padding:10px 14px;border-radius:8px" onclick="sendFriendRequest()">Send Request</button></div>`;
  h+=`<div id="friendRequests"></div>`;
  h+=`<div class="section-title" style="margin:.6rem 0 .3rem">FRIENDS LIST (${friends.length})</div>`;
  h+=`<div id="friendsList"></div>`;
  $('friendsPageContent').innerHTML=h;
  loadFriendsList();
}
function copyFriendCode(){
  const fc=userData.friendCode||'';if(!fc)return;
  if(navigator.clipboard){navigator.clipboard.writeText(fc).then(()=>toast('Code copied: '+fc)).catch(()=>fallbackCopy(fc))}else{fallbackCopy(fc)}
}
function fallbackCopy(text){const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.left='-9999px';document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);toast('Code copied: '+text)}

// ═══════════ SETTINGS ═══════════
function openSettings(){
  const st=userData.stats||{},prs=userData.prs||{},priv=userData.privacy||{};
  $('setUsername').value=userData.username||'';$('setDisplayName').value=userData.name||'';
  $('setHeight').value=st.height||'';$('setWeight').value=st.weight||'';$('setAge').value=st.age||'';$('setBodyFat').value=st.bodyFat||'';
  $('setSex').value=st.sex||'male';
  $('setBio').value=userData.bio||'';
  $('setBench').value=prs.bench||'';$('setSquat').value=prs.squat||'';$('setDeadlift').value=prs.deadlift||'';$('setOhp').value=prs.ohp||'';
  $('setGoal').value=userData.goal||'';$('setExperience').value=userData.experience||'';
  $('setHideName').checked=!!priv.hideName;$('setHideStats').checked=!!priv.hideStats;
  $('settingsModal').classList.add('open');
}
function closeSettings(){$('settingsModal').classList.remove('open')}
async function saveSettings(){
  const newUn=$('setUsername').value.trim().toLowerCase();
  if(newUn!==userData.username){
    if(!newUn||newUn.length<3){toast('Username 3+ chars');return}
    if(/[^a-z0-9_]/.test(newUn)){toast('Letters, numbers, _ only');return}
    const uc=await db.collection('usernames').doc(newUn).get();
    if(uc.exists){toast('Username taken');return}
    if(userData.username)await db.collection('usernames').doc(userData.username).delete();
    await db.collection('usernames').doc(newUn).set({uid:U.uid});
  }
  const stats={height:$('setHeight').value.trim(),weight:$('setWeight').value.trim(),age:$('setAge').value.trim(),bodyFat:$('setBodyFat').value.trim(),sex:$('setSex').value};
  const prs={bench:$('setBench').value.trim(),squat:$('setSquat').value.trim(),deadlift:$('setDeadlift').value.trim(),ohp:$('setOhp').value.trim()};
  if(prs.bench&&prs.squat&&prs.deadlift&&prs.ohp)unlockAch('set_prs');
  const privacy={hideName:$('setHideName').checked,hideStats:$('setHideStats').checked};
  await saveUser({username:newUn,name:$('setDisplayName').value.trim()||userData.name,stats,prs,privacy,goal:$('setGoal').value,experience:$('setExperience').value,bio:$('setBio').value.trim().slice(0,200)});
  await saveLeaderboard();closeSettings();renderProfile();toast('Settings saved!')}
async function changePassword(){const np=$('setNewPass').value;if(!np||np.length<6){toast('6+ chars required');return}try{await U.updatePassword(np);$('setNewPass').value='';toast('Password changed!')}catch(err){toast(friendlyErr(err.code))}}
function changeProgram(){selectedClass=null;selectedSub=null;selectedProg=null;showScreen('classScreen');buildClassSelect()}

document.getElementById('picInput').addEventListener('change',async function(){
  const file=this.files[0];if(!file)return;
  if(file.size>5*1024*1024){toast('Image too large (5MB max)');return}
  const reader=new FileReader();
  reader.onload=async function(e){
    const img=new Image();img.onload=async function(){
      const canvas=document.createElement('canvas');const max=150;
      let w=img.width,h=img.height;
      if(w>h){h=h*(max/w);w=max}else{w=w*(max/h);h=max}
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      const data=canvas.toDataURL('image/jpeg',0.5);
      // Cap at 100KB base64
      if(data.length>100000){toast('Image too complex — try a simpler photo');return}
      await saveUser({profilePic:data});await saveLeaderboard();renderProfile();toast('Photo updated!');
    };img.src=e.target.result;
  };reader.readAsDataURL(file);
});

// ═══════════ FRIENDS — REQUEST SYSTEM ═══════════
async function sendFriendRequest(){
  const code=$('friendCodeInput').value.trim().toUpperCase();
  if(code.length!==6){toast('Enter 6-char code');return}
  if(code===userData.friendCode){toast("That's your own code!");return}
  const cd=await db.collection('friendCodes').doc(code).get();
  if(!cd.exists){toast('Friend code not found');return}
  const toUid=cd.data().uid;
  if((userData.friends||[]).includes(toUid)){toast('Already friends!');return}
  // Check for existing request
  const existing=await db.collection('friendRequests').where('from','==',U.uid).where('to','==',toUid).where('status','==','pending').get();
  if(!existing.empty){toast('Request already sent!');return}
  // Check reverse (they already sent us one)
  const reverse=await db.collection('friendRequests').where('from','==',toUid).where('to','==',U.uid).where('status','==','pending').get();
  if(!reverse.empty){
    // Auto-accept — they already want to be friends
    const reqDoc=reverse.docs[0];
    await acceptFriendRequest(reqDoc.id,toUid);
    $('friendCodeInput').value='';return;
  }
  // Create request
  await db.collection('friendRequests').add({
    from:U.uid,to:toUid,
    fromUsername:userData.username||'hunter',
    fromPic:userData.profilePic||'',
    status:'pending',
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
  $('friendCodeInput').value='';toast('Friend request sent!');
}

async function loadFriendRequests(){
  const el=$('friendRequests');if(!el)return;
  try{
    const snap=await db.collection('friendRequests').where('to','==',U.uid).where('status','==','pending').get();
    if(snap.empty){el.innerHTML='';return}
    let h='<div style="font-size:.72rem;color:var(--gold);margin-bottom:.3rem;font-family:var(--font-mono)">PENDING REQUESTS</div>';
    for(const doc of snap.docs){
      const req=doc.data();
      h+=`<div class="friend-request">
        <div class="lb-pic">${req.fromPic?'<img src="'+req.fromPic+'">':'👤'}</div>
        <div class="lb-info"><div class="lb-name">@${esc(req.fromUsername)}</div><div class="lb-class">wants to be friends</div></div>
        <button class="fr-accept" onclick="acceptFriendRequest('${doc.id}','${req.from}')">✓</button>
        <button class="fr-decline" onclick="declineFriendRequest('${doc.id}')">✕</button>
      </div>`;
    }
    el.innerHTML=h;
  }catch(e){
    el.innerHTML=`<p style="color:var(--red);font-size:.7rem">Request load error: ${e.message}</p>`;
  }
}

async function acceptFriendRequest(reqId,fromUid){
  await db.collection('friendRequests').doc(reqId).update({status:'accepted'});
  // Add to MY friends list (I'm the receiver)
  const friends=userData.friends||[];
  if(!friends.includes(fromUid)){
    friends.push(fromUid);
    await saveUser({friends});
  }
  // Note: the sender syncs their own list via syncAcceptedRequests() on their next login
  unlockAch('add_friend');
  if(friends.length>=5)unlockAch('friends_5');
  if(friends.length>=10)unlockAch('friends_10');
  toast('Friend added!');loadFriendRequests();loadFriendsList();
}

// Called on login — checks for accepted requests where I'm the sender and adds those friends
async function syncAcceptedRequests(){
  try{
    const snap=await db.collection('friendRequests').where('from','==',U.uid).where('status','==','accepted').get();
    if(snap.empty)return;
    const friends=userData.friends||[];
    let updated=false;
    for(const doc of snap.docs){
      const req=doc.data();
      if(!friends.includes(req.to)){
        friends.push(req.to);
        updated=true;
      }
      // Clean up — delete the processed request
      await doc.ref.delete();
    }
    if(updated){
      await saveUser({friends});
      unlockAch('add_friend');
      if(friends.length>=5)unlockAch('friends_5');
    }
  }catch(e){}
}

async function declineFriendRequest(reqId){
  await db.collection('friendRequests').doc(reqId).update({status:'declined'});
  toast('Request declined.');loadFriendRequests();
}

async function loadFriendsList(){
  const list=$('friendsList');if(!list)return;
  await loadFriendRequests();
  const friends=userData.friends||[];
  if(!friends.length){list.innerHTML='<p style="color:var(--muted);font-size:.76rem">No friends yet — share your code!</p>';return}
  let h='';let loaded=0;
  for(const fid of friends.slice(0,20)){
    try{
      const d=await db.collection('users').doc(fid).get();
      if(!d.exists){h+=`<div class="friend-row" style="opacity:.4"><div class="lb-pic">👤</div><div class="lb-info"><div class="lb-name">Deleted user</div></div></div>`;continue}
      const f=d.data();const r=getRank(f.xp||0);
      h+=`<div class="friend-row"><div class="lb-pic">${f.profilePic?'<img src="'+f.profilePic+'">':'👤'}</div><div class="lb-info"><div class="lb-name">@${esc(f.username||'hunter')}</div><div class="lb-class">${f.class||''}</div></div><div class="lb-xp">${f.xp||0}</div><div class="lb-rank" style="color:${r.color}">${r.name}</div></div>`;
      loaded++;
    }catch(e){
      h+=`<div class="friend-row" style="opacity:.5"><div class="lb-pic">⚠️</div><div class="lb-info"><div class="lb-name" style="color:var(--red)">Load failed</div><div class="lb-class">${e.message}</div></div></div>`;
    }
  }
  if(!loaded&&friends.length)h+=`<p style="color:var(--gold);font-size:.72rem">Friends in your list but can't read their profiles. Update Firestore rules.</p>`;
  list.innerHTML=h;
}

// ═══════════ LEADERBOARD (username only) ═══════════
let lbData=[];
async function renderLeaderboard(){let list=[];if(lbMode==='friends'){const fids=[U.uid,...(userData.friends||[])];for(const fid of fids.slice(0,30)){try{const d=await db.collection('leaderboard').doc(fid).get();if(d.exists)list.push({uid:d.id,...d.data()})}catch(e){}}list.sort((a,b)=>b.xp-a.xp)}else{const snap=await db.collection('leaderboard').orderBy('xp','desc').limit(50).get();snap.forEach(d=>list.push({uid:d.id,...d.data()}))}
  lbData=list;
  let h=`<div class="log-filters" style="margin-bottom:.7rem"><div class="log-filter ${lbMode==='all'?'active':''}" onclick="lbMode='all';renderLeaderboard()">All Hunters</div><div class="log-filter ${lbMode==='friends'?'active':''}" onclick="lbMode='friends';renderLeaderboard()">Friends</div></div>`;
  h+=list.length?list.map((u,i)=>{const me=U&&u.uid===U.uid;const r=getRank(u.xp);const pc=i===0?'gold':i===1?'silver':i===2?'bronze':'';
    return`<div class="lb-row${me?' me':''}" onclick="openProfileCard('${u.uid}')"><span class="lb-pos ${pc}">${i+1}</span><div class="lb-pic">${u.profilePic?'<img src="'+u.profilePic+'">':'👤'}</div><div class="lb-info"><div class="lb-name">@${u.username||'hunter'}</div><div class="lb-class">${u.class||''}${u.subclass?' • '+u.subclass:''}</div></div><div class="lb-xp">${u.xp}</div><div class="lb-rank" style="color:${r.color}">${r.name}</div></div>`}).join(''):'<p style="color:var(--muted);font-size:.82rem">No hunters yet.</p>';
  $('lbList').innerHTML=h}

// ═══════════ PROFILE CARD (tap user) ═══════════
async function openProfileCard(uid){
  if(uid===U.uid){switchPage('profile');return}
  const modal=$('profileCardModal');if(!modal)return;
  modal.querySelector('.modal').innerHTML='<p style="color:var(--muted);text-align:center;padding:2rem">Loading...</p>';
  modal.classList.add('open');
  try{
    // Try leaderboard cache first, then fetch full user doc
    let u=lbData.find(x=>x.uid===uid);
    const userDoc=await db.collection('users').doc(uid).get();
    if(userDoc.exists){const ud=userDoc.data();u={...u,...ud,uid}}
    if(!u){modal.classList.remove('open');toast('User not found');return}
    const r=getRank(u.xp||0);
    const title=(r.title&&r.title[u.class])||r.name;
    const isFriend=(userData.friends||[]).includes(uid);
    let h=`<div class="pc-header">
      <div class="pc-pic">${u.profilePic?'<img src="'+u.profilePic+'">':'<div class="pp-placeholder" style="width:60px;height:60px;font-size:1.6rem">👤</div>'}</div>
      <div class="pc-info">
        <div class="pc-username">@${esc(u.username||'hunter')}</div>
        <div class="pc-class">${u.class||''}${u.subclass?' — '+u.subclass:''}</div>
        <div class="pc-rank" style="color:${r.color}">${r.name} — ${title}</div>
      </div>
    </div>`;
    if(u.bio)h+=`<div class="pc-bio">${esc(u.bio)}</div>`;
    h+=`<div class="pc-stats">
      <div class="pc-stat"><div class="pc-stat-val">${u.xp||0}</div><div class="pc-stat-label">XP</div></div>
      <div class="pc-stat"><div class="pc-stat-val">${u.workouts||'?'}</div><div class="pc-stat-label">Workouts</div></div>
      <div class="pc-stat"><div class="pc-stat-val">${(u.achievements||[]).length}</div><div class="pc-stat-label">Achieve.</div></div>
    </div>`;
    if(isFriend){
      h+=`<div class="pc-friend-status">✅ Friends</div>`;
    }else{
      h+=`<button class="pc-add-btn" onclick="addFriendFromCard('${uid}')">🤝 Add Friend</button>`;
    }
    h+=`<div class="m-actions" style="margin-top:.6rem"><button class="m-cancel" onclick="closeProfileCard()">Close</button></div>`;
    modal.querySelector('.modal').innerHTML=h;
  }catch(e){
    modal.querySelector('.modal').innerHTML=`<p style="color:var(--red);text-align:center;padding:1rem">Error: ${e.message}</p><div class="m-actions"><button class="m-cancel" onclick="closeProfileCard()">Close</button></div>`;
  }
}
function closeProfileCard(){$('profileCardModal').classList.remove('open')}
async function addFriendFromCard(uid){
  // Check if already friends
  if((userData.friends||[]).includes(uid)){toast('Already friends!');closeProfileCard();return}
  // Check for existing request
  const existing=await db.collection('friendRequests').where('from','==',U.uid).where('to','==',uid).where('status','==','pending').get();
  if(!existing.empty){toast('Request already sent!');closeProfileCard();return}
  // Check reverse
  const reverse=await db.collection('friendRequests').where('from','==',uid).where('to','==',U.uid).where('status','==','pending').get();
  if(!reverse.empty){await acceptFriendRequest(reverse.docs[0].id,uid);closeProfileCard();return}
  // Send request
  await db.collection('friendRequests').add({from:U.uid,to:uid,fromUsername:userData.username||'hunter',fromPic:userData.profilePic||'',status:'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  toast('Friend request sent!');closeProfileCard();
}

// ═══════════ LOG ═══════════
function renderLog(){const c=$('logContent');if(!workoutLog.length){c.innerHTML='<p style="color:var(--muted);font-size:.82rem">No workouts logged yet.</p>';return}
  const prog=userData.program||[];const filtered=logFilter==='all'?workoutLog:workoutLog.filter(e=>e.dayId===logFilter);
  const weeks={};filtered.forEach(e=>{const d=new Date(e.date),m=getMonday(d),k=m.toISOString().slice(0,10);if(!weeks[k])weeks[k]={monday:m,entries:[]};weeks[k].entries.push(e)});
  const sorted=Object.values(weeks).sort((a,b)=>b.monday-a.monday);
  let h='<div class="log-filters"><div class="log-filter'+(logFilter==='all'?' active':'')+'" onclick="setFilter(\'all\')">All</div>';
  prog.forEach(d=>h+='<div class="log-filter'+(logFilter===d.id?' active':'')+'" onclick="setFilter(\''+d.id+'\')">'+d.title+'</div>');h+='</div>';
  sorted.forEach(week=>{const sun=new Date(week.monday);sun.setDate(sun.getDate()+6);const fmt=d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});const wn=getWeekNum(week.monday);
    h+='<div class="week-group"><div class="week-header" onclick="toggleWk(this)"><span>WEEK '+wn+' <span class="wk-dates">'+fmt(week.monday)+' – '+fmt(sun)+'</span></span><span style="color:var(--muted);font-size:.72rem">▼</span></div><div class="week-body">';
    week.entries.sort((a,b)=>new Date(a.date)-new Date(b.date));
    week.entries.forEach(entry=>{const d=new Date(entry.date),ds=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});const maxS=Math.max(...entry.exercises.map(x=>x.sets.length));
      h+='<div class="day-log"><div class="day-log-head"><span class="day-log-title">'+entry.dayTitle+'</span><span><span class="day-log-date">'+ds+'</span> <button class="btn-del" onclick="delLog(\''+entry._id+'\')">✕</button></span></div><div class="log-table-wrap"><table class="log-table"><thead><tr><th>Exercise</th>';
      for(let i=0;i<maxS;i++)h+='<th>S'+(i+1)+'</th>';h+='</tr></thead><tbody>';
      entry.exercises.forEach(ex=>{if(!ex.sets.some(s=>s.reps||s.weight))return;h+='<tr><td style="font-weight:600;font-size:.74rem;max-width:120px;overflow:hidden;text-overflow:ellipsis">'+ex.name+'</td>';
        for(let i=0;i<maxS;i++){const s=ex.sets[i];if(!s||(!s.reps&&!s.weight)){h+='<td class="c-empty">—</td>';continue}const cls=s.done?'c-done':'c-miss';h+=s.isTime?'<td class="'+cls+'">'+(s.reps||0)+'s'+(s.done?' ✓':'')+'</td>':'<td class="'+cls+'">'+(s.weight||0)+'×'+(s.reps||0)+(s.done?' ✓':'')+'</td>'}h+='</tr>'});
      h+='</tbody></table></div></div>'});h+='</div></div>'});c.innerHTML=h}
function setFilter(f){logFilter=f;renderLog()}
function toggleWk(el){const b=el.nextElementSibling;if(b.style.maxHeight&&b.style.maxHeight!=='0px'){b.style.maxHeight='0px';b.style.overflow='hidden'}else{b.style.maxHeight=b.scrollHeight+'px';b.style.overflow='visible'}}
async function delLog(id){if(!confirm('Delete?'))return;await db.collection('users').doc(U.uid).collection('log').doc(id).delete();workoutLog=workoutLog.filter(e=>e._id!==id);renderLog();toast('Deleted.')}
function getMonday(d){const dt=new Date(d);const day=dt.getDay();dt.setDate(dt.getDate()-day+(day===0?-6:1));dt.setHours(0,0,0,0);return dt}
function getWeekNum(mon){if(!workoutLog.length)return 1;const dates=workoutLog.map(e=>getMonday(new Date(e.date)).getTime());return Math.round((mon-new Date(Math.min(...dates)))/(7*864e5))+1}
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}

// ═══════════ WHAT'S NEW ═══════════
function checkWhatsNew(){
  const seen=userData.lastSeenVersion||'0.0.0';
  if(seen===APP_VERSION){checkTour();return}
  // Show entries newer than last seen
  const newEntries=seen==='0.0.0'?[CHANGELOG[0]]:CHANGELOG.filter(e=>compareVer(e.version,seen)>0);
  if(!newEntries.length){saveUser({lastSeenVersion:APP_VERSION});checkTour();return}
  showWhatsNew(newEntries);
}
function compareVer(a,b){
  const pa=a.split('.').map(Number),pb=b.split('.').map(Number);
  for(let i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return 1;if((pa[i]||0)<(pb[i]||0))return-1}return 0;
}
function showWhatsNew(entries){
  let old=$('whatsNewOverlay');if(old)old.remove();
  const overlay=document.createElement('div');overlay.id='whatsNewOverlay';overlay.className='wn-overlay';
  let h=`<div class="wn-modal">`;
  h+=`<div class="wn-header"><div class="wn-badge">NEW</div><div class="wn-title">What's New</div><div class="wn-ver">v${APP_VERSION}</div></div>`;
  entries.forEach(e=>{
    h+=`<div class="wn-section"><div class="wn-section-title">${e.title} <span class="wn-date">${e.date}</span></div>`;
    h+=`<ul class="wn-list">${e.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;
  });
  h+=`<button class="wn-btn" id="wnDismiss">Got it</button></div>`;
  overlay.innerHTML=h;
  document.body.appendChild(overlay);
  document.getElementById('wnDismiss').addEventListener('click',async()=>{
    overlay.classList.add('closing');
    setTimeout(()=>{overlay.remove()},250);
    await saveUser({lastSeenVersion:APP_VERSION});
    checkTour();
  });
}

// ═══════════ ONBOARDING TOUR ═══════════
const TOUR_STEPS=[
  {target:'.top-bar',title:'XP & RANK',desc:'Your rank and XP bar are always visible. Every workout, mission, and achievement earns XP. Hit rank gates to unlock trials.',pos:'bottom'},
  {target:'[data-page="train"]',title:'TRAIN',desc:'Your workout program. Fill in weights & reps, then Log the day. Use "Log All Days" if you trained multiple.',pos:'top'},
  {target:'[data-page="missions"]',title:'MISSIONS',desc:'5 daily missions — 3 universal + 2 tailored to your class. Complete all 5 for bonus XP. Build streaks!',pos:'top'},
  {target:'[data-page="nutrition"]',title:'NUTRITION',desc:'TDEE calculator, macro tracking, and meal-based food logging. Search foods, scan barcodes, or add manually.',pos:'top'},
  {target:'[data-page="chat"]',title:'CHAT',desc:'Message friends, get AI Coach advice, and check patch notes in the Updates tab.',pos:'top'},
  {target:'[data-page="ranks"]',title:'RANKS',desc:'Leaderboard and rank info. Tap any hunter to view their profile and add them as a friend.',pos:'top'},
  {target:'[data-page="profile"]',title:'PROFILE',desc:'Your stats, PRs, bio, friends list, and settings. Set your bio so other hunters know who you are.',pos:'top'}
];
let tourStep=0;
function checkTour(){
  if(userData.hasCompletedTour)return;
  setTimeout(()=>startTour(),800);
}
function startTour(){
  tourStep=0;showTourStep();
}
function showTourStep(){
  let old=$('tourOverlay');if(old)old.remove();
  if(tourStep>=TOUR_STEPS.length){finishTour();return}
  const step=TOUR_STEPS[tourStep];
  const el=document.querySelector(step.target);
  const overlay=document.createElement('div');overlay.id='tourOverlay';overlay.className='tour-overlay';
  // Highlight ring
  if(el){
    const r=el.getBoundingClientRect();
    const ring=document.createElement('div');ring.className='tour-ring';
    ring.style.cssText=`top:${r.top-4}px;left:${r.left-4}px;width:${r.width+8}px;height:${r.height+8}px`;
    overlay.appendChild(ring);
  }
  // Tooltip
  const tip=document.createElement('div');tip.className='tour-tip';
  tip.innerHTML=`<div class="tour-step-count">${tourStep+1} / ${TOUR_STEPS.length}</div><div class="tour-title">${step.title}</div><div class="tour-desc">${step.desc}</div><div class="tour-actions"><button class="tour-btn" onclick="nextTourStep()">${tourStep<TOUR_STEPS.length-1?'Next →':'Finish ✓'}</button></div>`;
  if(el){
    const r=el.getBoundingClientRect();
    if(step.pos==='bottom')tip.style.cssText=`top:${r.bottom+12}px;left:50%;transform:translateX(-50%)`;
    else tip.style.cssText=`bottom:${window.innerHeight-r.top+12}px;left:50%;transform:translateX(-50%)`;
  }else{tip.style.cssText='top:50%;left:50%;transform:translate(-50%,-50%)'}
  overlay.appendChild(tip);document.body.appendChild(overlay);
}
function nextTourStep(){tourStep++;showTourStep()}
async function finishTour(){
  let old=$('tourOverlay');if(old)old.remove();
  await saveUser({hasCompletedTour:true});
  unlockAch('tour_done');
  toast('🗺️ Tour complete! +25 XP');
}

// ═══════════ UNREAD CHAT BADGE ═══════════
let unreadChatCount=0;
async function checkUnreadChats(){
  if(!U)return;
  const friends=userData.friends||[];if(!friends.length){updateChatBadge(0);return}
  const lastRead=userData.lastReadTimestamps||{};
  let unread=0;
  for(const fid of friends.slice(0,20)){
    try{
      const chatId=getChatId(U.uid,fid);
      const lastMsg=await db.collection('chats').doc(chatId).collection('messages').orderBy('ts','desc').limit(1).get();
      if(!lastMsg.empty){
        const m=lastMsg.docs[0].data();
        if(m.from!==U.uid&&m.ts){
          const msgTime=m.ts.toDate().getTime();
          const readTime=lastRead[fid]||0;
          if(msgTime>readTime)unread++;
        }
      }
    }catch(e){}
  }
  updateChatBadge(unread);
}
function updateChatBadge(count){
  unreadChatCount=count;
  const nav=document.querySelector('[data-page="chat"] .nav-icon');if(!nav)return;
  let badge=nav.querySelector('.chat-badge');
  if(count>0){
    if(!badge){badge=document.createElement('span');badge.className='chat-badge';nav.appendChild(badge)}
    badge.textContent=count>9?'9+':count;badge.style.display='';
  }else{if(badge)badge.style.display='none'}
}
async function markChatRead(friendUid){
  const lastRead=userData.lastReadTimestamps||{};
  lastRead[friendUid]=Date.now();
  await saveUser({lastReadTimestamps:lastRead});
  checkUnreadChats();
}

// ═══════════ EVENT MISSION ═══════════
async function completeEvent(){
  const today=getTodayStr();const evt=getEventMission(today);if(!evt)return;
  if((userData.eventsCompleted||{})[today])return;
  if(!confirm(`⚡ Complete "${evt.name}"?\n\n${evt.desc}`))return;
  const ec=userData.eventsCompleted||{};ec[today]=true;
  const evtCount=Object.keys(ec).length;
  const gained=addXP(evt.xp);
  unlockAch('event_first');if(evtCount>=5)unlockAch('event_5');
  await saveUser({eventsCompleted:ec,xp:userData.xp});await saveLeaderboard();
  updateTopBar();checkRankUp();renderMissions();
  toast(`⚡ ${evt.name} +${gained} XP`);
}

// ═══════════ PROGRESSION TRACKS ═══════════
function getTrackProgress(task){
  switch(task.check){
    case 'workouts':return workoutLog.length;
    case 'maxlift':return Math.max(0,...workoutLog.flatMap(e=>e.exercises.flatMap(ex=>ex.sets.map(s=>parseInt(s.weight)||0))));
    case 'full_weeks':return calcFullWeeks();
    case 'wk_streak':return calcWeeklyStreak();
    case 'class_missions':{
      // Count completed class-specific missions across all days
      let count=0;const cm=CLASS_MISSIONS[userData.class]||[];const cmIds=cm.map(m=>m.id);
      Object.values(userData.missionsCompleted||{}).forEach(arr=>{(arr||[]).forEach(id=>{if(cmIds.includes(id))count++})});
      return count;
    }
    default:return 0;
  }
}
function renderProgressionTrack(){
  const cls=userData.class;if(!cls||!PROGRESSION_TRACKS[cls])return'';
  const tracks=PROGRESSION_TRACKS[cls];
  const completed=userData.tracksCompleted||[];
  let h=`<div class="section-title" style="margin:1rem 0 .3rem">CLASS TRACK — ${cls.toUpperCase()}</div>`;
  for(const track of tracks){
    // Check if requires previous track
    if(track.requires&&!completed.includes(track.requires)){
      h+=`<div class="track-card locked"><div class="track-header"><span class="track-icon">🔒</span><div><div class="track-name">${track.name}</div><div class="track-desc">Complete previous tier to unlock</div></div></div></div>`;
      continue;
    }
    if(completed.includes(track.id)){
      h+=`<div class="track-card completed"><div class="track-header"><span class="track-icon">✅</span><div><div class="track-name">${track.name}</div><div class="track-desc">COMPLETED</div></div></div></div>`;
      continue;
    }
    const allDone=track.tasks.every(t=>getTrackProgress(t)>=t.target);
    h+=`<div class="track-card${allDone?' ready':''}"><div class="track-header"><span class="track-icon">${track.icon}</span><div><div class="track-name">${track.name}</div><div class="track-desc">${track.desc}</div></div></div>`;
    track.tasks.forEach(t=>{
      const p=Math.min(getTrackProgress(t),t.target);const pct=Math.min(100,(p/t.target)*100);
      h+=`<div class="track-task"><div class="track-task-desc">${t.desc}</div><div class="trial-bar"><div class="trial-bar-fill" style="width:${pct}%"></div></div><div class="trial-task-num">${p}/${t.target} · +${t.xp} XP</div></div>`;
    });
    if(allDone)h+=`<button class="trial-claim" onclick="claimTrack('${track.id}')">🏆 CLAIM ${track.name.toUpperCase()}</button>`;
    h+=`</div>`;
  }
  return h;
}
async function claimTrack(trackId){
  const cls=userData.class;if(!cls)return;
  const tracks=PROGRESSION_TRACKS[cls]||[];
  const track=tracks.find(t=>t.id===trackId);if(!track)return;
  const completed=userData.tracksCompleted||[];
  if(completed.includes(trackId))return;
  completed.push(trackId);
  let totalXp=0;track.tasks.forEach(t=>totalXp+=t.xp);
  addXP(totalXp);
  await saveUser({tracksCompleted:completed,xp:userData.xp});await saveLeaderboard();
  updateTopBar();checkRankUp();renderMissions();
  toast(`🏆 ${track.name} complete! +${totalXp} XP`);
}

// ═══════════ PASSIVE ACHIEVEMENT CHECKER ═══════════
async function checkPassiveAchievements(){
  let dirty=false;
  // Bio & pic
  if(userData.bio&&userData.bio.trim())unlockAch('set_bio');
  if(userData.profilePic)unlockAch('set_pic');
  // XP milestones
  if(userData.xp>=1000)unlockAch('xp_1k');
  if(userData.xp>=5000)unlockAch('xp_5k');
  if(userData.xp>=10000)unlockAch('xp_10k');
  // Workout milestones
  const wc=workoutLog.length;
  if(wc>=1)unlockAch('first_workout');if(wc>=10)unlockAch('workouts_10');if(wc>=25)unlockAch('workouts_25');
  if(wc>=50)unlockAch('workouts_50');if(wc>=100)unlockAch('workouts_100');if(wc>=200)unlockAch('workouts_200');
  if(wc>=300)unlockAch('workouts_300');if(wc>=500)unlockAch('workouts_500');
  // Weekly streak
  const ws=calcWeeklyStreak();
  if(ws>=2)unlockAch('wk_streak_2');if(ws>=4)unlockAch('wk_streak_4');if(ws>=8)unlockAch('wk_streak_8');
  if(ws>=12)unlockAch('wk_streak_12');if(ws>=26)unlockAch('wk_streak_26');if(ws>=52)unlockAch('wk_streak_52');
  // Full weeks
  const fw=calcFullWeeks();
  if(fw>=1)unlockAch('full_week');if(fw>=5)unlockAch('full_week_5');if(fw>=10)unlockAch('full_week_10');if(fw>=20)unlockAch('full_week_20');
  // Total missions
  let totalMissions=0;Object.values(userData.missionsCompleted||{}).forEach(arr=>totalMissions+=(arr||[]).length);
  if(totalMissions>=25)unlockAch('missions_total_25');if(totalMissions>=100)unlockAch('missions_total_100');
  // Event count
  const evtCount=Object.keys(userData.eventsCompleted||{}).length;
  if(evtCount>=1)unlockAch('event_first');if(evtCount>=5)unlockAch('event_5');
  // Food days
  const foodDays=Object.keys(userData.foodLog||{}).filter(k=>{const d=userData.foodLog[k];if(Array.isArray(d))return d.length>0;if(d&&d.meals)return Object.values(d.meals).some(m=>m&&m.length>0);return false}).length;
  if(foodDays>=1)unlockAch('food_log_1');if(foodDays>=7)unlockAch('food_log_7');if(foodDays>=14)unlockAch('food_log_14');
  if(foodDays>=30)unlockAch('food_log_30');if(foodDays>=60)unlockAch('food_log_60');
  // Friends
  const fc=(userData.friends||[]).length;
  if(fc>=1)unlockAch('add_friend');if(fc>=5)unlockAch('friends_5');if(fc>=10)unlockAch('friends_10');
  // Scan count
  const scanCount=parseInt(userData.scanCount)||0;
  if(scanCount>=1)unlockAch('scan_1');if(scanCount>=5)unlockAch('scan_5');
  // Message count
  const msgCount=parseInt(userData.messageCount)||0;
  if(msgCount>=1)unlockAch('chat_first');if(msgCount>=10)unlockAch('chat_10');
}

// ═══════════ NOTIFICATIONS ═══════════
let notifPermission='default';
function initNotifications(){
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
  if(!isStandalone)return; // Only push for installed app
  if(!('Notification' in window))return;
  notifPermission=Notification.permission;
  if(notifPermission==='default'){
    // Ask after a delay so it doesn't block first experience
    setTimeout(()=>{
      Notification.requestPermission().then(p=>{notifPermission=p});
    },10000);
  }
  // Schedule check — remind to train if no workout today
  scheduleTrainReminder();
}
function scheduleTrainReminder(){
  // Check every hour if app is open
  setInterval(()=>{
    if(notifPermission!=='granted')return;
    const hr=new Date().getHours();
    if(hr<16||hr>21)return; // Only remind 4-9 PM
    const todayLogs=workoutLog.filter(e=>{const d=new Date(e.date);return d.toDateString()===new Date().toDateString()});
    if(todayLogs.length>0)return; // Already trained
    const lastNotif=localStorage.getItem('lastTrainNotif');
    const today=getTodayStr();
    if(lastNotif===today)return; // Already notified today
    localStorage.setItem('lastTrainNotif',today);
    const ws=calcWeeklyStreak();
    const {label}=getXpMultiplier();
    let body='The System is watching. Don\'t let your streak die.';
    if(ws>0)body=`${ws}-week streak on the line. Get in there.`;
    if(label)body+=` ${label}`;
    new Notification('LexenFitness',{body,icon:'icons/icon-192x192.png',badge:'icons/icon-96x96.png'});
  },3600000); // Every hour
}
function sendNotif(title,body){
  if(notifPermission!=='granted')return;
  try{new Notification(title,{body,icon:'icons/icon-192x192.png'})}catch(e){}
}
