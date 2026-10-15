// ═══════════════════════════════════════════
//  LEXENFITNESS — APP LOGIC v3
// ═══════════════════════════════════════════
firebase.initializeApp({apiKey:"AIzaSyCbH-A7pp1xrtwHSaVUKlPA0hR2skHu9iY",authDomain:"lexenfitness.firebaseapp.com",projectId:"lexenfitness",storageBucket:"lexenfitness.firebasestorage.app",messagingSenderId:"570672585202",appId:"1:570672585202:web:ce329745b0282ee86c736b"});
const auth=firebase.auth(),db=firebase.firestore();
// Offline cache: the app opens from what it saved last time, even on a weak signal.
try{db.enablePersistence({synchronizeTabs:true}).catch(e=>console.warn('[firestore] offline cache off:',e.code||e))}catch(e){}
const SHARD_SVG='<svg class="shard-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l6 6.5-6 12.5L6 9z"/><path d="M6 9h12"/></svg>';
const DEV_EMAIL='gabinglee11@gmail.com';
let U=null,userData={},workoutLog=[],savedInputs={},isDev=false;
let currentDay='day1',currentPage='profile',logFilter='all',lbMode='all';
let editTarget=null,addDayIdx=null,selectedClass=null,selectedSub=null,selectedProg=null;
let prevRankName=null;
let authLock=false;
// Session Mode state
let sessionActive=false,sessionStartMs=null,sessionPausedMs=0,sessionPauseStartMs=null;
let sessionTimerHandle=null,restTimerHandle=null,restEndMs=null,restDefaultSec=90;
let sessionDayId=null;
// Backdate state for the next log action (null = today)
let pendingBackdateISO=null;
// Workout view state: 'menu' (program picker) or 'day' (logging a specific day)
let workoutView='day';
const $=id=>document.getElementById(id);

// XSS protection: escape HTML in user/API-sourced strings
function esc(s){if(!s)return'';const d=document.createElement('div');d.textContent=String(s);return d.innerHTML.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// Image sources come from other users' docs. Only accept what this app produces:
// canvas data URLs (profile uploads) or plain https URLs (Google photos). Anything
// else — quotes, javascript:, attribute break-outs — renders as the fallback.
function safeImgSrc(u){u=String(u||'');return /^(data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+|https:\/\/[^\s"'<>]+)$/.test(u)?u:''}
function avatarHtml(u,fallback){const s=safeImgSrc(u);return s?'<img src="'+esc(s)+'" alt="">':(fallback==null?'<svg class="av-fallback" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5c.9-3.4 3.5-5.2 6.5-5.2s5.6 1.8 6.5 5.2"/></svg>':fallback)}
// Numbers from other users' docs could be strings carrying HTML — coerce before rendering
function num(n){n=Number(n);return isFinite(n)?n:0}
// Inside onclick="fn('…')" the browser decodes &#39; back to a quote BEFORE running JS,
// so esc() is not enough there. Strip values down to their legal character set instead.
function safeId(x){x=String(x||'');return /^[A-Za-z0-9_-]{1,128}$/.test(x)?x:''}
function safeName(x){return String(x||'').replace(/[^a-z0-9_]/gi,'').slice(0,20)}

// Cleanup: cap unbounded data to prevent Firestore bloat
async function cleanupOldData(){
  let dirty=false;
  if(userData.missionsCompleted){
    const cut=new Date();cut.setDate(cut.getDate()-90);const cs=cut.toISOString().slice(0,10);
    const archive=new Set(userData.allMissionDays||[]);const before=archive.size;
    Object.keys(userData.missionsCompleted).forEach(k=>{if(dayAllMissionsDone(k))archive.add(k)});
    Object.keys(userData.missionsCompleted).forEach(k=>{if(k<cs){delete userData.missionsCompleted[k];dirty=true}});
    if(archive.size!==before){userData.allMissionDays=[...archive].sort();dirty=true}
  }
  if(userData.foodLog){
    const cut=new Date();cut.setDate(cut.getDate()-30);const cs=cut.toISOString().slice(0,10);
    Object.keys(userData.foodLog).forEach(k=>{if(k<cs){delete userData.foodLog[k];dirty=true}});
  }
  if(dirty)await saveUser({missionsCompleted:userData.missionsCompleted,foodLog:userData.foodLog||{},allMissionDays:userData.allMissionDays||[]});
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
  const invite=normalizeInvite($('signupInvite').value);
  if(invite.length!==6){$('signupError').textContent='Invite code required — ask a friend for theirs';return}
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
    // 2b. Validate the invite code before writing anything
    const inviterUid=await lookupInvite(invite);
    if(!inviterUid){
      await cred.user.delete();authLock=false;
      $('signupError').textContent='That invite code isn\'t valid — double-check it with your friend';
      return;
    }
    // 3. All good — write everything
    const dn=f+(l?' '+l:'');
    await cred.user.updateProfile({displayName:dn});
    // Send welcome/verification email
    try{await cred.user.sendEmailVerification()}catch(e){}
    const fc=genFriendCode();
    // One atomic batch: the rules check the profile, username and code together
    const batch=db.batch();
    batch.set(db.collection('users').doc(cred.user.uid),newUserDoc({name:dn,username:uname,email:e,friendCode:fc,invitedBy:invite,invitedByUid:inviterUid}));
    batch.set(db.collection('usernames').doc(uname),{uid:cred.user.uid});
    batch.set(db.collection('friendCodes').doc(fc),{uid:cred.user.uid});
    try{await batch.commit()}catch(bErr){
      await cred.user.delete().catch(()=>{});authLock=false;
      $('signupError').textContent=bErr.code==='permission-denied'?'Signup rejected — check your invite code and username':'Signup failed: '+bErr.message;
      return;
    }
    authLock=false;
    U=cred.user;isDev=(U.email===DEV_EMAIL);
    await loadUserData();
    prevRankName=getEffectiveRank().name;
    sendInviterFriendRequest();
    $('loadingScreen').style.display='none';
    showScreen('classScreen');buildClassSelect();
  }catch(err){
    authLock=false;
    $('signupError').textContent=friendlyErr(err.code);
  }
}
async function resetPassword(){
  const e=$('loginEmail').value.trim();
  if(!e){$('loginError').style.color='';$('loginError').textContent='Enter your email above first, then tap Forgot password';return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){$('loginError').style.color='';$('loginError').textContent='That email looks invalid';return}
  try{
    await auth.sendPasswordResetEmail(e);
    $('loginError').style.color='var(--green)';
    $('loginError').innerHTML=`Reset link sent to <strong>${esc(e)}</strong><br><span style="color:var(--muted);font-size:.65rem;line-height:1.5;display:block;margin-top:4px">• Check <strong>spam folder</strong> if not in inbox in 2 min<br>• Link expires in <strong>1 hour</strong><br>• Click it <strong>only once</strong> — it's single-use<br>• Open it on the <strong>same device</strong> if possible</span>`;
    setTimeout(()=>{$('loginError').style.color='';$('loginError').textContent=''},20000);
  }catch(err){
    $('loginError').style.color='';
    console.error('Password reset error:',err);
    $('loginError').textContent=friendlyErr(err.code)||err.message||'Reset failed';
  }
}
async function doGoogleLogin(){
  const provider=new firebase.auth.GoogleAuthProvider();
  try{
    await auth.signInWithPopup(provider);
  }catch(err){
    console.error('[google login]',err.code,err.message);
    // Popups fail in installed PWAs and some mobile browsers — fall back to full redirect
    if(err.code==='auth/popup-blocked'||err.code==='auth/operation-not-supported-in-this-environment'||err.code==='auth/cancelled-popup-request'){
      try{await auth.signInWithRedirect(provider);return}catch(e2){err=e2}
    }
    $('loginError').textContent=friendlyErr(err.code)+(friendlyErr(err.code)==='Something went wrong'?' ('+(err.code||err.message)+')':'');
  }
}
// Complete a redirect-based Google sign-in when the page reloads
auth.getRedirectResult().catch(err=>{
  if(err&&err.code&&err.code!=='auth/no-auth-event'){
    console.error('[google redirect]',err.code,err.message);
    const el=$('loginError');if(el)el.textContent=friendlyErr(err.code)+' ('+(err.code||'')+')';
  }
});
const doLogout=()=>auth.signOut();
function slowRetry(){location.reload()}
function slowSignOut(){auth.signOut().finally(()=>location.reload())}
// ═══════════ ACCOUNT DELETION (App Store requirement) ═══════════
async function deleteAccount(){
  if(!confirm('DELETE YOUR ACCOUNT?\n\nThis permanently erases your account, all workout history, nutrition logs, achievements, and leaderboard entry.\n\nThis CANNOT be undone.'))return;
  const typed=prompt('Type DELETE to confirm:');
  if(typed!=='DELETE'){toast('Deletion cancelled');return}
  const user=auth.currentUser;
  if(!user){toast('Not signed in');return}
  try{
    // Recent-login requirement: re-authenticate first
    const isGoogle=user.providerData.some(p=>p.providerId==='google.com');
    if(isGoogle){
      await user.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
    }else{
      const pw=prompt('Enter your password to confirm:');
      if(!pw){toast('Deletion cancelled');return}
      const cred=firebase.auth.EmailAuthProvider.credential(user.email,pw);
      await user.reauthenticateWithCredential(cred);
    }
    toast('Deleting your data…');
    // Delete client-reachable data: log + meta subcollections, user doc, leaderboard doc
    const uid=user.uid;
    for(const sub of ['log','meta']){
      const snap=await db.collection('users').doc(uid).collection(sub).get();
      // Firestore batches cap at 500 ops
      const docs=snap.docs;
      for(let i=0;i<docs.length;i+=400){
        const batch=db.batch();
        docs.slice(i,i+400).forEach(d=>batch.delete(d.ref));
        await batch.commit();
      }
    }
    await db.collection('leaderboard').doc(uid).delete().catch(()=>{});
    if(userData&&userData.username)await db.collection('usernames').doc(userData.username).delete().catch(()=>{});
    await db.collection('users').doc(uid).delete();
    await user.delete();
    try{localStorage.clear()}catch(e){}
    alert('Your account and data have been deleted. Take care, hunter. ');
    location.reload();
  }catch(e){
    console.error('[deleteAccount]',e);
    if(e.code==='auth/wrong-password'||e.code==='auth/invalid-credential')toast('Wrong password — account NOT deleted');
    else if(e.code==='auth/popup-closed-by-user')toast('Re-authentication cancelled — account NOT deleted');
    else toast('Deletion failed: '+(e.code||e.message));
  }
}
function friendlyErr(c){return{'auth/invalid-email':'Invalid email','auth/user-not-found':'No account','auth/wrong-password':'Wrong password','auth/email-already-in-use':'Email taken','auth/weak-password':'Password 6+ chars','auth/invalid-credential':'Invalid email or password','auth/too-many-requests':'Too many attempts','auth/requires-recent-login':'Sign out and back in first','auth/popup-closed-by-user':'Sign-in cancelled','auth/cancelled-popup-request':'Sign-in cancelled','auth/unauthorized-domain':'This domain isn\'t authorized for Google sign-in (admin: add it in Firebase Console)','auth/operation-not-allowed':'Google sign-in isn\'t enabled yet (admin: enable it in Firebase Console)','auth/popup-blocked':'Popup blocked — trying redirect...'}[c]||'Something went wrong'}

// Slow start: after 10 s, offer Try again / Sign out on the loading screen. Never drop a
// signed-in hunter onto the sign-in screen just because the network is slow (v1.31).
function showSlowStart(msg){
  if($('loadingScreen').style.display==='none')return;
  const box=$('ldSlow');if(!box)return;
  if(msg)$('ldSlowMsg').textContent=msg;
  box.style.display='';
}
setTimeout(()=>showSlowStart(),10000);
applyPersistence();try{syncKeepBoxes()}catch(e){}

auth.onAuthStateChanged(async u=>{
  if(authLock)return;
  const hangTimer=0; // kept so the clearTimeout calls below stay harmless
  try{
    if(u){
      U=u;isDev=(u.email===DEV_EMAIL);
      const doc=await db.collection('users').doc(U.uid).get();
      if(!doc.exists){
        // Signed in but no hunter profile yet (new Google sign-in) → invite required
        clearTimeout(hangTimer);
        $('loadingScreen').style.display='none';
        showScreen('inviteScreen');
        return;
      }
      await loadUserData(doc);
      prevRankName=getEffectiveRank().name;
      clearTimeout(hangTimer);
      $('loadingScreen').style.display='none';
      if(!userData.username){showScreen('usernameScreen');return}
      if(!userData.class){showScreen('classScreen');buildClassSelect()}
      else{showScreen('appScreen');initApp();checkWhatsNew()}
    }else{clearTimeout(hangTimer);U=null;isDev=false;$('loadingScreen').style.display='none';showScreen('authScreen')}
  }catch(e){
    console.error('[auth] load error:',e);
    // Still signed in: stay on the loading screen and offer a retry instead of the sign-in form
    if(auth.currentUser){$('loadingScreen').style.display='';showSlowStart("Couldn't load your profile. You're still signed in. Check your signal and try again.")}
    else{$('loadingScreen').style.display='none';showScreen('authScreen')}
  }
});
function showScreen(id){['authScreen','classScreen','appScreen','usernameScreen','inviteScreen'].forEach(s=>{$(s).classList.remove('active');$(s).style.display='none'});$(id).style.display='';$(id).classList.add('active')}

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
  sendInviterFriendRequest();
  // Proceed to class select or app
  if(!userData.class){showScreen('classScreen');buildClassSelect()}
  else{showScreen('appScreen');initApp();checkWhatsNew()}
}

// ═══════════ FIRESTORE ═══════════
async function loadUserData(pre){
  console.log('[loadUserData] starting');
  const doc=pre||await db.collection('users').doc(U.uid).get();
  console.log('[loadUserData] user doc loaded');
  userData=doc.exists?doc.data():{name:U.displayName||'',xp:0,achievements:[],stats:{},prs:{},friends:[],privacy:{hideName:false,hideStats:false},missionsCompleted:{},missionStreak:0,trialsCompleted:[],foodLog:{}};
  ['achievements','friends','trialsCompleted'].forEach(k=>{if(!userData[k])userData[k]=[]});
  ['stats','prs','privacy','missionsCompleted','foodLog'].forEach(k=>{if(!userData[k])userData[k]={}});
  if(!userData.missionStreak)userData.missionStreak=0;
  // Migrate: generate friend code if missing
  if(!userData.friendCode){
    const fc=genFriendCode();
    try{await db.collection('users').doc(U.uid).update({friendCode:fc});
    await db.collection('friendCodes').doc(fc).set({uid:U.uid});
    userData.friendCode=fc;}catch(e){console.warn('[loadUserData] friendCode migration failed:',e)}
  }
  console.log('[loadUserData] fetching log');
  try{
    const ls=await db.collection('users').doc(U.uid).collection('log').orderBy('date','desc').limit(500).get();
    workoutLog=[];ls.forEach(d=>workoutLog.push({_id:d.id,...d.data()}));
    console.log('[loadUserData] log fetched, entries:',workoutLog.length);
  }catch(e){console.warn('[loadUserData] log fetch failed:',e);workoutLog=[]}
  try{
    const iDoc=await db.collection('users').doc(U.uid).collection('meta').doc('inputs').get();
    savedInputs=iDoc.exists?(iDoc.data().data||{}):{};
  }catch(e){console.warn('[loadUserData] inputs fetch failed:',e);savedInputs={}}
  // Cleanup old data — fire and forget, never block init
  setTimeout(()=>{cleanupOldData().catch(e=>console.warn('[cleanupOldData] failed:',e))},800);
  console.log('[loadUserData] done');
}
async function saveUser(f){await db.collection('users').doc(U.uid).update(f);Object.assign(userData,f)}
async function saveLeaderboard(){
  // Never throw: a failed leaderboard write must not abort the action that triggered it
  try{
    try{await checkTitles(true)}catch(e){}
    const r=getEffectiveRank(),c=getCos();
    await db.collection('leaderboard').doc(U.uid).set({
      username:userData.username||'hunter',xp:userData.xp||0,class:userData.class||'',subclass:userData.subclass||'',
      rank:r.name,profilePic:safeImgSrc(userData.profilePic),bio:String(userData.bio||'').slice(0,200),
      workouts:getLiftLogs().length,activities:getActivityLogs().length,achCount:(userData.achievements||[]).length,
      frame:c.frame,nameColor:c.name,gatesCleared:userData.redGatesCleared||0,recent:publicFeedEvents(),
      titleId:myTitleId(),blueGates:userData.blueGatesCleared||0,bests:hofPublicBests(),...hofPublicSteps(),weekStreak:Math.min(520,bestWeekStreak()),hof:hofOptedIn(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  }catch(e){console.warn('[saveLeaderboard]',e.code||e.message)}
}

// ═══════════ RANK-UP SPLASH ═══════════
let prevLevelInfo=null;
function checkRankUp(){
  const newRank=getEffectiveRank();
  if(prevRankName&&newRank.name!==prevRankName){
    const ri=RANKS.findIndex(r=>r.name===newRank.name);
    const prevRi=RANKS.findIndex(r=>r.name===prevRankName);
    if(ri>prevRi){showRankUpSplash(newRank);pushFeedEvent('rank',{rank:newRank.name})}
  }
  prevRankName=newRank.name;
  // Level-up detection → animated burst
  const lvl=getLevelInfo();
  if(prevLevelInfo&&(lvl.rank.name===prevLevelInfo.rank.name)&&lvl.level>prevLevelInfo.level){
    showLevelUpBurst(lvl);
  }
  prevLevelInfo={rank:{name:lvl.rank.name},level:lvl.level};
}
function showLevelUpBurst(lvl){
  let b=$('levelBurst');
  if(!b){b=document.createElement('div');b.id='levelBurst';b.className='level-burst';document.body.appendChild(b)}
  b.innerHTML=`<div class="lb-arrow"></div><div class="lb-text">Level up</div><div class="lb-num">Lv ${lvl.level}<span class="lb-max">/${lvl.maxLevel}</span></div>`;
  b.classList.remove('show');void b.offsetWidth; // restart animation
  b.classList.add('show');
  try{if(navigator.vibrate)navigator.vibrate(80)}catch(e){}
  setTimeout(()=>b.classList.remove('show'),2200);
}
// ═══════════ S-RANK ASCENSION ═══════════
// The pinnacle. Full-screen takeover, sustained, dismissed by tap — an event, not a toast.
function showSRankAscension(rank){
  const title=(rank.title&&rank.title[userData.class])||'MONARCH';
  let ov=$('sRankAscension');
  if(!ov){ov=document.createElement('div');ov.id='sRankAscension';ov.className='srank-ascension';document.body.appendChild(ov)}
  let stars='';
  for(let i=0;i<60;i++){
    const x=Math.random()*100,y=Math.random()*100,d=Math.random()*2.5,sz=1+Math.random()*2.5;
    stars+=`<div class="sr-star" style="left:${x}%;top:${y}%;width:${sz}px;height:${sz}px;animation-delay:${d}s"></div>`;
  }
  let shards='';
  for(let i=0;i<24;i++){
    const angle=(i/24)*360,dist=120+Math.random()*160,dur=1.6+Math.random()*1.6;
    const x=Math.cos(angle*Math.PI/180)*dist,y=Math.sin(angle*Math.PI/180)*dist;
    shards+=`<div class="sr-shard" style="--tx:${x}px;--ty:${y}px;animation-duration:${dur}s;animation-delay:${Math.random()*0.8}s"></div>`;
  }
  ov.innerHTML=`<div class="sr-stars">${stars}</div>
    <div class="sr-core">
      <div class="sr-rays"></div>
      <div class="sr-shards">${shards}</div>
      <div class="sr-eye">👁️</div>
      <div class="sr-pre">The system acknowledges you</div>
      <div class="sr-rank">S-RANK</div>
      <div class="sr-title">${esc(title)}</div>
      <div class="sr-rule"></div>
      <div class="sr-flavor">You have walked the long road and passed the final trial.<br>There is no rank above this one.</div>
      <div class="sr-dismiss">tap to continue</div>
    </div>`;
  ov.onclick=()=>{ov.classList.remove('show');setTimeout(()=>{if(ov)ov.innerHTML=''},700)};
  requestAnimationFrame(()=>ov.classList.add('show'));
  try{if(navigator.vibrate)navigator.vibrate([120,60,120,60,300])}catch(e){}
}
function showRankUpSplash(rank){
  // S-RANK is the pinnacle — it gets its own monumental treatment
  if(rank.name==='S-RANK')return showSRankAscension(rank);
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
  // Trial-gated: XP already crossed the next rank's threshold but the trial blocks it
  const ri=RANKS.indexOf(r);
  const gateRank=RANKS[ri+1];
  if(gateRank&&!gateRank.auto&&gateRank.trial&&!userData.trialsCompleted.includes(gateRank.trial)&&userData.xp>=gateRank.min){
    const t=RANK_TRIALS[gateRank.trial];
    return {pct:100,label:`${userData.xp} XP`,sublabel:`Pass ${t?t.name:'the trial'} to claim ${gateRank.name}`,color:r.color};
  }
  if(!nr) return {pct:100,label:`${userData.xp} XP`,sublabel:'MAX RANK',color:r.color};
  const rangeXp=nr.min-r.min, progress=userData.xp-r.min;
  const pct=Math.min(100,(progress/rangeXp)*100);
  const remaining=nr.min-userData.xp;
  return {pct,label:`${userData.xp} XP`,sublabel:`${remaining} XP to ${nr.name}`,color:r.color};
}

// ═══════════ CLASS & PROGRAM SELECT ═══════════
function buildClassSelect(){
  $('classGrid').innerHTML=CLASSES.map(c=>`<div class="class-card" data-cls="${c.id}" onclick="pickClass('${c.id}')"><div class="cc-icon">${c.icon}</div><div class="cc-name">${c.id}</div><div class="cc-desc">${c.desc}</div><div class="cc-bonus">${c.bonus}</div></div>`).join('');
}
function pickClass(id){
  selectedClass=id;selectedSub=null;selectedProg=null;
  document.querySelectorAll('.class-card').forEach(c=>c.classList.toggle('selected',c.dataset.cls===id));
  const cls=CLASSES.find(c=>c.id===id);
  const sa=$('subclassArea');
  if(cls.subclasses){sa.classList.add('show');$('subOptions').innerHTML=cls.subclasses.map(s=>`<div class="sub-opt" onclick="pickSub(this,'${s}')">${s}</div>`).join('')}else{sa.classList.remove('show')}
  const progs=CLASS_PROGRAMS[id]||[];
  const pa=$('programArea');pa.classList.add('show');
  $('programGrid').innerHTML=progs.map(p=>`<div class="prog-card" data-prog="${p.key}" onclick="pickProg('${p.key}')"><span class="prog-icon">${p.icon}</span><div class="prog-name">${p.name}</div><div class="prog-desc">${p.desc}</div></div>`).join('')+`<div class="prog-card" data-prog="blank" onclick="pickProg('blank')"><span class="prog-icon"></span><div class="prog-name">Build Your Own</div><div class="prog-desc">Start blank — add exercises</div></div>`;
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
function initApp(){
  let tapCount=0,tapTimer=null;
  const logo=$('missionsContent');
  if(logo)logo.addEventListener('click',e=>{if(!e.target.closest('.hh-rank'))return;tapCount++;clearTimeout(tapTimer);tapTimer=setTimeout(()=>tapCount=0,2000);if(tapCount>=10){unlockAch('secret_founder');toast('You found it...');tapCount=0}});
  document.querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',()=>switchPage(n.dataset.page)));
  updateTopBar();
  // Defer non-critical init so the app page renders immediately
  setTimeout(()=>{
    try{syncAcceptedRequests()}catch(e){console.warn(e)}
    try{checkUnreadChats()}catch(e){console.warn(e)}
    try{checkPassiveAchievements()}catch(e){console.warn('passive ach failed:',e)}
    try{initNotifications()}catch(e){console.warn(e)}
    try{checkFriendRequests()}catch(e){console.warn(e)}
    try{updateTrainerTab()}catch(e){console.warn(e)}
    try{checkIncomingPokes()}catch(e){console.warn(e)}
    try{trackStreakHighWater()}catch(e){console.warn(e)}
    grantStartingShards().catch(e=>console.warn(e));
    setTimeout(()=>{try{checkAssignedPlan()}catch(e){console.warn(e)}},2200);
    migratePerfectWeekLocks().then(()=>lockLastWeekIfNeeded()).catch(e=>console.warn(e));
    try{checkWeeklyRecap()}catch(e){console.warn(e)}
    checkAwakeningExam().catch(e=>console.warn(e));
    ensureRedGate().catch(e=>console.warn(e));
    ensureBlueGate().then(g=>{if(g&&currentPage==='missions')renderMissions()}).catch(e=>console.warn(e));
    checkTitles(true).catch(e=>console.warn(e));
    // First-time training goal prompt — for users who haven't set it yet
    if(userData.weeklyTrainingGoal===undefined||userData.weeklyTrainingGoal===null){
      setTimeout(()=>openTrainingGoalPrompt(true),1200);
    }
  },100);
  setTimeout(()=>{try{checkEventMissionNotif()}catch(e){console.warn(e)}},5000);
  // Persist active session whenever the app is backgrounded or closed
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&sessionActive)persistSession()});
  window.addEventListener('pagehide',()=>{if(sessionActive)persistSession()});
  // Handle PWA shortcut ?page= param
  const params=new URLSearchParams(window.location.search);const startPage=params.get('page');
  // Resume an interrupted session — overrides the start page
  let resumed=false;
  try{resumed=restoreSession()}catch(e){console.warn(e)}
  if(resumed){switchPage('train');return}
  if(startPage==='chat'||startPage==='ranks')startPage='guild';
  switchPage(startPage&&['train','missions','nutrition','guild','profile'].includes(startPage)?startPage:'missions');
}
// ═══════════ WEEKLY RECAP ═══════════
// Shown once per week, on first open of a new week — summarizes LAST week.
async function checkWeeklyRecap(){
  const currentMon=getMonday(new Date()).toISOString().slice(0,10);
  const lastMon=new Date(getMonday(new Date()).getTime()-7*86400000).toISOString().slice(0,10);
  // Snapshot XP at week start (for next week's recap)
  if(!userData.xpWeekStart||userData.xpWeekStart.monday!==currentMon){
    const prevSnap=userData.xpWeekStart;
    userData.xpWeekStart={monday:currentMon,xp:userData.xp};
    // Carry last week's snapshot forward for the recap calc
    if(prevSnap&&prevSnap.monday===lastMon)userData.xpLastWeekStart=prevSnap;
    try{await saveUser({xpWeekStart:userData.xpWeekStart,xpLastWeekStart:userData.xpLastWeekStart||null})}catch(e){}
  }
  if(userData.lastRecapWeek===currentMon)return; // already shown this week
  const lastWeek=evaluateWeek(lastMon,getWeeklyGoal());
  if(lastWeek.sessions===0)return; // nothing to recap, don't nag
  const weekBefore=evaluateWeek(new Date(getMonday(new Date()).getTime()-14*86400000).toISOString().slice(0,10),getWeeklyGoal());
  setTimeout(()=>showWeeklyRecap(lastMon,lastWeek,weekBefore),2500);
  userData.lastRecapWeek=currentMon;
  try{await saveUser({lastRecapWeek:currentMon})}catch(e){}
}
function showWeeklyRecap(lastMon,wk,prev){
  const modal=$('weeklyRecapModal');if(!modal)return;
  // Volume + minutes for last week
  const monStart=new Date(lastMon+'T00:00:00').getTime(),monEnd=monStart+7*86400000;
  let vol=0,mins=0;
  workoutLog.forEach(e=>{const t=new Date(e.date).getTime();if(t<monStart||t>=monEnd)return;
    if(e.durationSec)mins+=e.durationSec/60;
    (e.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(s=>{vol+=(parseFloat(s.weight)||0)*(parseFloat(s.reps)||0)}));
  });
  const lw=userData.xpLastWeekStart;
  const xpGained=lw&&lw.monday===lastMon?Math.max(0,(userData.xpWeekStart?userData.xpWeekStart.xp:userData.xp)-lw.xp):null;
  const delta=wk.sessions-prev.sessions;
  const deltaTxt=prev.sessions===0?'':delta>0?`<span style="color:var(--green)">▲ ${delta} more than the week before</span>`:delta<0?`<span style="color:var(--gold)">▼ ${Math.abs(delta)} fewer than the week before</span>`:`<span style="color:var(--muted)">Same as the week before</span>`;
  const dateLabel=new Date(lastMon+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
  let h=`<h2>Your week in review</h2>
    <p style="color:var(--muted);font-size:.7rem;margin-bottom:.7rem">Week of ${dateLabel}. It's in the books.</p>
    <div class="recap-hero ${wk.perfect?'perfect':''}">${wk.perfect?'Perfect week':wk.sessions+' of '+wk.target+' sessions'}</div>
    <div class="recap-grid">
      <div class="recap-stat"><div class="rv">${wk.sessions}</div><div class="rl">Sessions</div></div>
      <div class="recap-stat"><div class="rv">${wk.lifts}</div><div class="rl">Lifts</div></div>
      <div class="recap-stat"><div class="rv">${vol>=1000?(vol/1000).toFixed(1)+'k':Math.round(vol)}</div><div class="rl">lbs moved</div></div>
      <div class="recap-stat"><div class="rv">${Math.round(mins)}</div><div class="rl">Minutes</div></div>
    </div>
    ${xpGained!==null?`<div class="recap-xp">+${xpGained} XP earned</div>`:''}
    ${deltaTxt?`<div class="recap-delta">${deltaTxt}</div>`:''}
    <div class="m-actions" style="margin-top:.8rem"><button class="m-save-btn" onclick="$('weeklyRecapModal').classList.remove('open')" style="width:100%">Start the new week</button></div>`;
  modal.querySelector('.modal').innerHTML=h;
  modal.classList.add('open');
}
// First-time training goal prompt — locks all past weeks under the chosen goal
function openTrainingGoalPrompt(firstTime){
  const modal=$('trainingGoalModal');if(!modal)return;
  const current=userData.weeklyTrainingGoal||4;
  let h=firstTime
    ?`<h2>Quick Setup</h2><p style="color:var(--muted);font-size:.78rem;line-height:1.5;margin-bottom:.7rem">How many days per week do you intend to train? Lifts, cardio, and active rest all count — but at least 3 days must be lifts.</p><p style="color:var(--gold);font-size:.7rem;line-height:1.45;margin-bottom:.8rem">This sets your <strong>perfect-week</strong> target for the Iron Gate trial. Pick honestly — past weeks will be locked under this number, future weeks will count against whatever you have set at the time.</p>`
    :`<h2>Workouts per Week</h2><p style="color:var(--muted);font-size:.78rem;line-height:1.5;margin-bottom:.7rem">How many lift sessions do you intend to do per week?</p><p style="color:var(--gold);font-size:.7rem;line-height:1.45;margin-bottom:.8rem"><strong>Past weeks won't change.</strong> They're already locked under your previous goal. This only affects the current and future weeks.</p>`;
  h+=`<div class="tg-options">`;
  for(let n=3;n<=7;n++){
    h+=`<button class="tg-opt${n===current?' selected':''}" data-n="${n}" onclick="pickTrainingGoal(${n})">${n}<span class="tg-opt-sub">/week</span></button>`;
  }
  h+=`</div>`;
  if(!firstTime){
    h+=`<div class="m-actions" style="margin-top:.8rem"><button class="m-cancel" onclick="closeTrainingGoalModal()">Cancel</button></div>`;
  }
  modal.querySelector('.modal').innerHTML=h;
  modal.classList.add('open');
  modal.dataset.firstTime=firstTime?'1':'0';
}
function closeTrainingGoalModal(){$('trainingGoalModal').classList.remove('open')}
async function pickTrainingGoal(n){
  const modal=$('trainingGoalModal');
  const firstTime=modal&&modal.dataset.firstTime==='1';
  const old=userData.weeklyTrainingGoal;
  userData.weeklyTrainingGoal=n;
  await saveUser({weeklyTrainingGoal:n});
  if(firstTime){
    // First-time setup: lock all past weeks under this goal
    const changes=await lockHistoricalWeeks(n);
    if(changes>0)toast(`${changes} past week${changes!==1?'s':''} locked. Future weeks count against ${n}/wk.`);
    else toast(`Goal set: ${n} workouts/week`);
  }else{
    if(old!==n)toast(`Goal updated: ${n}/week. Past weeks unchanged.`);
  }
  closeTrainingGoalModal();
}
function updateTopBar(){
  const el=$('homeHeader');if(el)el.outerHTML=renderHomeHeader();
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

// ═══════════ INTERNAL LEVEL SYSTEM (Plain Option B) ═══════════
// Cosmetic-only levels inside each rank — do NOT gate trial unlocks.
// Trials unlock purely at XP threshold (unchanged from old system).
function getLevelInfo(xp){
  if(xp==null)xp=userData.xp||0;
  // Determine rank by XP (raw, not effective — internal levels use the actual XP tier)
  let rank=RANKS[0];
  for(let i=RANKS.length-1;i>=0;i--){if(xp>=RANKS[i].min){rank=RANKS[i];break}}
  const xpInto=xp-rank.min;
  const xpPerLevel=rank.xpPerLevel||100;
  const maxLevel=rank.levels||10;
  const rawLevel=1+Math.floor(xpInto/xpPerLevel);
  const level=Math.min(maxLevel,rawLevel);
  const xpIntoLevel=xpInto-((level-1)*xpPerLevel);
  const xpToNextLevel=xpPerLevel-xpIntoLevel;
  const progressPct=level>=maxLevel?100:Math.min(100,(xpIntoLevel/xpPerLevel)*100);
  return {rank,level,maxLevel,xpIntoLevel,xpPerLevel,xpToNextLevel,progressPct,maxed:level>=maxLevel};
}
// ═══════════ XP CAP SYSTEM (SOFT 25%) ═══════════
// When user hits the trial threshold of an uncompleted trial-gated rank,
// they earn 25% XP until the trial passes. Not zero. Full-rate resumes after pass.
const TRIAL_BONUS={iron_gate:250,gauntlet:500,awakening:1000};
function getXpCap(){
  // Returns {softCap: 0..1 multiplier, trial: trial object or null}
  for(let i=0;i<RANKS.length;i++){
    if(!RANKS[i].auto&&RANKS[i].trial&&!userData.trialsCompleted.includes(RANKS[i].trial)){
      // User is past this rank's min without passing trial → soft cap at 25%
      if(userData.xp>=RANKS[i].min){
        return {softCap:0.25,trialName:RANKS[i].trial,rankMin:RANKS[i].min};
      }
      return {softCap:1,trialName:null};
    }
  }
  return {softCap:1,trialName:null}; // all trials done
}
function addXP(amount){
  const cap=getXpCap();
  const {mult}=getXpMultiplier();
  const boosted=Math.round(amount*mult*cap.softCap);
  userData.xp+=boosted;
  return boosted;
}
function switchPage(p){
  currentPage=p;
  const navP=p==='ranks'?'profile':p;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===navP));
  document.querySelectorAll('.page').forEach(pg=>pg.classList.remove('active'));
  $('page-'+p).classList.add('active');
  try{window.scrollTo(0,0)}catch(e){}
  if(p==='train')buildWorkout();
  if(p==='profile'){updateTrainerTab();renderProfile()}
  if(p==='missions')renderMissions();
  if(p==='nutrition')renderNutritionPage();
  if(p==='guild')renderGuild();
}
function switchSubTab(page,tab){
  const container=page==='chat'?$('chatPageContent'):$('page-'+page);if(!container)return;
  container.querySelectorAll(':scope > .sub-tabs > .stab').forEach(t=>t.classList.toggle('active',t.dataset.st===tab));
  container.querySelectorAll(':scope > .sub-page').forEach(p=>p.classList.remove('active'));
  const sp=$('sp-'+tab);if(sp)sp.classList.add('active');
  // When switching back into Train → Workout from another sub-tab, rebuild the day view
  if(page==='train'&&tab==='workout'&&!sessionActive){buildWorkout()}
  if(tab==='log')renderLog();if(tab==='rankinfo')$('rankInfoContent').innerHTML=renderRankInfo();if(tab==='leaderboard')renderLeaderboard();
  if(tab==='aicoach')renderAICoach();if(tab==='friendchat')renderChatList();
  if(tab==='friends'){renderFriendsPage();pendingFriendReqs=0;updateFriendBadge()}
  if(tab==='mystats')renderProfile();
  if(tab==='updates')renderUpdatesTab();if(tab==='library')renderLibrary();if(tab==='badges')renderAchievements();if(tab==='shop')renderShop();
  if(tab==='trainer')renderTrainerDashboard();
  if(tab==='activity')renderGuildActivity();if(tab==='messages')renderChatPage();
}
function updateTrainerTab(){
  const tab=$('trainerTab');if(tab)tab.style.display=userData.role==='trainer'?'':'none';
}

// Progress strip — trend-framed, never punitive. BMI deliberately excluded
// (it mislabels muscular users and would read as discouragement on a daily screen).
function renderProgressStrip(){
  // 1. Volume: this week vs last week
  const curMon=getMonday(new Date()).getTime();
  const lastMon=curMon-7*86400000;
  let volThis=0,volLast=0;
  getLiftLogs().forEach(e=>{const t=new Date(e.date).getTime();
    let v=0;(e.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(s=>{v+=(parseFloat(s.weight)||0)*(parseFloat(s.reps)||0)}));
    if(t>=curMon)volThis+=v;else if(t>=lastMon)volLast+=v;
  });
  const fmtV=v=>v>=1000?(v/1000).toFixed(1)+'k':Math.round(v);
  const volDelta=volLast>0?Math.round((volThis-volLast)/volLast*100):null;
  const trend=(cls,txt)=>`<span class="ps-t ${cls}">${txt}</span>`;
  const volTrend=volDelta===null?'':volDelta>0?trend('up',`▲ ${volDelta}%`):volDelta<0?trend('flat',`▼ ${Math.abs(volDelta)}%`):trend('flat','Same as last week');
  // 2. Bodyweight trend — colored toward the user's goal, never red
  const wi=userData.weighIns||[];
  let weightTile;
  if(wi.length>=1){
    const latest=parseFloat(wi[wi.length-1].weight)||0;
    let t='';
    if(wi.length>=2){
      const prev=parseFloat(wi[wi.length-2].weight)||0;
      const d=Math.round((latest-prev)*10)/10;
      const goal=(userData.goal||'').toLowerCase();
      const toward=(d<0&&(goal.includes('fat')||goal.includes('recomp')))||(d>0&&(goal.includes('muscle')||goal.includes('strength')));
      t=d!==0?trend(toward?'up':'flat',`${d>0?'▲':'▼'} ${Math.abs(d)} lb`):trend('flat','No change');
    }
    weightTile=`<div class="ps-tile"><div class="num ps-v">${latest}</div><div class="ps-l">Bodyweight</div>${t}</div>`;
  }else{
    weightTile=`<button class="ps-tile tap" onclick="openWeighIn()"><div class="ps-v lilac">${icon('scale',20)}</div><div class="ps-l">Log a weigh-in</div></button>`;
  }
  // 3. Steps (v1.31) — replaced "Sessions in 30 days", which This week already covers
  return `<div class="progress-strip">
      <div class="ps-tile"><div class="num ps-v">${fmtV(volThis)}</div><div class="ps-l">lb lifted this week</div>${volTrend}</div>
      ${weightTile}
      ${stepTileHtml()}
  </div>`;
}
// ═══════════ DAILY MISSIONS ═══════════
function renderMissions(){
  const today=getTodayStr();const missions=getDailyMissions(today,userData.class);
  const completed=userData.missionsCompleted[today]||[];
  const allDone=missions.every(m=>completed.includes(m.id));
  const cap=getXpCap();const softCapped=cap.softCap<1;
  const {mult}=getXpMultiplier();
  const xpOf=x=>Math.round(x*mult*(softCapped?0.25:1));
  let h=renderHomeHeader();
  // ── Daily Quest window ──
  const midnight=new Date();midnight.setHours(24,0,0,0);
  const left=midnight-Date.now(),hh=Math.floor(left/3600000),mm=Math.floor(left%3600000/60000);
  let q=`<div class="sys-title lg">[ Daily Quest ]</div><div class="hq-reset">Resets in ${hh}h ${mm}m</div><div class="wline"></div>`;
  const evt=getEventMission(today);
  if(evt){
    const evtDone=(userData.eventsCompleted||{})[today];
    q+=`<button class="hq-event${evtDone?' done':''}" ${evtDone?'disabled':'onclick="completeEvent()"'}>
      <span class="hq-ev-i">${evtDone?icon('check',18):icon('bolt',18)}</span>
      <span class="hq-txt"><span class="hq-name">Event: ${esc(evt.name)}</span><span class="hq-desc">${esc(evt.desc)}</span></span>
      <span class="hq-xp gold">${evtDone?'Done':'+'+xpOf(evt.xp)}</span></button>`;
  }
  q+=`<div class="hq-list">`+missions.map(m=>{
    const done=completed.includes(m.id);
    return questRow(done,esc(m.name),esc(m.desc),done?'Done':'+'+xpOf(m.xp),`completeMission('${m.id}')`);
  }).join('')+`</div><div class="wline"></div>`;
  const streak=userData.missionStreak||0;
  q+=`<div class="hq-foot"><span>${completed.length} of ${missions.length} done${streak>1?`, ${streak}-day quest streak`:''}</span>
    <span class="gold">${allDone?`Bonus earned: +${xpOf(50)} XP`:`All ${missions.length}: +${xpOf(50)} XP`}</span></div>`;
  if(softCapped){const t=getAvailableTrial();q+=`<div class="hq-cap">Trial active. XP is at 25% until you pass ${esc(t?dayLabel(t.trial.name):'your trial')}.</div>`}
  h+=sysWin(q,'hq');
  // ── Start the next workout ──
  const nd=nextProgramDay();
  const sesDay=sessionActive?(userData.program||[]).find(d=>d.id===sessionDayId):null;
  const typedDay=!sessionActive?(userData.program||[]).find(d=>dayHasTypedInputs(d.id)):null;
  if(sesDay){
    h+=`<button class="btn-p hh-start" onclick="switchPage('train')">${icon('play',14)} Resume ${esc(dayLabel(sesDay.title))}</button>
      <div class="hh-start-sub"><span>Session in progress, ${sessionMinutes()} min on the clock.</span></div>`;
  }else if(typedDay){
    h+=`<button class="btn-p hh-start" onclick="currentDay='${safeId(typedDay.id)}';switchPage('train');startLogMode()">${icon('play',14)} Continue ${esc(dayLabel(typedDay.title))}</button>
      <div class="hh-start-sub"><span>You have sets typed in but not logged yet.</span><button class="link" onclick="currentDay='${safeId(typedDay.id)}';switchPage('train')">See workout</button></div>`;
  }else if(nd){
    const trainedToday=workoutLog.some(e=>!e.isRest&&new Date(e.date).toDateString()===new Date().toDateString());
    h+=`<button class="btn-p hh-start" onclick="homeStart('${safeId(nd.id)}')">${icon('play',14)} Start ${esc(dayLabel(nd.title))}</button>
      <div class="hh-start-sub"><span>${trainedToday?'You trained today. Anything more is bonus.':'Next in your program.'}</span><button class="link" onclick="switchPage('train')">Pick another</button></div>`;
  }else{
    h+=`<button class="btn-p hh-start" onclick="switchPage('train')">Set up your program</button>`;
  }
  // ── This week ──
  h+=renderWeekStrip();
  h+=renderProgressStrip();
  // ── Gate / trial ──
  const trialInfo=getAvailableTrial();
  if(trialInfo)h+=renderTrialRow(trialInfo);
  if(isSRank()){
    if(!trialInfo)h+=`<div class="home-gate">${renderRedGateCard()}</div>`;
    // Reached S mid-week with this week's Blue Gate already beaten: still let them claim it
    const bg=userData.blueGate;
    if(bg&&bg.week===gateWeekKey()&&!bg.cleared&&getBlueGateProgress(bg).done)h+=`<div class="home-gate">${renderBlueGateCard()}</div>`;
  }else h+=`<div class="home-gate">${renderBlueGateCard()}</div>`;
  if(getEffectiveRank().name==='A-RANK')h+=`<div class="li home-teaser"><span class="ico sys">${icon('gate',18)}</span><span class="t">Red Gates<small>A new boss challenge every week, once you reach S-Rank.</small></span></div>`;
  // ── Guild activity ──
  h+=friendFeedSlot();
  // ── Class track ──
  h+=renderProgressionTrack();
  $('missionsContent').innerHTML=h;
}
async function completeMission(mid){
  const today=getTodayStr();const missions=getDailyMissions(today,userData.class);
  let completed=userData.missionsCompleted[today]||[];
  if(completed.includes(mid))return;
  const m=missions.find(x=>x.id===mid);if(!m)return;
  if(!confirm(`Complete "${m.name}"?\n\n${m.desc}\n\nThis locks in for today.`))return;
  completed.push(mid);
  let gained=addXP(m.xp);
  let bonusMsg='';
  if(missions.every(x=>completed.includes(x.id))){
    const bonusGained=addXP(50);
    gained+=bonusGained;
    bonusMsg=` (+${bonusGained} all-quests bonus, +${SHARD_REWARDS.allMissionsDay} shards)`;
    userData.shards=(userData.shards||0)+SHARD_REWARDS.allMissionsDay;
    unlockAch('missions_all');
  }
  if(completed.length>=3)unlockAch('missions_3');
  userData.missionsCompleted[today]=completed;
  userData.missionStreak=calcMissionStreak();
  if(userData.missionStreak>=7)unlockAch('mission_streak_7');
  if(userData.missionStreak>=14)unlockAch('missions_streak_14');
  await saveUser({missionsCompleted:userData.missionsCompleted,missionStreak:userData.missionStreak,xp:userData.xp,shards:userData.shards||0});
  await saveLeaderboard();updateTopBar();checkRankUp();renderMissions();
  toast(`${m.icon} ${m.name} +${gained} XP${bonusMsg}`);
}
// Missions are saved under LOCAL date keys, so the streak must read local keys too
// (UTC keys zeroed the streak every evening in US time zones). Today still being in
// progress doesn't break the streak — it just isn't counted until it's complete.
function calcMissionStreak(){
  let streak=0;const d=new Date();const mc=userData.missionsCompleted||{};
  for(let i=0;i<365;i++){
    const ds=new Date(d);ds.setDate(ds.getDate()-i);
    const key=getDateStr(ds);
    const missions=getDailyMissions(key,userData.class)||[];
    const comp=mc[key]||[];
    if(missions.length&&missions.every(m=>comp.includes(m.id)))streak++;
    else if(i===0)continue;
    else break;
  }
  return streak;
}

// ═══════════ SYSTEM SHARDS ═══════════
// Earned currency. Spendable on recovery items — NEVER on trial completion directly.
function getShards(){return userData.shards||0}
async function awardShards(n,reason){
  if(!n||n<=0)return 0;
  userData.shards=(userData.shards||0)+n;
  try{await saveUser({shards:userData.shards})}catch(e){console.warn('shard save:',e)}
  console.log('[shards] +'+n+' ('+reason+') → '+userData.shards);
  return n;
}
async function spendShards(n){
  if(getShards()<n)return false;
  userData.shards=getShards()-n;
  await saveUser({shards:userData.shards});
  return true;
}
function renderShop(){
  const el=$('shopContent');if(!el)return;
  const bal=getShards();
  let h=`<div class="page-title">System shop</div><div class="page-sub">Shards are earned, not bought.</div>
  <div class="shard-balance"><span class="sb-icon">${SHARD_SVG}</span><span class="sb-num">${bal}</span><span class="sb-label">Shards</span></div>
  <div class="shard-earn">Earn shards: <strong>+${SHARD_REWARDS.achievement}</strong> per achievement · <strong>+${SHARD_REWARDS.allMissionsDay}</strong> per all-missions day · <strong>+${SHARD_REWARDS.perfectWeek}</strong> per perfect week · <strong>+${SHARD_REWARDS.trial}</strong> per trial passed</div>`;
  // Active XP surge indicator
  const surge=userData.xpSurgeUntil||0;
  if(surge>Date.now()){
    const hrsLeft=Math.ceil((surge-Date.now())/3600000);
    h+=`<div class="surge-active">XP SURGE ACTIVE — 1.5× for ${hrsLeft} more hour${hrsLeft!==1?'s':''}</div>`;
  }
  SHOP_ITEMS.forEach(item=>{
    const afford=bal>=item.cost;
    let lockNote='';
    if(item.id==='streak_restore'){
      const last=userData.lastStreakRestore||0;
      const daysSince=(Date.now()-last)/86400000;
      if(last&&daysSince<30)lockNote=`Available again in ${Math.ceil(30-daysSince)} days`;
    }
    if(item.id==='xp_boost'&&surge>Date.now())lockNote='Surge already active';
    h+=`<div class="shop-item${afford&&!lockNote?'':' dim'}">
      <div class="si-top"><span class="si-icon">${item.icon}</span><span class="si-name">${item.name}</span><span class="si-cost">${SHARD_SVG} ${item.cost}</span></div>
      <div class="si-desc">${item.desc}</div>
      <div class="si-detail">${item.detail}</div>
      ${item.id==='week_buyback'?`<div class="si-rules">Requires ALL of: short by exactly 1 session · every logged set checked off · 3+ lift sessions · no blank sessions</div>`:''}
      ${lockNote?`<div class="si-lock">${lockNote}</div>`:`<button class="si-buy" ${afford?'':'disabled'} onclick="buyShopItem('${item.id}')">${afford?'Redeem':'Need '+(item.cost-bal)+' more'}</button>`}
    </div>`;
  });
  h+=renderCosmeticsShop();
  el.innerHTML=h;
}
async function buyShopItem(id){
  const item=SHOP_ITEMS.find(i=>i.id===id);if(!item)return;
  if(getShards()<item.cost){toast('Not enough shards');return}
  if(id==='streak_restore')return buyStreakRestore(item);
  if(id==='week_buyback')return buyWeekBuyback(item);
  if(id==='xp_boost')return buyXpSurge(item);
}
async function buyStreakRestore(item){
  const last=userData.lastStreakRestore||0;
  if(last&&(Date.now()-last)/86400000<30){toast('Streak restore is on cooldown');return}
  const prev=userData.prevWeeklyStreak||0;
  const cur=calcWeeklyStreak();
  if(prev<=cur){toast('Nothing to restore — your streak is intact');return}
  if(!confirm(`Restore your weekly streak from ${cur} to ${prev} for ${item.cost} shards?`))return;
  if(!await spendShards(item.cost))return;
  userData.streakRestoreTo=prev;
  userData.lastStreakRestore=Date.now();
  await saveUser({streakRestoreTo:prev,lastStreakRestore:userData.lastStreakRestore,shards:userData.shards});
  toast(`Streak restored to ${prev} weeks`);
  renderShop();updateTopBar();
}
async function buyWeekBuyback(item){
  const goal=getWeeklyGoal();
  const locked=userData.perfectWeeksLocked||{};
  const candidates=[],denied=[];
  Object.keys(locked).forEach(wk=>{
    if(locked[wk])return; // already perfect
    const label=new Date(wk+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
    if((userData.boughtWeeks||[]).includes(wk)){denied.push({label,why:'already bought back'});return}
    const r=evaluateWeek(wk,goal);
    const shortBy=r.target-r.sessions;
    // Eligibility: short by EXACTLY one session, and everything else clean
    if(shortBy!==1){
      denied.push({label,why:shortBy>1?`missed ${shortBy} sessions — only 1 can be bought back`:'not short on sessions'});
      return;
    }
    if(r.failedSets>0){denied.push({label,why:`${r.failedSets} set${r.failedSets!==1?'s':''} logged but never checked off`});return}
    if(r.lifts<Math.min(3,r.target)){denied.push({label,why:`only ${r.lifts} lift session${r.lifts!==1?'s':''} — 3 required`});return}
    if(r.sessionsWithDone<r.lifts){denied.push({label,why:'a logged session had no completed sets'});return}
    candidates.push({wk,r,label});
  });
  if(!candidates.length){
    const m=$('buybackInfoModal');
    let h=`<h2>No Eligible Weeks</h2>
      <p style="color:var(--muted);font-size:.78rem;line-height:1.55;margin-bottom:.7rem">A week can only be bought back if <strong style="color:var(--text)">all</strong> of these are true:</p>
      <div class="bb-rule">You were short by <strong>exactly one session</strong></div>
      <div class="bb-rule">Every set you logged was <strong>checked off</strong></div>
      <div class="bb-rule">You still hit <strong>3+ lift sessions</strong></div>
      <div class="bb-rule">No logged session was left blank</div>
      <p style="color:var(--gold);font-size:.7rem;line-height:1.5;margin:.7rem 0">Missing two or more days can't be bought back. One missed day is life — two is a choice.</p>`;
    if(denied.length){
      h+=`<div style="font-family:var(--font-mono);font-size:.62rem;color:var(--muted);letter-spacing:1px;margin:.6rem 0 .3rem">Your recent weeks</div>`;
      denied.sort((a,b)=>b.label.localeCompare(a.label)).slice(0,8).forEach(d=>{
        h+=`<div class="bb-denied"><span>Week of ${d.label}</span><span class="bb-why">${d.why}</span></div>`;
      });
    }
    h+=`<div class="m-actions" style="margin-top:.8rem"><button class="m-save-btn" style="width:100%" onclick="$('buybackInfoModal').classList.remove('open')">Got it</button></div>`;
    m.querySelector('.modal').innerHTML=h;
    m.classList.add('open');
    return;
  }
  candidates.sort((a,b)=>b.wk.localeCompare(a.wk));
  const c=candidates[0];
  if(!confirm(`Buy back the week of ${c.label}?\n\nYou logged ${c.r.sessions}/${c.r.target} sessions — exactly one short, and every set you logged was checked off.\n\nThis permanently marks it a PERFECT WEEK.\n\nCost: ${item.cost} shards`))return;
  if(!await spendShards(item.cost))return;
  locked[c.wk]=true;
  userData.perfectWeeksLocked=locked;
  userData.boughtWeeks=[...(userData.boughtWeeks||[]),c.wk];
  await saveUser({perfectWeeksLocked:locked,boughtWeeks:userData.boughtWeeks,shards:userData.shards});
  toast(`Week of ${c.label} claimed as PERFECT`);
  renderShop();updateTopBar();checkRankUp();
}
async function buyXpSurge(item){
  if((userData.xpSurgeUntil||0)>Date.now()){toast('Surge already active');return}
  if(!confirm(`Activate 1.5× XP for 24 hours for ${item.cost} shards?`))return;
  if(!await spendShards(item.cost))return;
  userData.xpSurgeUntil=Date.now()+24*3600000;
  await saveUser({xpSurgeUntil:userData.xpSurgeUntil,shards:userData.shards});
  toast('XP SURGE ACTIVE — 1.5× for 24 hours');
  renderShop();updateTopBar();
}
// ═══════════ RED GATES (S-Rank weekly boss) ═══════════
function isSRank(){return getEffectiveRank().name==='S-RANK'}
function gateWeekKey(d){return getMonday(d||new Date()).toISOString().slice(0,10)}
// Shift by whole weeks using calendar math at noon — safe across DST changes
function shiftWeek(monIso,n){const d=new Date(monIso+'T12:00:00');d.setDate(d.getDate()+7*n);return gateWeekKey(d)}
function weekBounds(monIso){const s=new Date(monIso+'T00:00:00');const e=new Date(s);e.setDate(e.getDate()+7);return[s.getTime(),e.getTime()]}
function weekDayKeys(monIso){const out=[];for(let i=0;i<7;i++){const d=new Date(monIso+'T12:00:00');d.setDate(d.getDate()+i);out.push(getDateStr(d))}return out}
// Same gate for every S-Rank each week. Fixed 7-week cycle: every gate shows up once
// per cycle and never twice in a row. Week index uses UTC date math (DST-proof).
function pickGateType(monIso){
  const [y,m,d]=monIso.split('-').map(Number);
  const idx=Math.round((Date.UTC(y,m-1,d)-Date.UTC(2026,0,5))/(7*86400000));
  const n=RED_GATE_POOL.length;
  return RED_GATE_POOL[((idx%n)+n)%n];
}
function inGateWeek(e,monIso){const[s,end]=weekBounds(monIso);const t=new Date(e.date).getTime();return t>=s&&t<end&&!e.backdated}
function weeklyVolume(monIso){let v=0;getLiftLogs().forEach(x=>{if(!inGateWeek(x,monIso))return;(x.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(st=>{v+=(parseFloat(st.weight)||0)*(parseFloat(st.reps)||0)}))});return v}
function weeklySessionMinutes(monIso){return workoutLog.filter(e=>inGateWeek(e,monIso)).reduce((a,e)=>a+(e.durationSec||0)/60,0)}
// Best weight per exercise from everything logged BEFORE a timestamp
function prBaselineBefore(ts){
  const base={};
  getLiftLogs().forEach(e=>{
    if(new Date(e.date).getTime()>=ts)return;
    (e.exercises||[]).forEach(ex=>{const k=normalizeExName(ex.name);if(!k)return;
      (ex.sets||[]).forEach(s=>{const w=parseFloat(s.weight)||0;if(w>0&&(!base[k]||w>base[k]))base[k]=w})});
  });
  return base;
}
function computeGateTarget(type,monIso){
  switch(type.id){
    case 'volume_siege':{let best=0;for(let i=1;i<=8;i++)best=Math.max(best,weeklyVolume(shiftWeek(monIso,-i)));return Math.max(15000,Math.round(best*1.1/500)*500)}
    case 'endurance_gate':{let tot=0,n=0;for(let i=1;i<=4;i++){const m=weeklySessionMinutes(shiftWeek(monIso,-i));if(m>0){tot+=m;n++}}return Math.max(180,Math.round((n?tot/n:0)*1.2/10)*10)}
    case 'flawless_five':return 5;
    case 'double_breach':return 2;
    case 'iron_discipline':return 5;
    case 'fuel_the_hunt':return 5;
    case 'cardio_raid':return 150;
  }
  return 1;
}
// Live progress → {val, target, blocker}
function getGateProgress(g){
  const wk=g.week;let val=0,blocker='';
  switch(g.type){
    case 'volume_siege':val=Math.round(weeklyVolume(wk));break;
    case 'flawless_five':{
      const logs=getTrainingLogs().filter(e=>inGateWeek(e,wk));val=logs.length;
      let unchecked=0;
      logs.forEach(e=>{if(e.isRest||e.isActivity)return;(e.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(s=>{const has=s&&((s.weight&&String(s.weight).trim())||(s.reps&&String(s.reps).trim()));if(has&&!s.done)unchecked++}))});
      if(unchecked)blocker=`${unchecked} logged set${unchecked!==1?'s':''} left unchecked — the gate demands a flawless week`;
      break}
    case 'double_breach':{
      const[s]=weekBounds(wk);const base=prBaselineBefore(s);const beaten=new Set();
      getLiftLogs().forEach(e=>{if(!inGateWeek(e,wk))return;(e.exercises||[]).forEach(ex=>{const k=normalizeExName(ex.name);if(base[k]===undefined)return;
        (ex.sets||[]).forEach(st=>{if((parseFloat(st.weight)||0)>base[k])beaten.add(k)})})});
      val=beaten.size;break}
    case 'iron_discipline':{
      const mc=userData.missionsCompleted||{};
      val=weekDayKeys(wk).filter(k=>{const ms=getDailyMissions(k,userData.class)||[];const c=mc[k]||[];return ms.length&&ms.every(m=>c.includes(m.id))}).length;break}
    case 'endurance_gate':val=Math.round(weeklySessionMinutes(wk));break;
    case 'fuel_the_hunt':{
      const t=(typeof calcTDEE==='function')?calcTDEE():null;
      if(!t){blocker='Set up your nutrition targets first (Nutrition → Adjust Targets)';break}
      val=weekDayKeys(wk).filter(k=>getDayTotals(getDayLog(k)).p>=t.proteinG).length;break}
    case 'steps_week':val=stepsWeek(wk);break;
    case 'cardio_raid':val=Math.round(getActivityLogs().filter(e=>inGateWeek(e,wk)).reduce((a,e)=>a+(parseFloat(e.duration)||0),0));break;
  }
  return {val,target:g.target,blocker,done:val>=g.target&&!blocker};
}
// Opens this week's gate (and archives last week's) — runs on load and on render
async function ensureRedGate(){
  if(!isSRank())return null;
  const wk=gateWeekKey();
  let g=userData.redGate;
  if(g&&g.week===wk)return g;
  if(g){
    const hist=userData.redGateHistory||[];
    if(!hist.some(h=>h.week===g.week))hist.push({week:g.week,type:g.type,cleared:!!g.cleared});
    userData.redGateHistory=hist.slice(-52);
  }
  const type=pickGateType(wk);
  g={week:wk,type:type.id,target:computeGateTarget(type,wk),cleared:false};
  userData.redGate=g;
  try{await saveUser({redGate:g,redGateHistory:userData.redGateHistory||[]})}catch(e){console.warn('gate save:',e)}
  return g;
}
function calcGateStreak(){
  const all=[...(userData.redGateHistory||[])];
  const g=userData.redGate;
  if(g&&g.cleared)all.push({week:g.week,cleared:true});
  const byWeek={};all.forEach(h=>{byWeek[h.week]=h.cleared});
  let expect=(g&&g.cleared)?g.week:shiftWeek(gateWeekKey(),-1);
  let n=0;while(byWeek[expect]){n++;expect=shiftWeek(expect,-1)}
  return n;
}
function fmtGateNum(n,unit){return unit==='lbs'?(n>=1000?(n/1000).toFixed(n>=100000?0:1)+'k':n):n}
function renderRedGateCard(){
  const g=userData.redGate;
  if(!g||g.week!==gateWeekKey()){
    ensureRedGate().then(()=>{if(currentPage==='missions')renderMissions()});
    return sysWin(`<div class="sys-title">[ Red Gate ]</div><div class="mist" style="text-align:center;margin-top:8px">A gate is opening…</div>`,'red-gate');
  }
  const type=RED_GATE_POOL.find(t=>t.id===g.type)||RED_GATE_POOL[0];
  const p=getGateProgress(g);
  const pct=Math.min(100,(p.val/p.target)*100);
  const msLeft=weekBounds(g.week)[1]-Date.now();
  const dLeft=Math.floor(msLeft/86400000),hLeft=Math.floor((msLeft%86400000)/3600000);
  const weekLabel=new Date(g.week+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
  let action='';
  if(g.cleared)action=`<div class="rg-cleared">Gate cleared</div>`;
  else if(p.done)action=`<button class="btn-p rg-claim" onclick="claimRedGate()">Claim: +${SHARD_REWARDS.redGate} shards, +${RED_GATE_XP} XP</button>`;
  return sysWin(`<div class="sys-title">[ Red Gate ]</div>
    <div class="rg-head"><div><div class="rg-name">${esc(type.name)}</div><div class="mist sm">Week of ${weekLabel}</div></div>${g.cleared?'':`<div class="num rg-timer">${dLeft}d ${hLeft}h</div>`}</div>
    <div class="rg-desc">${esc(type.desc)}</div>
    <div class="track rg-track"><div class="fill" style="width:${pct}%"></div></div>
    <div class="rg-nums"><span>${fmtGateNum(p.val,type.unit)} / ${fmtGateNum(p.target,type.unit)} ${esc(type.unit)}</span><span>${Math.round(pct)}%</span></div>
    ${p.blocker&&!g.cleared?`<div class="rg-blocker">${esc(p.blocker)}</div>`:''}
    ${action}
    <div class="rg-foot">${userData.redGatesCleared||0} cleared, gate streak ${calcGateStreak()}. Every S-Rank faces the same gate. It resets Monday.</div>`,'red-gate'+(g.cleared?' cleared':''));
}
async function claimRedGate(){
  const g=userData.redGate;if(!g||g.cleared)return;
  const p=getGateProgress(g);
  if(!p.done){toast('The gate still stands');return}
  g.cleared=true;g.clearedAt=Date.now();
  userData.redGatesCleared=(userData.redGatesCleared||0)+1;
  userData.shards=(userData.shards||0)+SHARD_REWARDS.redGate;
  const gained=addXP(RED_GATE_XP);
  queueFeedEvent('gate',{name:(RED_GATE_POOL.find(t=>t.id===g.type)||{}).name||''});
  await saveUser({redGate:g,redGatesCleared:userData.redGatesCleared,shards:userData.shards,xp:userData.xp,feedEvents:userData.feedEvents||[]});
  await saveLeaderboard();updateTopBar();
  const type=RED_GATE_POOL.find(t=>t.id===g.type)||{};
  showGateCleared(type,gained);
  const n=userData.redGatesCleared;
  if(n>=1)unlockAch('red_gate_1');if(n>=5)unlockAch('red_gate_5');if(n>=25)unlockAch('red_gate_25');
  if(calcGateStreak()>=4)unlockAch('red_gate_streak_4');
  if(currentPage==='missions')renderMissions();
}
function showGateCleared(type,gained,opts){
  opts=opts||{};
  let ov=$('gateCleared');
  if(!ov){ov=document.createElement('div');ov.id='gateCleared';ov.className='gate-cleared';document.body.appendChild(ov)}
  ov.classList.toggle('blue',!!opts.blue);
  ov.innerHTML=`<div class="gc-core"><div class="gc-sigil">${opts.blue?icon('gate',44):'⛩️'}</div><div class="gc-pre">${opts.blue?'Blue':'Red'} gate cleared</div>
    <div class="gc-name">${opts.blue?'':(type.icon||'')+' '}${esc(opts.blue?type.name||'':dayLabel(type.name||''))}</div>
    <div class="gc-rewards"><span>+${gained} XP</span><span>+${opts.shards||SHARD_REWARDS.redGate} shards</span></div>
    <div class="gc-count">Gate #${opts.count||userData.redGatesCleared}</div><div class="gc-tap">tap to continue</div></div>`;
  ov.onclick=()=>ov.classList.remove('show');
  requestAnimationFrame(()=>ov.classList.add('show'));
  try{if(navigator.vibrate)navigator.vibrate([90,40,90,40,200])}catch(e){}
}
// ═══════════ COSMETICS ═══════════
function getCos(){const c=userData.cosmetics||{};const out={owned:Array.isArray(c.owned)?c.owned:[]};COSMETIC_TYPES.forEach(t=>{out[t.id]=c[t.id]||''});return out}
function cosmeticLockReason(item){
  if(!item.lock)return '';
  if(item.lock==='S')return isSRank()?'':'S-RANK only';
  if(item.lock.gates){const n=userData.redGatesCleared||0;return n>=item.lock.gates?'':`Clear ${item.lock.gates} Red Gates (${n}/${item.lock.gates})`}
  return '';
}
function cosmeticOwned(item){
  if(item.lock&&item.lock.gates)return (userData.redGatesCleared||0)>=item.lock.gates; // earned, never sold
  return getCos().owned.includes(item.id);
}
// IDs can come from other users' leaderboard docs — only ever emit known catalog IDs
function frameClass(id){return COSMETICS.some(c=>c.type==='frame'&&c.id===id)?' cos-'+id:''}
function nameClass(id){return COSMETICS.some(c=>c.type==='name'&&c.id===id)?' cos-'+id:''}
async function saveCosmetics(c){userData.cosmetics=c;await saveUser({cosmetics:c});await saveLeaderboard()}
async function buyCosmetic(id){
  const item=COSMETICS.find(x=>x.id===id);if(!item)return;
  const lock=cosmeticLockReason(item);if(lock){toast(''+lock);return}
  if(cosmeticOwned(item)){toast('Already yours');return}
  if(getShards()<item.cost){toast(`Need ${item.cost-getShards()} more shards`);return}
  if(!confirm(`Buy ${item.name} for ${item.cost} shards?\n\n${item.desc}`))return;
  const c=getCos();c.owned=[...c.owned,id];c[item.type]=id; // auto-equip on purchase
  // Payment and ownership must land in the same write — the database rules check both together
  const newShards=getShards()-item.cost;
  await saveUser({shards:newShards,cosmetics:c});
  await saveLeaderboard();
  toast(`${item.name} equipped`);renderShop();
}
async function equipCosmetic(id){
  const item=COSMETICS.find(x=>x.id===id);if(!item||!cosmeticOwned(item))return;
  const c=getCos();c[item.type]=c[item.type]===id?'':id;
  await saveCosmetics(c);
  toast(c[item.type]?`${item.name} equipped`:`${item.name} removed`);renderShop();
}
function renderCosmeticsShop(){
  const c=getCos();
  let h=`<div class="shop-section">Cosmetics <span class="ss-sub">shown on your profile and the leaderboard</span></div>`;
  COSMETICS.forEach(item=>{
    const owned=cosmeticOwned(item),lock=cosmeticLockReason(item),equipped=c[item.type]===item.id;
    const preview=item.type==='frame'
      ?`<div class="cos-preview-frame${frameClass(item.id)}">${avatarHtml(userData.profilePic)}</div>`
      :`<div class="cos-preview-name${nameClass(item.id)}">@${esc(userData.username||'hunter')}</div>`;
    let btn;
    if(owned)btn=`<button class="cos-btn${equipped?' on':''}" onclick="equipCosmetic('${item.id}')">${equipped?'✓ Equipped':'Equip'}</button>`;
    else if(lock)btn=`<div class="si-lock">${lock}</div>`;
    else btn=`<button class="cos-btn buy" ${getShards()>=item.cost?'':'disabled'} onclick="buyCosmetic('${item.id}')">${SHARD_SVG} ${item.cost}</button>`;
    h+=`<div class="cos-item${lock&&!owned?' dim':''}">${preview}<div class="cos-info"><div class="cos-name">${item.name}${item.lock==='S'?' <span class="cos-tag">S</span>':''}${item.lock&&item.lock.gates?' <span class="cos-tag red">Earned</span>':''}</div><div class="cos-desc">${item.desc}</div></div>${btn}</div>`;
  });
  return h;
}
// ═══════════ FRIEND ACTIVITY FEED ═══════════
// Events are small structured records ({t,at,d}) — never HTML. Each user publishes
// their recent events on their leaderboard doc; friends read them from there.
const FEED_MAX=20;
function queueFeedEvent(t,d){
  if(!FEED_TYPES.includes(t))return;
  const ev={t,at:new Date().toISOString(),d:d||{}};
  userData.feedEvents=[...(userData.feedEvents||[]),ev].slice(-FEED_MAX);
}
async function pushFeedEvent(t,d){
  queueFeedEvent(t,d);
  try{await saveUser({feedEvents:userData.feedEvents});await saveLeaderboard()}catch(e){console.warn('feed save:',e)}
}
// What friends get to see. Respects "share activity" and "hide body stats" privacy settings.
function publicFeedEvents(){
  const priv=userData.privacy||{};
  if(priv.shareActivity===false)return[];
  const cutoff=Date.now()-14*86400000;
  return (userData.feedEvents||[]).filter(e=>new Date(e.at).getTime()>cutoff).map(e=>{
    if(priv.hideStats&&e.t==='workout'&&e.d&&e.d.pr)return{...e,d:{...e.d,pr:{ex:e.d.pr.ex,w:null}}};
    return e;
  });
}
// Largest improvement over the lifter's previous best, for the workout event
function findWorkoutPR(entry){
  const ts=new Date(entry.date).getTime();
  const base=prBaselineBefore(ts);let best=null;
  (entry.exercises||[]).forEach(ex=>{
    const k=normalizeExName(ex.name);if(base[k]===undefined)return;
    const maxW=Math.max(0,...(ex.sets||[]).filter(s=>(parseFloat(s.reps)||0)>0).map(s=>parseFloat(s.weight)||0));
    if(maxW>base[k]&&(!best||maxW-base[k]>best.gain))best={ex:String(ex.name).slice(0,40),w:maxW,gain:maxW-base[k]};
  });
  return best?{ex:best.ex,w:best.w}:null;
}
function timeAgo(t){const s=Math.max(0,(Date.now()-t)/1000);if(s<60)return'now';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';return Math.floor(s/86400)+'d'}
// Build the sentence for an event. Every value from another user is escaped or coerced.
function feedEventText(ev){
  const d=(ev&&ev.d)||{};
  switch(ev&&ev.t){
    case 'workout':
      if(d.pr)return{text:`set a best on <strong>${esc(d.pr.ex)}</strong>`,sub:[d.pr.w?num(d.pr.w)+' lb':'',d.title?esc(dayLabel(d.title)):''].filter(Boolean).join(', ')};
      return{text:`finished <strong>${esc(dayLabel(d.title||'a workout'))}</strong>`,sub:d.min?num(d.min)+' min':''};
    case 'cardio':return{text:`did <strong>${esc(d.type||'cardio')}</strong>`,sub:d.min?num(d.min)+' min':''};
    case 'rank':{const r=RANKS.find(x=>x.name===d.rank);if(!r)return null;return{text:`reached <strong class="${r.name==='S-RANK'?'gold':''}">${rankLabel(r.name)}</strong>`,sub:''}}
    case 'gate':return{text:`cleared the Red Gate, <strong>${esc(dayLabel(d.name||''))}</strong>`,sub:''};
    case 'bgate':return{text:`cleared the Blue Gate, <strong>${esc(d.name||'')}</strong>`,sub:''};
    case 'perfect':return{text:'closed out a <strong>perfect week</strong>',sub:''};
    case 'ach':{const a=ACHIEVEMENTS.find(x=>x.id===d.id);if(!a)return null;
      return a.secret?{text:'earned a <strong>secret badge</strong>',sub:''}:{text:`earned <strong>${esc(a.name)}</strong>`,sub:''}}
  }
  return null;
}
let feedCache={at:0,items:null,loading:null},feedExpanded=false;
async function loadFriendFeed(force){
  if(!force&&feedCache.items&&Date.now()-feedCache.at<180000)return feedCache.items;
  if(feedCache.loading)return feedCache.loading;
  const fids=(userData.friends||[]).filter(f=>safeId(f)).slice(0,40);
  feedCache.loading=(async()=>{
    const docs=await Promise.all(fids.map(fid=>db.collection('leaderboard').doc(fid).get().catch(()=>null)));
    const items=[],keep=[];const now=Date.now(),cutoff=now-7*86400000;
    docs.forEach((doc,i)=>{
      if(!doc||!doc.exists)return;
      const u=doc.data();keep.push({uid:fids[i],u});
      (Array.isArray(u.recent)?u.recent:[]).slice(-FEED_MAX).forEach(ev=>{
        const t=new Date(ev&&ev.at).getTime();
        if(!t||t<cutoff||t>now+3600000)return;
        if(feedEventText(ev))items.push({uid:fids[i],u,ev,t});
      });
    });
    items.sort((a,b)=>b.t-a.t);
    feedCache={at:Date.now(),items,docs:keep,loading:null};
    return items;
  })().catch(e=>{feedCache.loading=null;console.warn('feed load:',e);return[]});
  return feedCache.loading;
}
function renderFriendFeedHtml(items){
  const friends=(userData.friends||[]).length;
  let h=`<div class="sec-row"><span class="sec">Guild activity</span>${friends?`<button class="link" onclick="switchPage('guild');switchSubTab('guild','activity')">See all</button>`:''}</div>`;
  if(!friends)return h+`<div class="empty-note">Your friends' workouts, bests and Red Gates show up here. <button class="link" onclick="switchPage('guild');switchSubTab('guild','friends')">Add friends</button></div>`;
  if(items==null)return h+`<div class="empty-note">Loading…</div>`;
  if(!items.length)return h+`<div class="empty-note">Quiet week so far. Be the first to log something.</div>`;
  return h+`<div class="ff-list">${feedRowsHtml(items,3)}</div>`;
}
function paintFriendFeed(){const el=$('friendFeedCard');if(el)el.innerHTML=renderFriendFeedHtml(feedCache.items)}
function friendFeedSlot(){
  // Paint from cache immediately, refresh in the background if stale
  setTimeout(()=>{loadFriendFeed().then(paintFriendFeed)},0);
  return `<div class="friend-feed" id="friendFeedCard">${renderFriendFeedHtml(feedCache.items)}</div>`;
}
function refreshFriendFeed(){feedCache.at=0;feedCache.items=null;paintFriendFeed();loadFriendFeed(true).then(paintFriendFeed)}

// ═══════════ WEEK-AT-RISK BANNER ═══════════
// A nudge, never a guilt trip: silent when the week is already out of reach.
function renderWeekRisk(){
  const goal=getWeeklyGoal();
  const r=evaluateWeek(getMonday(new Date()).toISOString().slice(0,10),goal);
  const streak=calcWeeklyStreak();
  if(r.perfect)return `<div class="week-note done">Perfect week secured. Anything more is bonus.</div>`;
  if(r.failedSets>0||r.sessionsWithDone<r.lifts)return '';
  const daysLeft=7-((new Date().getDay()+6)%7);
  const needSessions=Math.max(0,r.target-r.sessions);
  const needLifts=Math.max(0,Math.min(3,r.target)-r.lifts);
  const need=Math.max(needSessions,needLifts);
  if(need===0||need>daysLeft)return '';
  const s=n=>n!==1?'s':'';
  const liftNote=needLifts>=need?(needLifts===1?' It has to be a lift.':` All ${needLifts} have to be lifts.`):needLifts>0?` ${needLifts} of them have to be lifts.`:'';
  const keep=streak>0?` keeps your ${streak}-week streak`:' for a perfect week';
  const level=need===daysLeft?'urgent':daysLeft-need<=1?'warn':'calm';
  const msg=need===daysLeft?`${need} session${s(need)} in ${daysLeft} day${s(daysLeft)}. Every day left counts.${liftNote}`
    :`${need===1?'One':need} more by Sunday${keep}.${liftNote}`;
  return `<div class="week-note ${level}" onclick="switchPage('train')">${msg}</div>`;
}

// ═══════════ WARDROBE (equip cosmetics) ═══════════
// Driven by COSMETIC_TYPES: adding a new type there + items in COSMETICS is all a
// future cosmetic needs to appear here.
function openWardrobe(tab){
  const m=$('wardrobeModal');if(!m)return;
  if(tab)wardrobeTab=tab;
  const tabs=[{id:'title',label:'Titles'},...COSMETIC_TYPES.map(t=>({id:t.id,label:t.id==='frame'?'Frames':t.id==='name'?'Name colors':t.label}))];
  if(!tabs.some(t=>t.id===wardrobeTab))wardrobeTab='title';
  const c=getCos();
  let h=`<h2>Wardrobe</h2><div class="sub-tabs wd-tabs" role="tablist">${tabs.map(t=>`<button class="stab${t.id===wardrobeTab?' active':''}" role="tab" aria-selected="${t.id===wardrobeTab}" onclick="openWardrobe('${t.id}')">${esc(t.label)}</button>`).join('')}</div>`;
  if(wardrobeTab==='title'){
    h+=titleRowsHtml();
  }else{
    const t=COSMETIC_TYPES.find(x=>x.id===wardrobeTab);
    const owned=COSMETICS.filter(x=>x.type===t.id&&cosmeticOwned(x));
    h+=`<p class="wd-sub">Equip what you've earned or bought. Friends see it on the leaderboard, their feed, and your profile card.</p><div class="wd-grid">`;
    h+=wardrobeTile(t.id,'',!c[t.id],null);
    owned.forEach(x=>{h+=wardrobeTile(t.id,x.id,c[t.id]===x.id,x)});
    h+=`</div>`;
    if(!owned.length)h+=`<div class="wd-empty">Nothing here yet. Find these in the Shop.</div>`;
    h+=`<button class="btn-s" style="width:100%;margin-top:14px" onclick="closeWardrobe();openProfileView('shop')">Browse the Shop</button>`;
  }
  h+=`<div class="m-actions" style="margin-top:12px"><button class="m-cancel" onclick="closeWardrobe()">Done</button></div>`;
  m.querySelector('.modal').innerHTML=h;
  m.classList.add('open');
}
function closeWardrobe(){const m=$('wardrobeModal');if(m)m.classList.remove('open')}
function wardrobeTile(type,id,on,item){
  let preview;
  if(type==='frame')preview=`<div class="cos-preview-frame${frameClass(id)}">${avatarHtml(userData.profilePic)}</div>`;
  else if(type==='name')preview=`<div class="cos-preview-name${nameClass(id)}">@${esc(userData.username||'hunter')}</div>`;
  else preview=`<div class="wd-generic">${id?'':'—'}</div>`;
  return `<button class="wd-tile${on?' on':''}" onclick="wardrobeEquip('${safeId(type)}','${safeId(id)}')">${preview}<div class="wd-name">${item?esc(item.name):'None'}</div>${on?'<div class="wd-on">Equipped</div>':''}</button>`;
}
async function wardrobeEquip(type,id){
  if(!COSMETIC_TYPES.some(t=>t.id===type))return;
  if(id){const item=COSMETICS.find(x=>x.id===id&&x.type===type);if(!item||!cosmeticOwned(item)){toast('You don\'t own that yet');return}}
  const c=getCos();
  if(c[type]===id){openWardrobe(type);return}
  c[type]=id;
  await saveCosmetics(c);
  openWardrobe(type);
  if(currentPage==='profile')renderProfile();
  toast(id?'Equipped':'Removed');
}

// ═══════════ INVITE-ONLY SIGNUP ═══════════
// Your friend code doubles as your invite code. The database rules refuse to create
// a new account's profile without a valid one, so this can't be skipped client-side.
function normalizeInvite(v){return String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)}
async function lookupInvite(code){
  if(code.length!==6)return null;
  try{const s=await db.collection('friendCodes').doc(code).get();return s.exists&&s.data().uid?s.data().uid:null}catch(e){return null}
}
function newUserDoc(extra){
  return Object.assign({xp:0,achievements:[],stats:{},prs:{},profilePic:'',class:'',subclass:'',programKey:'',program:[],friends:[],
    privacy:{hideName:false,hideStats:false},goal:'',experience:'',missionsCompleted:{},missionStreak:0,trialsCompleted:[],
    createdAt:firebase.firestore.FieldValue.serverTimestamp()},extra);
}
// After the new hunter has a username, send their inviter a friend request automatically
async function sendInviterFriendRequest(){
  const to=safeId(userData.invitedByUid);
  if(!to||to===U.uid||userData.inviteRequestSent||!userData.username)return;
  try{
    await db.collection('friendRequests').add({from:U.uid,to,fromUsername:userData.username,fromPic:safeImgSrc(userData.profilePic),status:'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    await saveUser({inviteRequestSent:true});
  }catch(e){console.warn('inviter request:',e)}
}
// Google sign-in for someone without an account yet → ask for an invite code
async function submitInviteCode(){
  const code=normalizeInvite($('inviteCodeInput').value);
  $('inviteError').textContent='';
  if(code.length!==6){$('inviteError').textContent='Invite codes are 6 characters';return}
  const inviterUid=await lookupInvite(code);
  if(!inviterUid){$('inviteError').textContent='That invite code isn\'t valid — double-check it with your friend';return}
  try{
    const fc=genFriendCode();
    const batch=db.batch();
    batch.set(db.collection('users').doc(U.uid),newUserDoc({name:U.displayName||'',username:'',email:U.email||'',friendCode:fc,profilePic:safeImgSrc(U.photoURL),invitedBy:code,invitedByUid:inviterUid}));
    batch.set(db.collection('friendCodes').doc(fc),{uid:U.uid});
    await batch.commit();
    await loadUserData();
    prevRankName=getEffectiveRank().name;
    showScreen('usernameScreen');
  }catch(e){console.error('[invite]',e);$('inviteError').textContent='Could not join: '+(e.code==='permission-denied'?'invite code rejected':e.message)}
}
function shareInvite(){
  const fc=userData.friendCode||'';if(!fc)return;
  const text=`Join me on LexenFitness. Sign up at https://lexen13.github.io/lexenfitness and use my invite code: ${fc}`;
  if(navigator.share){navigator.share({title:'LexenFitness invite',text}).catch(()=>{})}
  else if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>toast('Invite copied — paste it to your friend')).catch(()=>fallbackCopy(text))}
  else fallbackCopy(text);
}

// ═══════════ DEV: GRANT TO USER ═══════════
// Large one-off grants (XP, shards, trials) go through the dev account, which the
// database rules allow. Regular accounts are capped per write.
async function devGrantToUser(){
  if(!isDev)return;
  const un=(prompt('Grant to which username?')||'').trim().toLowerCase();if(!un)return;
  const snap=await db.collection('usernames').doc(un).get();
  if(!snap.exists){toast('No such user');return}
  const uid=snap.data().uid;
  const ud=(await db.collection('users').doc(uid).get()).data()||{};
  const xpAdd=parseInt(prompt(`@${un} has ${ud.xp||0} XP. XP to ADD (0 for none):`,'0'))||0;
  const shardAdd=parseInt(prompt(`@${un} has ${ud.shards||0} shards. Shards to ADD (0 for none):`,'0'))||0;
  const trialIn=(prompt(`Trials to mark complete (comma-separated: iron_gate, gauntlet, awakening). Current: [${(ud.trialsCompleted||[]).join(', ')}]`,'')||'');
  const trials=trialIn.split(',').map(s=>s.trim()).filter(t=>['iron_gate','gauntlet','awakening'].includes(t));
  const upd={};
  if(xpAdd)upd.xp=Math.max(0,(ud.xp||0)+xpAdd);
  if(shardAdd)upd.shards=Math.max(0,(ud.shards||0)+shardAdd);
  if(trials.length)upd.trialsCompleted=[...new Set([...(ud.trialsCompleted||[]),...trials])];
  if(!Object.keys(upd).length){toast('Nothing to grant');return}
  if(!confirm(`Apply to @${un}?\n\n${JSON.stringify(upd,null,1)}\n\nTheir leaderboard updates on their next app open.`))return;
  await db.collection('users').doc(uid).update(upd);
  toast(`Granted to @${un}`);
}
// ═══════════ ASSIGNED PLANS (force-accept) ═══════════
// A pushed plan cannot be dismissed — the only way out of the modal is Accept.
// This prevents someone tapping away and silently never receiving it.
function checkAssignedPlan(){
  const uname=userData.username;
  if(!uname)return;
  const planId=ASSIGNED_PLANS[uname];
  if(!planId)return;
  if((userData.acceptedPlans||[]).includes(planId))return;
  const plan=PLAN_LIBRARY[planId];
  if(!plan)return;
  showPlanOffer(planId,plan);
}
function showPlanOffer(planId,plan){
  const modal=$('planOfferModal');if(!modal)return;
  let h=`<div class="po-sigil"></div>
    <h2 style="text-align:center;margin-bottom:.2rem">The system has a new plan for you</h2>
    <p style="text-align:center;color:var(--accent2);font-family:var(--font-mono);font-size:.72rem;letter-spacing:1px;margin-bottom:.7rem">${esc(plan.name)}</p>
    <p style="color:var(--muted);font-size:.76rem;line-height:1.5;margin-bottom:.8rem">${esc(plan.desc)}</p>`;
  plan.days.forEach(d=>{
    h+=`<div class="po-day"><div class="po-day-title">${esc(d.title)}${d.subtitle?` <span class="po-day-sub">${esc(d.subtitle)}</span>`:''}</div>`;
    d.exercises.forEach(ex=>{h+=`<div class="po-ex">${esc(ex.name)} <span class="po-ex-sr">${ex.sets}×${esc(ex.reps)}</span></div>`});
    h+=`</div>`;
  });
  h+=`<p style="color:var(--gold);font-size:.68rem;line-height:1.45;margin:.7rem 0 .5rem">This will replace your current workout days. Your logged history is kept — nothing you've already recorded is deleted.</p>
    <button class="m-save-btn" style="width:100%" onclick="acceptAssignedPlan('${planId}')">Accept the plan</button>`;
  modal.querySelector('.modal').innerHTML=h;
  modal.classList.add('open');
  modal.dataset.locked='1'; // no backdrop dismiss
}
async function acceptAssignedPlan(planId){
  const plan=PLAN_LIBRARY[planId];if(!plan)return;
  userData.program=JSON.parse(JSON.stringify(plan.days));
  userData.acceptedPlans=[...(userData.acceptedPlans||[]),planId];
  await saveUser({program:userData.program,acceptedPlans:userData.acceptedPlans});
  const modal=$('planOfferModal');
  if(modal){modal.classList.remove('open');modal.dataset.locked=''}
  toast('Plan accepted. Your new days are in Train.');
  currentDay=null;workoutView='menu';
  try{buildWorkout()}catch(e){console.warn(e)}
}
// One-time starting shard grant for users who existed before the economy launched
async function grantStartingShards(){
  if(userData.startingShardsGranted)return;
  userData.shards=(userData.shards||0)+STARTING_SHARDS;
  userData.startingShardsGranted=true;
  await saveUser({shards:userData.shards,startingShardsGranted:true});
  setTimeout(()=>toast(`+${STARTING_SHARDS} SHARDS — welcome gift from The System`),1800);
}
// ═══════════ RANK TRIALS ═══════════
// ═══════════ THE AWAKENING · PHASE II ═══════════
// A 14-day final exam, unlocked only after Phase I. Retryable — failing costs an
// attempt, never your Phase I progress.
function awakeningPhase1Done(){
  const t=RANK_TRIALS.awakening;
  const p=getTrialProgress(t);
  // First three tasks are Phase I
  return t.tasks.slice(0,3).every((task,i)=>p[i]>=task.target);
}
// Snapshot the user's current best weight per exercise, so the PR must beat
// what they could already do BEFORE the exam started.
function snapshotPrBaseline(){
  const base={};
  getLiftLogs().forEach(e=>{
    (e.exercises||[]).forEach(ex=>{
      const k=normalizeExName(ex.name);if(!k)return;
      (ex.sets||[]).forEach(s=>{
        const w=parseFloat(s.weight)||0;
        if(w>0&&(!base[k]||w>base[k]))base[k]=w;
      });
    });
  });
  return base;
}
async function startAwakeningExam(){
  if(!awakeningPhase1Done()){toast('Finish Phase I first');return}
  const ex=userData.awakeningExam;
  if(ex&&ex.status==='active'){toast('Your exam is already running');return}
  const attempt=(userData.awakeningAttempts||0)+1;
  const msg=`BEGIN THE AWAKENING?\n\nYou have 14 days to:\n• Hit your weekly training goal both weeks\n• Log food every single day\n• Beat one of your own logged lifts\n\nThe clock starts the moment you accept. If you fall short, your Phase I progress is untouched — you simply try again.\n\nAttempt #${attempt}. Begin?`;
  if(!confirm(msg))return;
  userData.awakeningExam={
    status:'active',
    startedAt:Date.now(),
    attempt,
    prBaseline:snapshotPrBaseline()
  };
  userData.awakeningAttempts=attempt;
  await saveUser({awakeningExam:userData.awakeningExam,awakeningAttempts:attempt});
  toast('THE AWAKENING HAS BEGUN — 14 days');
  renderMissions();
}
// Live evaluation of the running exam
function getAwakeningExamStatus(){
  const ex=userData.awakeningExam;
  if(!ex||ex.status!=='active')return null;
  const start=ex.startedAt;
  const now=Date.now();
  const elapsedDays=Math.floor((now-start)/86400000);
  const daysLeft=Math.max(0,AWAKENING_EXAM.days-elapsedDays);
  const goal=getWeeklyGoal();
  const endOfWindow=start+AWAKENING_EXAM.days*86400000;
  // 1. Two 7-day blocks from the start date (not calendar weeks)
  const blockCount=[0,0];
  getTrainingLogs().forEach(e=>{
    const t=new Date(e.date).getTime();
    if(t<start||t>=endOfWindow)return;
    const block=Math.floor((t-start)/(7*86400000));
    if(block===0||block===1)blockCount[block]++;
  });
  const week1=blockCount[0],week2=blockCount[1];
  // 2. Food logged every day so far
  let foodDays=0,daysSoFar=Math.min(AWAKENING_EXAM.days,elapsedDays+1);
  for(let i=0;i<daysSoFar;i++){
    const d=new Date(start+i*86400000);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const fl=(userData.foodLog||{})[key];
    if(fl&&fl.meals&&Object.values(fl.meals).some(m=>Array.isArray(m)&&m.length))foodDays++;
  }
  const foodMissed=daysSoFar-foodDays;
  // 3. Any lift during the window that beat the pre-exam baseline
  let prHit=null;
  const base=ex.prBaseline||{};
  getLiftLogs().forEach(e=>{
    const t=new Date(e.date).getTime();
    if(t<start||t>=endOfWindow)return;
    (e.exercises||[]).forEach(exr=>{
      const k=normalizeExName(exr.name);
      (exr.sets||[]).forEach(s=>{
        const w=parseFloat(s.weight)||0;
        if(w>0&&base[k]!==undefined&&w>base[k]&&(!prHit||w-base[k]>prHit.gain)){
          prHit={name:exr.name,weight:w,prev:base[k],gain:w-base[k]};
        }
      });
    });
  });
  const expired=elapsedDays>=AWAKENING_EXAM.days;
  const weeksOk=week1>=goal&&week2>=goal;
  const foodOk=foodMissed===0&&daysSoFar>=1;
  const prOk=!!prHit;
  return {ex,daysLeft,elapsedDays,expired,goal,week1,week2,weeksOk,foodDays,foodMissed,foodOk,prHit,prOk,
    passed:weeksOk&&foodOk&&prOk&&expired,
    onTrack:foodOk&&(elapsedDays<7||week1>=goal)};
}
// Called on load — closes out an expired exam as pass or fail
async function checkAwakeningExam(){
  const st=getAwakeningExamStatus();
  if(!st||!st.expired)return;
  const ex=userData.awakeningExam;
  const allMet=st.weeksOk&&st.foodOk&&st.prOk;
  if(allMet){
    ex.status='passed';
    userData.awakeningExamPassed=true;
    userData.awakeningExam=ex;
    await saveUser({awakeningExam:ex,awakeningExamPassed:true});
    setTimeout(()=>{
      alert('THE AWAKENING IS COMPLETE.\n\nYou hit your goal both weeks, logged every day, and broke your own record.\n\nClaim S-RANK from the trial card.');
      renderMissions();
    },1200);
  }else{
    ex.status='failed';
    const reasons=[];
    if(!st.weeksOk)reasons.push(`training goal (${st.week1} and ${st.week2} sessions vs ${st.goal} needed)`);
    if(!st.foodOk)reasons.push(`food logging (${st.foodMissed} day${st.foodMissed!==1?'s':''} missed)`);
    if(!st.prOk)reasons.push('no lift beat your previous best');
    ex.failReasons=reasons;
    userData.awakeningExam=ex;
    await saveUser({awakeningExam:ex});
    setTimeout(()=>{
      alert(`The Awakening ends — attempt #${ex.attempt} fell short.\n\nWhat was missing:\n• ${reasons.join('\n• ')}\n\nYour Phase I progress is untouched. Rest, then begin again when you're ready.`);
      renderMissions();
    },1200);
  }
}
// Exam card rendered inside the trial banner
function renderAwakeningExam(){
  const st=getAwakeningExamStatus();
  const ex=userData.awakeningExam;
  const attempts=userData.awakeningAttempts||0;
  if(userData.awakeningExamPassed){
    return `<div class="exam-card passed"><div class="exam-title">Phase II complete</div><div class="exam-sub">The Awakening has been passed. Claim your rank.</div></div>`;
  }
  if(!st){
    if(!awakeningPhase1Done()){
      return `<div class="exam-card locked"><div class="exam-title">Phase II — the awakening</div><div class="exam-sub">A 14-day final exam. Unlocks when Phase I is complete.</div></div>`;
    }
    const failedNote=ex&&ex.status==='failed'?`<div class="exam-fail">Attempt #${ex.attempt} fell short: ${(ex.failReasons||[]).join(' · ')}</div>`:'';
    return `<div class="exam-card ready"><div class="exam-title">Phase II unlocked</div>
      <div class="exam-sub">14 days. Hit your weekly goal twice, log food every day, and beat one of your own lifts.</div>
      ${failedNote}
      <button class="exam-start" onclick="startAwakeningExam()">BEGIN THE AWAKENING${attempts?` · ATTEMPT #${attempts+1}`:''}</button></div>`;
  }
  // Active exam
  const row=(ok,label,detail)=>`<div class="exam-req ${ok?'ok':''}"><span class="er-mark">${ok?'':'○'}</span><span class="er-label">${label}</span><span class="er-detail">${detail}</span></div>`;
  return `<div class="exam-card active">
    <div class="exam-title">The awakening · active</div>
    <div class="exam-countdown">${st.daysLeft} day${st.daysLeft!==1?'s':''} remaining</div>
    ${row(st.week1>=st.goal&&st.week2>=st.goal,'Weekly goal, both weeks',`${st.week1} / ${st.goal} · ${st.week2} / ${st.goal}`)}
    ${row(st.foodOk,'Food logged every day',st.foodMissed?`${st.foodMissed} missed`:`${st.foodDays} day${st.foodDays!==1?'s':''} clean`)}
    ${row(st.prOk,'Beat one of your lifts',st.prHit?`${esc(st.prHit.name)} ${st.prHit.prev}→${st.prHit.weight}`:'not yet')}
    <div class="exam-note">Attempt #${st.ex.attempt} · Phase I progress is safe no matter how this ends.</div>
  </div>`;
}
function getAvailableTrial(){for(let i=RANKS.length-1;i>=0;i--){if(userData.xp>=RANKS[i].min&&!RANKS[i].auto&&RANKS[i].trial&&!userData.trialsCompleted.includes(RANKS[i].trial)){return{rank:RANKS[i],trial:RANK_TRIALS[RANKS[i].trial]}}}return null}
function renderTrialBanner(info){
  const t=info.trial;const progress=getTrialProgress(t);
  let h=`<div class="trial-banner"><div class="trial-header"><div><div class="trial-name">${dayLabel(t.name)}</div><div class="trial-desc">${t.desc}</div></div></div>`;
  if(t.twoPhase)h+=`<div class="phase-label">Phase I: the long road <span class="pl-sub">Progress here is never lost</span></div>`;
  t.tasks.forEach((task,i)=>{
    const p=progress[i];const pct=Math.min(100,(p/task.target)*100);
    if(task.id==='awaken_final'){h+=renderAwakeningExam();return}
    const isPerfectWeeks=task.id==='perfect_weeks_3';
    h+=`<div class="trial-task${isPerfectWeeks?' has-detail':''}"${isPerfectWeeks?' onclick="togglePerfectWeeksDetail(this)"':''}>
      <div class="trial-task-desc">${task.desc}${isPerfectWeeks?' <span style="color:var(--accent);font-size:.62rem">▼ tap</span>':''}</div>
      <div class="trial-bar"><div class="trial-bar-fill" style="width:${pct}%"></div></div>
      <div class="trial-task-num">${p} / ${task.target}</div>
      ${isPerfectWeeks?'<div class="trial-detail" style="display:none">'+renderPerfectWeeksBreakdown()+'</div>':''}
    </div>`;
  });
  const allDone=t.tasks.every((task,i)=>progress[i]>=task.target);
  if(allDone)h+=`<button class="trial-claim" onclick="claimTrial('${info.rank.trial}')">CLAIM ${info.rank.name}</button>`;
  h+=`</div>`;return h;
}
function togglePerfectWeeksDetail(el){
  const d=el.querySelector('.trial-detail');if(!d)return;
  d.style.display=d.style.display==='none'?'':'none';
}
function renderPerfectWeeksBreakdown(){
  const goal=getWeeklyGoal();
  const locked=userData.perfectWeeksLocked||{};
  const currentMon=getMonday(new Date()).toISOString().slice(0,10);
  // Find weeks with any data
  const weeks=new Set();
  getLiftLogs().forEach(e=>{
    const m=getMonday(new Date(e.date)).toISOString().slice(0,10);
    weeks.add(m);
  });
  // Also include weeks that are locked (but might have no data)
  Object.keys(locked).forEach(k=>weeks.add(k));
  const sorted=Array.from(weeks).sort((a,b)=>b.localeCompare(a)).slice(0,8);
  if(!sorted.length)return '<div style="color:var(--muted);font-size:.7rem;padding:8px 0">No lift sessions logged yet.</div>';
  let h=`<div style="font-size:.62rem;color:var(--muted);margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
    <div style="margin-bottom:4px;font-weight:700;color:var(--text)">Last 8 weeks · target: ${goal}/wk</div>`;
  sorted.forEach(wk=>{
    const date=new Date(wk+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const isCurrent=wk===currentMon;
    const isLocked=!isCurrent&&locked[wk]!==undefined;
    let status='';
    if(isLocked){
      status=locked[wk]
        ?'<span style="color:var(--green)">✓ Perfect </span>'
        :'<span style="color:var(--dim)">— locked</span>';
    }else{
      const r=evaluateWeek(wk,goal);
      if(r.perfect)status='<span style="color:var(--green)">✓ Perfect</span>';
      else{
        const color=r.sessions===0?'var(--dim)':r.sessions<r.target?'var(--gold)':'var(--red)';
        status=`<span style="color:${color}">${r.reason}</span>`;
      }
    }
    const tag=isCurrent?' <span style="color:var(--accent2)">(current)</span>':'';
    h+=`<div style="display:flex;justify-content:space-between;padding:2px 0">Week of ${date}${tag}: ${status}</div>`;
  });
  h+=`<div style="font-size:.58rem;color:var(--dim);margin-top:6px;font-style:italic">Past weeks are locked — they don't change when you adjust your goal</div>`;
  h+='</div>';
  return h;
}
function getTrialProgress(trial){return trial.tasks.map(task=>{switch(task.id){
  case 'perfect_weeks_3':return calcPerfectWeeks();case 'streak_14':case 'streak_30':return calcDayStreak();
  case 'log_pr':return Math.max(0,...getLiftLogs().flatMap(e=>Array.isArray(e.exercises)?e.exercises.flatMap(ex=>Array.isArray(ex.sets)?ex.sets.map(s=>parseInt(s.weight)||0):[]):[]));
  case 'missions_7':return userData.missionStreak;case 'workouts_50':return getLiftLogs().length;
  // ── v1.23.0 two-phase Awakening ──
  case 'sessions_100':return getTrainingLogs().length;
  case 'perfect_weeks_12':return calcEarnedPerfectWeeks();
  case 'mission_days_20':return calcAllMissionDays();
  case 'awaken_final':return (userData.trialsCompleted||[]).includes('awakening')?1:(userData.awakeningExamPassed?1:0);
  default:return 0}})}
// Perfect weeks EXCLUDING any that were bought with shards — S-Rank can't be purchased
function calcEarnedPerfectWeeks(){
  const locked=userData.perfectWeeksLocked||{};
  const bought=userData.boughtWeeks||[];
  const currentMon=getMonday(new Date()).toISOString().slice(0,10);
  let count=0;
  Object.keys(locked).forEach(k=>{if(k!==currentMon&&locked[k]&&!bought.includes(k))count++});
  if(evaluateWeek(currentMon,getWeeklyGoal()).perfect)count++;
  return count;
}
// Cumulative count of days where every daily mission was completed — the archive keeps
// days that cleanup has trimmed out of missionsCompleted
function dayAllMissionsDone(key){
  const ms=getDailyMissions(key,userData.class)||[];
  const comp=(userData.missionsCompleted||{})[key]||[];
  return ms.length>0&&ms.every(m=>comp.includes(m.id));
}
function calcAllMissionDays(){
  const days=new Set(userData.allMissionDays||[]);
  Object.keys(userData.missionsCompleted||{}).forEach(k=>{if(dayAllMissionsDone(k))days.add(k)});
  return days.size;
}
// ═══════════ PERFECT WEEKS ═══════════
// "Perfect" = at least max(weeklyTrainingGoal, 3) sessions in the week,
//   each session has at least one filled+done set, and every filled set is checked.
// Past weeks are locked into userData.perfectWeeksLocked once scored.
// Current week is calculated live.
function getWeeklyGoal(){return Math.max(3,Math.min(7,userData.weeklyTrainingGoal||4))}
function evaluateWeek(monIso,goal){
  // A session = lift, cardio activity, or ACTIVE rest (same definition as the weekly streak).
  // Guard: at least 3 of the sessions must be actual lifts, so rest/cardio can't carry a whole week.
  // Set-quality rules apply to lifts only: every filled set checked, every lift has ≥1 done set.
  const monStart=new Date(monIso+'T00:00:00').getTime();
  const monEnd=monStart+7*86400000;
  let lifts=0,otherSessions=0,failedSets=0,liftsWithDone=0;
  workoutLog.forEach(e=>{
    const t=new Date(e.date).getTime();
    if(t<monStart||t>=monEnd)return;
    if(e.isActivity||(e.isRest&&e.restType==='active')){otherSessions++;return}
    if(e.isRest)return; // full rest never counts as a session
    if(!Array.isArray(e.exercises))return;
    lifts++;
    let liftHasDone=false;
    e.exercises.forEach(ex=>{
      if(!Array.isArray(ex.sets))return;
      ex.sets.forEach(s=>{
        const hasData=s&&((s.weight&&String(s.weight).trim())||(s.reps&&String(s.reps).trim()));
        if(hasData){if(s.done)liftHasDone=true;else failedSets++}
      });
    });
    if(liftHasDone)liftsWithDone++;
  });
  const sessions=lifts+otherSessions;
  const target=Math.max(3,Math.min(7,goal||4));
  const perfect=sessions>=target&&lifts>=Math.min(3,target)&&liftsWithDone===lifts&&lifts>0&&failedSets===0;
  let reason='';
  if(perfect)reason='perfect';
  else if(sessions===0)reason='no sessions';
  else if(sessions<target)reason=`${sessions}/${target} sessions`;
  else if(lifts<Math.min(3,target))reason=`only ${lifts} lift${lifts!==1?'s':''} (need 3)`;
  else if(liftsWithDone<lifts)reason=`${lifts-liftsWithDone} blank session${lifts-liftsWithDone!==1?'s':''}`;
  else reason=`${failedSets} unchecked set${failedSets!==1?'s':''}`;
  return {sessions,lifts,failedSets,sessionsWithDone:liftsWithDone,perfect,reason,target};
}
function calcPerfectWeeks(){
  // Sum locked past weeks + live evaluate current week
  const locked=userData.perfectWeeksLocked||{};
  const currentMon=getMonday(new Date()).toISOString().slice(0,10);
  let count=0;
  Object.keys(locked).forEach(k=>{if(k!==currentMon&&locked[k])count++});
  // Current week — live calc
  const live=evaluateWeek(currentMon,getWeeklyGoal());
  if(live.perfect)count++;
  return count;
}
// Lock all past weeks in workoutLog using a given goal (used for first-time setup)
async function lockHistoricalWeeks(goal){
  const locked=userData.perfectWeeksLocked||{};
  const currentMon=getMonday(new Date()).toISOString().slice(0,10);
  // Find all distinct weeks we have data for
  const weeks=new Set();
  getLiftLogs().forEach(e=>{
    const m=getMonday(new Date(e.date)).toISOString().slice(0,10);
    if(m!==currentMon)weeks.add(m);
  });
  let changes=0;
  weeks.forEach(monIso=>{
    if(locked[monIso]!==undefined)return; // already locked, don't overwrite
    const r=evaluateWeek(monIso,goal);
    locked[monIso]=r.perfect;
    changes++;
  });
  if(changes>0){
    userData.perfectWeeksLocked=locked;
    await saveUser({perfectWeeksLocked:locked});
  }
  return changes;
}
// Lock last week if Monday rolled over (call on app load)
async function lockLastWeekIfNeeded(){
  const now=new Date();
  const currentMon=getMonday(now).toISOString().slice(0,10);
  const lastMon=new Date(getMonday(now).getTime()-7*86400000).toISOString().slice(0,10);
  const locked=userData.perfectWeeksLocked||{};
  if(locked[lastMon]!==undefined)return; // already locked
  // Only lock if there were any sessions in that week
  const r=evaluateWeek(lastMon,getWeeklyGoal());
  if(r.sessions===0)return; // no activity, don't bother locking
  locked[lastMon]=r.perfect;
  userData.perfectWeeksLocked=locked;
  if(r.perfect){userData.shards=(userData.shards||0)+SHARD_REWARDS.perfectWeek;queueFeedEvent('perfect',{})}
  try{await saveUser({perfectWeeksLocked:locked,shards:userData.shards||0,feedEvents:userData.feedEvents||[]});if(r.perfect)await saveLeaderboard()}catch(e){console.warn('lockLastWeek failed:',e)}
  if(r.perfect)toast(`+${SHARD_REWARDS.perfectWeek} shards — perfect week banked`);
}
// One-time migration (v1.14.1): weeks locked before the active-rest fix were scored
// without counting cardio/active-rest sessions. Re-check and upgrade false→true only.
async function migratePerfectWeekLocks(){
  if(userData.pwLockVersion===2)return;
  const locked=userData.perfectWeeksLocked;
  if(locked&&Object.keys(locked).length){
    const goal=getWeeklyGoal();
    let upgraded=0;
    Object.keys(locked).forEach(wk=>{
      if(locked[wk]===false&&evaluateWeek(wk,goal).perfect){locked[wk]=true;upgraded++}
    });
    if(upgraded>0)toast(`${upgraded} past week${upgraded!==1?'s':''} upgraded to PERFECT (rest-day fix)`);
  }
  userData.pwLockVersion=2;
  try{await saveUser({perfectWeeksLocked:locked||{},pwLockVersion:2})}catch(e){console.warn('pw migration failed:',e)}
}
async function claimTrial(trialId){
  if(userData.trialsCompleted.includes(trialId))return;
  // S-Rank cannot be claimed without actually passing Phase II
  if(trialId==='awakening'&&!userData.awakeningExamPassed){
    toast('Phase II must be passed before S-RANK can be claimed');
    return;
  }
  userData.trialsCompleted.push(trialId);
  const rank=RANKS.find(r=>r.trial===trialId);
  if(rank){if(rank.name==='B-RANK')unlockAch('rank_b');if(rank.name==='A-RANK')unlockAch('rank_a');if(rank.name==='S-RANK')unlockAch('rank_s')}
  // Trial bonus XP (no cap — this is the reward for breaking through)
  const bonus=TRIAL_BONUS[trialId]||0;
  if(bonus>0)userData.xp+=bonus;
  await saveUser({trialsCompleted:userData.trialsCompleted,xp:userData.xp});await saveLeaderboard();updateTopBar();checkRankUp();
  const trialName=rank?rank.name:'TRIAL';
  toast(bonus>0?`${trialName} ACHIEVED! +${bonus} XP BONUS`:`${trialName} ACHIEVED!`);
  switchPage('missions');
}

// TDEE/Nutrition functions moved to nutrition.js

// ═══════════ DEV TOOLS ═══════════
function renderDevTools(){
  if(!isDev)return'';
  const er=getEffectiveRank();const trial=getAvailableTrial();const cap=getXpCap();
  const capMsg=cap.softCap<1?'soft-cap 25% (trial pending)':'no cap';
  return`<div class="dev-panel">
    <div class="section-title" style="color:var(--red)">Dev tools</div>
    <div style="font-size:.68rem;color:var(--muted);margin:.3rem 0">Current: ${er.name} · XP: ${userData.xp} · ${capMsg} · Trials: [${userData.trialsCompleted.join(', ')||'none'}]</div>
    <div style="font-size:.68rem;color:${trial?'var(--gold)':'var(--green)'};margin-bottom:.4rem">${trial?'SOFT-CAP — '+trial.trial.name+' pending':'No gate blocking'}</div>
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
      <button class="dev-btn" style="color:var(--red)" onclick="devForceXP(parseInt(prompt('Force XP to:')||'0'))">Force XP </button>
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
      <button class="dev-btn" style="color:var(--sys)" onclick="devResetBlueGate()">Reopen Blue Gate</button>
      <button class="dev-btn" style="color:var(--gold)" onclick="devRestoreRecords()">Restore records</button>
    </div>
    <div class="dev-row">
      <button class="dev-btn" onclick="devResetTrials()">Reset Trials</button>
      <button class="dev-btn" style="color:var(--red)" onclick="devResetAll()">Full Reset</button>
    </div>
    <div class="dev-row" style="margin-top:.3rem;border-top:1px dashed var(--border);padding-top:.4rem">
      <button class="dev-btn" style="color:var(--green)" onclick="devPushProgram()">Push Program to User</button>
      <button class="dev-btn" style="color:var(--gold)" onclick="devGrantToUser()">Grant XP/Shards/Trials to User</button>
    </div>
    <div class="dev-row" style="margin-top:.3rem;border-top:1px dashed var(--border);padding-top:.4rem">
      <button class="dev-btn" style="color:var(--gold)" onclick="devPromoteTrainer()">Promote User to Trainer</button>
      <button class="dev-btn" style="color:var(--red)" onclick="devDemoteTrainer()">Demote Trainer</button>
      <button class="dev-btn" style="color:var(--cyan)" onclick="devRepairTrainerCode()">Repair Trainer Code</button>
    </div>
  </div>`;
}
async function devSetXP(xp){
  // No hard cap anymore — dev can set any value directly
  userData.xp=xp;
  await saveUser({xp:userData.xp});await saveLeaderboard();updateTopBar();checkRankUp();renderProfile();
  toast(`DEV: XP set to ${userData.xp}`);
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
async function devPromoteTrainer(){
  const username=prompt('Username to promote to Trainer (lowercase):');if(!username)return;
  const un=username.toLowerCase().trim();
  const snap=await db.collection('usernames').doc(un).get();
  if(!snap.exists){toast('Username not found: @'+un);return}
  const uid=snap.data().uid;
  try{
    // Check if they already have a code
    const userDoc=await db.collection('users').doc(uid).get();
    const existing=userDoc.data()?.trainerCode;
    let code;
    if(existing){
      code=existing;
      await db.collection('users').doc(uid).update({role:'trainer'});
    }else{
      code=genFriendCode();
      await db.collection('users').doc(uid).update({role:'trainer',trainerCode:code,clients:[]});
      await db.collection('trainerCodes').doc(code).set({uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    }
    toast('@'+un+' is now a Trainer. Code: '+code);
    alert('@'+un+' promoted to Trainer.\n\nTheir Trainer Code: '+code+'\n\nShare this with them so they can give it to their clients.\n\n(If they\'re already logged in, they need to refresh the app to see the Trainer tab.)');
  }catch(e){
    console.error('Promote error:',e);
    toast('Failed: '+e.message);
    alert('Promotion failed: '+e.message+'\n\nCheck that Firestore rules are published with the trainerCodes collection.');
  }
}
async function devDemoteTrainer(){
  const username=prompt('Username to demote (remove trainer status):');if(!username)return;
  const un=username.toLowerCase().trim();
  if(!confirm('Demote @'+un+' from Trainer? This will remove their code but leave clients intact.'))return;
  const snap=await db.collection('usernames').doc(un).get();
  if(!snap.exists){toast('Username not found: @'+un);return}
  const uid=snap.data().uid;
  const userDoc=await db.collection('users').doc(uid).get();
  const oldCode=userDoc.data()?.trainerCode;
  await db.collection('users').doc(uid).update({role:firebase.firestore.FieldValue.delete(),trainerCode:firebase.firestore.FieldValue.delete()});
  if(oldCode){try{await db.collection('trainerCodes').doc(oldCode).delete()}catch(e){}}
  toast('@'+un+' demoted');
}
async function devRepairTrainerCode(){
  const username=prompt('Username whose trainer code needs repair:');if(!username)return;
  const un=username.toLowerCase().trim();
  const snap=await db.collection('usernames').doc(un).get();
  if(!snap.exists){toast('Username not found: @'+un);return}
  const uid=snap.data().uid;
  try{
    const userDoc=await db.collection('users').doc(uid).get();
    const data=userDoc.data();
    if(data?.role!=='trainer'){
      if(!confirm('@'+un+' is not a trainer. Promote them and generate a fresh code?'))return;
    }
    // Generate fresh code
    const code=genFriendCode();
    await db.collection('users').doc(uid).update({role:'trainer',trainerCode:code,clients:data?.clients||[]});
    await db.collection('trainerCodes').doc(code).set({uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    // Delete old code if it existed
    if(data?.trainerCode&&data.trainerCode!==code){try{await db.collection('trainerCodes').doc(data.trainerCode).delete()}catch(e){}}
    toast('Repaired! New code: '+code);
    alert('@'+un+'\'s trainer code repaired.\n\nNew Code: '+code+'\n\nOld code (if any) invalidated.');
  }catch(e){console.error(e);toast('Repair failed: '+e.message)}
}

// ═══════════ WORKOUT ═══════════
function buildWorkout(){
  if(sessionActive)return;
  const prog=userData.program||[];
  const wa=$('workoutActions');if(wa)wa.style.display='none';
  if(!prog.length){
    $('dayTabs').innerHTML='';
    $('dayContent').innerHTML=`<div class="empty-note">No workouts in your program yet.</div>
      <button class="btn-p" onclick="addWorkoutDay()">${icon('plus',16)} Create your first workout</button>${otherLogsHtml()}`;
    return;
  }
  if(!prog.find(d=>d.id===currentDay))currentDay=(nextProgramDay()||prog[0]).id;
  if(workoutView==='log')renderWorkoutDay();else renderTrainOverview();
}
function renderWorkoutMenu(){workoutView='day';buildWorkout()}
function openWorkoutDay(dayId){currentDay=dayId;workoutView='day';buildWorkout()}
function backToWorkoutMenu(){captureInputs();pendingBackdateISO=null;workoutView='day';buildWorkout()}
function renderWorkoutDay(){
  // Log mode: all inputs, no timer
  $('dayTabs').innerHTML='';
  renderDayFull();
  const wa=$('workoutActions');if(wa)wa.style.display='';
  updateLogBtn();
}
async function addWorkoutDay(){
  const prog=userData.program||[];
  const num=prog.length+1;
  const title=prompt('Workout name, like Push or Upper A:','Day '+num);
  if(!title)return;
  const sub=prompt('Subtitle (e.g. "Monday — Chest & Tris"):','');
  captureInputs();
  prog.push({id:'day'+Date.now(),title:title.trim(),subtitle:sub||'',exercises:[]});
  await saveUser({program:prog});
  currentDay=prog[prog.length-1].id;
  workoutView='day'; // Jump into the new day so user can add exercises
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
function openWorkoutSettings(){
  const prog=userData.program||[];
  const day=prog.find(d=>d.id===currentDay);
  if(!day){toast('Pick a day first!');return}
  $('workoutSettingsDayTitle').textContent=day.title;
  $('wsNotesLabel').textContent=(day.notes?'Edit':'Add')+' Day Notes';
  $('workoutSettingsModal').classList.add('open');
}
function closeWorkoutSettings(){$('workoutSettingsModal').classList.remove('open')}

// ── Reorder Workouts ──
function openReorderWorkouts(){
  const modal=$('reorderWorkoutsModal');if(!modal)return;
  renderReorderWorkouts();
  modal.classList.add('open');
}
function renderReorderWorkouts(){
  const modal=$('reorderWorkoutsModal');
  const prog=userData.program||[];
  let h=`<h2>↕️ Reorder Workouts</h2>
    <p style="color:var(--muted);font-size:.74rem;line-height:1.4;margin-bottom:.7rem">Tap arrows to move workouts up or down in your program.</p>`;
  if(!prog.length){
    h+=`<p style="color:var(--muted);font-size:.78rem;padding:1rem 0">No workouts to reorder.</p>`;
  }else{
    h+=`<div class="reorder-list">`;
    prog.forEach((d,i)=>{
      const exCount=(d.exercises||[]).length;
      h+=`<div class="reorder-item">
        <div class="reorder-pos">${i+1}</div>
        <div class="reorder-info">
          <div class="reorder-name">${esc(d.title)}</div>
          <div class="reorder-meta">${exCount} exercise${exCount!==1?'s':''}</div>
        </div>
        <div class="reorder-arrows">
          <button class="reorder-arrow" onclick="moveWorkoutDay(${i},-1)" ${i===0?'disabled':''}>▲</button>
          <button class="reorder-arrow" onclick="moveWorkoutDay(${i},1)" ${i===prog.length-1?'disabled':''}>▼</button>
        </div>
      </div>`;
    });
    h+=`</div>`;
  }
  h+=`<div class="m-actions" style="margin-top:.8rem"><button class="m-cancel" onclick="closeReorderWorkouts()">Done</button></div>`;
  modal.querySelector('.modal').innerHTML=h;
}
function closeReorderWorkouts(){$('reorderWorkoutsModal').classList.remove('open');buildWorkout()}
async function moveWorkoutDay(idx,delta){
  const prog=userData.program||[];
  const newIdx=idx+delta;
  if(newIdx<0||newIdx>=prog.length)return;
  const item=prog.splice(idx,1)[0];
  prog.splice(newIdx,0,item);
  await saveUser({program:prog});
  renderReorderWorkouts();
}
async function renameWorkoutDay(){
  const prog=userData.program||[];
  const day=prog.find(d=>d.id===currentDay);if(!day)return;
  const title=prompt('New day name:',day.title);if(!title)return;
  const sub=prompt('New subtitle:',day.subtitle);
  day.title=title.trim();day.subtitle=sub||day.subtitle;
  await saveUser({program:prog});
  buildWorkout();toast('Day renamed!');
}
async function editDayNotes(){
  const prog=userData.program||[];const day=prog.find(d=>d.id===currentDay);if(!day)return;
  const notes=prompt('Day notes (rest times, warm-up reminders, etc.):',day.notes||'');
  if(notes===null)return; // cancelled
  day.notes=notes.trim();
  await saveUser({program:prog});
  renderDay();toast(notes?'Notes saved!':'Notes cleared.');
}
function switchDay(id){currentDay=id;buildWorkout()}
function renderDay(){if(sessionActive||workoutView==='log')return renderDayFull();return renderTrainOverview()}

// ═══════════ EXERCISE SWAP ═══════════
// Equipment taken? Swap to a same-pattern alternative for today, or permanently.
let swapTarget=null;
function openSwapModal(di,ei){
  const day=userData.program[di];if(!day)return;
  const ex=day.exercises[ei];if(!ex)return;
  swapTarget={di,ei};
  const swapKey=day.id+'_e'+ei+'_swap';
  const current=savedInputs[swapKey]||ex.name;
  const groupId=getExerciseGroup(ex.name)||getExerciseGroup(current);
  const modal=$('swapModal');if(!modal)return;
  let h=`<h2>Swap exercise</h2>
    <p style="color:var(--muted);font-size:.74rem;line-height:1.5;margin-bottom:.6rem">Equipment taken? Pick a movement that trains the same pattern. Your sets, reps and history carry over.</p>
    <div class="swap-current">Currently: <strong>${esc(current)}</strong></div>`;
  if(!groupId){
    h+=`<p style="color:var(--gold);font-size:.72rem;line-height:1.5;margin:.6rem 0">No close matches recognized for this exercise. You can type a replacement instead.</p>`;
  }else{
    const g=EXERCISE_GROUPS[groupId];
    h+=`<div class="swap-group-label">${esc(g.label)} variations, same movement pattern</div><div class="swap-list">`;
    g.items.forEach(alt=>{
      const isCur=normalizeExName(alt)===normalizeExName(current);
      h+=`<button class="swap-opt${isCur?' current':''}" ${isCur?'disabled':''} onclick="applySwap('${esc(alt).replace(/'/g,"\\'")}',false)">${esc(alt)}${isCur?' <span style="color:var(--dim);font-size:.6rem">(current)</span>':''}</button>`;
    });
    h+=`</div>`;
  }
  h+=`<div class="m-field" style="margin-top:.6rem"><label>Or type your own</label><input type="text" id="swapCustom" placeholder="e.g. Landmine Press" maxlength="60"></div>
    <button class="m-save-btn" style="width:100%;margin-top:.4rem" onclick="applyCustomSwap(false)">⇆ Swap for today</button>
    <button class="edit-stats-btn" style="width:100%;margin-top:.4rem" onclick="applyCustomSwap(true)">Replace permanently in my plan</button>
    ${savedInputs[swapKey]?`<button class="edit-stats-btn" style="width:100%;margin-top:.4rem;color:var(--gold);border-color:var(--gold)" onclick="clearSwap()">↩ Revert to ${esc(ex.name)}</button>`:''}
    <div class="m-actions" style="margin-top:.5rem"><button class="m-cancel" onclick="closeSwapModal()">Cancel</button></div>`;
  modal.querySelector('.modal').innerHTML=h;
  modal.classList.add('open');
}
function closeSwapModal(){$('swapModal').classList.remove('open');swapTarget=null}
async function applySwap(name,permanent){
  if(!swapTarget||!name)return;
  const {di,ei}=swapTarget;
  const day=userData.program[di];
  captureInputs();
  if(permanent){
    day.exercises[ei].name=name;
    delete savedInputs[day.id+'_e'+ei+'_swap'];
    await saveUser({program:userData.program});
    toast(`${name} is now part of your plan`);
  }else{
    savedInputs[day.id+'_e'+ei+'_swap']=name;
    try{await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs})}catch(e){console.warn(e)}
    toast(`⇆ Swapped to ${name} for today`);
  }
  if(sessionActive)persistSession();
  closeSwapModal();renderDay();
}
function applyCustomSwap(permanent){
  const el=$('swapCustom');
  const v=el&&el.value.trim();
  if(!v){toast('Type a replacement first, or pick one above');return}
  applySwap(v,permanent);
}
async function clearSwap(){
  if(!swapTarget)return;
  const {di,ei}=swapTarget;
  const day=userData.program[di];
  captureInputs();
  delete savedInputs[day.id+'_e'+ei+'_swap'];
  try{await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs})}catch(e){console.warn(e)}
  if(sessionActive)persistSession();
  closeSwapModal();renderDay();toast('↩ Reverted');
}
// ═══════════ SMART NOTES ═══════════
const INJURY_RX=/(pain|hurt|injur|buckl|tweak|pinch|click|pop|strain|sharp|numb|swell)/i;
function toggleExNote(noteId){
  const row=$('row_'+noteId);if(!row)return;
  row.classList.toggle('open');
  if(row.classList.contains('open')){const inp=$(noteId);if(inp)setTimeout(()=>inp.focus(),50)}
}
// Add or edit a note on an already-logged entry (from the Logs tab)
async function editLogNote(id){
  const entry=workoutLog.find(e=>e._id===id);
  if(!entry){toast('Entry not found — refresh and try again');return}
  const note=prompt('Note for this entry:',entry.notes||'');
  if(note===null)return; // cancelled
  entry.notes=note.trim();
  try{
    await db.collection('users').doc(U.uid).collection('log').doc(id).update({notes:entry.notes});
    if(INJURY_RX.test(entry.notes))toast('Noted. The System will flag this on that exercise\'s next session.');
    else toast(entry.notes?'Note saved':'Note removed');
    renderLog();
  }catch(e){console.error(e);toast('Save failed: '+e.message)}
}
// ═══════════ EXERCISE NAME MATCHING ═══════════
// Swapping or renaming an exercise shouldn't orphan its history. We normalize
// abbreviations and match loosely — but ONLY when the significant modifiers agree,
// so "Seated Leg Curl" never inherits "Standing Leg Curl"'s numbers.
const EX_ABBREV={'db':'dumbbell','bb':'barbell','ohp':'overhead press','rdl':'romanian deadlift','sldl':'stiff leg deadlift','bw':'bodyweight','ez':'ezbar','lat':'latpulldown','pull up':'pullup','pull-up':'pullup','chin up':'chinup','sq':'squat','dl':'deadlift','bp':'bench press'};
// Words that CHANGE the exercise — if these differ, it's a different movement
const EX_MODIFIERS=['seated','standing','incline','decline','flat','close','wide','narrow','single','one','reverse','front','back','overhead','lying','bent','preacher','hack','goblet','sumo','conventional','romanian','bulgarian','assisted','machine','cable','smith'];
function normalizeExName(name){
  let s=String(name||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  Object.keys(EX_ABBREV).forEach(k=>{s=s.replace(new RegExp('\\b'+k+'\\b','g'),EX_ABBREV[k])});
  return s;
}
function exModifierSet(norm){return EX_MODIFIERS.filter(m=>new RegExp('\\b'+m+'\\b').test(norm)).sort().join('|')}
function exTokens(norm){return norm.split(' ').filter(w=>w.length>2)}
// Returns the best fuzzy match key from a map, or null
function fuzzyMatchExercise(name,map){
  const norm=normalizeExName(name);
  if(map[norm])return {key:norm,exact:true};
  const mods=exModifierSet(norm);
  const toks=exTokens(norm);
  if(!toks.length)return null;
  let best=null,bestScore=0;
  Object.keys(map).forEach(k=>{
    // GUARDRAIL: modifiers must match exactly, or it's a different exercise
    if(exModifierSet(k)!==mods)return;
    const kt=exTokens(k);
    if(!kt.length)return;
    const shared=toks.filter(t=>kt.includes(t)).length;
    const score=shared/Math.max(toks.length,kt.length);
    if(score>bestScore){bestScore=score;best=k}
  });
  // Require strong overlap to avoid nonsense matches
  if(best&&bestScore>=0.6)return {key:best,exact:false,matchedName:map[best].displayName||best};
  return null;
}
// ═══════════ PROGRESSIVE OVERLOAD HINTS ═══════════
// Map of exercise name → most recent logged best set, built once per render
function buildLastSetMap(){
  const map={};
  for(const e of getLiftLogs()){ // newest-first
    if(!Array.isArray(e.exercises))continue;
    for(const ex of e.exercises){
      const key=normalizeExName(ex.name);
      if(!key)continue;
      if(!map[key])map[key]={displayName:ex.name};
      // Most recent best set (first found wins)
      if(!map[key].best){
        let best=null;
        (ex.sets||[]).forEach(s=>{
          const w=parseFloat(s.weight)||0,r=parseFloat(s.reps)||0;
          if(w>0&&r>0&&(!best||w>best.w||(w===best.w&&r>best.r)))best={w,r};
        });
        if(best)map[key].best={...best,date:e.date};
      }
      // Most recent note for this exercise (may live on a different entry than the best set)
      if(!map[key].note&&ex.note&&String(ex.note).trim()){
        map[key].note=String(ex.note).trim();map[key].noteDate=e.date;
      }
    }
  }
  return map;
}
function overloadHint(ex,lastMap){
  if(ex.isTime)return '';
  const match=fuzzyMatchExercise(ex.name,lastMap);
  if(!match)return '';
  const rec=lastMap[match.key];
  if(!rec)return '';
  const via=match.exact?'':` <span class="hint-via">(matched “${esc(rec.displayName||match.key)}”)</span>`;
  let h='';
  const last=rec.best;
  if(last){
    const m=String(ex.reps||'').match(/(\d+)\s*-\s*(\d+)/);
    const upper=m?parseInt(m[2]):parseInt(ex.reps)||0;
    const ago=Math.round((Date.now()-new Date(last.date).getTime())/86400000);
    const agoTxt=ago<=0?'today':ago===1?'yesterday':ago+' days ago';
    if(upper&&last.r>=upper){
      h+=`<div class="ex-hint up">Last ${last.w} lb × ${last.r}, ${agoTxt}. Rep range topped, try <strong>${last.w+5} lb</strong>.${via}</div>`;
    }else{
      h+=`<div class="ex-hint">Last ${last.w} lb × ${last.r}, ${agoTxt}. Match it, beat the reps.${via}</div>`;
    }
  }
  // Resurface the most recent note — injury notes come back LOUD
  if(rec.note){
    const nAgo=Math.round((Date.now()-new Date(rec.noteDate).getTime())/86400000);
    const nAgoTxt=nAgo<=0?'today':nAgo===1?'yesterday':nAgo+' days ago';
    if(INJURY_RX.test(rec.note)){
      h+=`<div class="ex-hint warn">Last time, ${nAgoTxt}: "${esc(rec.note)}". Ease in and warm up longer today.</div>`;
    }else{
      h+=`<div class="ex-hint note">Last time, ${nAgoTxt}: "${esc(rec.note)}"</div>`;
    }
  }
  return h;
}
// ═══════════ SESSION MODE ═══════════
// Session overlays the regular workout day view rather than rendering a separate page.
// Same input IDs, same captureInputs flow, no DOM duplication.
function startSession(){
  const prog=userData.program||[],day=prog.find(d=>d.id===currentDay);
  if(!day){toast('Pick a workout first');return}
  if(!day.exercises||!day.exercises.length){toast('Add an exercise first');return}
  if(!confirm(`Start ${dayLabel(day.title)}?\n\nThe timer starts now. You can pause it, and the time is logged with the workout.`))return;
  sessionActive=true;sessionStartMs=Date.now();sessionPausedMs=0;sessionPauseStartMs=null;sessionDayId=day.id;
  workoutView='day';
  enterSessionUI();
  persistSession();
}
// Shared UI entry — used by startSession and session restore
function enterSessionUI(){
  captureInputs();
  sesBlock=firstOpenBlock();
  $('dayTabs').innerHTML='';
  const ov=$('sessionOverlay');if(ov)ov.style.display='';
  const wa=$('workoutActions');if(wa)wa.style.display='none';
  const fb=$('sessionFinishBtn');if(fb)fb.style.display='';
  const th=$('trainHead');if(th)th.style.display='none';
  const tt=$('trainTabs');if(tt)tt.style.display='none';
  document.body.classList.add('in-session');
  const dc=$('dayContent');if(dc)dc.classList.add('in-session');
  renderDayFull();
  document.querySelectorAll('.rest-preset').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.sec)===restDefaultSec));
  clearInterval(sessionTimerHandle);
  sessionTimerHandle=setInterval(updateSessionClock,1000);
  updateSessionClock();
}
// ── Session persistence (survives app close / page reload) ──
const SESSION_LS_KEY='lexen_session';
function persistSession(){
  try{
    if(!sessionActive){localStorage.removeItem(SESSION_LS_KEY);return}
    captureInputs();
    localStorage.setItem(SESSION_LS_KEY,JSON.stringify({
      startMs:sessionStartMs,pausedMs:sessionPausedMs,pauseStartMs:sessionPauseStartMs,
      dayId:sessionDayId,restSec:restDefaultSec,inputs:savedInputs,savedAt:Date.now()
    }));
  }catch(e){console.warn('persistSession:',e)}
}
function clearPersistedSession(){try{localStorage.removeItem(SESSION_LS_KEY)}catch(e){}}
// Returns true if a session was restored (caller should navigate to Train)
function restoreSession(){
  try{
    const raw=localStorage.getItem(SESSION_LS_KEY);
    if(!raw)return false;
    const s=JSON.parse(raw);
    // Stale guard: sessions older than 12 hours are discarded
    if(!s.startMs||Date.now()-s.startMs>12*3600000){clearPersistedSession();return false}
    const day=(userData.program||[]).find(d=>d.id===s.dayId);
    if(!day){clearPersistedSession();return false}
    // Restore typed inputs first so renderDay re-fills them
    if(s.inputs&&typeof s.inputs==='object')Object.assign(savedInputs,s.inputs);
    sessionActive=true;sessionStartMs=s.startMs;sessionPausedMs=s.pausedMs||0;
    sessionPauseStartMs=s.pauseStartMs||null;sessionDayId=s.dayId;restDefaultSec=s.restSec||90;
    currentDay=s.dayId;workoutView='day';
    // Rebuild day tabs + workout view, then layer session UI on top
    renderWorkoutDay();
    enterSessionUI();
    if(sessionPauseStartMs)$('sessionPauseBtn').textContent='Resume';
    const elapsed=Math.floor((Date.now()-s.startMs-(s.pausedMs||0))/60000);
    toast(`Session resumed — ${elapsed} min on the clock`);
    return true;
  }catch(e){console.warn('restoreSession:',e);clearPersistedSession();return false}
}
function attachSessionCheckboxHandlers(){
  document.querySelectorAll('#dayContent input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change',onSessionSetCheck);
    cb.addEventListener('change',()=>{captureInputs();applySessionFocus()});
  });
}
function onSessionSetCheck(e){
  if(!sessionActive)return;
  const el=e.target;
  if(!el.checked||restDefaultSec<=0)return;
  // Superset rule: no rest between A and B — rest only after the last of the pair
  const m=(el.id||'').match(/_e(\d+)_s\d+_c$/);
  if(m){
    const day=(userData.program||[]).find(d=>d.id===currentDay);
    if(day&&day.exercises){
      const ei=parseInt(m[1]);
      const cur=day.exercises[ei];
      const next=day.exercises[ei+1];
      const curNum=cur&&cur.group?String(cur.group).replace(/[A-Za-z]/g,''):'';
      const nextNum=next&&next.group?String(next.group).replace(/[A-Za-z]/g,''):'';
      if(curNum&&curNum===nextNum){toast('⇄ Straight into the next movement — no rest');return}
    }
  }
  startRestTimer(restDefaultSec);
}
function pauseSession(){
  if(!sessionActive)return;
  if(sessionPauseStartMs){sessionPausedMs+=Date.now()-sessionPauseStartMs;sessionPauseStartMs=null;$('sessionPauseBtn').textContent='Pause'}
  else{sessionPauseStartMs=Date.now();$('sessionPauseBtn').textContent='Resume'}
  persistSession();
}
function updateSessionClock(){
  if(!sessionActive)return;
  let elapsed=Date.now()-sessionStartMs-sessionPausedMs;
  if(sessionPauseStartMs)elapsed-=(Date.now()-sessionPauseStartMs);
  const sec=Math.max(0,Math.floor(elapsed/1000));
  const mm=Math.floor(sec/60),ss=sec%60;
  const el=$('sessionClock');if(el)el.textContent=String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0');
  if(restEndMs){
    const remaining=Math.max(0,Math.floor((restEndMs-Date.now())/1000));
    const rm=Math.floor(remaining/60),rs=remaining%60;
    const rel=$('restClock');if(rel)rel.textContent=String(rm).padStart(2,'0')+':'+String(rs).padStart(2,'0');
    if(remaining===0){
      restEndMs=null;
      try{if(navigator.vibrate)navigator.vibrate([200,100,200])}catch(e){}
      const rrow=$('restRow');if(rrow)rrow.style.display='none';
      toast('Rest complete!');
    }
  }
}
function startRestTimer(seconds){
  restEndMs=Date.now()+seconds*1000;
  const rrow=$('restRow');if(rrow)rrow.style.display='';
  updateSessionClock();
}
function skipRest(){restEndMs=null;const rrow=$('restRow');if(rrow)rrow.style.display='none'}
function setRestDefault(sec){restDefaultSec=sec;document.querySelectorAll('.rest-preset').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.sec)===sec));persistSession()}
function exitSessionUI(){
  const ov=$('sessionOverlay');if(ov)ov.style.display='none';
  const fb=$('sessionFinishBtn');if(fb)fb.style.display='none';
  const th=$('trainHead');if(th)th.style.display='';
  const tt=$('trainTabs');if(tt)tt.style.display='';
  document.body.classList.remove('in-session');
  const dc=$('dayContent');if(dc)dc.classList.remove('in-session');
  const rrow=$('restRow');if(rrow)rrow.style.display='none';
}
async function finishSession(){
  if(!sessionActive)return;
  if(!confirm('Finish this session? Your workout will be logged.'))return;
  const sessionNote=prompt('Session note? (optional — how did it go?)','')||'';
  let elapsed=Date.now()-sessionStartMs-sessionPausedMs;
  if(sessionPauseStartMs)elapsed-=(Date.now()-sessionPauseStartMs);
  const durationSec=Math.max(0,Math.floor(elapsed/1000));
  clearInterval(sessionTimerHandle);sessionTimerHandle=null;
  // Save the session log — reads from the SAME #dayContent inputs
  await logWorkoutWithSession(sessionDayId,durationSec,sessionNote);
  sessionActive=false;clearPersistedSession();sessionStartMs=null;sessionPausedMs=0;sessionPauseStartMs=null;sessionDayId=null;restEndMs=null;
  exitSessionUI();
  buildWorkout();
}
function cancelSession(){
  if(!sessionActive)return;
  if(!confirm('Cancel this session without logging it? What you typed is kept, the timer is discarded.'))return;
  clearInterval(sessionTimerHandle);sessionTimerHandle=null;
  captureInputs();
  sessionActive=false;clearPersistedSession();sessionStartMs=null;sessionPausedMs=0;sessionPauseStartMs=null;sessionDayId=null;restEndMs=null;
  exitSessionUI();buildWorkout();
  toast('Session cancelled');
}

function openEdit(di,ei){editTarget={di,ei};const ex=userData.program[di].exercises[ei];$('editName').value=ex.name;$('editSets').value=ex.sets;$('editReps').value=ex.reps;$('editNotes').value=ex.notes||'';const g=$('editGroup');if(g)g.value=ex.group||'';$('editModal').classList.add('open')}
function closeEdit(){$('editModal').classList.remove('open')}
async function saveEdit(){if(!editTarget)return;captureInputs();const ex=userData.program[editTarget.di].exercises[editTarget.ei];ex.name=$('editName').value.trim()||ex.name;ex.sets=parseInt($('editSets').value)||ex.sets;ex.reps=$('editReps').value.trim()||ex.reps;ex.notes=$('editNotes').value.trim();const gEl=$('editGroup');if(gEl){const gv=gEl.value.trim().toUpperCase();if(gv)ex.group=gv;else delete ex.group}ex.isTime=/sec|s$/i.test(ex.reps);await saveUser({program:userData.program});closeEdit();renderDay();unlockAch('customize');toast('Updated!')}
// savedInputs are keyed by exercise INDEX, so removing an exercise would leave every
// exercise after it inheriting the previous slot's typed values. Shift them down to match.
function reindexSavedInputsAfterDelete(day,deletedIdx,oldLen){
  const MAXS=30;
  const setKeys=(i,s)=>[day.id+'_e'+i+'_s'+s+'_w',day.id+'_e'+i+'_s'+s+'_r',day.id+'_e'+i+'_s'+s+'_c'];
  const auxKeys=i=>[day.id+'_e'+i+'_note',day.id+'_e'+i+'_swap'];
  for(let i=deletedIdx+1;i<oldLen;i++){
    for(let s=0;s<MAXS;s++){
      const from=setKeys(i,s),to=setKeys(i-1,s);
      from.forEach((f,k)=>{
        if(savedInputs[f]!==undefined){savedInputs[to[k]]=savedInputs[f];delete savedInputs[f]}
        else delete savedInputs[to[k]];
      });
    }
    const fa=auxKeys(i),ta=auxKeys(i-1);
    fa.forEach((f,k)=>{
      if(savedInputs[f]!==undefined){savedInputs[ta[k]]=savedInputs[f];delete savedInputs[f]}
      else delete savedInputs[ta[k]];
    });
  }
  // Clear the now-vacant final slot
  const lastIdx=oldLen-1;
  for(let s=0;s<MAXS;s++)setKeys(lastIdx,s).forEach(k=>delete savedInputs[k]);
  auxKeys(lastIdx).forEach(k=>delete savedInputs[k]);
}
async function deleteEx(){
  if(!editTarget||!confirm('Remove?'))return;
  captureInputs();
  const day=userData.program[editTarget.di];
  const oldLen=day.exercises.length;
  const ei=editTarget.ei;
  day.exercises.splice(ei,1);
  reindexSavedInputsAfterDelete(day,ei,oldLen);
  await saveUser({program:userData.program});
  try{await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs})}catch(e){console.warn(e)}
  if(sessionActive)persistSession();
  closeEdit();renderDay();toast('Removed.');
}
function openAdd(di){addDayIdx=di;$('addName').value='';$('addSets').value=3;$('addReps').value='';$('addNotes').value='';$('addModal').classList.add('open')}
function closeAdd(){$('addModal').classList.remove('open')}
async function saveAdd(){if(addDayIdx===null)return;const name=$('addName').value.trim();if(!name){toast('Enter a name');return}captureInputs();userData.program[addDayIdx].exercises.push({name,sets:parseInt($('addSets').value)||3,reps:$('addReps').value.trim()||'8-12',notes:$('addNotes').value.trim(),isTime:/sec|s$/i.test($('addReps').value)});await saveUser({program:userData.program});closeAdd();renderDay();toast('Added!')}
function captureInputs(){document.querySelectorAll('#dayContent input[type=number]').forEach(el=>{if(el.id)savedInputs[el.id]=el.value});document.querySelectorAll('#dayContent input[type=checkbox]').forEach(el=>{if(el.id)savedInputs[el.id]=el.checked});document.querySelectorAll('#dayContent input.ex-note-input').forEach(el=>{if(el.id)savedInputs[el.id]=el.value})}
async function saveInputs(){captureInputs();await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs});toast('Saved!')}
function clearInputs(){
  if(!confirm('Clear what you typed on this page?'))return;
  document.querySelectorAll('#dayContent input[type=number]').forEach(el=>el.value='');
  document.querySelectorAll('#dayContent input[type=checkbox]').forEach(el=>el.checked=false);
  captureInputs();toast('Cleared.');
}

// ═══════════ LOG WORKOUT ═══════════
let logLock=false;
async function logWorkout(){
  return logWorkoutWithOptions({});
}
async function logWorkoutWithSession(dayId,durationSec,sessionNote){
  return logWorkoutWithOptions({sessionDayId:dayId,durationSec,sessionNote});
}
async function logWorkoutWithOptions(opts){
  if(logLock)return;logLock=true;
  try{
  const prog=userData.program||[];
  const targetDayId=opts.sessionDayId||currentDay;
  const day=prog.find(d=>d.id===targetDayId);
  if(!day){toast('Pick a day!');logLock=false;return}
  captureInputs();
  const dateISO=opts.backdateISO||pendingBackdateISO||new Date().toISOString();
  const isBackdated=!!(opts.backdateISO||pendingBackdateISO);
  pendingBackdateISO=null;
  const entry={dayId:day.id,dayTitle:day.title,date:dateISO,exercises:[]};
  if(opts.durationSec)entry.durationSec=opts.durationSec;
  if(isBackdated)entry.backdated=true;
  let hasData=false,allDone=true,maxW=0;
  day.exercises.forEach((ex,ei)=>{const sets=[];for(let s=0;s<ex.sets;s++){const wEl=$(day.id+'_e'+ei+'_s'+s+'_w'),rEl=$(day.id+'_e'+ei+'_s'+s+'_r'),cEl=$(day.id+'_e'+ei+'_s'+s+'_c');const w=wEl?wEl.value:'',r=rEl?rEl.value:'',d=cEl?cEl.checked:false;if(w||r)hasData=true;if(!d)allDone=false;if(parseInt(w)>maxW)maxW=parseInt(w);sets.push({weight:w,reps:r,done:d,isTime:!!ex.isTime})}const exObj={name:savedInputs[day.id+'_e'+ei+'_swap']||ex.name,sets};const nEl=$(day.id+'_e'+ei+'_note');if(nEl&&nEl.value.trim())exObj.note=nEl.value.trim();entry.exercises.push(exObj)});
  if(opts.sessionNote&&String(opts.sessionNote).trim())entry.notes=String(opts.sessionNote).trim();
  if(!hasData){toast('Fill in sets!');logLock=false;return}
  const ref=await db.collection('users').doc(U.uid).collection('log').add(entry);entry._id=ref.id;workoutLog.unshift(entry);
  // Notes are per-session: clear drafts for this day after logging
  day.exercises.forEach((ex,ei)=>{const nid=day.id+'_e'+ei+'_note';delete savedInputs[nid];const nEl=$(nid);if(nEl)nEl.value='';delete savedInputs[day.id+'_e'+ei+'_swap']});
  const anyInjury=entry.exercises.some(ex=>ex.note&&INJURY_RX.test(ex.note))||(entry.notes&&INJURY_RX.test(entry.notes));
  if(anyInjury)toast('Injury note saved — The System will flag it next session.');
  if(isBackdated)unlockAch('the_historian');
  let xp=50;if(allDone)xp+=50;
  if(isBackdated)xp=0;
  const hr=new Date(dateISO).getHours();
  // Only unlock achievements for non-backdated entries
  if(!isBackdated){
    const wc=getLiftLogs().filter(e=>!e.backdated).length;
    if(wc>=1)unlockAch('first_workout');if(wc>=10)unlockAch('workouts_10');if(wc>=25)unlockAch('workouts_25');if(wc>=50)unlockAch('workouts_50');if(wc>=100)unlockAch('workouts_100');if(wc>=200)unlockAch('workouts_200');
    if(hr<7)unlockAch('early_bird');if(hr>=21)unlockAch('night_owl');if(allDone)unlockAch('all_sets_done');
    if(hr===5)unlockAch('secret_5am');
    const now=new Date();if(now.getHours()===3&&now.getMinutes()===33)unlockAch('secret_3am');
    if(maxW>=200)unlockAch('heavy_day');if(maxW>=315)unlockAch('monster_lift');if(maxW>=405)unlockAch('titan_lift');if(maxW>=500)unlockAch('heavy_500');
    const dids=new Set(workoutLog.map(e=>e.dayId));if(dids.size>=4)unlockAch('variety');
    const wkStreak=calcWeeklyStreak();
    if(wkStreak>=2)unlockAch('wk_streak_2');if(wkStreak>=4)unlockAch('wk_streak_4');if(wkStreak>=8)unlockAch('wk_streak_8');
    if(wkStreak>=12)unlockAch('wk_streak_12');if(wkStreak>=26)unlockAch('wk_streak_26');if(wkStreak>=52)unlockAch('wk_streak_52');
    const hr2=new Date().getHours();if(hr2>=0&&hr2<4)unlockAch('midnight');
    if(hr2===3)unlockAch('here_dragons');
    const nd=new Date();
    if(nd.getMonth()===0&&nd.getDate()===1)unlockAch('new_year_log');
    if(nd.getMonth()===1&&nd.getDate()===29)unlockAch('leap_of_faith');
    if(nd.getDay()===5&&nd.getHours()>=20)unlockAch('friday_lights');
    if(day.exercises.some(ex=>/calf|calves/i.test(ex.name||'')))unlockAch('achilles_heel');
    const fw=calcFullWeeks();if(fw>=1)unlockAch('full_week');if(fw>=5)unlockAch('full_week_5');if(fw>=10)unlockAch('full_week_10');if(fw>=20)unlockAch('full_week_20');
    const dow=new Date().getDay();if(dow===0||dow===6){const thisWeekLogs=workoutLog.filter(e=>{const d=new Date(e.date);const wk=getMonday(d).toISOString().slice(0,10);return wk===getMonday(new Date()).toISOString().slice(0,10)});const wDays=new Set(thisWeekLogs.map(e=>new Date(e.date).getDay()));if(wDays.has(0)&&wDays.has(6))unlockAch('weekend_warrior')}
    if(getLiftLogs().length>=2){const prevMax=Math.max(0,...getLiftLogs().slice(1).flatMap(e=>Array.isArray(e.exercises)?e.exercises.flatMap(ex=>Array.isArray(ex.sets)?ex.sets.map(s=>parseInt(s.weight)||0):[]):[]));if(maxW>prevMax&&prevMax>0)unlockAch('pr_breaker')}
    const nx=userData.xp+xp;if(nx>=500)unlockAch('rank_d');if(nx>=1500)unlockAch('rank_c');
  }
  if(!isBackdated){const pr=findWorkoutPR(entry);queueFeedEvent('workout',{title:String(day.title||'').slice(0,40),min:opts.durationSec?Math.round(opts.durationSec/60):0,...(pr?{pr}:{})})}
  const gained=addXP(xp);await saveUser({xp:userData.xp,feedEvents:userData.feedEvents||[]});await saveLeaderboard();updateTopBar();checkRankUp();
  let msg;
  if(isBackdated)msg=dayLabel(day.title)+' logged for an earlier day (no XP)';
  else{
    msg=dayLabel(day.title)+' logged, +'+gained+' XP';
    const cap=getXpCap();
    if(cap.softCap<1)msg+=' (trial active: 25%)';
  }
  day.exercises.forEach((ex,ei)=>{for(let s=0;s<ex.sets;s++){delete savedInputs[day.id+'_e'+ei+'_s'+s+'_w'];delete savedInputs[day.id+'_e'+ei+'_s'+s+'_r'];delete savedInputs[day.id+'_e'+ei+'_s'+s+'_c']}});
  try{await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs})}catch(e){console.warn(e)}
  if(!opts.sessionDayId){workoutView='day';pendingBackdateISO=null}
  renderDay();
  toast(msg)}finally{logLock=false}
}
function openBackdatePicker(){
  const modal=$('backdateModal');if(!modal)return;
  let h=`<h2>What did you forget to log?</h2>`;
  h+=`<p style="color:var(--muted);font-size:.75rem;line-height:1.4;margin-bottom:.6rem">Pick the type of entry you want to add for an earlier day.</p>`;
  h+=`<div class="backdate-days">`;
  h+=`<button class="backdate-day" onclick="openBackdateModal('workout')">Workout</button>`;
  h+=`<button class="backdate-day" onclick="openBackdateModal('activity')">Cardio / Activity</button>`;
  h+=`<button class="backdate-day" onclick="openBackdateModal('rest')">Rest Day</button>`;
  h+=`</div>`;
  h+=`<div class="m-actions" style="margin-top:.6rem"><button class="m-cancel" onclick="closeBackdateModal()">Cancel</button></div>`;
  modal.querySelector('.modal').innerHTML=h;
  modal.classList.add('open');
}
// Backdate modal — user picks a date up to 7 days back
function openBackdateModal(action){
  const modal=$('backdateModal');if(!modal)return;
  const today=new Date();const maxBack=7;
  let h=`<h2>Backdate ${action==='workout'?'Workout':action==='activity'?'Activity':'Rest Day'}</h2>`;
  h+=`<p style="color:var(--muted);font-size:.78rem;line-height:1.4;margin-bottom:.6rem">Forgot to log earlier? Pick a day in the past week. <strong style="color:var(--gold)">No XP</strong> is awarded for backdated entries, and achievements won't trigger. Streaks CAN be saved.</p>`;
  h+=`<div class="backdate-days">`;
  for(let i=0;i<=maxBack;i++){
    const d=new Date(today);d.setDate(d.getDate()-i);
    const iso=d.toISOString();
    const label=i===0?'Today':i===1?'Yesterday':d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    const suffix=i>0?' <span style="color:var(--gold);font-size:.6rem">No XP</span>':'';
    h+=`<button class="backdate-day" onclick="pickBackdate('${iso}','${action}')">${label}${suffix}</button>`;
  }
  h+=`</div>`;
  h+=`<div class="m-actions" style="margin-top:.6rem"><button class="m-cancel" onclick="closeBackdateModal()">Cancel</button></div>`;
  modal.querySelector('.modal').innerHTML=h;
  modal.classList.add('open');
}
function closeBackdateModal(){$('backdateModal').classList.remove('open')}
function pickBackdate(iso,action){
  closeBackdateModal();
  const today=new Date().toISOString().slice(0,10);
  const picked=iso.slice(0,10);
  pendingBackdateISO=picked===today?null:iso;
  if(action==='workout'){
    if(currentPage!=='train')switchPage('train');
    startLogMode();
    if(pendingBackdateISO)toast('Fill in your sets, then tap Log for earlier day');
  }
  else if(action==='activity')openActivityLog();
  else if(action==='rest')openRestLog();
}
function updateLogBtn(){const btn=$('logDayBtn');if(btn)btn.textContent=pendingBackdateISO?'Log for earlier day':'Log workout'}
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
    day.exercises.forEach((ex,ei)=>{const sets=[];for(let s=0;s<ex.sets;s++){const w=savedInputs[day.id+'_e'+ei+'_s'+s+'_w']||'',r=savedInputs[day.id+'_e'+ei+'_s'+s+'_r']||'',d=!!savedInputs[day.id+'_e'+ei+'_s'+s+'_c'];if(!d)allDone=false;if(parseInt(w)>maxW)maxW=parseInt(w);sets.push({weight:w,reps:r,done:d,isTime:!!ex.isTime})}const exObj={name:savedInputs[day.id+'_e'+ei+'_swap']||ex.name,sets};const nEl=$(day.id+'_e'+ei+'_note');if(nEl&&nEl.value.trim())exObj.note=nEl.value.trim();entry.exercises.push(exObj)});
  if(opts.sessionNote&&String(opts.sessionNote).trim())entry.notes=String(opts.sessionNote).trim();
    const ref=await db.collection('users').doc(U.uid).collection('log').add(entry);entry._id=ref.id;workoutLog.unshift(entry);
    let xp=50;if(allDone)xp+=50;totalXp+=xp;logged++;
    // Clear savedInputs for this day after logging
    day.exercises.forEach((ex,ei)=>{for(let s=0;s<ex.sets;s++){delete savedInputs[day.id+'_e'+ei+'_s'+s+'_w'];delete savedInputs[day.id+'_e'+ei+'_s'+s+'_r'];delete savedInputs[day.id+'_e'+ei+'_s'+s+'_c']}});
  }
  if(!logged){toast('No filled-in days to log!');return}
  // Save cleared inputs
  await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs});
  // XP + achievements (run once at end)
  const wc=getLiftLogs().length;const hr=new Date().getHours();
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
// ─── Helpers: distinguish lifts from activities/rest ───
function getLiftLogs(){return workoutLog.filter(e=>!e.isActivity&&!e.isRest)}
function getActivityLogs(){return workoutLog.filter(e=>e.isActivity)}
function getRestLogs(){return workoutLog.filter(e=>e.isRest)}
// Any entry that counts for streak (lift, activity, or active rest — NOT full rest)
function getTrainingLogs(){return workoutLog.filter(e=>!e.isRest||e.restType==='active')}
function calcWeeklyStreak(){
  // Streak = consecutive weeks with 3+ training sessions (lifts, activities, active rest)
  const weeks={};getTrainingLogs().forEach(e=>{const m=getMonday(new Date(e.date)).toISOString().slice(0,10);if(!weeks[m])weeks[m]=0;weeks[m]++});
  const thisMonday=getMonday(new Date()).toISOString().slice(0,10);
  let streak=0;const d=new Date();
  for(let i=0;i<104;i++){
    const wk=new Date(d);wk.setDate(wk.getDate()-(7*i));
    const key=getMonday(wk).toISOString().slice(0,10);
    if(key===thisMonday){if((weeks[key]||0)>0)streak++;continue}
    if((weeks[key]||0)>=3)streak++;else break;
  }
  // A purchased Streak Restore acts as a floor, and keeps growing from there
  const restore=userData.streakRestoreTo||0;
  if(restore>0){
    const restoredAt=userData.lastStreakRestore||0;
    const weeksSince=Math.floor((Date.now()-restoredAt)/(7*86400000));
    return Math.max(streak,restore+weeksSince);
  }
  return streak;
}
// Remember the high-water mark so a break has something to restore back to
function trackStreakHighWater(){
  const cur=calcWeeklyStreak();
  const prev=userData.prevWeeklyStreak||0;
  if(cur>prev){userData.prevWeeklyStreak=cur;saveUser({prevWeeklyStreak:cur}).catch(()=>{})}
}
function calcFullWeeks(){const w={};getLiftLogs().forEach(e=>{const m=getMonday(new Date(e.date)).toISOString().slice(0,10);if(!w[m])w[m]=new Set();w[m].add(e.dayId)});return Object.values(w).filter(s=>s.size>=4).length}

// ═══════════ ACHIEVEMENTS ═══════════
// Celebration queue — achievement unlocks slide in one at a time instead of unlocking silently
let achQueue=[],achShowing=false;
async function unlockAch(id){
  if(userData.achievements.includes(id))return;
  userData.achievements.push(id);
  const a=ACHIEVEMENTS.find(x=>x.id===id);
  if(a&&a.xp>0)addXP(a.xp);
  celebrateAch(a);
  userData.shards=(userData.shards||0)+SHARD_REWARDS.achievement;
  if(a&&(a.xp>=100||a.secret))queueFeedEvent('ach',{id});
  await saveUser({achievements:userData.achievements,xp:userData.xp,shards:userData.shards,feedEvents:userData.feedEvents||[]});await saveLeaderboard();updateTopBar();
}
// Silent version — just mutates userData in memory, caller is responsible for saving later.
// Used by checkPassiveAchievements to batch many unlocks into ONE Firestore write.
function unlockAchSilent(id){if(userData.achievements.includes(id))return false;userData.achievements.push(id);const a=ACHIEVEMENTS.find(x=>x.id===id);if(a&&a.xp>0)addXP(a.xp);return true}
let achFilter='all';
function renderAchievements(){
  const ul=userData.achievements||[];
  const visible=ACHIEVEMENTS.filter(a=>!a.secret||ul.includes(a.id));
  const secretCount=ACHIEVEMENTS.filter(a=>a.secret).length;
  const secretUnlocked=ACHIEVEMENTS.filter(a=>a.secret&&ul.includes(a.id)).length;
  const totalUnlocked=ul.length;
  const totalVisible=visible.length;

  $('achSub').textContent=`${totalUnlocked} / ${ACHIEVEMENTS.length} unlocked${secretCount?' · '+secretUnlocked+'/'+secretCount+' secrets':''}`;

  // Filter controls
  $('achFilters').innerHTML=`<div class="log-filters"><div class="log-filter${achFilter==='all'?' active':''}" onclick="achFilter='all';renderAchievements()">All (${totalVisible})</div><div class="log-filter${achFilter==='unlocked'?' active':''}" onclick="achFilter='unlocked';renderAchievements()">Unlocked (${totalUnlocked})</div><div class="log-filter${achFilter==='locked'?' active':''}" onclick="achFilter='locked';renderAchievements()">Locked (${totalVisible-totalUnlocked})</div></div>`;

  // Group achievements by category
  const categories=[
    {name:'Getting Started',test:a=>['first_workout','tour_done','customize','set_bio','set_pic','set_prs'].includes(a.id)},
    {name:'Workout Milestones',test:a=>a.id.startsWith('workouts_')},
    {name:'Streaks',test:a=>a.id.startsWith('wk_streak_')},
    {name:'Perfect Weeks',test:a=>a.id.startsWith('full_week')},
    {name:'Lifting',test:a=>['early_bird','night_owl','midnight','all_sets_done','heavy_day','monster_lift','titan_lift','heavy_500','variety','weekend_warrior','pr_breaker'].includes(a.id)},
    {name:'Social',test:a=>['add_friend','friends_5','friends_10','chat_first','chat_10'].includes(a.id)},
    {name:'Missions',test:a=>a.id.startsWith('mission')||a.id.startsWith('event')},
    {name:'Nutrition',test:a=>['food_log_1','food_log_7','food_log_14','food_log_30','food_log_60','scan_1','scan_5','all_meals','protein_hit'].includes(a.id)},
    {name:'Cardio',test:a=>a.id.startsWith('cardio_')},
    {name:'Rank',test:a=>a.id.startsWith('rank_')||a.id.startsWith('xp_')},
    {name:'Steps',test:a=>a.id.startsWith('steps_')&&!a.secret},
    {name:'Secrets',test:a=>!!a.secret}
  ];

  let h='';
  for(const cat of categories){
    let items=visible.filter(cat.test);
    if(achFilter==='unlocked')items=items.filter(a=>ul.includes(a.id));
    if(achFilter==='locked')items=items.filter(a=>!ul.includes(a.id));
    if(!items.length)continue;
    const unlockedInCat=items.filter(a=>ul.includes(a.id)).length;
    h+=`<div class="ach-category"><div class="ach-cat-header" onclick="toggleAchCat(this)"><span>${cat.name} <span class="ach-cat-count">${unlockedInCat}/${items.length}</span></span><span class="ach-cat-toggle">▼</span></div><div class="ach-cat-body ach-grid">`;
    h+=items.map(a=>{
      const u=ul.includes(a.id);
      if(a.secret&&!u)return`<div class="ach-card secret"><span class="ach-icon"></span><div class="ach-info"><div class="ach-name">???</div><div class="ach-desc">Secret achievement</div></div></div>`;
      return`<div class="ach-card${u?' unlocked':''}"><span class="ach-icon">${a.icon}</span><div class="ach-info"><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div>${a.xp?'<div class="ach-xp">+'+a.xp+' XP</div>':''}</div></div>`;
    }).join('');
    h+=`</div></div>`;
  }

  // Hidden secret count hint
  const hiddenSecrets=secretCount-secretUnlocked;
  if(hiddenSecrets>0&&achFilter!=='unlocked')h+=`<div style="text-align:center;font-family:var(--font-mono);font-size:.62rem;color:var(--dim);margin-top:.5rem">${hiddenSecrets} secret${hiddenSecrets>1?'s':''} remain hidden...</div>`;

  $('achGrid').innerHTML=h;
}
function toggleAchCat(el){
  const body=el.nextElementSibling;const toggle=el.querySelector('.ach-cat-toggle');
  if(body.style.maxHeight&&body.style.maxHeight!=='0px'){body.style.maxHeight='0px';body.style.overflow='hidden';toggle.textContent='▶'}
  else{body.style.maxHeight=body.scrollHeight+'px';body.style.overflow='visible';toggle.textContent='▼'}
}

// ═══════════ PROFILE ═══════════
function renderProfile(){
  const r=getEffectiveRank(),info=getXpBarInfo(),lv=getLevelInfo(),cap=getXpCap();
  const title=(r.title&&r.title[userData.class])||rankLabel(r.name);const st=userData.stats||{};const prs=userData.prs||{};
  const myCos=getCos();const best=bestLoggedLifts();const str=best.bench+best.squat+best.deadlift;
  const wk=calcWeeklyStreak();
  const nr=getNextRank(userData.xp);
  const ri=RANKS.indexOf(r),gate=RANKS[ri+1];
  let right=nr?`${fmtN(nr.min-userData.xp)} to ${rankLabel(nr.name)}`:'Max rank';
  if(gate&&!gate.auto&&gate.trial&&!userData.trialsCompleted.includes(gate.trial)&&userData.xp>=gate.min){const t=RANK_TRIALS[gate.trial];right=`Pass ${t?dayLabel(t.name):'the trial'} first`}
  const initial=esc(String(userData.username||'h')[0].toUpperCase());
  let w=`<div class="sys-title">[ Status ]</div>
    <div class="pf-id">
      <button class="pf-pic${frameClass(myCos.frame)}" aria-label="Change profile photo" onclick="checkPhotoPrivacy(()=>document.getElementById('picInput').click())">${avatarHtml(userData.profilePic,`<span>${initial}</span>`)}</button>
      <div class="pf-names"><div class="pf-user${nameClass(myCos.name)}">${esc(userData.username||'hunter')}</div>${myTitleId()?`<div class="pf-ttl">${titleLine(myTitleId())}</div>`:''}${userData.name?`<div class="mist sm">${esc(userData.name)}, only you see this</div>`:''}</div>
      <div class="pf-rank" aria-label="${esc(rankLabel(r.name))}" style="--rk:${esc(r.color)}">${rankLetter(r)}</div></div>
    ${userData.bio?`<div class="pf-bio">${esc(userData.bio)}</div>`:''}
    <div class="pf-kv"><span class="mist">Job</span><span>${esc(userData.class||'None')}${userData.subclass?', '+esc(userData.subclass):''}</span></div>
    <div class="pf-kv"><span class="mist">Class title</span><span>${esc(title)}</span></div>
    ${(userData.redGatesCleared||0)>0?`<div class="pf-kv"><span class="mist">Red Gates</span><span class="gold">${userData.redGatesCleared} cleared</span></div>`:''}
    ${(userData.blueGatesCleared||0)>0?`<div class="pf-kv"><span class="mist">Blue Gates</span><span class="sys">${userData.blueGatesCleared} cleared</span></div>`:''}
    <div class="hh-bar"><span class="lv">Lv ${lv.level}</span><div class="hp"><div class="hp-fill${cap.softCap<1?' capped':''}" style="width:${info.pct}%"></div></div></div>
    <div class="hh-sub"><span>${fmtN(userData.xp)} XP</span><span>${esc(right)}</span></div>
    <div class="wline"></div>
    <div class="pf-stats">
      <div><span class="pf-k">STR</span><span class="num pf-v">${str?fmtN(str):'—'}</span><span class="mist sm">Best logged bench + squat + deadlift</span></div>
      <div><span class="pf-k">VIT</span><span class="num pf-v">${fmtN(getLiftLogs().length)}</span><span class="mist sm">Workouts logged</span></div>
      <div><span class="pf-k">AGI</span><span class="num pf-v">${fmtN(getActivityLogs().length)}</span><span class="mist sm">Cardio sessions</span></div>
      <div><span class="pf-k">END</span><span class="num pf-v">${wk}</span><span class="mist sm">Week streak</span></div>
    </div>`;
  let h=`<div class="pg-head"><h1 class="pg-title">Profile</h1><div class="pg-actions"><button class="icon-btn" aria-label="Settings" onclick="openSettings()">${icon('gear',22)}</button></div></div>`;
  h+=sysWin(w,'pf-win');
  // Streak nudge (same rule as before: 3 sessions keeps a weekly streak alive)
  const thisWeekCount=workoutLog.filter(e=>getMonday(new Date(e.date)).toISOString().slice(0,10)===getMonday(new Date()).toISOString().slice(0,10)).length;
  if(wk>0&&thisWeekCount<3){const need=3-thisWeekCount;h+=`<div class="pf-streak">${icon('flame',16)}${wk}-week streak. ${need===1?'One more session':need+' more sessions'} this week keeps it.</div>`}
  else if(wk===0&&workoutLog.length>0)h+=`<div class="pf-streak mist">${icon('flame',16)}Streak broken. Three sessions this week starts a new one.</div>`;
  const kv=(v,k)=>`<div><div class="num pf-kv-v">${v}</div><div class="mist sm">${k}</div></div>`;
  h+=`<div class="panel pf-body"><div class="sec-row" style="margin:0"><span class="sec">Body and lifts</span><span class="mist sm">${(userData.privacy||{}).hideStats?'Hidden from others':'Private'}</span></div>
    <div class="pf-grid">${kv(st.height?esc(st.height):'—','Height')}${kv(st.weight?esc(st.weight)+' lb':'—','Weight')}${kv(st.age?esc(st.age):'—','Age')}
    ${kv(prs.bench?fmtN(prs.bench):'—','Bench PR')}${kv(prs.squat?fmtN(prs.squat):'—','Squat PR')}${kv(prs.deadlift?fmtN(prs.deadlift):'—','Deadlift PR')}</div>
    <button class="btn-s" style="width:100%;margin-top:16px" onclick="openWeighIn()">${icon('scale',16)} Weekly check-in</button></div>`;
  const row=(ic,t,r,on,rc)=>`<button class="li" onclick="${on}"><span class="ico">${icon(ic,18)}</span><span class="t">${t}</span><span class="r${rc?' '+rc:''}">${r}</span><span class="chev">${icon('chev',16)}</span></button>`;
  const achTotal=ACHIEVEMENTS.length,achHave=(userData.achievements||[]).length;
  const frame=COSMETICS.find(c=>c.id===myCos.frame);
  h+=`<div class="li-list pf-list">`+
    row('badge','Badges',`${achHave} of ${achTotal}`,"openProfileView('badges')")+
    row('ladder','Rank info',rankLabel(r.name),"openProfileView('rankinfo')")+
    row('shard','Shop',`${fmtN(userData.shards||0)} shards`,"openProfileView('shop')",'gold')+
    row('frame','Wardrobe',myTitleId()?esc(titleName(myTitleId())):frame?esc(frame.name):`${titlesEarned().length} title${titlesEarned().length!==1?'s':''} earned`,'openWardrobe()')+
    row('camera','Progress photos','On this phone only','openProgressPhotos()')+
    (userData.role==='trainer'?row('whistle','Trainer dashboard','Your clients',"openProfileView('trainer')"):'')+
    row('gear','Settings','Account, privacy, alerts','openSettings()')+`</div>`;
  h+=renderDevTools();
  h+=`<div class="pf-ver dim">Version ${APP_VERSION}</div>`;
  $('profileContent').innerHTML=h;
}

// ═══════════ FRIENDS PAGE ═══════════
function renderFriendsPage(){
  const fc=userData.friendCode||'------';
  const friends=userData.friends||[];
  let h=`<div class="panel invite-card"><div class="sec">Your invite code</div>
    <div class="num ic-code">${esc(fc)}</div>
    <div class="mist sm">New hunters need a code to sign up. Anyone who joins with yours is sent to you as a friend request.</div>
    <div class="ic-btns"><button class="btn-s" onclick="copyFriendCode()">${icon('copy',16)} Copy</button><button class="btn-p" style="height:44px;font-size:15px" onclick="shareInvite()">${icon('share',16)} Share invite</button></div></div>`;
  h+=`<div class="sec" style="margin-top:24px">Add a friend</div>
    <div class="friend-add-row"><input type="text" id="friendCodeInput" class="auth-input invite-input" placeholder="Their 6-character code" maxlength="6" autocapitalize="characters" aria-label="Friend code"><button class="btn-s" onclick="sendFriendRequest()">Send</button></div>`;
  h+=`<div id="friendRequests"></div>`;
  h+=`<div class="sec-row"><span class="sec">Friends</span><span class="mist sm">${friends.length}</span></div>`;
  h+=`<div id="friendsList" class="li-list"></div>`;
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
  $('setHideName').checked=!!priv.hideName;$('setHideStats').checked=!!priv.hideStats;$('setShareActivity').checked=priv.shareActivity!==false;if($('setHideHof'))$('setHideHof').checked=priv.hideHof!==true;
  // Training goal button label
  const tgBtn=$('setTrainingGoalBtn');
  if(tgBtn){
    const g=userData.weeklyTrainingGoal;
    tgBtn.textContent=g?`${g} workouts/week (tap to change)`:'— /week (tap to set)';
  }
  // Notification prefs (default all to true)
  const np=userData.notifPrefs||{};
  $('setNotifMessages').checked=np.messages!==false;
  $('setNotifFriendReqs').checked=np.friendRequests!==false;
  $('setNotifPokes').checked=np.pokes!==false;
  $('setNotifEvents').checked=np.events!==false;
  $('setNotifTraining').checked=np.training!==false;
  // Notif status text
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
  const btn=$('enableNotifBtn');
  let statusText='';
  if(!('Notification' in window)){statusText='This browser doesn\'t support notifications.';if(btn)btn.style.display='none'}
  else if(isIOS&&!isStandalone){statusText='iOS: Install app to home screen first (tap Share → Add to Home Screen in Safari).';if(btn){btn.style.display='';btn.textContent='How to Install'}}
  else if(notifPermission==='granted'){statusText='Notifications enabled — you\'ll get pings when the app is open or recently closed.';if(btn)btn.style.display='none'}
  else if(notifPermission==='denied'){statusText='Notifications blocked. Enable in browser/phone settings to receive alerts.';if(btn)btn.style.display='none'}
  else{statusText='Allow notifications to get alerts for messages, pokes, and event missions.';if(btn){btn.style.display='';btn.textContent='Enable Notifications'}}
  $('notifStatus').textContent=statusText;
  // Trainer status
  if(userData.trainer){$('trainerStatus').innerHTML='<strong style="color:var(--green)">Connected to a trainer</strong><br><button class="copy-code-btn" onclick="disconnectTrainer()" style="margin-top:4px">Disconnect</button>';$('trainerCodeRow').style.display='none'}
  else if(userData.role==='trainer'){$('trainerStatus').innerHTML='<strong style="color:var(--gold)">You are a trainer</strong><br>Share your code from Profile → Trainer tab';$('trainerCodeRow').style.display='none'}
  else{$('trainerStatus').textContent='Have a trainer? Enter their code to share your progress with them.';$('trainerCodeRow').style.display='';$('setTrainerCode').value=''}
  $('settingsModal').classList.add('open');
}
async function enableNotifications(){
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
  if(isIOS&&!isStandalone){showIOSInstallPrompt();return}
  if(!('Notification' in window)){toast('Not supported');return}
  try{
    const p=await Notification.requestPermission();
    notifPermission=p;
    if(p==='granted'){
      toast('Notifications enabled!');
      startRealtimeListeners();
      // Test notification
      sendNotif('LexenFitness','Notifications working! ',{tag:'test'});
      openSettings();
    }else if(p==='denied'){
      toast('Permission denied. Check browser/phone settings to re-enable.');
      openSettings();
    }
  }catch(e){toast('Error: '+e.message)}
}
async function connectTrainer(){
  const code=$('setTrainerCode').value.trim().toUpperCase();
  if(!code||code.length!==6){toast('Enter a 6-character code');return}
  await acceptTrainerCode(code);
  openSettings();
}
async function disconnectTrainer(){
  if(!confirm('Disconnect from your trainer? They will no longer see your progress.'))return;
  const trainerUid=userData.trainer;
  await saveUser({trainer:null});
  if(trainerUid){try{await db.collection('users').doc(trainerUid).update({clients:firebase.firestore.FieldValue.arrayRemove(U.uid)})}catch(e){}}
  toast('Trainer disconnected');openSettings();
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
  const privacy={hideName:$('setHideName').checked,hideStats:$('setHideStats').checked,shareActivity:$('setShareActivity').checked,hideHof:$('setHideHof')?!$('setHideHof').checked:false};
  const notifPrefs={
    messages:$('setNotifMessages').checked,
    friendRequests:$('setNotifFriendReqs').checked,
    pokes:$('setNotifPokes').checked,
    events:$('setNotifEvents').checked,
    training:$('setNotifTraining').checked
  };
  await saveUser({username:newUn,name:$('setDisplayName').value.trim()||userData.name,stats,prs,privacy,notifPrefs,goal:$('setGoal').value,experience:$('setExperience').value,bio:$('setBio').value.trim().slice(0,200)});
  await saveLeaderboard();closeSettings();renderProfile();toast('Settings saved!');
  // Restart listeners with new prefs
  if(notifPermission==='granted')startRealtimeListeners();}
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
    fromPic:safeImgSrc(userData.profilePic),
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
    let h='<div class="sec" style="margin-top:24px">Requests</div><div class="li-list">';
    for(const doc of snap.docs){
      const req=doc.data();
      h+=`<div class="li"><span class="ff-pic">${avatarHtml(req.fromPic,`<span>${esc(String(req.fromUsername||'h')[0].toUpperCase())}</span>`)}</span>
        <span class="t">${esc(req.fromUsername)}<small>Wants to be friends</small></span>
        <button class="btn-p sm" onclick="acceptFriendRequest('${safeId(doc.id)}','${safeId(req.from)}')">Accept</button>
        <button class="ring" aria-label="Decline" onclick="declineFriendRequest('${safeId(doc.id)}')">${icon('x',16)}</button></div>`;
    }
    el.innerHTML=h+'</div>';
  }catch(e){
    el.innerHTML=`<div class="empty-note" style="color:var(--red)">Couldn't load requests: ${esc(e.message||'')}</div>`;
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
  if(!friends.length){list.innerHTML='<div class="empty-note">No friends yet. Share your code to get started.</div>';return}
  const myPokeStreaks=userData.pokeStreaks||{};
  const myLastMutual=userData.pokeLastMutual||{};
  const today=getTodayStr();
  const pokedToday=userData.pokedToday||{};
  let h='';let loaded=0;
  for(const fid of friends.slice(0,20)){
    try{
      const d=await db.collection('leaderboard').doc(fid).get();
      if(!d.exists){h+=`<div class="li dim"><span class="ff-pic">${avatarHtml('')}</span><span class="t">Deleted account</span></div>`;continue}
      const f=d.data();const r=(f.rank&&RANKS.find(x=>x.name===f.rank))||getRank(f.xp||0);
      let streak=myPokeStreaks[fid]||0;
      const lastMutualDay=myLastMutual[fid];
      // Display-side decay: if last mutual was 2+ days ago, show 0
      if(streak>0&&lastMutualDay){
        const lastM=new Date(lastMutualDay+'T12:00:00');
        if(Math.floor((Date.now()-lastM.getTime())/86400000)>=2)streak=0;
      }
      const pokedTodayFlag=pokedToday[fid]===today;
      const atRisk=streak>0&&lastMutualDay&&lastMutualDay!==today;
      const sub=[rankLabel(r.name),f.class?esc(f.class):'',streak>0?`${streak}-day poke streak${atRisk?', poke today to keep it':''}`:''].filter(Boolean).join('. ');
      const pokeBtn=pokedTodayFlag
        ?`<span class="mist sm">Poked</span>`
        :`<button class="btn-s ghost sm" onclick="event.stopPropagation();sendPoke('${safeId(fid)}','${safeName(f.username||'hunter')}')">Poke</button>`;
      h+=`<div class="li" role="button" tabindex="0" onclick="openProfileCard('${safeId(fid)}')"><span class="ff-pic${r.name==='S-RANK'?' s':''}${frameClass(f.frame)}">${avatarHtml(f.profilePic,`<span>${esc(String(f.username||'h')[0].toUpperCase())}</span>`)}</span>
        <span class="t"><span class="${nameClass(f.nameColor).trim()}">${esc(f.username||'hunter')}</span><small${atRisk?' class="lilac"':''}>${sub}</small></span>${pokeBtn}</div>`;
      loaded++;
    }catch(e){
      h+=`<div class="li"><span class="t" style="color:var(--red)">Couldn't load this friend<small>${esc(e.message||'')}</small></span></div>`;
    }
  }
  if(!loaded&&friends.length)h+=`<div class="empty-note gold">Friends are in your list but their profiles can't be read. The database rules need updating.</div>`;
  list.innerHTML=h;
}

// ═══════════ POKES ═══════════
async function sendPoke(fid,fusername){
  const today=getTodayStr();
  const pokedToday=userData.pokedToday||{};
  if(pokedToday[fid]===today){toast('Already poked @'+fusername+' today');return}
  try{
    // Read friend's current poke data
    const fsnap=await db.collection('users').doc(fid).get();
    if(!fsnap.exists){toast('User not found');return}
    const fdata=fsnap.data();

    // Did they poke me today? Check their "pokedToday" map for my uid
    const theirPokedToday=fdata.pokedToday||{};
    const theyPokedMeToday=theirPokedToday[U.uid]===today;

    // Current streak data — stored symmetrically on both sides
    const myStreaks=userData.pokeStreaks||{};
    const myLastMutual=userData.pokeLastMutual||{};
    const theirStreaks=fdata.pokeStreaks||{};
    const theirLastMutual=fdata.pokeLastMutual||{};

    // Determine new streak based on mutual rule
    let newStreak=myStreaks[fid]||0;
    let newLastMutualDay=myLastMutual[fid]||null;

    if(theyPokedMeToday){
      // Both poked today — streak advances
      if(newLastMutualDay===today){
        // Already mutual today (shouldn't happen but guard anyway)
      }else{
        // Check if last mutual day was yesterday (consecutive) or earlier (streak restart)
        const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
        const yesterdayStr=getDateStr(yesterday);
        if(newLastMutualDay===yesterdayStr){
          newStreak=newStreak+1; // consecutive day
        }else if(newLastMutualDay){
          // Gap — restart at 1
          newStreak=1;
        }else{
          // First ever mutual
          newStreak=1;
        }
        newLastMutualDay=today;
      }
    }
    // else: I'm poking but they haven't poked back yet.
    // Don't change the streak value — it stays what it was.
    // It'll either get bumped when they reciprocate, or decay when a day passes without mutual.

    // Decay check: if the last mutual day is 2+ days ago AND they haven't reciprocated today, streak is dead
    if(newLastMutualDay){
      const lastMutual=new Date(newLastMutualDay+'T12:00:00');
      const daysSinceMutual=Math.floor((Date.now()-lastMutual.getTime())/86400000);
      if(daysSinceMutual>=2&&!theyPokedMeToday){
        newStreak=0;
        newLastMutualDay=null;
      }
    }

    // Update THEIR doc: add the poke entry + apply the same symmetric streak update
    const theirIncomingPokes=fdata.pokes||[];
    const newTheirIncoming=[...theirIncomingPokes.filter(p=>p.from!==U.uid||(Date.now()-new Date(p.at).getTime()<86400000)),{from:U.uid,fromName:userData.username||'hunter',at:new Date().toISOString()}].slice(-20);
    const newTheirStreaks={...theirStreaks,[U.uid]:newStreak};
    const newTheirLastMutual={...theirLastMutual};
    if(newLastMutualDay)newTheirLastMutual[U.uid]=newLastMutualDay; else delete newTheirLastMutual[U.uid];
    await db.collection('users').doc(fid).update({
      pokes:newTheirIncoming,
      pokeStreaks:newTheirStreaks,
      pokeLastMutual:newTheirLastMutual
    });

    // Update MY doc
    pokedToday[fid]=today;
    const myNewStreaks={...myStreaks,[fid]:newStreak};
    const myNewLastMutual={...myLastMutual};
    if(newLastMutualDay)myNewLastMutual[fid]=newLastMutualDay; else delete myNewLastMutual[fid];
    userData.pokesSent=(userData.pokesSent||0)+1;
    await saveUser({pokedToday,pokeStreaks:myNewStreaks,pokeLastMutual:myNewLastMutual,pokesSent:userData.pokesSent});

    const gained=addXP(5);
    await saveUser({xp:userData.xp});
    if(newStreak>=3)unlockAch('poke_streak_3');
    if(newStreak>=7)unlockAch('poke_streak_7');
    if(newStreak>=30)unlockAch('poke_streak_30');
    unlockAch('poke_first');

    let streakMsg='';
    if(theyPokedMeToday&&newStreak>0)streakMsg=` · ${newStreak} streak`;
    else if(newStreak>0)streakMsg=` · ${newStreak} (waiting for reply)`;
    else streakMsg=' · waiting for reply to start streak';

    toast(`Poked @${fusername}! +${gained} XP${streakMsg}`);
    loadFriendsList();
  }catch(e){console.error(e);toast(e.code==='permission-denied'?`Can't poke @${fusername} yet — they need to open the app once so your friendship syncs`:'Poke failed: '+e.message)}
}
function getDateStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

async function checkIncomingPokes(){
  if(!U)return;
  const pokes=userData.pokes||[];
  if(!pokes.length)return;
  // Filter to pokes from last 24 hours
  const recent=pokes.filter(p=>(Date.now()-new Date(p.at).getTime())<86400000);
  if(!recent.length)return;
  // Show toast once per session
  if(sessionStorage.getItem('pokesSeen'))return;
  sessionStorage.setItem('pokesSeen','1');
  if(recent.length===1){
    toast(`@${recent[0].fromName} poked you! Time to train.`);
  }else{
    toast(`You have ${recent.length} pokes waiting!`);
  }
}

// ═══════════ LEADERBOARD (username only) ═══════════
let lbData=[];
async function renderLeaderboard(){
  const el=$('lbList');if(!el)return;
  const sub=$('lbSub');if(sub)sub.textContent=lbMode==='hof'?'Records from logged sets, across every hunter':lbMode==='friends'?'You and your friends, by XP':'Top hunters by XP';
  if(lbMode==='hof'){await renderHallOfFame(el);return}
  let list=[];
  try{
    if(lbMode==='friends'){const fids=[U.uid,...(userData.friends||[])];for(const fid of fids.slice(0,30)){try{const d=await db.collection('leaderboard').doc(fid).get();if(d.exists)list.push({uid:d.id,...d.data()})}catch(e){}}list.sort((a,b)=>b.xp-a.xp)}
    else{const snap=await db.collection('leaderboard').orderBy('xp','desc').limit(50).get();snap.forEach(d=>list.push({uid:d.id,...d.data()}))}
  }catch(e){el.innerHTML=`<div class="empty-note">Couldn't load the leaderboard. ${esc(e.message||'')}</div>`;return}
  lbData=list;
  const myPokedToday=userData.pokedToday||{};const today=getTodayStr();
  let h=hofTabs();
  h+=list.length?'<div class="li-list">'+list.map((u,i)=>{
    const me=U&&u.uid===U.uid;const r=(u.rank&&RANKS.find(x=>x.name===u.rank))||getRank(u.xp);
    let poke='';
    if(!me&&lbMode==='friends'&&(userData.friends||[]).includes(u.uid)){
      poke=myPokedToday[u.uid]===today?`<span class="mist sm">Poked</span>`:`<button class="btn-s ghost sm" onclick="event.stopPropagation();sendPoke('${safeId(u.uid)}','${safeName(u.username||'hunter')}')">Poke</button>`;
    }
    const tn=titleName(u.titleId);
    const sub=tn?`${rankLabel(r.name)}, <span class="ttl-chip${u.titleId==='shadow_monarch'?' gold':''}">${esc(tn)}</span>`:[rankLabel(r.name),u.class?esc(u.class)+(u.subclass?', '+esc(u.subclass):''):''].filter(Boolean).join('. ');
    return `<div class="li lb-li${me?' me':''}" role="button" tabindex="0" onclick="openProfileCard('${safeId(u.uid)}')"><span class="num lb-pos${i<3?' top':''}">${i+1}</span>
      <span class="ff-pic${r.name==='S-RANK'?' s':''}${frameClass(u.frame)}">${avatarHtml(u.profilePic,`<span>${esc(String(u.username||'h')[0].toUpperCase())}</span>`)}</span>
      <span class="t"><span class="${nameClass(u.nameColor).trim()}">${esc(u.username||'hunter')}${me?' <span class="mist">(you)</span>':''}</span><small>${sub}</small></span>${poke}<span class="num lb-xp">${fmtN(u.xp)}<small>XP</small></span></div>`;
  }).join('')+'</div>':'<div class="empty-note">No hunters yet.</div>';
  el.innerHTML=h;
}

// ═══════════ PROFILE CARD (tap user) ═══════════
async function openProfileCard(uid){
  if(uid===U.uid){switchPage('profile');return}
  const modal=$('profileCardModal');if(!modal)return;
  modal.querySelector('.modal').innerHTML='<p style="color:var(--muted);text-align:center;padding:2rem">Loading...</p>';
  modal.classList.add('open');
  try{
    // Try leaderboard cache first, then fetch full user doc
    let u=lbData.find(x=>x.uid===uid);
    if(!u){try{const ld=await db.collection('leaderboard').doc(uid).get();if(ld.exists)u={...ld.data(),uid}}catch(e){}}
    try{const userDoc=await db.collection('users').doc(uid).get();if(userDoc.exists){const ud=userDoc.data();u={...u,...ud,uid}}}catch(e){/* not friends — public card only */}
    if(!u){modal.classList.remove('open');toast('User not found');return}
    const r=(u.rank&&RANKS.find(x=>x.name===u.rank))||getRank(u.xp||0);
    const title=(r.title&&r.title[u.class])||r.name;
    const isFriend=(userData.friends||[]).includes(uid);
    let h=`<div class="pc-header">
      <div class="pc-pic${frameClass(u.frame||(u.cosmetics&&u.cosmetics.frame))}">${avatarHtml(u.profilePic)}</div>
      <div class="pc-info">
        <div class="pc-username${nameClass(u.nameColor||(u.cosmetics&&u.cosmetics.name))}">@${esc(u.username||'hunter')}</div>
        ${titleName(u.titleId)?`<div class="pc-ttl">${titleLine(u.titleId)}</div>`:''}
        <div class="pc-class">${esc(u.class||'')}${u.subclass?', '+esc(u.subclass):''}</div>
        <div class="pc-rank${r.name==='S-RANK'?' gold':''}">${rankLabel(r.name)}, ${esc(title)}</div>
      </div>
    </div>`;
    if(u.bio)h+=`<div class="pc-bio">${esc(u.bio)}</div>`;
    h+=`<div class="pc-stats">
      <div class="pc-stat"><div class="pc-stat-val">${fmtN(u.xp)}</div><div class="pc-stat-label">XP</div></div>
      <div class="pc-stat"><div class="pc-stat-val">${u.workouts!=null?num(u.workouts):'?'}</div><div class="pc-stat-label">Workouts</div></div>
      <div class="pc-stat"><div class="pc-stat-val">${u.achievements?u.achievements.length:(u.achCount!=null?num(u.achCount):'—')}</div><div class="pc-stat-label">Badges</div></div>
    </div>`;
    if(isFriend){
      h+=`<div class="pc-friend-status">You're friends</div>`;
    }else{
      h+=`<button class="pc-add-btn" onclick="addFriendFromCard('${safeId(uid)}')">Add friend</button>`;
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
  await db.collection('friendRequests').add({from:U.uid,to:uid,fromUsername:userData.username||'hunter',fromPic:safeImgSrc(userData.profilePic),status:'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  toast('Friend request sent!');closeProfileCard();
}

// ═══════════ LOG ═══════════
function renderLog(){const c=$('logContent');if(!workoutLog.length){c.innerHTML='<p style="color:var(--muted);font-size:.82rem">No workouts logged yet.</p>';return}
  const prog=userData.program||[];const filtered=logFilter==='all'?workoutLog:workoutLog.filter(e=>e.dayId===logFilter);
  const weeks={};filtered.forEach(e=>{const d=new Date(e.date),m=getMonday(d),k=m.toISOString().slice(0,10);if(!weeks[k])weeks[k]={monday:m,entries:[]};weeks[k].entries.push(e)});
  const sorted=Object.values(weeks).sort((a,b)=>b.monday-a.monday);
  let h='<div class="log-filters"><div class="log-filter'+(logFilter==='all'?' active':'')+'" onclick="setFilter(\'all\')">All</div>';
  prog.forEach(d=>h+='<div class="log-filter'+(logFilter===d.id?' active':'')+'" onclick="setFilter(\''+d.id+'\')">'+esc(dayLabel(d.title))+'</div>');h+='</div>';
  sorted.forEach(week=>{const sun=new Date(week.monday);sun.setDate(sun.getDate()+6);const fmt=d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});const wn=getWeekNum(week.monday);
    const wkSessions=week.entries.filter(e=>!e.isRest||e.restType==='active').length;
    h+='<div class="week-group"><div class="week-header" onclick="toggleWk(this)"><span>Week '+wn+' <span class="wk-dates">'+fmt(week.monday)+' – '+fmt(sun)+'</span></span><span class="wk-count">'+wkSessions+' session'+(wkSessions!==1?'s':'')+' ▼</span></div><div class="week-body">';
    week.entries.sort((a,b)=>new Date(a.date)-new Date(b.date));
    week.entries.forEach(entry=>{
      try{
        const d=new Date(entry.date),ds=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
        const dayChip='<span class="log-daychip">'+d.toLocaleDateString('en-US',{weekday:'short'})+'<span class="lc-num">'+d.getDate()+'</span></span>';
        // Handle rest days
        if(entry.isRest){
          const ic=icon(entry.restType==='active'?'pulse':'moon',16);
          const label=entry.restType==='active'?'Active Rest':'Full Rest';
          h+='<div class="day-log"><div class="day-log-head"><span class="day-log-title">'+dayChip+ic+' '+esc(label)+'</span><span><span class="day-log-date">'+ds+'</span> <button class="btn-del" onclick="delLog(\''+entry._id+'\')">✕</button></span></div>'+(entry.notes?'<div style="padding:6px 10px;font-size:.72rem;color:var(--muted);font-style:italic">'+esc(entry.notes)+'</div>':'')+'</div>';
          return;
        }
        // Handle activity/cardio entries
        if(entry.isActivity){
          const ic=icon('pulse',16);
          const detailParts=[];
          if(entry.duration)detailParts.push(entry.duration+' min');
          if(entry.calBurned)detailParts.push(entry.calBurned+' cal');
          if(entry.steps)detailParts.push(entry.steps.toLocaleString()+' steps');
          h+='<div class="day-log"><div class="day-log-head"><span class="day-log-title">'+dayChip+ic+' '+esc(entry.dayTitle||'Activity')+'</span><span><span class="day-log-date">'+ds+'</span> <button class="btn-del" onclick="delLog(\''+entry._id+'\')">✕</button></span></div>'+(detailParts.length?'<div style="padding:6px 10px;font-size:.72rem;color:var(--muted)">'+detailParts.join(' · ')+'</div>':'')+(entry.notes?'<div style="padding:0 10px 8px;font-size:.7rem;color:var(--dim);font-style:italic">'+esc(entry.notes)+'</div>':'')+'</div>';
          return;
        }
        // Regular lift entry — guard against missing/empty exercises
        const exs=(entry.exercises||[]).filter(ex=>Array.isArray(ex.sets));
        if(!exs.length){
          h+='<div class="day-log"><div class="day-log-head"><span class="day-log-title">'+esc(dayLabel(entry.dayTitle||'Workout'))+'</span><span><span class="day-log-date">'+ds+'</span> <button class="btn-del" onclick="delLog(\''+entry._id+'\')">✕</button></span></div><div style="padding:8px 10px;font-size:.7rem;color:var(--dim);font-style:italic">No sets recorded</div></div>';
          return;
        }
        const maxS=Math.max(...exs.map(x=>x.sets.length));
        const bd=entry.backdated?' <span style="color:var(--gold);font-size:.6rem;font-weight:700;margin-left:4px">Backdated</span>':'';
        const dur=entry.durationSec?' <span style="color:var(--accent);font-size:.62rem;font-weight:700;margin-left:4px">'+Math.floor(entry.durationSec/60)+' min</span>':'';
        h+='<div class="day-log"><div class="day-log-head"><span class="day-log-title">'+dayChip+esc(dayLabel(entry.dayTitle||'Workout'))+bd+dur+'</span><span><span class="day-log-date">'+ds+'</span> <button class="btn-del" style="margin-right:2px" onclick="editLogNote(\''+entry._id+'\')" aria-label="Edit note">'+icon('note',16)+'</button><button class="btn-del" onclick="delLog(\''+entry._id+'\')">✕</button></span></div>'+(entry.notes?'<div class="log-note'+(INJURY_RX.test(entry.notes)?' warn':'')+'">'+(INJURY_RX.test(entry.notes)?'':'')+esc(entry.notes)+'</div>':'')+'<div class="log-table-wrap"><table class="log-table"><thead><tr><th>Exercise</th>';
        for(let i=0;i<maxS;i++)h+='<th>S'+(i+1)+'</th>';h+='</tr></thead><tbody>';
        exs.forEach(ex=>{
          if(!ex.sets.some(s=>s&&(s.reps||s.weight)))return;
          h+='<tr><td style="font-weight:600;font-size:.74rem;max-width:120px;overflow:hidden;text-overflow:ellipsis">'+esc(ex.name)+(ex.note?'<div class="log-ex-note'+(INJURY_RX.test(ex.note)?' warn':'')+'">'+esc(ex.note)+'</div>':'')+'</td>';
          for(let i=0;i<maxS;i++){const s=ex.sets[i];if(!s||(!s.reps&&!s.weight)){h+='<td class="c-empty">—</td>';continue}const cls=s.done?'c-done':'c-miss';h+=s.isTime?'<td class="'+cls+'">'+(s.reps||0)+'s'+(s.done?' ✓':'')+'</td>':'<td class="'+cls+'">'+(s.weight||0)+'×'+(s.reps||0)+(s.done?' ✓':'')+'</td>'}
          h+='</tr>';
        });
        h+='</tbody></table></div></div>';
      }catch(e){
        console.error('Log entry render failed:',e,entry);
        h+='<div class="day-log" style="opacity:.5"><div class="day-log-head"><span class="day-log-title" style="color:var(--red)">Entry render failed</span><span><button class="btn-del" onclick="delLog(\''+(entry._id||'')+'\')">✕</button></span></div></div>';
      }
    });
    h+='</div></div>';
  });
  c.innerHTML=h;
}
function setFilter(f){logFilter=f;renderLog()}
function toggleWk(el){const b=el.nextElementSibling;if(b.style.maxHeight&&b.style.maxHeight!=='0px'){b.style.maxHeight='0px';b.style.overflow='hidden'}else{b.style.maxHeight=b.scrollHeight+'px';b.style.overflow='visible'}}
async function delLog(id){
  if(!id||id==='undefined'){toast('Can\'t delete this entry — refresh the app and try again');return}
  if(!confirm('Delete?'))return;
  try{
    await db.collection('users').doc(U.uid).collection('log').doc(id).delete();
    workoutLog=workoutLog.filter(e=>e._id!==id);
    renderLog();
    toast('Deleted.');
  }catch(e){console.error(e);toast('Delete failed: '+e.message)}
}
function getMonday(d){const dt=new Date(d);const day=dt.getDay();dt.setDate(dt.getDate()-day+(day===0?-6:1));dt.setHours(0,0,0,0);return dt}
function getWeekNum(mon){if(!workoutLog.length)return 1;const dates=workoutLog.map(e=>getMonday(new Date(e.date)).getTime());return Math.round((mon-new Date(Math.min(...dates)))/(7*864e5))+1}
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}

// ═══════════ WELCOME MESSAGE ═══════════
function showWelcomeMessage(){
  let old=$('welcomeOverlay');if(old)old.remove();
  const overlay=document.createElement('div');overlay.id='welcomeOverlay';overlay.className='wn-overlay';
  let h=`<div class="wn-modal welcome-modal">
    <div class="welcome-header"><div class="welcome-icon"></div><div class="wn-title">Welcome, Hunter</div></div>
    <div class="welcome-body">${WELCOME_MESSAGE.replace(/\n/g,'<br>')}</div>
    <button class="wn-btn" id="welcomeDismiss">Enter the System</button>
  </div>`;
  overlay.innerHTML=h;document.body.appendChild(overlay);
  document.getElementById('welcomeDismiss').addEventListener('click',async()=>{
    overlay.classList.add('closing');
    setTimeout(()=>overlay.remove(),250);
    await saveUser({hasSeenWelcome:true});
    checkWhatsNew();
  });
}

// ═══════════ WHAT'S NEW ═══════════
function checkWhatsNew(){
  // Welcome message for first-time users
  if(!userData.hasSeenWelcome){showWelcomeMessage();return}
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
  let inner=`<div class="sys-title">[ System update ]</div><div class="wn-ver">Version ${APP_VERSION}</div><div class="wline"></div><div class="wn-scroll">`;
  entries.forEach((e,i)=>{
    inner+=`<div class="wn-section"><div class="wn-section-title">${esc(e.title)}</div>${i===0&&e.blurb?`<p class="wn-blurb">${esc(e.blurb)}</p>`:''}
      <ul class="wn-list">${e.items.map(it=>`<li>${esc(it)}</li>`).join('')}</ul></div>`;
  });
  inner+=`</div><button class="btn-p" id="wnDismiss">Got it</button>`;
  overlay.innerHTML=`<div class="wn-modal">${sysWin(inner)}</div>`;
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
  {target:'#homeHeader',title:'Your status',desc:'Your rank, level and XP live here. Workouts, quests and badges all earn XP. Reach the next rank and a trial opens.',pos:'bottom'},
  {target:'[data-page="missions"]',title:'Home',desc:'Your Daily Quest: five small tasks a day. Finish all five for bonus XP and build a streak.',pos:'top'},
  {target:'[data-page="train"]',title:'Train',desc:'Your program. Start a session for the rest timer, or log a workout afterwards without it. Swap or edit any exercise from its menu.',pos:'top'},
  {target:'[data-page="nutrition"]',title:'Nutrition',desc:'Calorie and macro targets, with meals you log by search, barcode or by hand.',pos:'top'},
  {target:'[data-page="guild"]',title:'Guild',desc:'Friend activity, the leaderboard, your friends and chat. Tap any hunter to see their profile.',pos:'top'},
  {target:'[data-page="profile"]',title:'Profile',desc:'Your Status window, body stats, badges, shop, wardrobe and settings.',pos:'top'}
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
  tip.innerHTML=`<div class="tour-step-count">${tourStep+1} of ${TOUR_STEPS.length}</div><div class="tour-title">${step.title}</div><div class="tour-desc">${step.desc}</div><div class="tour-actions"><button class="tour-btn" onclick="nextTourStep()">${tourStep<TOUR_STEPS.length-1?'Next':'Done'}</button></div>`;
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
  toast('Tour complete! +25 XP');
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
function updateChatBadge(count){unreadChatCount=count;updateGuildDots()}
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
  if(!confirm(`Complete "${evt.name}"?\n\n${evt.desc}`))return;
  const ec=userData.eventsCompleted||{};ec[today]=true;
  const evtCount=Object.keys(ec).length;
  const gained=addXP(evt.xp);
  unlockAch('event_first');if(evtCount>=5)unlockAch('event_5');
  await saveUser({eventsCompleted:ec,xp:userData.xp});await saveLeaderboard();
  updateTopBar();checkRankUp();renderMissions();
  toast(`${evt.name} +${gained} XP`);
}

// ═══════════ PROGRESSION TRACKS ═══════════
function getTrackProgress(task){
  switch(task.check){
    case 'workouts':return getLiftLogs().length;
    case 'maxlift':return Math.max(0,...getLiftLogs().flatMap(e=>Array.isArray(e.exercises)?e.exercises.flatMap(ex=>Array.isArray(ex.sets)?ex.sets.map(s=>parseInt(s.weight)||0):[]):[]));
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
  let h=`<div class="sec-row"><span class="sec">Class track</span><span class="mist sm">${esc(cls)}</span></div><div class="li-list">`;
  for(const track of tracks){
    if(track.requires&&!completed.includes(track.requires)){
      h+=`<div class="li track-li locked"><span class="ico">${icon('ladder',18)}</span><span class="t">${esc(track.name)}<small>Finish the tier before it to unlock</small></span></div>`;
      continue;
    }
    if(completed.includes(track.id)){
      h+=`<div class="li track-li"><span class="ico lilac">${icon('check',18)}</span><span class="t">${esc(track.name)}<small>Complete</small></span></div>`;
      continue;
    }
    const allDone=track.tasks.every(t=>getTrackProgress(t)>=t.target);
    h+=`<div class="li track-li open"><span class="ico sys">${icon('ladder',18)}</span><span class="t">${esc(track.name)}<small>${esc(track.desc)}</small></span></div><div class="track-tasks">`;
    track.tasks.forEach(t=>{
      const p=Math.min(getTrackProgress(t),t.target);const pct=Math.min(100,(p/t.target)*100);
      h+=`<div class="track-task"><div class="track-task-top"><span>${esc(t.desc)}</span><span class="num mist">${p} / ${t.target}</span></div><div class="track"><div class="fill" style="width:${pct}%"></div></div><div class="gold sm">+${t.xp} XP</div></div>`;
    });
    if(allDone)h+=`<button class="btn-p" onclick="claimTrack('${track.id}')">Claim ${esc(track.name)}</button>`;
    h+=`</div>`;
  }
  return h+`</div>`;
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
  {const nextT=tracks[tracks.indexOf(track)+1];celebrate({kind:'tier',name:track.name,sub:`${cls} track.${nextT?' '+nextT.name+' is open':' Track finished'}`,xp:totalXp})}
}

// ═══════════ PASSIVE ACHIEVEMENT CHECKER ═══════════
// Batches all silent unlocks into a single Firestore write to avoid
// spamming the DB on app open with 50+ parallel saves (which can stall).
async function checkPassiveAchievements(){
  const U=unlockAchSilent; // local shorthand, batched
  const xpBefore=userData.xp;
  const achBefore=userData.achievements.length;
  try{
    // Bio & pic
    if(userData.bio&&userData.bio.trim())U('set_bio');
    if(userData.profilePic)U('set_pic');
    // XP milestones
    if(userData.xp>=1000)U('xp_1k');
    if(userData.xp>=5000)U('xp_5k');
    if(userData.xp>=10000)U('xp_10k');
    // Workout milestones (lifts only, not activities)
    const wc=getLiftLogs().length;
    if(wc>=1)U('first_workout');if(wc>=10)U('workouts_10');if(wc>=25)U('workouts_25');
    if(wc>=50)U('workouts_50');if(wc>=100)U('workouts_100');if(wc>=200)U('workouts_200');
    if(wc>=300)U('workouts_300');if(wc>=500)U('workouts_500');
    // Weekly streak
    const ws=calcWeeklyStreak();
    if(ws>=2)U('wk_streak_2');if(ws>=4)U('wk_streak_4');if(ws>=8)U('wk_streak_8');
    if(ws>=12)U('wk_streak_12');if(ws>=26)U('wk_streak_26');if(ws>=52)U('wk_streak_52');
    // Full weeks
    const fw=calcFullWeeks();
    if(fw>=1)U('full_week');if(fw>=5)U('full_week_5');if(fw>=10)U('full_week_10');if(fw>=20)U('full_week_20');
    // Total missions
    let totalMissions=0;Object.values(userData.missionsCompleted||{}).forEach(arr=>totalMissions+=(arr||[]).length);
    if(totalMissions>=25)U('missions_total_25');if(totalMissions>=100)U('missions_total_100');
    // Event count
    const evtCount=Object.keys(userData.eventsCompleted||{}).length;
    if(evtCount>=1)U('event_first');if(evtCount>=5)U('event_5');
    // Food days
    const foodDays=Object.keys(userData.foodLog||{}).filter(k=>{const d=userData.foodLog[k];if(Array.isArray(d))return d.length>0;if(d&&d.meals)return Object.values(d.meals).some(m=>m&&m.length>0);return false}).length;
    if(foodDays>=1)U('food_log_1');if(foodDays>=7)U('food_log_7');if(foodDays>=14)U('food_log_14');
    if(foodDays>=30)U('food_log_30');if(foodDays>=60)U('food_log_60');
    // Friends
    const fc=(userData.friends||[]).length;
    if(fc>=1)U('add_friend');if(fc>=5)U('friends_5');if(fc>=10)U('friends_10');
    // Scan count
    const scanCount=parseInt(userData.scanCount)||0;
    if(scanCount>=1)U('scan_1');if(scanCount>=5)U('scan_5');
    // Message count
    const msgCount=parseInt(userData.messageCount)||0;
    if(msgCount>=1)U('chat_first');if(msgCount>=10)U('chat_10');
    // Cardio count
    const actCount=getActivityLogs().length;
    if(actCount>=1)U('cardio_first');if(actCount>=5)U('cardio_5');if(actCount>=20)U('cardio_20');
    // Rest days
    const restLogs=getRestLogs();const activeRestCount=restLogs.filter(e=>e.restType==='active').length;
    if(restLogs.length>=1)U('rest_first');
    if(restLogs.length>=5)U('rest_5');
    if(restLogs.length>=20)U('recovery_pro');
    if(activeRestCount>=10)U('active_rest_10');
    // Weigh-ins
    const wiCount=(userData.weighIns||[]).length;
    if(wiCount>=1)U('first_weighin');
    if(wiCount>=4)U('weighin_4');
    if(wiCount>=12)U('weighin_12');
    if(wiCount>=26)U('weighin_26');
    // Weight change goals (requires at least 2 weigh-ins)
    if(wiCount>=2){
      const first=userData.weighIns[0].weight,last=userData.weighIns[userData.weighIns.length-1].weight;
      const diff=last-first;
      if(diff<=-5)U('goal_5down');
      if(diff<=-10)U('goal_10down');
      if(diff>=5)U('goal_5up');
    }
    // Trainer connections
    if(userData.trainer)U('trainer_connected');
    if(userData.role==='trainer'&&(userData.clients||[]).length>=1)U('trainer_first_client');
    // Powerlifter 1000 Club
    if(userData.class==='Powerlifter'){
      const prs=userData.prs||{};const total=(parseInt(prs.bench)||0)+(parseInt(prs.squat)||0)+(parseInt(prs.deadlift)||0);
      if(total>=1000)U('pl_1000_club');
    }
    // Bowling secret
    if(getActivityLogs().some(e=>e.activityType==='Bowling'))U('secret_bowler');
    // Dawn Patrol (10 workouts before 6 AM)
    const dawnCount=getLiftLogs().filter(e=>new Date(e.date).getHours()<6).length;
    if(dawnCount>=10)U('dawn_patrol');
    // Twice a day (3 separate days with 2+ workouts)
    const byDay={};getLiftLogs().forEach(e=>{const k=new Date(e.date).toDateString();byDay[k]=(byDay[k]||0)+1});
    const twiceDays=Object.values(byDay).filter(c=>c>=2).length;
    if(twiceDays>=3)U('twice_day');
    // Perfect weeks (10 perfect weeks)
    if(calcPerfectWeeks()>=10)U('perfectionist');
    // ── Secret Achievements ──
    if(userData.createdAt){const created=userData.createdAt.toDate?userData.createdAt.toDate():new Date(userData.createdAt);if(created<new Date('2026-05-01'))U('secret_og')}
    if(userData.xp===404)U('secret_404');
    const todayPal=getTodayStr().replace(/-/g,'');if(todayPal===todayPal.split('').reverse().join(''))U('secret_palindrome');
    if(wc>=7&&ws>=7&&fc>=7)U('secret_lucky7');
    if(userData.achievements.length>=50)U('secret_100pct');
    const nightLogs=workoutLog.filter(e=>{const h=new Date(e.date).getHours();return h>=0&&h<5}).length;
    if(nightLogs>=5)U('secret_night_shift');
    // ── v1.15.0: Fable Set + content pack ──
    const lifts=getLiftLogs();
    // Phoenix: a log whose previous log was 14+ days earlier
    const sortedDates=workoutLog.map(e=>new Date(e.date).getTime()).sort((a,b)=>a-b);
    for(let i=1;i<sortedDates.length;i++){if(sortedDates[i]-sortedDates[i-1]>=14*86400000){U('phoenix');break}}
    // Twelve Labors: 12 event missions
    if(Object.keys(userData.eventsCompleted||{}).length>=12)U('twelve_labors');
    // Volume Road + Atlas
    let totalVol=0;lifts.forEach(e=>{(e.exercises||[]).forEach(ex=>{(ex.sets||[]).forEach(s=>{const w=parseFloat(s.weight)||0,r=parseFloat(s.reps)||0;totalVol+=w*r})})});
    if(totalVol>=100000)U('vol_100k');if(totalVol>=500000)U('vol_500k');if(totalVol>=1000000)U('atlas_1m');
    // Sisyphus: same dayId logged 25×
    const dayCounts={};lifts.forEach(e=>{if(e.dayId)dayCounts[e.dayId]=(dayCounts[e.dayId]||0)+1});
    if(Object.values(dayCounts).some(c=>c>=25))U('sisyphus');
    // David & Goliath: any set ≥ 2× bodyweight
    const bw=parseFloat((userData.stats||{}).weight)||0;
    if(bw>0){const maxLift=Math.max(0,...lifts.flatMap(e=>(e.exercises||[]).flatMap(ex=>(ex.sets||[]).map(s=>parseFloat(s.weight)||0))));if(maxLift>=bw*2)U('david_goliath')}
    // Odyssey + timed sessions + marathon + efficient killer
    const timed=workoutLog.filter(e=>e.durationSec>0);
    const totalMin=timed.reduce((a,e)=>a+e.durationSec/60,0);
    if(totalMin>=10000)U('odyssey_10k');
    if(timed.length>=10)U('timed_10');if(timed.length>=100)U('timed_100');
    if(timed.some(e=>e.durationSec>=90*60))U('marathon_session');
    if(timed.some(e=>{if(e.durationSec>=45*60||e.isRest||e.isActivity)return false;const sets=(e.exercises||[]).flatMap(ex=>ex.sets||[]);const filled=sets.filter(s=>s&&((s.weight&&String(s.weight).trim())||(s.reps&&String(s.reps).trim())));return filled.length>0&&filled.every(s=>s.done)}))U('efficient_killer');
    // The Bard: 10 entries with notes
    if(workoutLog.filter(e=>(e.notes&&String(e.notes).trim())||(e.exercises||[]).some(ex=>ex.note&&String(ex.note).trim())).length>=10)U('the_bard');
    // Trials + levels
    if((userData.trialsCompleted||[]).length>=3)U('trial_legends');
    const lvl=getLevelInfo();
    if(lvl.level>=10)U('level_10_any');
    if(lvl.rank.name==='S-RANK'&&lvl.level>=50)U('s_rank_50');
    if(lvl.rank.name==='S-RANK'&&lvl.level>=100)U('pantheon');
    // Achilles: any calf exercise logged
    if(lifts.some(e=>(e.exercises||[]).some(ex=>/calf|calves/i.test(ex.name||''))))U('achilles_heel');
    // Here Be Dragons: 3-4 AM log
    if(workoutLog.some(e=>new Date(e.date).getHours()===3))U('here_dragons');
    // Explorer + Iron Lungs
    const actTypes=new Set(getActivityLogs().map(e=>e.activityType).filter(Boolean));
    if(actTypes.size>=5)U('explorer_acts');
    const cardioMin=getActivityLogs().reduce((a,e)=>a+(parseFloat(e.duration)||0),0);
    if(cardioMin>=1000)U('cardio_1000');
    // Social: pokes sent counter + 5 friends in one day
    if((userData.pokesSent||0)>=100)U('pokes_100');
    const pokedToday=userData.pokedToday||{};
    if(Object.values(pokedToday).filter(d=>d===getTodayStr()).length>=5)U('social_butterfly');
    // Full Week Fed: 7 consecutive days with food logged
    const fdDays=Object.keys(userData.foodLog||{}).filter(k=>{const d=userData.foodLog[k];return d&&d.meals&&Object.values(d.meals).some(m=>Array.isArray(m)&&m.length)}).sort();
    let fdStreak=1,fdBest=fdDays.length?1:0;
    for(let i=1;i<fdDays.length;i++){const gap=(new Date(fdDays[i])-new Date(fdDays[i-1]))/86400000;fdStreak=gap===1?fdStreak+1:1;if(fdStreak>fdBest)fdBest=fdStreak}
    if(fdBest>=7)U('food_week_7');
    // Label Reader + Historian
    if((parseInt(userData.scanCount)||0)>=25)U('scan_25');
    if(workoutLog.some(e=>e.backdated))U('the_historian');
    // Date-based: New Year, Leap of Faith, Friday Night Lights
    workoutLog.forEach(e=>{const d=new Date(e.date);if(e.backdated)return;
      if(d.getMonth()===0&&d.getDate()===1)U('new_year_log');
      if(d.getMonth()===1&&d.getDate()===29)U('leap_of_faith');
      if(!e.isRest&&!e.isActivity&&d.getDay()===5&&d.getHours()>=20)U('friday_lights');
    });
    // Steps (v1.31)
    try{stepAchEarnedNow().forEach(id=>U(id))}catch(e){}
    // Fable: the meta-capstone
    if(userData.achievements.length>=100)U('fable_legend');
  }catch(e){console.warn('[checkPassiveAchievements] eval error:',e)}
  // ONE batched write at the end
  const gainedAch=userData.achievements.length-achBefore;
  const gainedXp=userData.xp-xpBefore;
  if(gainedAch>0||gainedXp>0){
    try{
      // The database caps each write at +3000 XP / +600 shards. A big one-time batch
      // (e.g. a content drop after a long break) steps up in chunks instead of failing.
      const userRef=db.collection('users').doc(U.uid);
      for(let x=xpBefore+2500;x<userData.xp;x+=2500)await userRef.update({xp:x});
      await saveUser({achievements:userData.achievements,xp:userData.xp});
      await saveLeaderboard();
      updateTopBar();
      if(gainedAch>0){const s0=userData.shards||0,s1=s0+gainedAch*SHARD_REWARDS.achievement;for(let s=s0+500;s<s1;s+=500)await userRef.update({shards:s});userData.shards=s1;await saveUser({shards:s1});userData.achievements.slice(achBefore).forEach(id=>celebrate({kind:'badge',a:ACHIEVEMENTS.find(x=>x.id===id)}))}
      console.log('[checkPassiveAchievements] batched',gainedAch,'unlocks, +'+gainedXp,'XP');
    }catch(e){console.warn('[checkPassiveAchievements] batch save failed:',e)}
  }
}

// ═══════════ NOTIFICATIONS ═══════════
let notifPermission='default';
let realtimeUnsubs=[];
function initNotifications(){
  if(!('Notification' in window))return;
  notifPermission=Notification.permission;
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);

  // iOS: only works if installed as PWA (16.4+)
  if(isIOS&&!isStandalone){
    // Don't request — won't work. Prompt user to install instead.
    setTimeout(()=>{if(!localStorage.getItem('iosInstallPrompted'))showIOSInstallPrompt()},15000);
    return;
  }
  // Android web + Installed PWAs: ask for permission
  if(notifPermission==='default'){
    setTimeout(()=>{
      Notification.requestPermission().then(p=>{
        notifPermission=p;
        if(p==='granted'){
          toast('Notifications enabled!');
          startRealtimeListeners();
          checkTrainReminder();
        }
      });
    },10000);
  }else if(notifPermission==='granted'){
    // Already granted — start listeners
    startRealtimeListeners();
    setTimeout(()=>checkTrainReminder(),3000);
  }
  // Also check periodically
  setInterval(()=>checkTrainReminder(),1800000);
}

function showIOSInstallPrompt(){
  localStorage.setItem('iosInstallPrompted','1');
  if(confirm('Install LexenFitness to your Home Screen?\n\nTo get push notifications on iPhone, you need to install this app.\n\n1. Tap the Share button () in Safari\n2. Scroll down and tap "Add to Home Screen"\n3. Open the app from your home screen\n\nTap OK for more details.')){
    alert('Step-by-step:\n\n1. Tap the Share icon at the bottom of Safari (square with arrow up)\n2. Scroll through the options\n3. Tap "Add to Home Screen"\n4. Tap "Add" in the top right\n5. Close Safari, open the LexenFitness app from your home screen\n\nOnce installed, you\'ll get push notifications for messages, friend requests, and pokes.');
  }
}

function sendNotif(title,body,opts={}){
  // Prefer service worker notifications (they persist + handle clicks properly)
  // Respect per-type user preferences
  const prefs=userData.notifPrefs||{};
  if(opts.type&&prefs[opts.type]===false)return;
  if(notifPermission!=='granted')return;
  if(navigator.serviceWorker&&navigator.serviceWorker.controller){
    navigator.serviceWorker.controller.postMessage({
      type:'SHOW_NOTIFICATION',
      payload:{title,body,tag:opts.tag||'default',data:opts.data||{}}
    });
  }else{
    // Fallback to basic notification API
    try{new Notification(title,{body,icon:'icons/icon-192x192.png',badge:'icons/icon-96x96.png',tag:opts.tag})}catch(e){}
  }
}

function checkTrainReminder(){
  if(notifPermission!=='granted')return;
  const prefs=userData.notifPrefs||{};if(prefs.training===false)return;
  const hr=new Date().getHours();
  if(hr<10||hr>21)return;
  const todayLogs=workoutLog.filter(e=>{const d=new Date(e.date);return d.toDateString()===new Date().toDateString()});
  if(todayLogs.length>0)return;
  const lastNotif=localStorage.getItem('lastTrainNotif');
  const today=getTodayStr();
  if(lastNotif===today)return;
  localStorage.setItem('lastTrainNotif',today);
  const ws=calcWeeklyStreak();
  const {label}=getXpMultiplier();
  let body='The System is watching. Don\'t let your streak die.';
  if(ws>0)body=`${ws}-week streak on the line. Get in there.`;
  if(label)body+=` ${label}`;
  sendNotif('LexenFitness',body,{type:'training',tag:'train-reminder'});
}

// ─── Real-time listeners for messages, friend requests, pokes, event missions ───
function startRealtimeListeners(){
  if(!U)return;
  // Clear any old
  realtimeUnsubs.forEach(u=>{try{u()}catch(e){}});
  realtimeUnsubs=[];
  const sessionStart=Date.now();
  const prefs=userData.notifPrefs||{};

  // Messages: listen to incoming chats where user is a member
  if(prefs.messages!==false){
    try{
      const unsub=db.collection('chats').where('members','array-contains',U.uid).onSnapshot(snap=>{
        snap.docChanges().forEach(change=>{
          if(change.type!=='modified'&&change.type!=='added')return;
          const data=change.doc.data();
          // Only notify if this update is AFTER the session started AND the last sender is not me
          const lastMsg=data.lastMessage;if(!lastMsg)return;
          const lastFrom=data.lastFrom;if(lastFrom===U.uid)return;
          const lastAt=data.lastAt?(data.lastAt.toMillis?data.lastAt.toMillis():new Date(data.lastAt).getTime()):0;
          if(lastAt<sessionStart)return;
          // Only notify if app is NOT focused on chat tab
          const isVisible=!document.hidden&&currentPage==='chat';
          if(isVisible)return;
          // Debounce: skip if we notified this chat within last 30s
          const key='lastMsgNotif_'+change.doc.id;
          const prev=parseInt(sessionStorage.getItem(key)||'0');
          if(Date.now()-prev<30000)return;
          sessionStorage.setItem(key,String(Date.now()));
          const preview=lastMsg.length>60?lastMsg.slice(0,57)+'...':lastMsg;
          sendNotif('New Message',preview,{type:'messages',tag:'msg-'+change.doc.id,data:{url:'/lexenfitness/#chat'}});
        });
      });
      realtimeUnsubs.push(unsub);
    }catch(e){console.error('Msg listener failed:',e)}
  }

  // Friend requests: listen for incoming pending requests
  if(prefs.friendRequests!==false){
    try{
      const unsub=db.collection('friendRequests').where('to','==',U.uid).where('status','==','pending').onSnapshot(snap=>{
        snap.docChanges().forEach(change=>{
          if(change.type!=='added')return;
          const data=change.doc.data();
          const ts=data.createdAt?(data.createdAt.toMillis?data.createdAt.toMillis():new Date(data.createdAt).getTime()):0;
          if(ts<sessionStart)return;
          sendNotif('Friend Request','@'+(data.fromUsername||'someone')+' wants to be friends',{type:'friendRequests',tag:'friend-'+change.doc.id,data:{url:'/lexenfitness/#profile'}});
        });
      });
      realtimeUnsubs.push(unsub);
    }catch(e){console.error('Friend req listener failed:',e)}
  }

  // Pokes: listen for updates to my own user doc where pokes array changes
  if(prefs.pokes!==false){
    try{
      const unsub=db.collection('users').doc(U.uid).onSnapshot(snap=>{
        if(!snap.exists)return;
        const data=snap.data();
        const pokes=data.pokes||[];
        const lastSeen=parseInt(localStorage.getItem('lastPokeSeen')||'0');
        const newPokes=pokes.filter(p=>new Date(p.at).getTime()>Math.max(lastSeen,sessionStart));
        if(newPokes.length){
          const latest=newPokes[newPokes.length-1];
          localStorage.setItem('lastPokeSeen',String(Date.now()));
          sendNotif('Poke!','@'+latest.fromName+' poked you — time to train',{type:'pokes',tag:'poke',data:{url:'/lexenfitness/#profile'}});
        }
      });
      realtimeUnsubs.push(unsub);
    }catch(e){console.error('Poke listener failed:',e)}
  }
}

// Event mission notification — fires once a day when event is available and not done
function checkEventMissionNotif(){
  if(notifPermission!=='granted')return;
  const prefs=userData.notifPrefs||{};if(prefs.events===false)return;
  const today=getTodayStr();
  const evt=getEventMission(today);if(!evt)return;
  const evtDone=(userData.eventsCompleted||{})[today];if(evtDone)return;
  const key='evtNotif_'+today;
  if(localStorage.getItem(key))return;
  localStorage.setItem(key,'1');
  sendNotif('EVENT MISSION',evt.name+' — '+evt.desc+' (+'+evt.xp+' XP)',{type:'events',tag:'event-'+today,data:{url:'/lexenfitness/#missions'}});
}

// Handle click from notification (SW posts this)
if(navigator.serviceWorker){
  navigator.serviceWorker.addEventListener('message',e=>{
    if(!e.data)return;
    if(e.data.type==='NOTIFICATION_CLICK'){
      const url=e.data.data&&e.data.data.url;
      if(url){const hash=url.split('#')[1];if(hash)switchPage(hash)}
    }
  });
}

// ═══════════ CARDIO / ACTIVITY LOG ═══════════
const ACTIVITY_CAL_PER_MIN={Walking:4,Running:10,Cycling:7,Swimming:8,Hiking:6,Bowling:3,Basketball:7,Soccer:8,Tennis:7,Yoga:3,Stretching:2,'Jump Rope':11,Rowing:8,Stairmaster:9,Elliptical:7,Other:5};
function openActivityLog(){
  $('actType').value='Walking';$('actDuration').value='';$('actCalories').value='';$('actSteps').value='';$('actNotes').value='';$('actCustomName').value='';$('actCustomRow').style.display='none';
  $('actType').onchange=function(){$('actCustomRow').style.display=this.value==='Other'?'':'none'};
  $('actDuration').oninput=function(){
    const type=$('actType').value;const dur=parseInt(this.value)||0;
    const est=Math.round(dur*(ACTIVITY_CAL_PER_MIN[type]||5));
    $('actCalories').placeholder='~'+est+' cal (auto)';
  };
  // Backdate indicator
  const h2=document.querySelector('#activityModal h2');
  if(h2){
    if(pendingBackdateISO){
      const d=new Date(pendingBackdateISO);
      h2.textContent='Log Activity · '+d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+' (no XP)';
    }else h2.textContent='Log Activity';
  }
  $('activityModal').classList.add('open');
}
function closeActivityLog(){$('activityModal').classList.remove('open')}
async function saveActivityLog(){
  const type=$('actType').value;
  const name=type==='Other'?($('actCustomName').value.trim()||'Activity'):type;
  const dur=parseInt($('actDuration').value);
  if(!dur){toast('Enter duration');return}
  const calBurned=parseInt($('actCalories').value)||Math.round(dur*(ACTIVITY_CAL_PER_MIN[type]||5));
  const steps=parseInt($('actSteps').value)||0;
  const notes=$('actNotes').value.trim();
  const dateISO=pendingBackdateISO||new Date().toISOString();
  const isBackdated=!!pendingBackdateISO;pendingBackdateISO=null;
  const entry={
    date:dateISO,
    dayId:'activity_'+Date.now(),
    dayTitle:name,
    isActivity:true,
    activityType:type,
    duration:dur,
    calBurned,
    steps,
    notes,
    exercises:[{name,sets:1,reps:dur+'min',sets_data:[{reps:dur}]}]
  };
  if(isBackdated)entry.backdated=true;
  const aref=await db.collection('users').doc(U.uid).collection('log').add(entry);
  entry._id=aref.id;
  workoutLog.unshift(entry);
  let xp=15;if(isBackdated)xp=0;
  const gained=addXP(xp);
  if(!isBackdated){
    unlockAch('cardio_first');
    const actCount=getActivityLogs().filter(e=>!e.backdated).length;
    if(actCount>=5)unlockAch('cardio_5');if(actCount>=20)unlockAch('cardio_20');
  }
  if(!isBackdated)queueFeedEvent('cardio',{type:String(name||'Cardio').slice(0,30),min:num(dur)});
  await saveUser({xp:userData.xp,feedEvents:userData.feedEvents||[]});await saveLeaderboard();
  updateTopBar();checkRankUp();
  closeActivityLog();
  let msg;
  if(isBackdated)msg=`${name} logged for earlier day · ${calBurned} cal (no XP)`;
  else msg=`${name} logged! +${gained} XP · ${calBurned} cal burned`;
  toast(msg);
}

// ═══════════ REST DAY ═══════════
let selectedRestType=null;
function openRestLog(){
  selectedRestType=null;
  document.querySelectorAll('.rest-option').forEach(r=>r.classList.remove('selected'));
  $('restNotes').value='';
  const btn=$('restSaveBtn');btn.disabled=true;btn.textContent='Pick a type';
  const h2=document.querySelector('#restModal h2');
  if(h2){
    if(pendingBackdateISO){
      const d=new Date(pendingBackdateISO);
      h2.textContent='Log Rest · '+d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+' (no XP)';
    }else h2.textContent='Log Rest Day';
  }
  $('restModal').classList.add('open');
}
function closeRestLog(){$('restModal').classList.remove('open')}
function selectRestType(type){
  selectedRestType=type;
  document.querySelectorAll('.rest-option').forEach(r=>r.classList.toggle('selected',r.dataset.rest===type));
  const btn=$('restSaveBtn');btn.disabled=false;btn.textContent=type==='active'?'Log Active Rest':'Log Full Rest';
}
async function saveRestLog(){
  if(!selectedRestType)return;
  const isActive=selectedRestType==='active';
  const notes=$('restNotes').value.trim();
  const dateISO=pendingBackdateISO||new Date().toISOString();
  const isBackdated=!!pendingBackdateISO;pendingBackdateISO=null;
  // Check if already logged rest on that day
  const dayStr=new Date(dateISO).toDateString();
  const alreadyRest=workoutLog.some(e=>e.isRest&&new Date(e.date).toDateString()===dayStr);
  if(alreadyRest){toast('Already logged rest for that day');closeRestLog();return}
  const entry={
    date:dateISO,
    dayId:'rest_'+Date.now(),
    dayTitle:isActive?'Active Rest':'Full Rest',
    isRest:true,
    restType:selectedRestType,
    notes,
    exercises:[]
  };
  if(isBackdated)entry.backdated=true;
  const rref=await db.collection('users').doc(U.uid).collection('log').add(entry);
  entry._id=rref.id;
  workoutLog.unshift(entry);
  let xp=isActive?10:5;if(isBackdated)xp=0;
  const gained=addXP(xp);
  if(!isBackdated){
    unlockAch('rest_first');
    const restCount=getRestLogs().filter(e=>!e.backdated).length;
    if(restCount>=5)unlockAch('rest_5');
    if(restCount>=20)unlockAch('recovery_pro');
  }
  await saveUser({xp:userData.xp});await saveLeaderboard();
  updateTopBar();
  closeRestLog();
  let msg;
  if(isBackdated)msg=`${isActive?'':''} ${isActive?'Active':'Full'} rest logged for earlier day (no XP)`;
  else msg=`${isActive?'':''} ${isActive?'Active':'Full'} rest logged! +${gained} XP`;
  toast(msg);
}

// ═══════════ WEIGH-IN / CHECK-IN ═══════════
function openWeighIn(){
  const st=userData.stats||{};
  $('wiWeight').value=st.weight||'';
  $('wiBodyFat').value=st.bodyFat||'';
  $('wiNotes').value='';
  // Render history
  const history=(userData.weighIns||[]).slice(-8).reverse();
  const histEl=$('wiHistory');
  if(!history.length){histEl.innerHTML='<p style="color:var(--dim);font-size:.7rem;margin-top:.5rem">No check-ins yet. First one is the baseline.</p>'}
  else{
    let h='<div class="section-title" style="margin:.8rem 0 .3rem;font-size:.6rem">Recent check-ins</div>';
    history.forEach((w,i)=>{
      const dt=new Date(w.date).toLocaleDateString('en-US',{month:'short',day:'numeric'});
      const diff=i<history.length-1?(w.weight-history[i+1].weight).toFixed(1):'—';
      const diffColor=diff==='—'?'var(--muted)':diff>0?'var(--gold)':'var(--green)';
      h+=`<div class="weigh-row"><span class="weigh-date">${dt}</span><span class="weigh-weight">${w.weight} lbs</span><span class="weigh-diff" style="color:${diffColor}">${diff!=='—'?(diff>0?'+':'')+diff:''}</span></div>`;
    });
    histEl.innerHTML=h;
  }
  $('weighInModal').classList.add('open');
}
function closeWeighIn(){$('weighInModal').classList.remove('open')}
async function saveWeighIn(){
  const weight=parseFloat($('wiWeight').value);
  if(!weight||weight<50||weight>700){toast('Enter a valid weight');return}
  const bodyFat=parseFloat($('wiBodyFat').value)||null;
  const notes=$('wiNotes').value.trim();
  const entry={date:new Date().toISOString(),weight,bodyFat,notes};
  const history=userData.weighIns||[];
  history.push(entry);
  // Also update current stats
  const stats={...(userData.stats||{}),weight:String(weight)};
  if(bodyFat)stats.bodyFat=String(bodyFat);
  await saveUser({weighIns:history,stats});
  const gained=addXP(15);
  unlockAch('first_weighin');
  if(history.length>=4)unlockAch('weighin_4');
  if(history.length>=12)unlockAch('weighin_12');
  if(history.length>=26)unlockAch('weighin_26');
  closeWeighIn();renderProfile();
  toast(`Check-in logged! +${gained} XP`);
}

// ═══════════ PHOTO PRIVACY ═══════════
function checkPhotoPrivacy(then){
  if(localStorage.getItem('photoPrivacyAccepted')==='1'){then();return}
  window._pendingPhotoAction=then;
  $('photoPrivacyModal').classList.add('open');
}
function acceptPhotoPrivacy(){
  localStorage.setItem('photoPrivacyAccepted','1');
  $('photoPrivacyModal').classList.remove('open');
  if(window._pendingPhotoAction){const fn=window._pendingPhotoAction;window._pendingPhotoAction=null;fn()}
}

// ═══════════ TRAINER MODE ═══════════
let trainerClients=[];
async function renderTrainerDashboard(){
  const el=$('trainerContent');if(!el)return;
  let h=`<div class="page-title">Trainer dashboard</div>`;
  h+=`<div class="page-sub">Monitor your clients' progress and stay connected</div>`;
  h+=`<div class="trainer-code-card"><div class="trainer-code-label">Your trainer code</div><div class="trainer-code">${userData.trainerCode||'Generate below'}</div>`;
  if(!userData.trainerCode)h+=`<button class="m-save-btn" onclick="generateTrainerCode()">Generate Code</button>`;
  else h+=`<button class="copy-code-btn" onclick="copyTrainerCode()">Copy</button><div style="font-size:.62rem;color:var(--dim);margin-top:4px">Share this with your clients</div>`;
  h+=`</div>`;
  h+=`<div class="section-title" style="margin:1rem 0 .3rem">CLIENTS (${(userData.clients||[]).length})</div>`;
  const clients=userData.clients||[];
  if(!clients.length){h+=`<p style="color:var(--muted);font-size:.82rem">No clients yet. Share your trainer code with clients so they can connect.</p>`}
  else{
    h+=`<div id="trainerClientList">Loading...</div>`;
  }
  el.innerHTML=h;
  if(clients.length)loadTrainerClientList();
}
async function loadTrainerClientList(){
  const el=$('trainerClientList');if(!el)return;
  const clients=userData.clients||[];
  let h='';
  for(const uid of clients.slice(0,30)){
    try{
      const d=await db.collection('users').doc(uid).get();
      if(!d.exists)continue;
      const u=d.data();
      const logSnap=await db.collection('users').doc(uid).collection('log').orderBy('date','desc').limit(20).get();
      let lifts=0,activities=0,rest=0,last=null;
      logSnap.forEach(doc=>{const e=doc.data();if(e.isRest)rest++;else if(e.isActivity)activities++;else lifts++;if(!last||new Date(e.date)>new Date(last))last=e.date});
      const daysSince=last?Math.floor((Date.now()-new Date(last).getTime())/86400000):999;
      const status=daysSince<=2?'Active':daysSince<=7?'Slow':'Inactive';
      const weighIns=(u.weighIns||[]).length;
      h+=`<div class="client-card" onclick="openClientDetail('${safeId(uid)}')">
        <div class="lb-pic">${avatarHtml(u.profilePic)}</div>
        <div class="client-info">
          <div class="client-name">@${esc(u.username||'hunter')} <span class="client-status">${status}</span></div>
          <div class="client-stats">${lifts} lifts · ${activities} cardio · ${rest} rest · ${weighIns} check-ins</div>
          <div class="client-goal">${esc(u.nutritionGoal||u.goal||'No goal set')}</div>
        </div>
      </div>`;
    }catch(e){}
  }
  el.innerHTML=h||'<p style="color:var(--muted);font-size:.78rem">Could not load clients. Make sure they\'ve accepted your invite.</p>';
}
async function generateTrainerCode(){
  const code=genFriendCode();
  await saveUser({trainerCode:code,role:'trainer'});
  await db.collection('trainerCodes').doc(code).set({uid:U.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  renderTrainerDashboard();toast('Trainer code generated!');
}
function copyTrainerCode(){
  const c=userData.trainerCode||'';if(!c)return;
  if(navigator.clipboard){navigator.clipboard.writeText(c).then(()=>toast('Code copied: '+c)).catch(()=>fallbackCopy(c))}else{fallbackCopy(c)}
}
async function openClientDetail(uid){
  try{
    const d=await db.collection('users').doc(uid).get();
    if(!d.exists){toast('Client not found');return}
    const u=d.data();
    const logSnap=await db.collection('users').doc(uid).collection('log').orderBy('date','desc').limit(60).get();
    const logs=[];logSnap.forEach(doc=>logs.push(doc.data()));
    const weighIns=(u.weighIns||[]).slice(-10).reverse();
    const modal=$('profileCardModal');if(!modal)return;

    // Calculate client metrics for trainer
    const now=Date.now();
    const last=logs[0]?new Date(logs[0].date).getTime():null;
    const daysSince=last?Math.floor((now-last)/86400000):999;
    const statusEmoji=daysSince<=2?'':daysSince<=7?'':'';
    const statusLabel=daysSince<=2?`Active (${daysSince}d ago)`:daysSince<=7?`Slow (${daysSince}d ago)`:`Inactive (${daysSince}d ago)`;

    // Weekly averages (last 30 days)
    const recent=logs.filter(e=>new Date(e.date).getTime()>now-30*86400000);
    const liftsRecent=recent.filter(e=>!e.isRest&&!e.isActivity).length;
    const actRecent=recent.filter(e=>e.isActivity).length;
    const restRecent=recent.filter(e=>e.isRest).length;
    const weeksRecent=Math.max(1,Math.ceil(recent.length/4));
    const avgPerWeek=(recent.length/weeksRecent).toFixed(1);

    // Weight trend
    const allWeighIns=u.weighIns||[];
    let weightChange=null,weightChangeDays=null;
    if(allWeighIns.length>=2){
      const first=allWeighIns[0],latest=allWeighIns[allWeighIns.length-1];
      weightChange=(parseFloat(latest.weight)-parseFloat(first.weight)).toFixed(1);
      weightChangeDays=Math.floor((new Date(latest.date)-new Date(first.date))/86400000);
    }

    const rank=u.rank||'E-RANK';
    const prs=u.prs||{};
    const st=u.stats||{};
    const goal=u.nutritionGoal||u.goal||'No goal set';

    let h=`<div class="pc-header">
      <div class="pc-pic${frameClass(u.frame||(u.cosmetics&&u.cosmetics.frame))}">${avatarHtml(u.profilePic)}</div>
      <div class="pc-info">
        <div class="pc-username${nameClass(u.nameColor||(u.cosmetics&&u.cosmetics.name))}">@${esc(u.username||'hunter')}</div>
        ${titleName(u.titleId)?`<div class="pc-ttl">${titleLine(u.titleId)}</div>`:''}
        <div class="pc-class">${esc(u.class||'')}${u.subclass?' — '+esc(u.subclass):''} · ${esc(rank)}</div>
        <div style="font-size:.7rem;color:var(--accent2);margin-top:2px">${esc(goal)}</div>
        <div style="font-size:.7rem;margin-top:4px">${statusEmoji} ${esc(statusLabel)}</div>
      </div>
    </div>`;

    // Quick glance stats
    h+=`<div class="client-stat-grid">
      <div class="cs-cell"><div class="cs-v">${num(u.xp)}</div><div class="cs-l">XP</div></div>
      <div class="cs-cell"><div class="cs-v">${liftsRecent}</div><div class="cs-l">Lifts/30d</div></div>
      <div class="cs-cell"><div class="cs-v">${actRecent}</div><div class="cs-l">Cardio/30d</div></div>
      <div class="cs-cell"><div class="cs-v">${restRecent}</div><div class="cs-l">Rest/30d</div></div>
      <div class="cs-cell"><div class="cs-v">${avgPerWeek}</div><div class="cs-l">Sess/wk</div></div>
      <div class="cs-cell"><div class="cs-v">${(u.achievements||[]).length}</div><div class="cs-l">Achieve.</div></div>
    </div>`;

    // Body stats
    if(st.height||st.weight||st.age){
      h+=`<div class="section-title" style="margin:.6rem 0 .2rem">Body stats</div>`;
      h+=`<div style="font-size:.74rem;color:var(--muted);padding:3px 0">${st.height?''+esc(st.height):''}${st.weight?' · '+esc(st.weight)+' lbs':''}${st.age?' · '+esc(st.age):''}${st.bodyFat?' · '+esc(st.bodyFat)+'% BF':''}</div>`;
    }

    // PRs
    if(prs.bench||prs.squat||prs.deadlift||prs.ohp){
      h+=`<div class="section-title" style="margin:.6rem 0 .2rem">Personal records</div>`;
      h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:.72rem">`;
      if(prs.bench)h+=`<div>Bench: <strong>${esc(prs.bench)} lbs</strong></div>`;
      if(prs.squat)h+=`<div>Squat: <strong>${esc(prs.squat)} lbs</strong></div>`;
      if(prs.deadlift)h+=`<div>DL: <strong>${esc(prs.deadlift)} lbs</strong></div>`;
      if(prs.ohp)h+=`<div>OHP: <strong>${esc(prs.ohp)} lbs</strong></div>`;
      h+=`</div>`;
    }

    // Weight trend
    if(weightChange!==null){
      const arrow=weightChange>0?'':weightChange<0?'':'';
      const color=weightChange>0?'var(--gold)':weightChange<0?'var(--green)':'var(--muted)';
      h+=`<div class="section-title" style="margin:.6rem 0 .2rem">Weight trend</div>`;
      h+=`<div style="font-size:.78rem;padding:.4rem;background:var(--surface2);border-radius:6px;text-align:center">${arrow} <strong style="color:${color}">${weightChange>0?'+':''}${weightChange} lbs</strong> over ${weightChangeDays} days (${allWeighIns.length} check-ins)</div>`;
    }

    // Recent activity
    h+=`<div class="section-title" style="margin:.6rem 0 .2rem">Last 10 logs</div>`;
    if(!logs.length)h+='<p style="color:var(--muted);font-size:.74rem">No workouts logged yet.</p>';
    else logs.slice(0,10).forEach(e=>{
      const dt=new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric'});
      const type=e.isRest?'Rest':e.isActivity?'Activity':'Lift';
      const detail=e.isActivity?(e.duration?' · '+num(e.duration)+'m':''):'';
      h+=`<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:3px 0;border-bottom:1px solid var(--border)"><span>${type} · ${esc(e.dayTitle||'Workout')}${detail}</span><span style="color:var(--dim)">${dt}</span></div>`;
    });

    if(weighIns.length){
      h+=`<div class="section-title" style="margin:.6rem 0 .2rem">Recent check-ins</div>`;
      weighIns.forEach((w,i)=>{
        const dt=new Date(w.date).toLocaleDateString('en-US',{month:'short',day:'numeric'});
        const prev=i<weighIns.length-1?weighIns[i+1].weight:null;
        const delta=prev?(parseFloat(w.weight)-parseFloat(prev)).toFixed(1):'';
        const deltaColor=delta>0?'var(--gold)':delta<0?'var(--green)':'var(--muted)';
        h+=`<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:3px 0"><span>${esc(w.weight)} lbs${w.bodyFat?' · '+esc(w.bodyFat)+'%':''}${delta?' <span style="color:'+deltaColor+'">('+(delta>0?'+':'')+delta+')</span>':''}</span><span style="color:var(--dim)">${dt}</span></div>`;
        if(w.notes)h+=`<div style="font-size:.66rem;color:var(--dim);padding:0 0 4px 0;font-style:italic">${esc(w.notes)}</div>`;
      });
    }

    h+=`<div class="m-actions" style="margin-top:.8rem;flex-wrap:wrap;gap:6px"><button class="m-cancel" onclick="closeProfileCard()" style="flex:1">Close</button><button class="m-save-btn" onclick="messageClient('${safeId(uid)}')" style="flex:1">Message</button></div>`;
    modal.querySelector('.modal').innerHTML=h;
    modal.classList.add('open');
  }catch(e){console.error(e);toast('Error: '+e.message)}
}
function messageClient(uid){
  closeProfileCard();
  if(!(userData.friends||[]).includes(uid)){toast('Add them as a friend first to message');return}
  openChat(uid);
}

// Client-side: accept a trainer
async function acceptTrainerCode(code){
  if(!code||code.length!==6)return;
  try{
    const snap=await db.collection('trainerCodes').doc(code.toUpperCase()).get();
    if(!snap.exists){toast('Invalid trainer code');return}
    const trainerUid=snap.data().uid;
    if(trainerUid===U.uid){toast('That\'s your own code!');return}
    // Add trainer to user's doc
    await saveUser({trainer:trainerUid});
    // Add user to trainer's clients list
    await db.collection('users').doc(trainerUid).update({clients:firebase.firestore.FieldValue.arrayUnion(U.uid)});
    toast('Trainer connected! They can now view your progress.');
    renderProfile();
  }catch(e){toast('Could not connect: '+e.message)}
}

// ═══════════ PROGRESS PHOTOS (IndexedDB, device-only) ═══════════
let photoDB=null;
function openPhotoDB(){
  return new Promise((resolve,reject)=>{
    if(photoDB){resolve(photoDB);return}
    const req=indexedDB.open('lexenPhotos',1);
    req.onerror=()=>reject(req.error);
    req.onupgradeneeded=(e)=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('photos')){
        const store=db.createObjectStore('photos',{keyPath:'id',autoIncrement:true});
        store.createIndex('date','date',{unique:false});
        store.createIndex('pose','pose',{unique:false});
      }
    };
    req.onsuccess=()=>{photoDB=req.result;resolve(photoDB)};
  });
}
async function savePhotoToDB(photo){
  const db=await openPhotoDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('photos','readwrite');const store=tx.objectStore('photos');
    const req=store.add(photo);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function getAllPhotos(){
  const db=await openPhotoDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('photos','readonly');const store=tx.objectStore('photos');
    const req=store.getAll();
    req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
  });
}
async function deletePhotoFromDB(id){
  const db=await openPhotoDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('photos','readwrite');const store=tx.objectStore('photos');
    const req=store.delete(id);
    req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);
  });
}

function openProgressPhotos(){
  $('photoPoseFilter').value='all';
  $('progressPhotosModal').classList.add('open');
  renderProgressPhotos();
}
function closeProgressPhotos(){$('progressPhotosModal').classList.remove('open')}

async function renderProgressPhotos(){
  const grid=$('progressPhotosGrid');if(!grid)return;
  try{
    let photos=await getAllPhotos();
    const filter=$('photoPoseFilter').value;
    if(filter!=='all')photos=photos.filter(p=>p.pose===filter);
    photos.sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(!photos.length){grid.innerHTML='<p style="color:var(--muted);font-size:.78rem;padding:1rem;text-align:center">No photos yet. Tap "Add Photo" to start tracking your progress.</p>';return}
    let h='';
    photos.forEach(p=>{
      const dt=new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'});
      const poseEmoji={front:'',side:'',back:'',other:''}[p.pose]||'';
      const weight=p.weight?` · ${p.weight} lbs`:'';
      h+=`<div class="photo-card" onclick="viewPhoto(${p.id})">
        <img src="${esc(safeImgSrc(p.dataUrl))}" alt="Progress">
        <div class="photo-meta">
          <div class="photo-date">${dt}</div>
          <div class="photo-pose">${poseEmoji} ${p.pose}${weight}</div>
        </div>
        <button class="photo-del" onclick="event.stopPropagation();deletePhoto(${p.id})">✕</button>
      </div>`;
    });
    // Add compare button if we have 2+ photos
    if(photos.length>=2){
      h+=`<div class="photo-compare-row"><button class="m-save-btn" onclick="openPhotoCompare()" style="width:100%;background:var(--accent2);color:#000">Compare First vs Latest</button></div>`;
    }
    grid.innerHTML=h;
  }catch(e){console.error(e);grid.innerHTML='<p style="color:var(--red);font-size:.78rem;padding:1rem">Failed to load photos: '+e.message+'</p>'}
}

async function handleProgressPhotoUpload(file){
  if(!file)return;
  if(!file.type.startsWith('image/')){toast('Only images supported');return}
  // Check size — warn if huge
  if(file.size>10*1024*1024){if(!confirm('Photo is '+(file.size/1048576).toFixed(1)+' MB. Save anyway?\n\n(This uses your device storage)'))return}
  // Resize using canvas for reasonable storage size
  const reader=new FileReader();
  reader.onload=async(e)=>{
    const img=new Image();
    img.onload=async()=>{
      const canvas=document.createElement('canvas');
      const maxSize=1200;let w=img.width,h=img.height;
      if(w>maxSize||h>maxSize){if(w>h){h=Math.round(h*maxSize/w);w=maxSize}else{w=Math.round(w*maxSize/h);h=maxSize}}
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
      const dataUrl=canvas.toDataURL('image/jpeg',0.82);
      // Prompt for pose + optional weight
      const pose=prompt('Pose? (front / side / back / other)','front');
      if(pose===null)return;
      const poseNorm=['front','side','back','other'].includes(pose.toLowerCase().trim())?pose.toLowerCase().trim():'other';
      const curWeight=userData.stats?.weight||'';
      const weight=prompt('Current weight? (optional)',curWeight);
      if(weight===null)return;
      try{
        await savePhotoToDB({date:new Date().toISOString(),pose:poseNorm,weight:weight.trim(),dataUrl});
        toast('Photo saved to this device');
        renderProgressPhotos();
        // Track achievement
        const photos=await getAllPhotos();
        if(photos.length>=1)unlockAch('progress_photo_1');
        if(photos.length>=4)unlockAch('progress_photo_4');
        if(photos.length>=12)unlockAch('progress_photo_12');
      }catch(err){toast('Save failed: '+err.message)}
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

async function viewPhoto(id){
  const photos=await getAllPhotos();
  const p=photos.find(x=>x.id===id);if(!p)return;
  const modal=$('photoCompareModal');
  const dt=new Date(p.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  $('photoCompareBody').innerHTML=`<img src="${esc(safeImgSrc(p.dataUrl))}" style="width:100%;border-radius:10px;margin-bottom:.5rem"><div style="font-size:.75rem;color:var(--muted)">${dt}<br>${p.pose}${p.weight?' · '+p.weight+' lbs':''}</div>`;
  modal.classList.add('open');
}
function closePhotoCompare(){$('photoCompareModal').classList.remove('open')}

async function openPhotoCompare(){
  const photos=(await getAllPhotos()).sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(photos.length<2){toast('Need 2+ photos to compare');return}
  const first=photos[0],latest=photos[photos.length-1];
  const d1=new Date(first.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'});
  const d2=new Date(latest.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'});
  const daysBetween=Math.floor((new Date(latest.date)-new Date(first.date))/86400000);
  const weightDiff=first.weight&&latest.weight?(parseFloat(latest.weight)-parseFloat(first.weight)).toFixed(1):null;
  $('photoCompareBody').innerHTML=`
    <div class="compare-grid">
      <div class="compare-col"><img src="${esc(safeImgSrc(first.dataUrl))}"><div class="compare-cap">${d1}<br>${first.weight?first.weight+' lbs':''}</div></div>
      <div class="compare-col"><img src="${esc(safeImgSrc(latest.dataUrl))}"><div class="compare-cap">${d2}<br>${latest.weight?latest.weight+' lbs':''}</div></div>
    </div>
    <div class="compare-summary">${daysBetween} days${weightDiff!==null?' · '+(weightDiff>0?'+':'')+weightDiff+' lbs':''}</div>`;
  $('photoCompareModal').classList.add('open');
}

async function deletePhoto(id){
  if(!confirm('Delete this photo? Cannot be undone.'))return;
  await deletePhotoFromDB(id);
  renderProgressPhotos();toast('Photo deleted');
}

// Hook up the file input
document.addEventListener('DOMContentLoaded',()=>{
  const input=document.getElementById('progressPhotoInput');
  if(input)input.addEventListener('change',function(){if(this.files[0]){handleProgressPhotoUpload(this.files[0]);this.value=''}});
});

// ═══════════ EXERCISE LIBRARY ═══════════
let libFilter='All',libSearch='';
function renderLibrary(){
  const el=$('libraryContent');if(!el)return;
  let h=`<div class="page-title">Learn</div>
  <div class="page-sub">Training principles, progression, and exercise library</div>`;
  // ── Training Guide (collapsible) ──
  h+=`<div class="learn-section">
    <div class="learn-section-title" onclick="toggleLearnSection(this)">
      <span>Training principles</span><span class="learn-arrow">▼</span>
    </div>
    <div class="learn-section-body" style="max-height:none">
      <div class="learn-block">
        <div class="learn-block-title">Progressive Overload</div>
        <p>Your body adapts to stress. To keep progressing, each week you should aim to either (1) lift more weight, (2) do more reps at the same weight, or (3) improve form at the same load. Don't skip — adding 2.5–5 lbs per week on main lifts is enough.</p>
      </div>
      <div class="learn-block">
        <div class="learn-block-title">Deload Weeks</div>
        <p>Every 4-6 weeks, reduce weight 30-40% and stick to 2-3 easy sets. Your CNS and joints need to recover from accumulated stress. Skipping deloads leads to stalled lifts and injury risk. Your Rest Day logs count here too.</p>
      </div>
      <div class="learn-block">
        <div class="learn-block-title">Recovery &amp; Sleep</div>
        <p>Muscle is built during recovery, not in the gym. Target 7-9 hours of sleep. One bad night kills gym performance; a week of bad sleep kills gains. Prioritize sleep as hard as you prioritize training.</p>
      </div>
      <div class="learn-block">
        <div class="learn-block-title">Nutrition Fundamentals</div>
        <p>Hit your protein goal daily (0.8-1g per lb bodyweight). To grow, eat 200-500 cal above maintenance. To cut fat, eat 300-500 cal below. Track via the Nutrition tab. Hydration matters — aim for your bodyweight in ounces.</p>
      </div>
      <div class="learn-block">
        <div class="learn-block-title">How Ranks Work</div>
        <p>E → D is automatic at 500 XP. After that, <strong>Rank Trials</strong> gate B/A/S ranks. You'll earn XP up to the rank minimum, then get capped until you complete the trial (perfect weeks, heavy lifts, streaks). Trials force you to earn the rank, not just grind XP.</p>
      </div>
      <div class="learn-block">
        <div class="learn-block-title">Session Mode</div>
        <p>Tap <strong>Start session</strong> on Train for a timed workout. The clock tracks your total time, and ticking off a set starts the rest timer. The session shows one exercise at a time; the list under it lets you jump around. Trained already? Use <strong>Log it without the timer</strong>.</p>
      </div>
    </div>
  </div>`;
  // ── Exercise Library ──
  h+=`<div class="learn-section-title" style="margin-top:1rem">Exercise library</div>`;
  h+=`<div class="lib-search"><input type="text" class="auth-input" placeholder="Search exercises..." value="${esc(libSearch)}" oninput="libSearch=this.value;renderLibrary()" style="margin:0"></div>
  <div class="lib-filters">`;
  h+=`<div class="log-filter${libFilter==='All'?' active':''}" onclick="libFilter='All';renderLibrary()">All</div>`;
  LIBRARY_GROUPS.forEach(g=>{
    h+=`<div class="log-filter${libFilter===g?' active':''}" onclick="libFilter='${g}';renderLibrary()">${g}</div>`;
  });
  h+=`</div>`;
  let exs=EXERCISE_LIBRARY;
  if(libFilter!=='All')exs=exs.filter(e=>e.group===libFilter);
  if(libSearch.trim()){const q=libSearch.toLowerCase();exs=exs.filter(e=>e.name.toLowerCase().includes(q)||e.group.toLowerCase().includes(q)||(e.tags||[]).some(t=>t.includes(q)))}
  h+=`<div class="lib-count">${exs.length} exercise${exs.length!==1?'s':''}</div>`;
  exs.forEach(ex=>{
    const groupColor={'Chest':'var(--red)','Back':'var(--green)','Shoulders':'var(--gold)','Biceps':'var(--cyan)','Triceps':'var(--accent2)','Quads':'var(--green)','Hamstrings':'var(--orange)','Glutes':'var(--accent)','Core':'var(--gold)','Full Body':'var(--cyan)','Calves':'var(--muted)','Conditioning':'var(--red)'}[ex.group]||'var(--muted)';
    h+=`<div class="lib-card" onclick="toggleLibCard(this)">
      <div class="lib-card-header">
        <div class="lib-card-info">
          <div class="lib-card-name">${esc(ex.name)}</div>
          <div class="lib-card-meta"><span class="lib-group" style="color:${groupColor}">${esc(ex.group)}</span> · ${esc(ex.reps)}</div>
        </div>
        <span class="lib-card-arrow">▶</span>
      </div>
      <div class="lib-card-body">
        <div class="lib-cues">${(ex.cues||[]).map(c=>'<div class="lib-cue">→ '+esc(c)+'</div>').join('')}</div>
        <div class="lib-tags">${(ex.tags||[]).map(t=>'<span class="lib-tag">'+esc(t)+'</span>').join('')}</div>
        <div class="lib-actions">
          <a class="lib-btn video" href="https://www.youtube.com/results?search_query=${ex.yt||ex.name.replace(/ /g,'+')}" target="_blank" rel="noopener">Watch Tutorial</a>
          <button class="lib-btn add" onclick="event.stopPropagation();addFromLibrary('${ex.name.replace(/'/g,"\\'")}',${ex.reps.includes('s')?'true':'false'},'${(ex.reps||'').replace(/'/g,"\\'")}','${(ex.cues||[])[0]?ex.cues[0].replace(/'/g,"\\'"):''}')">Add to Program</button>
        </div>
      </div>
    </div>`;
  });
  if(!exs.length)h+=`<p style="color:var(--muted);font-size:.82rem;padding:1rem 0">No exercises found. Try a different search.</p>`;
  el.innerHTML=h;
}
function toggleLearnSection(header){
  const body=header.nextElementSibling;
  const arrow=header.querySelector('.learn-arrow');
  if(body.style.maxHeight==='0px'||body.dataset.collapsed==='1'){body.style.maxHeight='none';body.dataset.collapsed='0';if(arrow)arrow.textContent='▼'}
  else{body.style.maxHeight='0px';body.dataset.collapsed='1';if(arrow)arrow.textContent='▶'}
  body.style.overflow='hidden';
}
function toggleLibCard(card){
  const body=card.querySelector('.lib-card-body');
  const arrow=card.querySelector('.lib-card-arrow');
  const isOpen=body.style.maxHeight&&body.style.maxHeight!=='0px';
  // Close all others
  document.querySelectorAll('.lib-card-body').forEach(b=>{b.style.maxHeight='0px';b.style.overflow='hidden'});
  document.querySelectorAll('.lib-card-arrow').forEach(a=>a.textContent='▶');
  if(!isOpen){body.style.maxHeight=body.scrollHeight+'px';body.style.overflow='visible';arrow.textContent='▼'}
}
async function addFromLibrary(name,isTime,reps,notes){
  const prog=userData.program||[];if(!prog.length){toast('Create a program first');return}
  const day=prog.find(d=>d.id===currentDay);if(!day){toast('Select a workout day first');return}
  const di=prog.indexOf(day);
  userData.program[di].exercises.push({name,sets:3,reps:reps||'8-12',isTime:!!isTime,notes:notes||''});
  await saveUser({program:userData.program});
  toast(name+' added to '+day.title+'!');
}

// ═══════════ FRIEND REQUEST BADGE ═══════════
let pendingFriendReqs=0;
async function checkFriendRequests(){
  if(!U)return;
  try{
    const snap=await db.collection('friendRequests').where('to','==',U.uid).where('status','==','pending').get();
    pendingFriendReqs=snap.size;
    updateFriendBadge();
    // Toast on login if there are pending requests
    if(pendingFriendReqs>0){
      const names=[];snap.forEach(d=>{const r=d.data();if(r.fromUsername)names.push('@'+r.fromUsername)});
      if(names.length===1)toast('Friend request from '+names[0]);
      else if(names.length>1)toast(''+pendingFriendReqs+' friend requests waiting!');
    }
  }catch(e){}
}
function updateFriendBadge(){updateGuildDots()}

// ═══════════ v1.29.0 REDESIGN HELPERS ═══════════
const ICONS={
  chev:'<path d="M9 6l6 6-6 6"/>',left:'<path d="M15 6l-6 6 6 6"/>',
  swap:'<path d="M7 4L3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8"/>',
  note:'<path d="M6 3.5h8.5l3.5 3.5v13.5H6z"/><path d="M9 11h6M9 15h4"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  more:'<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',x:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  scan:'<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M8 9v6M11 9v6M14 9v6M17 9v6"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  pulse:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',moon:'<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.4"/>',
  badge:'<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/>',
  frame:'<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  shard:'<path d="M12 2.5l6 6.5-6 12.5L6 9z"/><path d="M6 9h12"/>',
  camera:'<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M9 6l1.5-2.5h3L15 6"/>',
  gate:'<path d="M5 20V8l7-5 7 5v12"/><path d="M9 20v-6h6v6"/>',
  scale:'<path d="M5 20h14M12 4v16M6 8h12M6 8l-3 6h6zM18 8l-3 6h6z"/>',
  whistle:'<path d="M4 12a5 5 0 1 0 10 0V9h6V6H9a5 5 0 0 0-5 5z"/>',
  bolt:'<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  flame:'<path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-3.6-2.7-5.6-3.7-9.3-1.7 1.6-2.3 3.4-2.3 5-1.2-.9-1.9-2.3-2-3.7C8 8.6 5.5 11.4 5.5 14.8 5.5 18.4 8 21 12 21z"/>',
  play:'<path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>',ladder:'<path d="M7 3v18M17 3v18M7 8h10M7 13h10M7 18h10"/>',
  share:'<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12v7.5h14V12"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  hand:'<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V13c0 4.5-2.5 7.5-6.5 7.5-3 0-4.5-1.7-6-4.5l-1.5-3a1.5 1.5 0 0 1 2.6-1.5L8 13"/>',
  trash:'<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  person:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21c0-4 3.4-7 7.5-7s7.5 3 7.5 7"/>',
  send:'<path d="M4 12l16-8-6 16-2.5-6.5z"/>',logout:'<path d="M15 4h4.5v16H15M10 8l-4 4 4 4M6 12h10"/>'
};
function icon(name,size){return `<svg class="i" width="${size||20}" height="${size||20}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||''}</svg>`}
function ringBtn(name,label,onclick){return `<button class="ring${name==='more'?' dots':''}" aria-label="${esc(label)}" onclick="${onclick}">${icon(name,16)}</button>`}
function fmtN(n){return (Math.round(+n||0)).toLocaleString('en-US')}
function rankLabel(name){return String(name||'').replace(/-RANK$/,'-Rank')}
function rankLetter(r){return String((r&&r.name)||'E')[0]}
function sysWin(inner,cls){return `<div class="sys-win${cls?' '+cls:''}"><div class="sys-edge"><div class="sys-win-body">${inner}</div></div></div>`}
function openProfileView(tab){switchPage('ranks');const b=document.querySelector('#page-ranks .pg-back .back-btn');if(b){b.lastChild.textContent='Profile';b.onclick=()=>switchPage('profile')}switchSubTab('ranks',tab)}
function renderGuild(){
  const active=document.querySelector('#guildTabs .stab.active');
  switchSubTab('guild',active?active.dataset.st:'activity');
}
function updateGuildDots(){
  const chat=(typeof unreadChatCount!=='undefined'?unreadChatCount:0)>0,req=(typeof pendingFriendReqs!=='undefined'?pendingFriendReqs:0)>0;
  const set=(id,on)=>{const el=$(id);if(el)el.style.display=on?'':'none'};
  set('chatTabDot',chat);set('friendsTabDot',req);set('guildNavDot',chat||req);
}
function renderHomeHeader(){
  const r=getEffectiveRank(),lv=getLevelInfo(),info=getXpBarInfo(),cap=getXpCap(),xm=getXpMultiplier();
  const title=(r.title&&r.title[userData.class])||rankLabel(r.name);
  const capped=cap.softCap<1;
  const ri=RANKS.indexOf(r),gate=RANKS[ri+1];
  let right;
  if(gate&&!gate.auto&&gate.trial&&!userData.trialsCompleted.includes(gate.trial)&&userData.xp>=gate.min){
    const t=RANK_TRIALS[gate.trial];right=`Pass ${t?dayLabel(t.name):'the trial'} to reach ${rankLabel(gate.name)}`;
  }else{const nr=getNextRank(userData.xp);right=nr?`${fmtN(nr.min-userData.xp)} to ${rankLabel(nr.name)}`:'Max rank'}
  let chip='';
  if(capped)chip=`<div class="hh-chip gold" title="Trial active">XP at 25%</div>`;
  else if(xm.label)chip=`<div class="hh-chip">${xm.mult}× XP</div>`;
  return `<div id="homeHeader" class="hh">
    <div class="hh-top"><button class="hh-rank" aria-label="${esc(rankLabel(r.name))}" style="--rk:${esc(r.color)}"><span>${rankLetter(r)}</span></button>
      <div class="hh-id"><div class="hh-name">${esc(userData.username||'hunter')}</div><div class="hh-title">${titleLine(myTitleId(),title)}</div></div>${chip}</div>
    <div class="hh-bar"><span class="lv">Lv ${lv.level}</span><div class="hp" role="img" aria-label="${Math.round(info.pct)} percent of the way to the next rank"><div class="hp-fill${capped?' capped':''}" style="width:${info.pct}%"></div></div></div>
    <div class="hh-sub"><span>${fmtN(userData.xp)} XP</span><span>${esc(right)}</span></div>
  </div>`;
}
function questRow(done,name,desc,right,onclick,rightCls){
  return `<button class="hq-row${done?' done':''}" ${done?'disabled':`onclick="${onclick}"`}>
    <span class="hq-box">${done?icon('check',14):''}</span>
    <span class="hq-txt"><span class="hq-name">${name}</span><span class="hq-desc">${desc}</span></span>
    <span class="hq-xp${rightCls?' '+rightCls:''}">${right}</span></button>`;
}
function nextProgramDay(){
  const prog=userData.program||[];if(!prog.length)return null;
  const last=getLiftLogs().find(e=>prog.some(d=>d.id===e.dayId));
  if(!last)return prog[0];
  const i=prog.findIndex(d=>d.id===last.dayId);
  return prog[(i+1)%prog.length];
}
function homeStart(dayId){
  if(sessionActive){switchPage('train');return}
  currentDay=dayId;workoutView='day';switchPage('train');
  startSession();
}
function dayLabel(t){
  // Program day titles were stored in caps ("UPPER A"). Show them in title case.
  const s=String(t||'');return /[a-z]/.test(s)?s:s.toLowerCase().replace(/\b([a-z])/g,c=>c.toUpperCase());
}
function renderWeekStrip(){
  const goal=getWeeklyGoal();
  const monIso=getMonday(new Date()).toISOString().slice(0,10);
  const r=evaluateWeek(monIso,goal);
  const mon=new Date(monIso+'T00:00:00');
  const todayIdx=(new Date().getDay()+6)%7;
  let cells='';
  'MTWTFSS'.split('').forEach((L,i)=>{
    const d0=mon.getTime()+i*86400000,d1=d0+86400000;
    const es=workoutLog.filter(e=>{const t=new Date(e.date).getTime();return t>=d0&&t<d1});
    const trained=es.some(e=>!e.isRest||e.restType==='active');
    const rest=!trained&&es.some(e=>e.isRest);
    const st=trained?'done':rest?'rest':i===todayIdx?'today':'open';
    cells+=`<div class="wk-day${i===todayIdx?' is-today':''}"><span>${L}</span><div class="wk-cell ${st}" title="${trained?'Trained':rest?'Rest day':''}"></div></div>`;
  });
  return `<div class="sec-row"><span class="sec">This week</span><span class="mist sm">${r.sessions} of ${r.target} sessions</span></div>
    <div class="wk-grid">${cells}</div>${renderWeekRisk()}`;
}
function renderTrialRow(info){
  const t=info.trial;const progress=getTrialProgress(t);
  const pcts=t.tasks.map((task,i)=>Math.min(1,(progress[i]||0)/task.target));
  const pct=Math.round(pcts.reduce((a,b)=>a+b,0)/Math.max(1,pcts.length)*100);
  const ready=t.tasks.every((task,i)=>progress[i]>=task.target);
  return `<button class="li gate-row" aria-expanded="false" onclick="toggleGateDetail(this)">
      <span class="ico sys">${icon('gate',18)}</span>
      <span class="t">${esc(dayLabel(t.name))}<small>${ready?'Ready to claim':`Trial for ${rankLabel(info.rank.name)}`}</small></span>
      <span class="track gate-track"><span class="fill" style="width:${pct}%;display:block"></span></span><span class="chev">${icon('chev',16)}</span></button>
    <div class="gate-detail" hidden>${renderTrialBanner(info)}</div>`;
}
function toggleGateDetail(btn){
  const d=btn.nextElementSibling;if(!d)return;
  const open=d.hidden;d.hidden=!open;btn.setAttribute('aria-expanded',open?'true':'false');btn.classList.toggle('open',open);
}
function feedRowsHtml(items,limit){
  return items.slice(0,limit).map(({uid,u,ev,t})=>{
    const x=feedEventText(ev);if(!x)return '';
    const gold=u.rank==='S-RANK';
    return `<button class="ff-row" onclick="openProfileCard('${safeId(uid)}')">
      <span class="ff-pic${gold?' s':''}${frameClass(u.frame)}">${avatarHtml(u.profilePic,`<span>${esc(String(u.username||'h')[0].toUpperCase())}</span>`)}</span>
      <span class="ff-body"><span class="ff-line"><span class="ff-name${nameClass(u.nameColor)}">${esc(u.username||'hunter')}</span> ${x.text}</span>${x.sub?`<span class="ff-sub">${x.sub}</span>`:''}</span>
      <span class="ff-time">${timeAgo(t)}</span></button>`;
  }).join('');
}
async function renderGuildActivity(){
  const el=$('guildActivity');if(!el)return;
  const friends=(userData.friends||[]).length;
  if(!friends){el.innerHTML=`<div class="empty-note">Nobody here yet. Add friends with their code, or share yours.</div>
    <button class="btn-p" onclick="switchSubTab('guild','friends')">Add friends</button>`;return}
  if(!feedCache.items)el.innerHTML=`<div class="empty-note">Loading…</div>`;
  const items=await loadFriendFeed();
  const now=Date.now();
  // "Needs a push": friends whose latest workout is 4+ days old (and who share activity at all)
  const byUser={};(feedCache.docs||[]).forEach(({uid,u})=>{
    const ws=(Array.isArray(u.recent)?u.recent:[]).filter(ev=>ev&&(ev.t==='workout'||ev.t==='cardio')).map(ev=>new Date(ev.at).getTime()).filter(Boolean);
    if(ws.length)byUser[uid]={u,last:Math.max(...ws)};
  });
  const pokedToday=userData.pokedToday||{},today=getTodayStr();
  const push=Object.entries(byUser).filter(([,v])=>now-v.last>=4*86400000&&now-v.last<30*86400000).slice(0,3);
  let h='';
  if(push.length){
    h+=`<div class="sec">Needs a push</div><div class="mist sm" style="margin-top:4px">No workout in 4 days or more. A poke costs nothing.</div><div class="li-list" style="margin-top:8px">`;
    push.forEach(([uid,v])=>{
      const days=Math.floor((now-v.last)/86400000),poked=pokedToday[uid]===today;
      h+=`<div class="li"><span class="ff-pic">${avatarHtml(v.u.profilePic,`<span>${esc(String(v.u.username||'h')[0].toUpperCase())}</span>`)}</span>
        <span class="t">${esc(v.u.username||'hunter')}<small>Last workout ${days} days ago</small></span>
        ${poked?`<span class="mist sm">Poked</span>`:`<button class="btn-s ghost sm" onclick="sendPoke('${safeId(uid)}','${safeName(v.u.username||'hunter')}').then(renderGuildActivity)">Poke</button>`}</div>`;
    });
    h+=`</div>`;
  }
  // Group the feed by day
  const groups={};const label=t=>{const d=new Date(t),td=new Date();const y=new Date();y.setDate(y.getDate()-1);
    if(d.toDateString()===td.toDateString())return 'Today';if(d.toDateString()===y.toDateString())return 'Yesterday';
    return d.toLocaleDateString('en-US',{weekday:'long'})};
  (items||[]).slice(0,40).forEach(it=>{const k=label(it.t);(groups[k]=groups[k]||[]).push(it)});
  const keys=Object.keys(groups);
  if(!keys.length)h+=`<div class="empty-note">Quiet week so far. Be the first to log something.</div>`;
  keys.forEach(k=>{h+=`<div class="sec" style="margin-top:24px">${k}</div><div class="ff-list">${feedRowsHtml(groups[k],40)}</div>`});
  h+=`<div class="panel invite-mini"><div><div class="im-t">Invite a hunter</div><div class="mist sm">Your code <span class="num im-code">${esc(userData.friendCode||'------')}</span></div></div>
    <button class="btn-p sm" onclick="shareInvite()">Share</button></div>`;
  el.innerHTML=h;
}
let sesBlock=0;
function startLogMode(){workoutView='log';buildWorkout();try{window.scrollTo(0,0)}catch(e){}}
function otherLogsHtml(){
  return `<div class="sec" style="margin-top:30px">Other logs</div><div class="li-list" style="margin-top:6px">
    <button class="li" onclick="openActivityLog()"><span class="ico">${icon('pulse',18)}</span><span class="t">Cardio or activity</span><span class="r">Runs, sports, steps</span><span class="chev">${icon('chev',16)}</span></button>
    <button class="li" onclick="openRestLog()"><span class="ico">${icon('moon',18)}</span><span class="t">Rest day</span><span class="r">Counts toward your week</span><span class="chev">${icon('chev',16)}</span></button>
    <button class="li" onclick="openBackdatePicker()"><span class="ico">${icon('cal',18)}</span><span class="t">Log an earlier day</span><span class="r">No XP</span><span class="chev">${icon('chev',16)}</span></button></div>`;
}
function exCode(day,ei){const ex=day.exercises[ei];return ex.group?String(ex.group):String(ei+1)}
function grpNum(ex){return ex&&ex.group?String(ex.group).replace(/[A-Za-z]/g,''):''}
function dayBlocks(day){
  const out=[];(day.exercises||[]).forEach((ex,ei)=>{
    const g=grpNum(ex),prev=out[out.length-1];
    if(g&&prev&&prev.g===g)prev.idx.push(ei);else out.push({g,idx:[ei]});
  });return out;
}
function shortHint(ex,lastMap){
  if(ex.isTime)return '';
  const match=fuzzyMatchExercise(ex.name,lastMap);if(!match)return '';
  const rec=lastMap[match.key];if(!rec||!rec.best)return '';
  const last=rec.best;const m=String(ex.reps||'').match(/(\d+)\s*-\s*(\d+)/);
  const upper=m?parseInt(m[2]):parseInt(ex.reps)||0;
  return upper&&last.r>=upper?`Last ${last.w} lb × ${last.r}. Try ${last.w+5} lb.`:`Last ${last.w} lb × ${last.r}. Match it, beat the reps.`;
}
function renderTrainOverview(){
  const prog=userData.program||[];const day=prog.find(d=>d.id===currentDay);if(!day)return;
  const di=prog.indexOf(day);const lastMap=buildLastSetMap();
  const wa=$('workoutActions');if(wa)wa.style.display='none';
  $('dayTabs').innerHTML=prog.map(d=>`<button class="chip${d.id===currentDay?' on':''}" onclick="switchDay('${safeId(d.id)}')">${esc(dayLabel(d.title))}</button>`).join('')
    +`<button class="chip chip-icon" aria-label="New workout" onclick="addWorkoutDay()">${icon('plus',16)}</button>`;
  const lastLog=workoutLog.find(e=>e.dayId===day.id&&!e.isRest&&!e.isActivity);
  const lastTxt=lastLog?'Last done '+new Date(lastLog.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'Not done yet';
  const n=day.exercises.length;
  let h=`<div class="tr-head"><div class="tr-head-t"><div class="tr-day">${esc(dayLabel(day.title))}</div>${day.subtitle?`<div class="mist">${esc(day.subtitle)}</div>`:''}
    <div class="tr-meta"><span>${n} exercise${n!==1?'s':''}</span><span>${lastTxt}</span></div></div>${ringBtn('more','Day options','openWorkoutSettings()')}</div>`;
  if(day.notes)h+=`<div class="panel tr-notes"><span class="mist">${icon('note',18)}</span><div>${esc(day.notes)}</div></div>`;
  if(n&&dayHasTypedInputs(day.id)){
    h+=`<div class="panel tr-pending"><div><div class="tr-pending-t">You have sets typed in</div><div class="mist sm">They're saved but not logged yet. Pick up where you left off.</div></div>
      <div class="tr-pending-btns"><button class="btn-s" onclick="startLogMode()">Continue logging</button><button class="btn-s ghost" onclick="clearDayInputs()">Clear</button></div></div>`;
  }
  if(n){
    h+=`<button class="btn-p tr-start" onclick="startSession()">${icon('play',14)} Start session</button>
      <div class="tr-start-sub"><span class="mist">Already trained?</span> <button class="link" onclick="startLogMode()">Log it without the timer</button></div>`;
  }
  h+=`<div class="tr-list">`;
  dayBlocks(day).forEach(b=>{
    h+=`<div class="tr-blk${b.idx.length>1?' ss':''}">`;
    b.idx.forEach(ei=>{
      const ex=day.exercises[ei];const swapped=savedInputs[day.id+'_e'+ei+'_swap']||'';
      const hint=shortHint(swapped?{...ex,name:swapped}:ex,lastMap);
      h+=`<div class="tr-row"><span class="tr-code${b.idx.length>1?' lilac':''}">${esc(exCode(day,ei))}</span>
        <div class="tr-info"><div class="tr-name">${esc(swapped||ex.name)}${swapped?'<span class="tr-tag">Swapped today</span>':''}</div>
        <div class="mist sm">${ex.sets} × ${esc(ex.reps||'')}${ex.isTime?' sec':''}</div>
        ${swapped?`<div class="dim sm">Plan says ${esc(ex.name)}</div>`:''}${ex.notes?`<div class="mist sm">${esc(ex.notes)}</div>`:''}${hint?`<div class="lilac sm">${esc(hint)}</div>`:''}</div>
        ${ringBtn('more','Options for '+(swapped||ex.name),`openExerciseMenu(${di},${ei})`)}</div>`;
    });
    h+=`</div>`;
  });
  h+=`</div><button class="btn-s ghost tr-add" onclick="openAdd(${di})">${icon('plus',16)} Add exercise</button>`;
  h+=otherLogsHtml();
  $('dayContent').innerHTML=h;
}
function renderDayFull(){
  const prog=userData.program||[],day=prog.find(d=>d.id===currentDay);if(!day)return;
  const di=prog.indexOf(day);const lastMap=buildLastSetMap();let h='';
  if(!sessionActive){
    const when=pendingBackdateISO?new Date(pendingBackdateISO).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}):'';
    h+=`<div class="pg-back"><button class="back-btn" onclick="backToWorkoutMenu()">${icon('left',20)}${esc(dayLabel(day.title))}</button></div>
      <div class="tr-day">Log ${esc(dayLabel(day.title))}</div>
      <div class="mist" style="margin:4px 0 16px">${when?`For ${esc(when)}. No XP for earlier days, but it keeps your streak.`:'No timer. Fill in what you did, tick each set, then log it.'}</div>`;
  }
  if(day.notes&&!sessionActive)h+=`<div class="panel tr-notes"><span class="mist">${icon('note',18)}</span><div>${esc(day.notes)}</div></div>`;
  dayBlocks(day).forEach((b,bi)=>{
    const ss=b.idx.length>1;
    h+=`<div class="ex-blk${ss?' ss panel':''}" data-blk="${bi}">`;
    if(ss)h+=`<div class="ss-head"><span class="lilac">${icon('swap',16)}</span><div><div class="ss-t">Superset ${b.idx.map(i=>esc(exCode(day,i))).join(' and ')}</div><div class="mist sm">Back to back, rest after the pair</div></div></div>`;
    b.idx.forEach((ei,k)=>{
      const ex=day.exercises[ei];
      const swapKey=day.id+'_e'+ei+'_swap';const swappedName=savedInputs[swapKey]||'';const shownName=swappedName||ex.name;
      const noteId=day.id+'_e'+ei+'_note';const noteDraft=savedInputs[noteId]||'';
      h+=`<div class="exercise${ss?' in-superset':' panel'}" data-ei="${ei}">
        <div class="ex-header"><span class="ex-num${ss?' lilac':''}">${esc(exCode(day,ei))}</span>
          <div class="ex-title"><div class="ex-name">${esc(shownName)}${swappedName?'<span class="tr-tag">Swapped today</span>':''}</div><div class="mist sm">${ex.sets} × ${esc(ex.reps||'')}${ex.isTime?' sec':''}</div></div>
          ${ringBtn('swap','Swap '+shownName,`openSwapModal(${di},${ei})`)}${ringBtn('note','Note for this session',`toggleExNote('${noteId}')`)}${ringBtn('edit','Edit '+shownName,`openEdit(${di},${ei})`)}</div>`;
      if(ex.notes)h+=`<div class="ex-notes">${esc(ex.notes)}</div>`;
      h+=overloadHint(swappedName?{...ex,name:swappedName}:ex,lastMap);
      h+=`<div class="ex-note-row${noteDraft?' open':''}" id="row_${noteId}"><input type="text" class="ex-note-input" id="${noteId}" placeholder="Note for this session, like knee felt off on set 2" value="${esc(noteDraft)}" maxlength="200"></div>`;
      h+=`<div class="sets-grid">`;
      const tgt=esc(String(ex.reps||'reps'));
      for(let s=0;s<ex.sets;s++){
        const wK=day.id+'_e'+ei+'_s'+s+'_w',rK=day.id+'_e'+ei+'_s'+s+'_r',cK=day.id+'_e'+ei+'_s'+s+'_c';
        if(ex.isTime)h+=`<div class="set-row time"><label for="${rK}">S${s+1}</label><input type="number" inputmode="numeric" id="${rK}" placeholder="${tgt} sec" value="${esc(savedInputs[rK]||'')}" aria-label="Set ${s+1} seconds"><span class="sep"></span><span></span><input type="checkbox" id="${cK}" ${savedInputs[cK]?'checked':''} aria-label="Set ${s+1} done"></div>`;
        else h+=`<div class="set-row"><label for="${wK}">S${s+1}</label><input type="number" inputmode="decimal" id="${wK}" placeholder="lb" value="${esc(savedInputs[wK]||'')}" aria-label="Set ${s+1} weight"><span class="sep">×</span><input type="number" inputmode="numeric" id="${rK}" placeholder="${tgt}" value="${esc(savedInputs[rK]||'')}" aria-label="Set ${s+1} reps"><input type="checkbox" id="${cK}" ${savedInputs[cK]?'checked':''} aria-label="Set ${s+1} done"></div>`;
      }
      h+=`</div></div>`;
      if(ss&&k<b.idx.length-1)h+=`<div class="ss-gap"></div>`;
    });
    if(ss)h+=`<div class="mist sm ss-foot">Gym packed? Doing these one after the other is fine.</div>`;
    h+=`</div>`;
  });
  if(sessionActive)h+=`<div id="sesList"></div>`;
  h+=`<button class="btn-s ghost tr-add" onclick="openAdd(${di})">${icon('plus',16)} Add exercise</button>`;
  $('dayContent').innerHTML=h;
  if(sessionActive){attachSessionCheckboxHandlers();applySessionFocus()}
}
function sesBlocks(){const day=(userData.program||[]).find(d=>d.id===currentDay);return day?dayBlocks(day):[]}
function exDone(day,ei){
  const ex=day.exercises[ei];let n=0;
  for(let s=0;s<ex.sets;s++){const c=$(day.id+'_e'+ei+'_s'+s+'_c');if(c?c.checked:savedInputs[day.id+'_e'+ei+'_s'+s+'_c'])n++}
  return n;
}
function firstOpenBlock(){
  const day=(userData.program||[]).find(d=>d.id===currentDay);if(!day)return 0;
  const bl=dayBlocks(day);const i=bl.findIndex(b=>b.idx.some(ei=>exDone(day,ei)<day.exercises[ei].sets));
  return i<0?Math.max(0,bl.length-1):i;
}
function applySessionFocus(){
  const day=(userData.program||[]).find(d=>d.id===currentDay);if(!day)return;
  const bl=dayBlocks(day);if(sesBlock>=bl.length)sesBlock=Math.max(0,bl.length-1);
  document.querySelectorAll('#dayContent .ex-blk').forEach(el=>{el.style.display=parseInt(el.dataset.blk)===sesBlock?'':'none'});
  const lbl=$('sessionDayLabel');if(lbl)lbl.textContent=dayLabel(day.title);
  let total=0,done=0;day.exercises.forEach((ex,ei)=>{total+=ex.sets;done+=exDone(day,ei)});
  const pf=$('sesProgFill');if(pf)pf.style.width=(total?Math.round(done/total*100):0)+'%';
  const first=bl[sesBlock]?bl[sesBlock].idx[0]:0;
  const pl=$('sesProgLabel');if(pl)pl.textContent=`Exercise ${first+1} of ${day.exercises.length}`;
  const nb=$('sesNextBtn');
  if(nb){const nx=bl[sesBlock+1];nb.textContent=nx?'Next: '+exCode(day,nx.idx[0]):'Finish workout'}
  refreshSesList();
}
function refreshSesList(){
  const el=$('sesList');if(!el)return;
  const day=(userData.program||[]).find(d=>d.id===currentDay);if(!day)return;
  const bl=dayBlocks(day);
  let h=`<div class="sec-row"><span class="sec">All exercises</span><span class="mist sm">Tap to jump</span></div><div class="li-list">`;
  bl.forEach((b,bi)=>b.idx.forEach(ei=>{
    const ex=day.exercises[ei],d=exDone(day,ei),full=d>=ex.sets,now=bi===sesBlock;
    const nm=savedInputs[day.id+'_e'+ei+'_swap']||ex.name;
    h+=`<button class="li ses-li${now?' now':''}${full?' full':''}" onclick="sesJump(${bi})"><span class="ses-mark">${full?icon('check',13):''}</span>
      <span class="tr-code${b.idx.length>1?' lilac':''}">${esc(exCode(day,ei))}</span><span class="t">${esc(nm)}<small>${full?`${d} of ${ex.sets} sets done`:now?`Set ${Math.min(d+1,ex.sets)} of ${ex.sets}`:`${ex.sets} × ${esc(ex.reps||'')}`}</small></span></button>`;
  }));
  el.innerHTML=h+`</div>`;
}
function sesJump(bi){captureInputs();sesBlock=bi;applySessionFocus();try{window.scrollTo({top:0,behavior:'smooth'})}catch(e){}}
function sessionNext(){
  captureInputs();persistSession();
  if(sesBlock>=sesBlocks().length-1){finishSession();return}
  sesBlock++;applySessionFocus();try{window.scrollTo({top:0,behavior:'smooth'})}catch(e){}
}
function openExerciseMenu(di,ei){
  const day=userData.program[di];if(!day)return;const ex=day.exercises[ei];if(!ex)return;
  const nm=savedInputs[day.id+'_e'+ei+'_swap']||ex.name;
  const ss=ex.group?` Superset ${esc(String(ex.group))}.`:'';
  openSheet(`<div class="sheet-head"><span class="num lilac">${esc(exCode(day,ei))}</span><span class="sheet-t">${esc(nm)}</span></div>
    <div class="mist sm" style="margin:2px 0 12px">${ex.sets} × ${esc(ex.reps||'')}.${ss}</div>
    <div class="li-list">
    <button class="li" onclick="closeSheet();openSwapModal(${di},${ei})"><span class="ico">${icon('swap',18)}</span><span class="t">Swap exercise<small>Equipment taken? Pick something that trains the same thing</small></span></button>
    <button class="li" onclick="closeSheet();openEdit(${di},${ei})"><span class="ico">${icon('edit',18)}</span><span class="t">Edit<small>Name, sets, target reps, cues, superset pair</small></span></button>
    <button class="li danger" onclick="closeSheet();editTarget={di:${di},ei:${ei}};deleteEx()"><span class="ico">${icon('trash',18)}</span><span class="t">Remove from ${esc(dayLabel(day.title))}<small>Your past logs stay</small></span></button>
    </div><button class="btn-s" style="width:100%;margin-top:16px;height:48px" onclick="closeSheet()">Cancel</button>`);
}
function openSheet(html){
  let m=$('sheetModal');
  if(!m){m=document.createElement('div');m.className='modal-bg';m.id='sheetModal';m.innerHTML='<div class="modal"></div>';
    m.addEventListener('click',e=>{if(e.target===m)closeSheet()});document.body.appendChild(m)}
  m.querySelector('.modal').innerHTML=html;m.classList.add('open');
}
function closeSheet(){const m=$('sheetModal');if(m)m.classList.remove('open')}
async function clearDayInputs(){
  const day=(userData.program||[]).find(d=>d.id===currentDay);if(!day)return;
  if(!confirm(`Clear the weights and reps you've typed for ${dayLabel(day.title)}?`))return;
  const pre=day.id+'_e';Object.keys(savedInputs).forEach(k=>{if(k.startsWith(pre)&&/_s\d+_[wrc]$/.test(k))delete savedInputs[k]});
  try{await db.collection('users').doc(U.uid).collection('meta').doc('inputs').set({data:savedInputs})}catch(e){console.warn(e)}
  renderDay();toast('Cleared.');
}
function addRest(sec){if(restEndMs){restEndMs+=sec*1000;updateSessionClock()}}
const STR_LIFTS={
  bench:{inc:/bench/,exc:/incline|decline|close|dumbbell|\bdb\b|machine|smith|floor|board|pin/},
  squat:{inc:/squat/,exc:/split|goblet|front|hack|bulgarian|jump|sissy|pistol|box|zercher|belt|smith|machine|leg press/},
  deadlift:{inc:/deadlift|\bdl\b/,exc:/romanian|\brdl\b|stiff|deficit|single|trap|hex|sumo|rack|block|snatch/}
};
function bestLoggedLifts(){
  const out={bench:0,squat:0,deadlift:0};
  getLiftLogs().forEach(e=>(e.exercises||[]).forEach(ex=>{
    const n=String(ex.name||'').toLowerCase();
    Object.entries(STR_LIFTS).forEach(([k,r])=>{
      if(!r.inc.test(n)||r.exc.test(n))return;
      (ex.sets||[]).forEach(s=>{const w=parseFloat(s.weight)||0,reps=parseFloat(s.reps)||0;if(reps>0&&w<=1500&&w>out[k])out[k]=w});
    });
  }));
  return out;
}

// ═══════════ v1.29.0 REDESIGN HELPERS ═══════════
function dayHasTypedInputs(dayId){
  const pre=dayId+'_e';
  return Object.keys(savedInputs||{}).some(k=>k.startsWith(pre)&&/_s\d+_[wrc]$/.test(k)&&(k.endsWith('_c')?savedInputs[k]===true:String(savedInputs[k]||'').trim()!==''));
}
function sessionMinutes(){
  if(!sessionActive||!sessionStartMs)return 0;
  let el=Date.now()-sessionStartMs-sessionPausedMs;if(sessionPauseStartMs)el-=Date.now()-sessionPauseStartMs;
  return Math.max(0,Math.floor(el/60000));
}

// ═══════════════════════════════════════════════════════════════
//  v1.30.0 — NEW ERA BEGINS: Blue Gates, Titles, Hall of Fame
// ═══════════════════════════════════════════════════════════════
ICONS.crown='<path d="M4 18h16M5 17l-1-9 5 4 3-7 3 7 5-4-1 9z"/>';
ICONS.trophy='<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>';
ICONS.tag='<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.2"/>';
ICONS.lock='<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';

// ─────────────── Blue Gates ───────────────
// 0 = E/D, 1 = C, 2 = B/A. Floors keep a brand-new hunter's gate winnable and a veteran's honest.
function blueTier(){const n=getEffectiveRank().name;return n==='C-RANK'?1:(n==='B-RANK'||n==='A-RANK')?2:0}
function pickBlueGateType(monIso){
  const [y,m,d]=monIso.split('-').map(Number);
  const idx=Math.round((Date.UTC(y,m-1,d)-Date.UTC(2026,0,5))/(7*86400000))+3; // offset from the Red Gate cycle
  const n=BLUE_GATE_POOL.length;
  return BLUE_GATE_POOL[((idx%n)+n)%n];
}
// Swap out a gate this hunter can't possibly clear (no lift history yet, no nutrition targets)
function blueGateFallback(type,monIso){
  if(type.id==='heavier_hand'){const base=prBaselineBefore(weekBounds(monIso)[0]);if(!Object.keys(base).length)return BLUE_GATE_POOL.find(t=>t.id==='clean_sweep')}
  if(type.id==='long_walk'&&!hasRecentSteps(monIso))return BLUE_GATE_POOL.find(t=>t.id==='clean_sweep');
  if(type.id==='fuel_run'){const t=(typeof calcTDEE==='function')?calcTDEE():null;if(!t)return BLUE_GATE_POOL.find(t=>t.id==='quest_line')}
  return type;
}
function computeBlueTarget(type,monIso){
  const tier=blueTier();
  switch(type.id){
    case 'iron_tide':{let tot=0,n=0;for(let i=1;i<=4;i++){const v=weeklyVolume(shiftWeek(monIso,-i));if(v>0){tot+=v;n++}}
      return Math.max([5000,10000,15000][tier],Math.round((n?tot/n:0)*1.05/500)*500)}
    case 'clean_sweep':return [2,3,4][tier];
    case 'heavier_hand':return 1;
    case 'quest_line':return [3,3,4][tier];
    case 'fuel_run':return [3,4,4][tier];
    case 'long_road':return [45,60,90][tier];
    case 'long_walk':return stepsGateTarget(monIso);
    case 'time_under_iron':{let tot=0,n=0;for(let i=1;i<=4;i++){const m=weeklySessionMinutes(shiftWeek(monIso,-i));if(m>0){tot+=m;n++}}
      return Math.max([60,90,120][tier],Math.round((n?tot/n:0)/10)*10)}
  }
  return 1;
}
function blueGateDesc(type,target){
  const t=fmtN(target);
  switch(type.id){
    case 'iron_tide':return `Move ${t} lb this week. Scaled from your last four weeks, so it's a stretch, not a wall.`;
    case 'clean_sweep':return `${t} training sessions this week, with every logged set checked off.`;
    case 'heavier_hand':return 'Beat your best weight on any one lift.';
    case 'quest_line':return `Finish every daily quest on ${t} days this week.`;
    case 'fuel_run':return `Hit your protein target on ${t} days this week.`;
    case 'long_road':return `Log ${t} minutes of cardio this week.`;
    case 'time_under_iron':return `Spend ${t} minutes in a timed session this week.`;
    case 'long_walk':return `Log ${t} steps this week. Scaled from your last four weeks of logged steps.`;
  }
  return '';
}
function blueGateType(g){return BLUE_GATE_POOL.find(t=>t.id===(g&&g.type))||BLUE_GATE_POOL[0]}
function getBlueGateProgress(g){const type=blueGateType(g);return getGateProgress({week:g.week,type:type.m,target:g.target})}
let blueGateOpening=null;
async function ensureBlueGate(){
  if(isSRank())return null;
  const wk=gateWeekKey();
  let g=userData.blueGate;
  if(g&&g.week===wk)return g;
  if(blueGateOpening)return blueGateOpening;
  blueGateOpening=(async()=>{
    if(g){
      const hist=userData.blueGateHistory||[];
      if(!hist.some(h=>h.week===g.week))hist.push({week:g.week,type:g.type,cleared:!!g.cleared});
      userData.blueGateHistory=hist.slice(-52);
    }
    const type=blueGateFallback(pickBlueGateType(wk),wk);
    g={week:wk,type:type.id,target:computeBlueTarget(type,wk),cleared:false};
    userData.blueGate=g;
    try{await saveUser({blueGate:g,blueGateHistory:userData.blueGateHistory||[]})}catch(e){console.warn('blue gate save:',e)}
    return g;
  })();
  try{return await blueGateOpening}finally{blueGateOpening=null}
}
function calcStreakFrom(history,g){
  const all=[...(history||[])];
  if(g&&g.cleared)all.push({week:g.week,cleared:true});
  const byWeek={};all.forEach(h=>{byWeek[h.week]=h.cleared});
  let expect=(g&&g.cleared)?g.week:shiftWeek(gateWeekKey(),-1);
  let n=0;while(byWeek[expect]){n++;expect=shiftWeek(expect,-1)}
  return n;
}
function calcBlueGateStreak(){return calcStreakFrom(userData.blueGateHistory,userData.blueGate)}
function renderBlueGateCard(){
  const g=userData.blueGate;
  if(!g||g.week!==gateWeekKey()){
    ensureBlueGate().then(x=>{if(x&&currentPage==='missions')renderMissions()});
    return sysWin(`<div class="sys-title">[ Blue Gate ]</div><div class="mist" style="text-align:center;margin-top:8px">A gate is opening…</div>`,'blue-gate');
  }
  const type=blueGateType(g);
  const p=getBlueGateProgress(g);
  const pct=Math.min(100,p.target?(p.val/p.target)*100:0);
  const msLeft=weekBounds(g.week)[1]-Date.now();
  const dLeft=Math.max(0,Math.floor(msLeft/86400000)),hLeft=Math.max(0,Math.floor((msLeft%86400000)/3600000));
  const weekLabel=new Date(g.week+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const reward=`+${SHARD_REWARDS.blueGate} shards, +${BLUE_GATE_XP} XP`;
  let action='',right=`<span class="gold">Clear it: ${reward}</span>`;
  if(g.cleared){action=`<div class="rg-cleared">Gate cleared</div>`;right=''}
  else if(p.done){action=`<button class="btn-p rg-claim" onclick="claimBlueGate()">Claim: ${reward}</button>`;right=''}
  return sysWin(`<div class="sys-title">[ Blue Gate ]</div>
    <div class="rg-head"><div><div class="rg-name">${esc(type.name)}</div><div class="mist sm">Week of ${weekLabel}</div></div>${g.cleared?'':`<div class="num rg-timer">${dLeft}d ${hLeft}h</div>`}</div>
    <div class="rg-desc">${esc(blueGateDesc(type,g.target))}</div>
    <div class="track rg-track"><div class="fill" style="width:${pct}%"></div></div>
    <div class="rg-nums"><span>${fmtN(p.val)} / ${fmtN(p.target)} ${esc(type.unit)}</span><span>${Math.round(pct)}%</span></div>
    ${p.blocker&&!g.cleared?`<div class="rg-blocker">${esc(p.blocker)}</div>`:''}
    ${action}
    <div class="bg-foot"><button class="link" onclick="openBlueGateInfo()">${fmtN(userData.blueGatesCleared||0)} cleared, gate streak ${calcBlueGateStreak()}</button>${right}</div>`,'blue-gate'+(g.cleared?' cleared':''));
}
function openBlueGateInfo(){
  const pts=['A new gate opens every Monday for every rank, E through A. S-Ranks face the Red Gate instead.',
    'Seven challenge types rotate: volume, flawless sessions, a heavier top set, quest days, protein days, cardio and time trained.',
    'Targets scale to you, so a new hunter and a veteran both get a fair fight.',
    'Clear five for the Gatebreaker title. Your count shows in the Hall of Fame.'];
  openSheet(`<h2>How Blue Gates work</h2><ol class="bg-how">${pts.map(p=>`<li>${p}</li>`).join('')}</ol>
    <div class="m-actions"><button class="m-cancel" onclick="closeSheet()">Got it</button></div>`);
}
async function claimBlueGate(){
  const g=userData.blueGate;if(!g||g.cleared)return;
  const p=getBlueGateProgress(g);
  if(!p.done){toast('The gate still stands');return}
  g.cleared=true;g.clearedAt=Date.now();
  userData.blueGatesCleared=(userData.blueGatesCleared||0)+1;
  userData.shards=(userData.shards||0)+SHARD_REWARDS.blueGate;
  const gained=addXP(BLUE_GATE_XP);
  const type=blueGateType(g);
  queueFeedEvent('bgate',{name:type.name});
  await saveUser({blueGate:g,blueGatesCleared:userData.blueGatesCleared,shards:userData.shards,xp:userData.xp,feedEvents:userData.feedEvents||[]});
  const n=userData.blueGatesCleared;
  if(n>=1)unlockAch('blue_gate_1');if(n>=10)unlockAch('blue_gate_10');
  await checkTitles(true);
  await saveLeaderboard();updateTopBar();
  showGateCleared(type,gained,{blue:true,shards:SHARD_REWARDS.blueGate,count:n});
  if(currentPage==='missions')renderMissions();
}

// ─────────────── Titles ───────────────
function bestWeekStreak(){return Math.max(userData.prevWeeklyStreak||0,calcWeeklyStreak())}
// {have, need} for titles with a count, or a boolean for yes/no titles
function titleProgress(id){
  const best=bestLoggedLiftsFull();
  switch(id){
    case 'first_blood':return{have:Math.min(1,getLiftLogs().length),need:1};
    case 'quest_keeper':return{have:Math.min(30,userData.missionStreak||0),need:30};
    case 'centurion':return{have:Math.min(100,getLiftLogs().length),need:100};
    case 'the_unbroken':return{have:Math.min(12,bestWeekStreak()),need:12};
    case 'thousand_club':{const t=best.bench.w+best.squat.w+best.deadlift.w;return{have:Math.min(1000,t),need:1000,unit:'lb'}}
    case 'gatebreaker':return{have:Math.min(5,userData.blueGatesCleared||0),need:5};
    case 'crimson_hunter':return{have:Math.min(5,userData.redGatesCleared||0),need:5};
    case 'iron_will':return (userData.trialsCompleted||[]).includes('iron_gate');
    case 'gauntlet_survivor':return (userData.trialsCompleted||[]).includes('gauntlet');
    case 'shadow_monarch':return (userData.trialsCompleted||[]).includes('awakening');
    case 'record_holder':return false; // only granted from the Hall of Fame
    case 'the_wanderer':return{have:Math.min(1000000,stepsLifetime()),need:1000000};
    case 'the_strider':return{have:Math.min(100,stepBestStreak()),need:100};
  }
  return false;
}
function titleEarnedNow(id){const p=titleProgress(id);return typeof p==='boolean'?p:p.have>=p.need}
function titlesEarned(){return (userData.titlesEarned||[]).filter(id=>TITLES.some(t=>t.id===id))}
function hasTitle(id){return titlesEarned().includes(id)}
// Only ever returns a name from the catalog, so other users' IDs can't inject anything
function titleName(id){const t=TITLES.find(x=>x.id===id);return t?t.name:''}
// Must match the profile exactly for the leaderboard rules, so only filter unknown IDs
function myTitleId(){const id=userData.titleId||'';return TITLES.some(t=>t.id===id)?id:''}
async function checkTitles(quiet,extra){
  const have=new Set(titlesEarned());const fresh=[];
  TITLES.forEach(t=>{if(!have.has(t.id)&&(titleEarnedNow(t.id)||(extra||[]).includes(t.id))){have.add(t.id);fresh.push(t)}});
  if(!fresh.length)return [];
  userData.titlesEarned=[...have];
  try{await saveUser({titlesEarned:userData.titlesEarned})}catch(e){console.warn('titles save:',e)}
  fresh.forEach(t=>celebrate({kind:'title',t}));
  return fresh;
}
async function equipTitle(id){
  if(id&&!hasTitle(id)){toast('Earn that title first');return}
  userData.titleId=id||'';
  await saveUser({titleId:userData.titleId});
  await saveLeaderboard();
  openWardrobe('title');
  if(currentPage==='profile')renderProfile();
  toast(id?`Wearing ${titleName(id)}`:'Title removed');
}
function titleRowsHtml(){
  const earned=new Set(titlesEarned());const on=myTitleId();
  const order=[...TITLES].sort((a,b)=>(earned.has(b.id)?1:0)-(earned.has(a.id)?1:0));
  let h=`<p class="wd-sub">Titles are earned, never bought. Wear one and it shows under your name for everyone.</p><div class="li-list ttl-list">`;
  h+=`<button class="li ttl${on?'':' on'}" onclick="equipTitle('')"><span class="ico">${icon('x',18)}</span><span class="t">No title<small>Show your class title instead</small></span>${on?'':`<span class="ttl-on">${icon('check',18)}</span>`}</button>`;
  order.forEach(t=>{
    const have=earned.has(t.id),isOn=on===t.id;
    const p=titleProgress(t.id);
    let how=esc(t.how),bar='';
    if(!have&&typeof p==='object'){how+=`. ${fmtN(p.have)} of ${fmtN(p.need)}${p.unit?' '+p.unit:''}`;bar=`<span class="track ttl-track"><span class="fill" style="width:${Math.min(100,p.have/p.need*100)}%"></span></span>`}
    const right=isOn?`<span class="ttl-on">${icon('check',18)}</span>`:have?`<span class="btn-s sm ttl-eq">Equip</span>`:`<span class="ttl-lock">${icon('lock',18)}</span>`;
    h+=`<button class="li ttl${have?'':' locked'}${isOn?' on':''}${t.gold?' gold-t':''}" ${have&&!isOn?`onclick="equipTitle('${safeId(t.id)}')"`:'disabled'}>
      <span class="ico">${icon('tag',18)}</span><span class="t"><span class="ttl-n">${esc(t.name)}</span><small>${how}</small>${bar}</span>${right}</button>`;
  });
  return h+`</div>`;
}
// Title line under a name. Falls back to the class title so the line is never empty.
function titleLine(titleId,fallback){const n=titleName(titleId);return n?`<span class="ttl-chip${titleId==='shadow_monarch'?' gold':''}">${esc(n)}</span>`:esc(fallback||'')}

// ─────────────── Hall of Fame ───────────────
const HOF_PATTERNS={
  bench:STR_LIFTS.bench,squat:STR_LIFTS.squat,deadlift:STR_LIFTS.deadlift,
  ohp:{inc:/overhead press|\bohp\b|military press|standing press|shoulder press/,exc:/dumbbell|\bdb\b|machine|seated|smith|landmine|push press|arnold|behind|kettlebell|\bkb\b|cable|band/}
};
// Best finished set per big lift, with the date it was set. Unfinished sets (done:false) don't count.
function bestLoggedLiftsFull(){
  const out={};Object.keys(HOF_PATTERNS).forEach(k=>out[k]={w:0,date:''});
  getLiftLogs().forEach(e=>(e.exercises||[]).forEach(ex=>{
    const n=String(ex.name||'').toLowerCase();
    Object.entries(HOF_PATTERNS).forEach(([k,r])=>{
      if(!r.inc.test(n)||r.exc.test(n))return;
      const cap=(HOF_LIFTS.find(l=>l.k===k)||{}).cap||1500;
      (ex.sets||[]).forEach(s=>{if(s.done===false)return;const w=parseFloat(s.weight)||0,reps=parseFloat(s.reps)||0;
        if(reps>0&&w>0&&w<=cap&&w>out[k].w)out[k]={w:Math.round(w*10)/10,date:e.date||''}});
    });
  }));
  return out;
}
function hofOptedIn(){return (userData.privacy||{}).hideHof!==true}
// Step records for the leaderboard doc. Opted out or struck = zeros.
function hofPublicSteps(){
  const off=!hofOptedIn()||(userData.hofExclude||[]).includes('steps');
  return {stepsTotal:off?0:Math.min(100000000,stepsLifetime()),stepsWeek:off?0:Math.min(420000,stepsWeek(gateWeekKey())),stepsWeekOf:gateWeekKey()};
}
// What goes on your public leaderboard doc. A record the dev struck stays at 0.
function hofPublicBests(){
  const b=bestLoggedLiftsFull(),ex=userData.hofExclude||[],out={};
  Object.keys(HOF_PATTERNS).forEach(k=>{out[k]=hofOptedIn()&&!ex.includes(k)?b[k].w:0});
  return out;
}
let hofData=null;
const HOF_CATS=[
  ...HOF_LIFTS.map(l=>({id:l.k,name:l.name,sub:'Heaviest finished set',unit:'lb',icon:'crown',val:u=>+((u.bests||{})[l.k])||0})),
  {id:'total',name:'Big three total',sub:'Best bench + squat + deadlift',unit:'lb',icon:'trophy',val:u=>{const b=u.bests||{};return (+b.bench||0)+(+b.squat||0)+(+b.deadlift||0)}},
  {id:'workouts',name:'Most workouts',sub:'Lifting sessions logged',unit:'',icon:'crown',val:u=>+u.workouts||0},
  {id:'streak',name:'Longest week streak',sub:'Weeks in a row with 3+ sessions',unit:'weeks',icon:'crown',val:u=>+u.weekStreak||0},
  {id:'bgates',name:'Most Blue Gates',sub:'Blue Gates cleared',unit:'',icon:'crown',val:u=>+u.blueGates||0},
  {id:'stepsweek',name:'Most steps this week',sub:'Logged steps since Monday',unit:'',icon:'crown',val:u=>u.stepsWeekOf===gateWeekKey()?(+u.stepsWeek||0):0,strike:'steps'},
  {id:'stepslife',name:'Lifetime steps',sub:'Every step logged',unit:'',icon:'crown',val:u=>+u.stepsTotal||0,strike:'steps'}
];
async function loadHallOfFame(){
  const list=[];
  const snap=await db.collection('leaderboard').limit(500).get();
  snap.forEach(d=>{const x=d.data()||{};if(x.hof===false)return;list.push({uid:d.id,...x})});
  // Your own row always uses what's on this phone right now
  const meIdx=list.findIndex(u=>u.uid===U.uid);
  if(hofOptedIn()){
    const mine={uid:U.uid,username:userData.username||'hunter',rank:getEffectiveRank().name,titleId:myTitleId(),profilePic:userData.profilePic,frame:getCos().frame,
      bests:hofPublicBests(),...hofPublicSteps(),workouts:getLiftLogs().length,weekStreak:bestWeekStreak(),blueGates:userData.blueGatesCleared||0};
    if(meIdx>=0)list[meIdx]={...list[meIdx],...mine};else list.push(mine);
  }else if(meIdx>=0)list.splice(meIdx,1);
  hofData={at:Date.now(),list};
  return list;
}
function hofRanked(cat){
  return (hofData?hofData.list:[]).map(u=>({u,v:cat.val(u)})).filter(x=>x.v>0)
    .sort((a,b)=>b.v-a.v||String(a.u.username||'').localeCompare(String(b.u.username||'')));
}
function ordinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function hofValue(v,cat){return `${fmtN(v)}${cat.unit==='lb'?' lb':cat.unit?' '+cat.unit:''}`}
function hofRow(x,i,cat,opts){
  const u=x.u,me=u.uid===U.uid;const r=(u.rank&&RANKS.find(k=>k.name===u.rank))||RANKS[0];
  const t=titleName(u.titleId);
  let sub=me&&opts&&opts.youSub?opts.youSub:[rankLabel(r.name),t].filter(Boolean).join(', ');
  const sk=HOF_LIFTS.some(l=>l.k===cat.id)?cat.id:cat.strike||'';
  const strike=isDev&&!me&&sk?`<button class="link sm hof-strike" onclick="event.stopPropagation();devStrikeRecord('${safeId(u.uid)}','${sk}','${safeName(u.username||'hunter')}')">Strike</button>`:'';
  return `<div class="hof-row${me?' me':''}${i===0?' first':''}" role="button" tabindex="0" onclick="openProfileCard('${safeId(u.uid)}')">
    <span class="num hof-pos">${me&&i>2?ordinal(i+1):i+1}</span>
    <span class="ff-pic hof-av${i===0?' gold':''}${frameClass(u.frame)}">${avatarHtml(u.profilePic,`<span>${esc(String(u.username||'h')[0].toUpperCase())}</span>`)}</span>
    <span class="t"><span>${me?'You':esc(u.username||'hunter')}</span><small>${esc(sub)}</small></span>${strike}
    <span class="num hof-v">${hofValue(x.v,cat)}</span></div>`;
}
function hofPanel(cat){
  const ranked=hofRanked(cat);
  let h=`<div class="panel hof-panel"><div class="hof-head"><span class="hof-ic">${icon(cat.icon,20)}</span><span><span class="hof-name">${esc(cat.name)}</span><small class="mist">${esc(cat.sub)}</small></span></div>`;
  if(!ranked.length)return h+`<div class="empty-note">No records yet. Log a finished set to claim the first spot.</div></div>`;
  const best=bestLoggedLiftsFull();
  const youSub=(best[cat.id]&&best[cat.id].date)?'Set '+new Date(best[cat.id].date).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'Climbing';
  ranked.slice(0,3).forEach((x,i)=>{h+=hofRow(x,i,cat,{youSub})});
  const mi=ranked.findIndex(x=>x.u.uid===U.uid);
  if(mi>2)h+=hofRow(ranked[mi],mi,cat,{youSub});
  return h+`</div>`;
}
async function renderHallOfFame(el){
  el.innerHTML=hofTabs()+`<div class="empty-note">Opening the Hall of Fame…</div>`;
  try{await loadHallOfFame()}catch(e){el.innerHTML=hofTabs()+`<div class="empty-note">Couldn't open the Hall of Fame. ${esc(e.message||'')}</div>`;return}
  let h=hofTabs();
  h+=sysWin(`<div class="sys-title">[ Hall of Fame ]</div><div class="hof-intro">The heaviest lifts anyone in LexenFitness has logged. Records come from finished sets in your logs, not from Settings.</div>`,'hof-win');
  if(!hofOptedIn())h+=`<div class="hof-note">You're hidden from the Hall of Fame. Turn on "Show my records in the Hall of Fame" in Settings, Privacy to compete.</div>`;
  ['deadlift','bench','total'].forEach(id=>{h+=hofPanel(HOF_CATS.find(c=>c.id===id))});
  h+=`<div class="sec" style="margin-top:26px">More records</div><div class="li-list hof-more">`;
  ['squat','ohp','stepsweek','stepslife','workouts','streak','bgates'].forEach(id=>{
    const cat=HOF_CATS.find(c=>c.id===id);const top=hofRanked(cat)[0];
    h+=`<button class="li" onclick="openHofCategory('${id}')"><span class="ico gold">${icon(cat.icon,18)}</span><span class="t">${esc(cat.name)}<small>${top?'Held by '+(top.u.uid===U.uid?'you':esc(top.u.username||'hunter')):'No record yet'}</small></span>
      <span class="r num">${top?hofValue(top.v,cat):'—'}</span><span class="chev">${icon('chev',16)}</span></button>`;
  });
  h+=`</div><div class="hof-foot mist sm">Hide your numbers from the Hall of Fame in Settings, Privacy. Records past what's humanly plausible are refused, and a record that doesn't look right can be struck.</div>`;
  el.innerHTML=h;
  // Record Holder: first place in anything
  if(hofOptedIn()&&!hasTitle('record_holder')&&HOF_CATS.some(c=>{const r=hofRanked(c);return r.length>1&&r[0].u.uid===U.uid}))checkTitles(false,['record_holder']);
}
function hofTabs(){return `<div class="seg-mini"><button class="chip${lbMode==='all'?' on':''}" onclick="lbMode='all';renderLeaderboard()">All hunters</button><button class="chip${lbMode==='friends'?' on':''}" onclick="lbMode='friends';renderLeaderboard()">Friends</button><button class="chip${lbMode==='hof'?' on':''}" onclick="lbMode='hof';renderLeaderboard()">${icon('crown',14)} Hall of Fame</button></div>`}
function openHofCategory(id){
  const cat=HOF_CATS.find(c=>c.id===id);if(!cat)return;
  const ranked=hofRanked(cat).slice(0,10);
  openSheet(`<h2>${esc(cat.name)}</h2><div class="mist sm" style="margin:-4px 0 10px">${esc(cat.sub)}. Top 10.</div>
    <div class="hof-sheet">${ranked.length?ranked.map((x,i)=>hofRow(x,i,cat)).join(''):'<div class="empty-note">No records yet.</div>'}</div>
    <div class="m-actions"><button class="m-cancel" onclick="closeSheet()">Close</button></div>`);
}
// Dev: strike a record that doesn't look right. The owner's app keeps it at 0 from then on.
async function devStrikeRecord(uid,k,uname){
  if(!isDev||!(HOF_LIFTS.some(l=>l.k===k)||k==='steps'))return;
  if(!confirm(`Strike @${uname}'s ${k} record? It drops to 0 and stays out until you restore it.`))return;
  try{
    await db.collection('users').doc(uid).update({hofExclude:firebase.firestore.FieldValue.arrayUnion(k)});
    await db.collection('leaderboard').doc(uid).update(k==='steps'?{stepsTotal:0,stepsWeek:0}:{['bests.'+k]:0});
    toast('Record struck');renderLeaderboard();
  }catch(e){toast('Strike failed: '+(e.code||e.message))}
}
async function devRestoreRecords(){
  if(!isDev)return;
  const un=String(prompt('Restore struck records for which username?')||'').trim().toLowerCase().replace(/^@/,'');if(!un)return;
  try{const d=await db.collection('usernames').doc(un).get();if(!d.exists){toast('No hunter with that name');return}
    await db.collection('users').doc(d.data().uid).update({hofExclude:[]});toast(`Restored. @${un}'s records come back next time they open the app.`)}
  catch(e){toast('Restore failed: '+(e.code||e.message))}
}
async function devResetBlueGate(){
  if(!isDev)return;
  userData.blueGate=null;await ensureBlueGate();toast('Blue Gate reopened');if(currentPage==='missions')renderMissions();else renderProfile();
}

// ═══════════ v1.29.0 REDESIGN HELPERS ═══════════
let wardrobeTab='title';

// ═══════════════════════════════════════════════════════════════
//  v1.31.0 — Steps, unlock notifications, tap-outside menus, sign-in fixes
// ═══════════════════════════════════════════════════════════════
ICONS.steps='<path d="M7.5 3C9 3 10 5 10 7.5S9 12 7.5 12 5 10 5 7.5 6 3 7.5 3Z"/><path d="M5.8 14h3.4v2.2a1.7 1.7 0 0 1-3.4 0Z"/><path d="M16 6c1.5 0 2.5 2 2.5 4.5S17.5 15 16 15s-2.5-2-2.5-4.5S14.5 6 16 6Z"/><path d="M14.3 17h3.4v2.2a1.7 1.7 0 0 1-3.4 0Z"/>';

// ─────────────── Step data ───────────────
// userData.steps = {'YYYY-MM-DD': total}. A save replaces the day's number (people copy
// the total from Apple Health / Samsung Health), so nothing can be double counted.
const STEP_MAX=60000;
function stepsMap(){const m=userData.steps;return m&&typeof m==='object'?m:{}}
function stepsOn(d){return Math.max(0,parseInt(stepsMap()[d])||0)}
function stepGoal(){const g=parseInt(userData.stepGoal);return g>=1000&&g<=STEP_MAX?g:10000}
function stepDays(){return Object.keys(stepsMap()).filter(d=>stepsOn(d)>0).sort()}
function stepsLifetime(){return stepDays().reduce((a,d)=>a+stepsOn(d),0)}
function stepsWeek(monIso){return weekDayKeys(monIso).reduce((a,d)=>a+stepsOn(d),0)}
function dayShift(d,n){const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return getDateStr(x)}
function stepBestDay(){let best={d:'',n:0};stepDays().forEach(d=>{const n=stepsOn(d);if(n>best.n)best={d,n}});return best}
// Days in a row at or over the goal. Today only counts once it's hit, so the streak
// doesn't look broken first thing in the morning.
function stepGoalStreak(){
  const g=stepGoal();let d=getTodayStr();
  if(stepsOn(d)<g)d=dayShift(d,-1);
  let n=0;while(stepsOn(d)>=g){n++;d=dayShift(d,-1)}
  return n;
}
function stepBestStreak(){
  const g=stepGoal();let best=0,run=0,prev='';
  stepDays().forEach(d=>{if(stepsOn(d)<g){run=0;prev=d;return}run=(prev&&dayShift(prev,1)===d&&run>0)?run+1:1;prev=d;if(run>best)best=run});
  return Math.max(best,userData.stepBestStreak||0);
}

// ─────────────── Badges ───────────────
// Each returns {have, need} so the Steps page can show the closest ones.
function stepBadgeProgress(id){
  const g=stepGoal(),days=stepDays(),best=stepBestDay().n,life=stepsLifetime();
  const big=n=>({have:Math.min(best,n),need:n}),lt=n=>({have:Math.min(life,n),need:n});
  switch(id){
    case 'steps_day_10k':return big(10000);case 'steps_15k':return big(15000);case 'steps_20k':return big(20000);case 'steps_25k':return big(25000);case 'steps_30k':return big(30000);
    case 'steps_life_55k':return lt(55000);case 'steps_life_100k':return lt(100000);case 'steps_life_211k':return lt(211000);case 'steps_life_500k':return lt(500000);
    case 'steps_life_1m':return lt(1000000);case 'steps_life_2m':return lt(2000000);case 'steps_life_5900k':return lt(5900000);
    case 'steps_streak_7':return{have:Math.min(stepBestStreak(),7),need:7};
    case 'steps_streak_30':return{have:Math.min(stepBestStreak(),30),need:30};
    case 'steps_streak_100':return{have:Math.min(stepBestStreak(),100),need:100};
    case 'steps_full_week':{let bestWk=0;const wks=new Set(days.map(d=>gateWeekKey(new Date(d+'T12:00:00'))));
      wks.forEach(w=>{const c=weekDayKeys(w).filter(d=>stepsOn(d)>=g).length;if(c>bestWk)bestWk=c});return{have:bestWk,need:7}}
    case 'steps_weekend':{let ok=0;days.forEach(d=>{const x=new Date(d+'T12:00:00');if(x.getDay()===6&&stepsOn(d)>=10000&&stepsOn(dayShift(d,1))>=10000)ok=1});return{have:ok,need:1}}
    case 'steps_month':{const m={};days.forEach(d=>{const k=d.slice(0,7);m[k]=(m[k]||0)+stepsOn(d)});const mx=Math.max(0,...Object.values(m));return{have:Math.min(mx,300000),need:300000}}
    case 'steps_logbook':return{have:Math.min(days.length,30),need:30};
    case 'steps_double':{const lifted=new Set(getLiftLogs().filter(e=>!e.backdated).map(e=>getDateStr(new Date(e.date))));return{have:days.some(d=>stepsOn(d)>=g&&lifted.has(d))?1:0,need:1}}
    case 'steps_comeback':{let ok=0;for(let i=1;i<days.length;i++){const gap=(new Date(days[i]+'T12:00:00')-new Date(days[i-1]+'T12:00:00'))/86400000;if(gap>=4&&stepsOn(days[i])>=g)ok=1}return{have:ok,need:1}}
    case 'steps_exact':return{have:days.some(d=>stepsOn(d)===10000)?1:0,need:1};
  }
  return null;
}
function stepAchIds(){return ACHIEVEMENTS.filter(a=>a.id.startsWith('steps_')).map(a=>a.id)}
function stepAchEarnedNow(){return stepAchIds().filter(id=>{const p=stepBadgeProgress(id);return p&&p.have>=p.need})}
// Unlock several badges in ONE write, then show them together
async function unlockMany(ids){
  const fresh=ids.filter(id=>!userData.achievements.includes(id));
  if(!fresh.length)return [];
  fresh.forEach(id=>unlockAchSilent(id));
  userData.shards=(userData.shards||0)+fresh.length*SHARD_REWARDS.achievement;
  fresh.forEach(id=>{const a=ACHIEVEMENTS.find(x=>x.id===id);if(a&&(a.xp>=100||a.secret))queueFeedEvent('ach',{id})});
  await saveUser({achievements:userData.achievements,xp:userData.xp,shards:userData.shards,feedEvents:userData.feedEvents||[]});
  fresh.forEach(id=>celebrate({kind:'badge',a:ACHIEVEMENTS.find(x=>x.id===id)}));
  return fresh;
}

// ─────────────── Saving ───────────────
async function saveSteps(d,n){
  n=Math.round(+n||0);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>getTodayStr()){toast('Pick today or an earlier day');return false}
  if(n<0||n>STEP_MAX){toast(`Steps go up to ${fmtN(STEP_MAX)} a day`);return false}
  const steps={...stepsMap()};
  if(n>0)steps[d]=n;else delete steps[d];
  const upd={steps};
  // +10 XP for hitting the goal, once per day, and only for today or yesterday
  // (no back-filling a year of XP)
  const xpDays={...(userData.stepXpDays||{})};
  let gained=0;
  if(n>=stepGoal()&&!xpDays[d]&&(d===getTodayStr()||d===dayShift(getTodayStr(),-1))){
    gained=addXP(10);xpDays[d]=1;
    Object.keys(xpDays).sort().slice(0,-40).forEach(k=>delete xpDays[k]);
    upd.stepXpDays=xpDays;upd.xp=userData.xp;
  }
  userData.steps=steps;
  const bs=stepBestStreak();if(bs>(userData.stepBestStreak||0))upd.stepBestStreak=bs;
  try{await saveUser(upd)}catch(e){toast('Couldn\'t save steps. Check your connection.');return false}
  await unlockMany(stepAchEarnedNow());
  // Today's "Step It Up" quest, if it's in today's list, completes itself
  try{const ms=getDailyMissions(getTodayStr(),userData.class)||[];const done=(userData.missionsCompleted||{})[getTodayStr()]||[];
    if(d===getTodayStr()&&n>=10000&&ms.some(m=>m.id==='steps_10k')&&!done.includes('steps_10k'))await completeMission('steps_10k')}catch(e){console.warn(e)}
  await saveLeaderboard();updateTopBar();
  toast(n>0?`${fmtN(n)} steps saved${gained?`, goal hit +${gained} XP`:''}`:'Steps cleared');
  if(currentPage==='missions')renderMissions();
  if($('sp-steps')&&$('sp-steps').classList.contains('active'))renderStepsPage();
  return true;
}

// ─────────────── Home tile ───────────────
function stepTileHtml(){
  const today=getTodayStr(),n=stepsOn(today),g=stepGoal();
  if(!n){const y=stepsOn(dayShift(today,-1));
    return `<button class="ps-tile tap st-tile empty" onclick="openStepLog()"><span class="st-tile-ic">${icon('steps',18)}</span><div class="ps-l st-tile-cta">Log steps</div><div class="ps-l">${y?'Yesterday '+fmtN(y):'Tap to add today'}</div></button>`}
  const hit=n>=g,pct=Math.min(100,n/g*100);
  const big=n>=10000?(n/1000).toFixed(n>=100000?0:1).replace(/\.0$/,'')+'k':fmtN(n);
  return `<button class="ps-tile tap st-tile${hit?' hit':''}" onclick="openStepLog()"><div class="num ps-v">${big}</div><div class="ps-l">${hit?'Goal hit':'Steps of '+(g%1000===0?g/1000+'k':fmtN(g))}</div><span class="st-tile-bar"><span style="width:${pct}%"></span></span></button>`;
}

// ─────────────── Log steps sheet ───────────────
let stepLogDate=null;
function openStepLog(d){
  const today=getTodayStr(),yest=dayShift(today,-1);
  stepLogDate=d||stepLogDate||today;if(stepLogDate>today)stepLogDate=today;
  const mode=stepLogDate===today?'today':stepLogDate===yest?'yest':'earlier';
  const cur=stepsOn(stepLogDate);
  const label=mode==='today'?'today':mode==='yest'?'yesterday':new Date(stepLogDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  const min=dayShift(today,-365);
  openSheet(`<h2>Log steps</h2>
    <div class="sub-tabs st-days" role="tablist">
      <button class="stab${mode==='today'?' active':''}" onclick="openStepLog('${today}')">Today</button>
      <button class="stab${mode==='yest'?' active':''}" onclick="openStepLog('${yest}')">Yesterday</button>
      <label class="stab${mode==='earlier'?' active':''} st-earlier">${icon('cal',16)} Earlier<input type="date" max="${yest}" min="${min}" value="${mode==='earlier'?stepLogDate:''}" onchange="if(this.value)openStepLog(this.value)" aria-label="Pick an earlier day"></label>
    </div>
    <label class="au-label" for="stepInput">Total steps for ${esc(label)}</label>
    <div class="st-field"><input id="stepInput" type="text" inputmode="numeric" autocomplete="off" placeholder="0" value="${cur?fmtN(cur):''}" oninput="stepInputFmt(this)" onkeydown="if(event.key==='Enter')submitStepLog()"><span class="mist">steps</span></div>
    <div class="mist sm st-help">Copy the total from Apple Health, Samsung Health or your watch app. Saving again later replaces this number. Up to ${fmtN(STEP_MAX)} a day.</div>
    <button class="li st-goal-row" onclick="openStepGoal()"><span class="t">Daily goal<small>Change it any time</small></span><span class="num">${fmtN(stepGoal())}</span><span class="chev">${icon('chev',16)}</span></button>
    <button class="btn-p st-save" id="stepSaveBtn" onclick="submitStepLog()">${cur?'Save '+fmtN(cur)+' steps':'Save steps'}</button>
    ${cur?`<button class="link st-clear" onclick="submitStepLog(0)">Clear this day</button>`:''}
    <button class="link st-more" onclick="closeSheet();openStepsPage()">${icon('pulse',16)} Your week, streaks and badges</button>`);
  setTimeout(()=>{const i=$('stepInput');if(i){i.focus();try{i.setSelectionRange(i.value.length,i.value.length)}catch(e){}}},250);
}
function stepInputFmt(el){
  const digits=el.value.replace(/\D/g,'').slice(0,6);const n=parseInt(digits)||0;
  el.value=digits?fmtN(n):'';
  const b=$('stepSaveBtn');if(b)b.textContent=n?`Save ${fmtN(n)} steps`:'Save steps';
  el.classList.toggle('over',n>STEP_MAX);
}
async function submitStepLog(force){
  const el=$('stepInput');const n=force===0?0:parseInt(String(el&&el.value||'').replace(/\D/g,''))||0;
  if(force!==0&&!n){toast('Type your step total first');return}
  if(n>STEP_MAX){toast(`Steps go up to ${fmtN(STEP_MAX)} a day`);return}
  if(await saveSteps(stepLogDate||getTodayStr(),n)){closeSheet();stepLogDate=null}
}
function openStepGoal(){
  const g=stepGoal();const presets=[6000,8000,10000,12000,15000];
  openSheet(`<h2>Daily step goal</h2><div class="mist sm" style="margin:-4px 0 12px">Streaks and the +10 XP use this number.</div>
    <div class="st-goals">${presets.map(p=>`<button class="chip${p===g?' on':''}" onclick="setStepGoal(${p})">${p/1000}k</button>`).join('')}</div>
    <label class="au-label" for="stepGoalInput">Or your own number</label>
    <div class="st-field"><input id="stepGoalInput" type="text" inputmode="numeric" placeholder="${fmtN(g)}" value="${presets.includes(g)?'':fmtN(g)}" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,5)?fmtN(parseInt(this.value.replace(/\\D/g,'').slice(0,5))):''"><span class="mist">steps</span></div>
    <div class="m-actions"><button class="m-cancel" onclick="closeSheet()">Cancel</button><button class="m-save-btn" onclick="setStepGoal(parseInt($('stepGoalInput').value.replace(/\\D/g,''))||0)">Save</button></div>`);
}
async function setStepGoal(n){
  if(!n){closeSheet();return}
  if(n<1000||n>STEP_MAX){toast(`Pick a goal from 1,000 to ${fmtN(STEP_MAX)}`);return}
  await saveUser({stepGoal:n});closeSheet();toast(`Goal set to ${fmtN(n)} steps`);
  if(currentPage==='missions')renderMissions();
  if($('sp-steps')&&$('sp-steps').classList.contains('active'))renderStepsPage();
}

// ─────────────── Steps page ───────────────
let stepWeekOffset=0;
function openStepsPage(){
  stepWeekOffset=0;
  switchPage('ranks');switchSubTab('ranks','steps');
  const b=document.querySelector('#page-ranks .pg-back .back-btn');
  if(b){b.lastChild.textContent='Home';b.onclick=()=>switchPage('missions')}
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page==='missions'));
  renderStepsPage();window.scrollTo(0,0);
}
function renderStepsPage(){
  const el=$('stepsContent');if(!el)return;
  const g=stepGoal(),today=getTodayStr();
  const wk=shiftWeek(gateWeekKey(),stepWeekOffset);const keys=weekDayKeys(wk);
  const vals=keys.map(stepsOn);const total=vals.reduce((a,b)=>a+b,0);
  const counted=keys.filter(d=>d<=today&&stepsOn(d)>0).length;
  const avg=counted?Math.round(total/counted):0;
  const mx=Math.max(g*1.3,...vals);
  const bars=keys.map((d,i)=>{const v=vals[i];const cls=v>=g?' hit':'';return `<div class="st-bar${cls}${d===today?' today':''}" style="height:${v?Math.max(4,v/mx*130):3}px" title="${fmtN(v)}"></div>`}).join('');
  const dn=['M','T','W','T','F','S','S'];
  const lab=keys.map((d,i)=>`<span${d===today?' class="on"':''}>${dn[i]}</span>`).join('');
  const range=`${new Date(keys[0]+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} to ${new Date(keys[6]+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
  const best=stepBestDay();
  let h=`<div class="pg-head"><h1 class="pg-title">Steps</h1><div class="pg-actions"><button class="btn-s" onclick="openStepLog('${today}')">${icon('plus',16)} Log</button></div></div>`;
  h+=sysWin(`<div class="sys-title">[ Steps ]</div>
    <div class="st-sum"><div><div class="num st-sum-v">${fmtN(total)}</div><div class="mist sm">${stepWeekOffset===0?'This week so far':'That week'}</div></div>
      <div style="text-align:right"><div class="num st-sum-v">${fmtN(avg)}</div><div class="mist sm">Daily average</div></div></div>
    <div class="st-bars" role="img" aria-label="Steps each day, ${range}">${bars}<div class="st-goal-line" style="bottom:${Math.min(130,g/mx*130)}px"><span>Goal ${fmtN(g)}</span></div></div>
    <div class="st-blab">${lab}</div>
    <div class="st-wknav"><button class="link" onclick="stepWeekOffset--;renderStepsPage()">${icon('left',14)} Earlier</button><span class="mist sm">${range}</span>
      <button class="link" ${stepWeekOffset>=0?'disabled':''} onclick="stepWeekOffset++;renderStepsPage()">Later ${icon('chev',14)}</button></div>`,'st-win');
  h+=`<div class="st-kv">
    <div class="panel"><div class="num">${fmtN(stepsLifetime())}</div><div class="mist sm">Lifetime steps</div></div>
    <div class="panel"><div class="num">${best.n?fmtN(best.n):'—'}</div><div class="mist sm">${best.d?'Best day, '+new Date(best.d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'Best day'}</div></div>
    <div class="panel"><div class="num st-flame">${stepGoalStreak()} ${icon('flame',16)}</div><div class="mist sm">Goal streak, days</div></div>
    <div class="panel"><div class="num">${stepBestStreak()}</div><div class="mist sm">Best streak, days</div></div></div>`;
  h+=`<div class="sec" style="margin-top:26px">Daily goal</div><div class="mist sm">Streaks and the +10 XP use this number.</div>
    <div class="st-goals">${[6000,8000,10000,12000,15000].map(p=>`<button class="chip${p===g?' on':''}" onclick="setStepGoal(${p})">${p/1000}k</button>`).join('')}<button class="chip${[6000,8000,10000,12000,15000].includes(g)?'':' on'}" onclick="openStepGoal()">${[6000,8000,10000,12000,15000].includes(g)?'Other':fmtN(g)}</button></div>`;
  const recent=[];for(let i=0;i<14;i++)recent.push(dayShift(today,-i));
  h+=`<div class="sec" style="margin-top:26px">Recent days</div><div class="li-list st-recent">`+recent.map((d,i)=>{const v=stepsOn(d);
    const lbl=i===0?'Today':i===1?'Yesterday':new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    return `<button class="li" onclick="openStepLog('${d}')"><span class="t">${lbl}</span><span class="num${v?'':' dim'}">${v?fmtN(v):'—'}</span><span class="st-ok">${v>=g?icon('check',18):''}</span><span class="mist">${icon('edit',16)}</span></button>`}).join('')+`</div>`;
  const ul=userData.achievements||[];
  const next=ACHIEVEMENTS.filter(a=>a.id.startsWith('steps_')&&!a.secret&&!ul.includes(a.id)).map(a=>({a,p:stepBadgeProgress(a.id)})).filter(x=>x.p)
    .sort((x,y)=>y.p.have/y.p.need-x.p.have/x.p.need).slice(0,3);
  if(next.length){
    h+=`<div class="sec" style="margin-top:26px">Next badges</div><div class="li-list">`+next.map(({a,p})=>`<button class="li" onclick="openProfileView('badges')"><span class="ico">${icon('badge',18)}</span>
      <span class="t">${esc(a.name)}<small>${esc(a.desc)}. ${p.need>1?fmtN(p.have)+' of '+fmtN(p.need):'Not yet'}</small><span class="track st-track"><span class="fill" style="width:${Math.min(100,p.have/p.need*100)}%"></span></span></span><span class="chev">${icon('chev',16)}</span></button>`).join('')+`</div>`;
  }
  el.innerHTML=h;
}

// ─────────────── Blue Gate: Long Walk ───────────────
function stepsGateTarget(monIso){
  const tier=blueTier();let tot=0,n=0;
  for(let i=1;i<=4;i++){const v=stepsWeek(shiftWeek(monIso,-i));if(v>0){tot+=v;n++}}
  return Math.max([35000,45000,50000][tier],Math.round((n?tot/n:0)*1.1/1000)*1000);
}
function hasRecentSteps(monIso){const s=new Date(monIso+'T12:00:00');for(let i=1;i<=14;i++){const x=new Date(s);x.setDate(x.getDate()-i);if(stepsOn(getDateStr(x))>0)return true}return false}

// ─────────────── Nutrition: suggest a step range from real steps ───────────────
const STEP_BUCKETS=[2000,4000,6000,8000,10000,12000];
function stepRangeSuggestion(){
  const today=getTodayStr();const vals=[];
  for(let i=1;i<=14;i++){const v=stepsOn(dayShift(today,-i));if(v>0)vals.push(v)}
  if(vals.length<10)return null;
  const avg=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  const bucket=STEP_BUCKETS.reduce((b,x)=>Math.abs(x-avg)<Math.abs(b-avg)?x:b,STEP_BUCKETS[0]);
  const cur=parseInt(userData.dailySteps)||0;
  if(bucket===cur)return null;
  const dis=userData.stepHintDismissed||'';
  if(dis&&dis>dayShift(today,-14))return null;
  const delta=(typeof stepsToCalories==='function')?stepsToCalories(bucket)-stepsToCalories(cur):0;
  return {avg,bucket,cur,delta};
}
function stepRangeHintHtml(){
  const s=stepRangeSuggestion();if(!s)return '';
  const curTxt=s.cur?'about '+fmtN(s.cur):'no step estimate';
  return `<div class="st-hint"><span class="st-hint-i">${icon('steps',18)}</span><div>Your last 14 days average <b>${fmtN(s.avg)} steps</b>, but your target assumes ${curTxt}. Switching to about ${fmtN(s.bucket)} ${s.delta>=0?'adds':'takes off'} ${fmtN(Math.abs(s.delta))} cal a day.</div>
    <div class="st-hint-btns"><button class="btn-s" onclick="dismissStepHint()">${s.cur?'Keep '+fmtN(s.cur):'Not now'}</button><button class="btn-s on" onclick="applyStepHint(${s.bucket})">Use ${fmtN(s.bucket)}</button></div></div>`;
}
async function dismissStepHint(){await saveUser({stepHintDismissed:getTodayStr()});renderNutritionPage()}
async function applyStepHint(b){if(!STEP_BUCKETS.includes(b))return;await saveUser({dailySteps:String(b),stepHintDismissed:getTodayStr()});renderNutritionPage();toast(`Step range set to about ${fmtN(b)}`)}

// ─────────────── Unlock notifications ───────────────
// kinds: badge {a} · title {t} · tier {name, sub, xp}. Badges that arrive together show as one card.
let unlockQueue=[],unlockShowing=false,unlockTimer=null,unlockBatch=[];
function celebrate(item){if(!item||(item.kind==='badge'&&!item.a))return;unlockQueue.push(item);if(!unlockShowing)showNextUnlock()}
function celebrateAch(a){if(a)celebrate({kind:'badge',a})}
function unlockRow(ic,name,desc){return `<div class="un-row"><span class="un-ic">${ic}</span><span class="un-t"><span class="un-n">${esc(name)}</span>${desc?`<span class="un-d">${esc(desc)}</span>`:''}</span></div>`}
function showNextUnlock(){
  clearTimeout(unlockTimer);
  const item=unlockQueue.shift();
  if(!item){unlockShowing=false;return}
  unlockShowing=true;
  let card=$('achCelebration');
  if(!card){card=document.createElement('div');card.id='achCelebration';card.className='ach-celebration';card.setAttribute('role','status');document.body.appendChild(card)}
  let html='',gold=false,ms=3800;card.onclick=null;
  if(item.kind==='badge'){
    unlockBatch=[item.a];
    while(unlockQueue.length&&unlockQueue[0].kind==='badge'){unlockBatch.push(unlockQueue.shift().a)}
    const xp=unlockBatch.reduce((s,a)=>s+(a.xp||0),0),sh=unlockBatch.length*SHARD_REWARDS.achievement;
    const rew=[xp?`+${fmtN(xp)} XP`:'',`+${sh} shards`].filter(Boolean).join(', ');
    if(unlockBatch.length===1){
      const a=unlockBatch[0];
      html=`<div class="sys-title sm">[ Badge earned ]</div>${unlockRow(a.icon||'🏅',a.name,a.desc)}<div class="un-foot"><span class="gold">${rew}</span></div>`;
      card.onclick=()=>{hideUnlock();openProfileView('badges')};
    }else{
      const show=unlockBatch.slice(0,3),more=unlockBatch.length-show.length;
      html=`<div class="sys-title sm">[ ${unlockBatch.length} badges earned ]</div>${show.map(a=>unlockRow(a.icon||'🏅',a.name,a.desc)).join('')}
        ${more>0?`<div class="un-more">and ${more} more</div>`:''}<div class="un-foot"><span class="gold">${rew}</span><button class="btn-s sm" onclick="event.stopPropagation();openUnlockList()">${more>0?`See all ${unlockBatch.length}`:'See all'}</button></div>`;
      card.onclick=()=>openUnlockList();ms=6500;
    }
    try{if(navigator.vibrate)navigator.vibrate([100,50,100])}catch(e){}
  }else if(item.kind==='title'){
    gold=true;ms=6000;
    html=`<div class="sys-title sm">[ Title earned ]</div>${unlockRow(icon('tag',20),item.t.name,item.t.how)}
      <div class="un-foot"><span class="gold">Wear it under your name</span><button class="btn-s sm" onclick="event.stopPropagation();hideUnlock();equipTitle('${safeId(item.t.id)}')">Equip</button></div>`;
    card.onclick=()=>{hideUnlock();openWardrobe('title')};
  }else if(item.kind==='tier'){
    html=`<div class="sys-title sm">[ Tier complete ]</div>${unlockRow(icon('ladder',20),item.name,item.sub)}<div class="un-foot"><span class="gold">+${fmtN(item.xp)} XP</span></div>`;
    card.onclick=()=>hideUnlock();
  }
  card.innerHTML=sysWin(html,'un-win'+(gold?' gold':''));
  requestAnimationFrame(()=>card.classList.add('show'));
  unlockTimer=setTimeout(hideUnlock,ms);
}
function hideUnlock(){
  clearTimeout(unlockTimer);
  const card=$('achCelebration');if(!card){unlockShowing=false;return}
  if(!card.classList.contains('show')){showNextUnlock();return}
  card.classList.remove('show');setTimeout(showNextUnlock,380);
}
function openUnlockList(){
  const list=unlockBatch.slice();hideUnlock();
  openSheet(`<h2>${list.length} badges earned</h2><div class="li-list un-list">${list.map(a=>`<div class="li"><span class="ico un-ico">${a.icon||'🏅'}</span><span class="t">${esc(a.name)}<small>${esc(a.desc||'')}</small></span><span class="num gold">${a.xp?'+'+fmtN(a.xp):''}</span></div>`).join('')}</div>
    <div class="m-actions"><button class="m-cancel" onclick="closeSheet()">Close</button><button class="m-save-btn" onclick="closeSheet();openProfileView('badges')">All badges</button></div>`);
}

// ─────────────── Tap outside a menu to close it ───────────────
// One rule for every .modal-bg. It presses the menu's own Cancel/Close button so any
// cleanup runs (the scanner stops the camera, etc.). If something was typed, it asks first.
(function(){
  let downOn=null;
  document.addEventListener('pointerdown',e=>{downOn=e.target},true);
  document.addEventListener('input',e=>{const m=e.target.closest&&e.target.closest('.modal-bg');if(m)m.dataset.dirty='1'},true);
  // Opening a menu clears its "typed" flag
  const mo=new MutationObserver(ms=>ms.forEach(r=>{const el=r.target;if(el.classList&&el.classList.contains('modal-bg')&&el.classList.contains('open')&&!r.oldValue?.includes('open'))delete el.dataset.dirty}));
  const watch=()=>document.querySelectorAll('.modal-bg').forEach(m=>{if(!m.dataset.watched){m.dataset.watched='1';mo.observe(m,{attributes:true,attributeFilter:['class'],attributeOldValue:true})}});
  watch();setInterval(watch,3000);
  document.addEventListener('click',e=>{
    const m=e.target;
    if(!m.classList||!m.classList.contains('modal-bg')||!m.classList.contains('open'))return;
    if(downOn!==m)return; // a drag that started inside the menu (e.g. selecting text) doesn't count
    if(m.id==='sheetModal')return; // the sheet has its own handler
    if(m.dataset.dirty==='1'&&!confirm('Discard what you typed?'))return;
    closeModalBg(m);
  });
})();
function closeModalBg(m){
  const btns=[...m.querySelectorAll('button')];
  const btn=btns.find(b=>/close|cancel/i.test(b.getAttribute('onclick')||''))||m.querySelector('.m-cancel')||btns.find(b=>/^(cancel|close|done|not now|skip)$/i.test(b.textContent.trim()));
  if(btn)btn.click();
  if(m.classList.contains('open'))m.classList.remove('open');
  delete m.dataset.dirty;
}

// ─────────────── Keep me signed in ───────────────
function keepSignedIn(){try{return localStorage.getItem('lexen_keep')!=='0'}catch(e){return true}}
function applyPersistence(){
  try{const P=firebase.auth.Auth.Persistence;return auth.setPersistence(keepSignedIn()?P.LOCAL:(P.SESSION||P.LOCAL)).catch(e=>console.warn('[auth] persistence',e))}catch(e){return Promise.resolve()}
}
function setKeepSignedIn(on){try{localStorage.setItem('lexen_keep',on?'1':'0')}catch(e){}document.querySelectorAll('.keep-cb').forEach(c=>c.checked=on);applyPersistence()}
function syncKeepBoxes(){document.querySelectorAll('.keep-cb').forEach(c=>c.checked=keepSignedIn())}
