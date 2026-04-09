// ═══════════════════════════════════════════
//  LEXENFITNESS — APP LOGIC v2
// ═══════════════════════════════════════════
firebase.initializeApp({apiKey:"AIzaSyCbH-A7pp1xrtwHSaVUKlPA0hR2skHu9iY",authDomain:"lexenfitness.firebaseapp.com",projectId:"lexenfitness",storageBucket:"lexenfitness.firebasestorage.app",messagingSenderId:"570672585202",appId:"1:570672585202:web:ce329745b0282ee86c736b"});
const auth=firebase.auth(),db=firebase.firestore();
let U=null,userData={},workoutLog=[],savedInputs={};
let currentDay='day1',currentPage='workout',logFilter='all',lbMode='all';
let editTarget=null,addDayIdx=null,selectedClass=null,selectedSub=null,selectedProg=null;
const $=id=>document.getElementById(id);

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
  const uc=await db.collection('usernames').doc(uname).get();
  if(uc.exists){$('signupError').textContent='Username taken';return}
  try{const cred=await auth.createUserWithEmailAndPassword(e,p);const dn=f+(l?' '+l:'');await cred.user.updateProfile({displayName:dn});
    const fc=genFriendCode();
    await db.collection('users').doc(cred.user.uid).set({name:dn,username:uname,email:e,friendCode:fc,xp:0,achievements:[],stats:{},prs:{},profilePic:'',class:'',subclass:'',programKey:'',program:[],friends:[],privacy:{hideName:false,hideStats:false},goal:'',experience:'',missionsCompleted:{},missionStreak:0,trialsCompleted:[],createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    await db.collection('usernames').doc(uname).set({uid:cred.user.uid});
    await db.collection('friendCodes').doc(fc).set({uid:cred.user.uid});
  }catch(err){$('signupError').textContent=friendlyErr(err.code)}
}
async function resetPassword(){const e=$('loginEmail').value.trim();if(!e){$('loginError').textContent='Enter email first';return}try{await auth.sendPasswordResetEmail(e);$('loginError').style.color='var(--green)';$('loginError').textContent='Reset link sent!';setTimeout(()=>{$('loginError').style.color='';$('loginError').textContent=''},4000)}catch(err){$('loginError').textContent=friendlyErr(err.code)}}
const doLogout=()=>auth.signOut();
function friendlyErr(c){return{'auth/invalid-email':'Invalid email','auth/user-not-found':'No account','auth/wrong-password':'Wrong password','auth/email-already-in-use':'Email taken','auth/weak-password':'Password 6+ chars','auth/invalid-credential':'Invalid email or password','auth/too-many-requests':'Too many attempts','auth/requires-recent-login':'Please sign out and back in first'}[c]||'Something went wrong'}

auth.onAuthStateChanged(async u=>{$('loadingScreen').style.display='none';if(u){U=u;await loadUserData();if(!userData.class){showScreen('classScreen');buildClassSelect()}else{showScreen('appScreen');initApp()}}else{U=null;showScreen('authScreen')}});
function showScreen(id){['authScreen','classScreen','appScreen'].forEach(s=>{$(s).classList.remove('active');$(s).style.display='none'});$(id).style.display='';$(id).classList.add('active')}

// ═══════════ FIRESTORE ═══════════
async function loadUserData(){
  const doc=await db.collection('users').doc(U.uid).get();
  userData=doc.exists?doc.data():{name:U.displayName||'',xp:0,achievements:[],stats:{},prs:{},friends:[],privacy:{hideName:false,hideStats:false},missionsCompleted:{},missionStreak:0,trialsCompleted:[]};
  ['achievements','friends','trialsCompleted'].forEach(k=>{if(!userData[k])userData[k]=[]});
  ['stats','prs','privacy','missionsCompleted'].forEach(k=>{if(!userData[k])userData[k]={}});
  if(!userData.missionStreak)userData.missionStreak=0;
  const ls=await db.collection('users').doc(U.uid).collection('log').orderBy('date','desc').limit(200).get();
  workoutLog=[];ls.forEach(d=>workoutLog.push({_id:d.id,...d.data()}));
  const iDoc=await db.collection('users').doc(U.uid).collection('meta').doc('inputs').get();
  savedInputs=iDoc.exists?(iDoc.data().data||{}):{};
}
async function saveUser(f){await db.collection('users').doc(U.uid).update(f);Object.assign(userData,f)}
async function saveLeaderboard(){const r=getRank(userData.xp);await db.collection('leaderboard').doc(U.uid).set({username:userData.username||userData.name,xp:userData.xp,class:userData.class,subclass:userData.subclass||'',rank:r.name,profilePic:userData.profilePic||'',friendCode:userData.friendCode||'',updatedAt:firebase.firestore.FieldValue.serverTimestamp()})}

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
  // Show programs for this class
  const progs=CLASS_PROGRAMS[id]||[];
  const pa=$('programArea');pa.classList.add('show');
  $('programGrid').innerHTML=progs.map(p=>`<div class="prog-card" data-prog="${p.key}" onclick="pickProg('${p.key}')"><span class="prog-icon">${p.icon}</span><div class="prog-name">${p.name}</div><div class="prog-desc">${p.desc}</div></div>`).join('')+`<div class="prog-card" data-prog="blank" onclick="pickProg('blank')"><span class="prog-icon">📝</span><div class="prog-name">Build Your Own</div><div class="prog-desc">Start blank — add your own exercises</div></div>`;
  updateConfirmBtn();
}
function pickSub(el,s){selectedSub=s;document.querySelectorAll('.sub-opt').forEach(e=>e.classList.remove('active'));el.classList.add('active');updateConfirmBtn()}
function pickProg(key){selectedProg=key;document.querySelectorAll('.prog-card').forEach(c=>c.classList.toggle('selected',c.dataset.prog===key));updateConfirmBtn()}
function updateConfirmBtn(){const cls=CLASSES.find(c=>c.id===selectedClass);let ok=!!selectedClass&&!!selectedProg;if(cls&&cls.subclasses&&!selectedSub)ok=false;$('csConfirm').disabled=!ok}
async function confirmClass(){
  if(!selectedClass||!selectedProg)return;
  let prog;
  if(selectedProg==='blank'){prog=[{id:'day1',title:'DAY 1',subtitle:'Add exercises',exercises:[]},{id:'day2',title:'DAY 2',subtitle:'Add exercises',exercises:[]},{id:'day3',title:'DAY 3',subtitle:'Add exercises',exercises:[]},{id:'day4',title:'DAY 4',subtitle:'Add exercises',exercises:[]}]}
  else{const all=[...Object.values(CLASS_PROGRAMS).flat()];const found=all.find(p=>p.key===selectedProg);prog=found?JSON.parse(JSON.stringify(found.days)):[];}
  await saveUser({class:selectedClass,subclass:selectedSub||'',programKey:selectedProg,program:prog});
  await saveLeaderboard();showScreen('appScreen');initApp();
}

// ═══════════ INIT ═══════════
function initApp(){document.querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',()=>switchPage(n.dataset.page)));updateTopBar();switchPage('workout')}
function updateTopBar(){const r=getEffectiveRank();$('tbXp').textContent=userData.xp+' XP';const rb=$('tbRank');rb.textContent=r.name;rb.style.color=r.color;rb.style.background=r.color+'22';rb.style.border='1px solid '+r.color+'44'}
function getEffectiveRank(){
  const xpRank=getRank(userData.xp);
  // Check if trial is needed but not completed
  for(let i=RANKS.length-1;i>=0;i--){
    if(userData.xp>=RANKS[i].min){
      if(!RANKS[i].auto&&RANKS[i].trial&&!userData.trialsCompleted.includes(RANKS[i].trial)){
        // Can't hold this rank yet — drop to previous
        return i>0?RANKS[i-1]:RANKS[0];
      }
      return RANKS[i];
    }
  }
  return RANKS[0];
}
function switchPage(p){currentPage=p;document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===p));document.querySelectorAll('.page').forEach(pg=>pg.classList.remove('active'));$('page-'+p).classList.add('active');
  if(p==='workout')buildWorkout();if(p==='log')renderLog();if(p==='profile')renderProfile();if(p==='achievements')renderAchievements();if(p==='leaderboard')renderLeaderboard();if(p==='missions')renderMissions()}

// ═══════════ DAILY MISSIONS ═══════════
function renderMissions(){
  const today=getTodayStr();const missions=getDailyMissions(today);
  const completed=userData.missionsCompleted[today]||[];
  const allDone=missions.every(m=>completed.includes(m.id));
  let h=`<div class="page-title">DAILY MISSIONS</div><div class="page-sub">${completed.length}/${missions.length} complete today · Streak: ${userData.missionStreak} days</div>`;
  // Trial banner
  const trialInfo=getAvailableTrial();
  if(trialInfo)h+=renderTrialBanner(trialInfo);
  h+=missions.map(m=>{const done=completed.includes(m.id);return`<div class="mission-card${done?' done':''}" onclick="toggleMission('${m.id}')"><div class="mission-check">${done?'✅':'⬜'}</div><div class="mission-icon">${m.icon}</div><div class="mission-info"><div class="mission-name">${m.name}</div><div class="mission-desc">${m.desc}</div></div><div class="mission-xp">+${m.xp} XP</div></div>`}).join('');
  if(allDone)h+=`<div class="mission-bonus">🌟 ALL MISSIONS COMPLETE! +50 BONUS XP 🌟</div>`;
  $('missionsContent').innerHTML=h;
}
async function toggleMission(mid){
  const today=getTodayStr();const missions=getDailyMissions(today);
  let completed=userData.missionsCompleted[today]||[];
  if(completed.includes(mid)){completed=completed.filter(x=>x!==mid)}
  else{
    completed.push(mid);
    const m=missions.find(x=>x.id===mid);if(m)userData.xp+=m.xp;
    // Check all done bonus
    if(missions.every(x=>completed.includes(x.id))){userData.xp+=50;unlockAch('missions_all')}
    if(completed.length>=3)unlockAch('missions_3');
  }
  userData.missionsCompleted[today]=completed;
  // Update streak
  userData.missionStreak=calcMissionStreak();
  if(userData.missionStreak>=7){unlockAch('mission_streak_7')}
  await saveUser({missionsCompleted:userData.missionsCompleted,missionStreak:userData.missionStreak,xp:userData.xp});
  await saveLeaderboard();updateTopBar();renderMissions();
}
function calcMissionStreak(){
  let streak=0;const d=new Date();
  for(let i=0;i<365;i++){const ds=new Date(d);ds.setDate(ds.getDate()-i);const key=ds.toISOString().slice(0,10);
    const missions=getDailyMissions(key);const comp=userData.missionsCompleted[key]||[];
    if(missions.every(m=>comp.includes(m.id)))streak++;else break;}
  return streak;
}

// ═══════════ RANK TRIALS ═══════════
function getAvailableTrial(){
  for(let i=RANKS.length-1;i>=0;i--){
    if(userData.xp>=RANKS[i].min&&!RANKS[i].auto&&RANKS[i].trial&&!userData.trialsCompleted.includes(RANKS[i].trial)){
      return{rank:RANKS[i],trial:RANK_TRIALS[RANKS[i].trial]};
    }
  }
  return null;
}
function renderTrialBanner(info){
  const t=info.trial;const progress=getTrialProgress(t);
  let h=`<div class="trial-banner"><div class="trial-header"><span class="trial-icon">${t.icon}</span><div><div class="trial-name">${t.name}</div><div class="trial-desc">${t.desc}</div></div></div>`;
  t.tasks.forEach((task,i)=>{const p=progress[i];const pct=Math.min(100,(p/task.target)*100);
    h+=`<div class="trial-task"><div class="trial-task-desc">${task.desc}</div><div class="trial-bar"><div class="trial-bar-fill" style="width:${pct}%"></div></div><div class="trial-task-num">${p} / ${task.target}</div></div>`;
  });
  const allDone=t.tasks.every((task,i)=>progress[i]>=task.target);
  if(allDone)h+=`<button class="trial-claim" onclick="claimTrial('${info.rank.trial}')">⚔️ CLAIM ${info.rank.name}</button>`;
  h+=`</div>`;return h;
}
function getTrialProgress(trial){
  return trial.tasks.map(task=>{
    switch(task.id){
      case 'perfect_weeks_3':return calcPerfectWeeks();
      case 'streak_14':case 'streak_30':return calcStreak();
      case 'log_pr':return Math.max(0,...workoutLog.flatMap(e=>e.exercises.flatMap(ex=>ex.sets.map(s=>parseInt(s.weight)||0))));
      case 'missions_7':return userData.missionStreak;
      case 'workouts_50':return workoutLog.length;
      default:return 0;
    }
  });
}
function calcPerfectWeeks(){const w={};workoutLog.forEach(e=>{const m=getMonday(new Date(e.date)).toISOString().slice(0,10);if(!w[m])w[m]={days:new Set(),allDone:true};w[m].days.add(e.dayId);const ad=e.exercises.every(ex=>ex.sets.every(s=>s.done));if(!ad)w[m].allDone=false});return Object.values(w).filter(wk=>wk.days.size>=4&&wk.allDone).length}
async function claimTrial(trialId){
  if(userData.trialsCompleted.includes(trialId))return;
  userData.trialsCompleted.push(trialId);
  // Unlock rank achievement
  const rank=RANKS.find(r=>r.trial===trialId);
  if(rank){if(rank.name==='B-RANK')unlockAch('rank_b');if(rank.name==='A-RANK')unlockAch('rank_a');if(rank.name==='S-RANK')unlockAch('rank_s')}
  await saveUser({trialsCompleted:userData.trialsCompleted});await saveLeaderboard();updateTopBar();
  toast('⚔️ '+rank.name+' ACHIEVED!');switchPage('missions');
}

// ═══════════ WORKOUT ═══════════
function buildWorkout(){const prog=userData.program||[];if(!prog.length)return;$('workoutTitle').textContent=(userData.class||'WORKOUT').toUpperCase();$('workoutSub').textContent=(userData.subclass?userData.subclass+' — ':'')+getEffectiveRank().name;$('dayTabs').innerHTML=prog.map(d=>`<div class="dtab${d.id===currentDay?' active':''}" data-d="${d.id}" onclick="switchDay('${d.id}')">${d.title}</div>`).join('');renderDay()}
function switchDay(id){currentDay=id;document.querySelectorAll('.dtab').forEach(t=>t.classList.toggle('active',t.dataset.d===id));renderDay()}
function renderDay(){const prog=userData.program||[],day=prog.find(d=>d.id===currentDay);if(!day)return;const di=prog.indexOf(day);let h='';
  day.exercises.forEach((ex,ei)=>{h+=`<div class="exercise"><div class="ex-header"><span class="ex-num">${ei+1}</span><span class="ex-name">${ex.name}</span><button class="ex-edit" onclick="openEdit(${di},${ei})">✏️</button></div><div class="sets-grid">`;
    for(let s=0;s<ex.sets;s++){const wK=day.id+'_e'+ei+'_s'+s+'_w',rK=day.id+'_e'+ei+'_s'+s+'_r',cK=day.id+'_e'+ei+'_s'+s+'_c';
      if(ex.isTime)h+=`<div class="set-row"><label>S${s+1}</label><input type="number" id="${rK}" placeholder="sec" value="${savedInputs[rK]||''}"><span class="sep">sec</span><input type="checkbox" id="${cK}" ${savedInputs[cK]?'checked':''}><span class="target">${ex.reps}</span></div>`;
      else h+=`<div class="set-row"><label>S${s+1}</label><input type="number" id="${wK}" placeholder="lbs" value="${savedInputs[wK]||''}"><span class="sep">×</span><input type="number" id="${rK}" placeholder="reps" value="${savedInputs[rK]||''}"><input type="checkbox" id="${cK}" ${savedInputs[cK]?'checked':''}><span class="target">${ex.reps}</span></div>`}
    h+='</div></div>'});
  h+=`<button class="add-ex" onclick="openAdd(${di})">+ Add Exercise</button>`;$('dayContent').innerHTML=h}

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
async function logWorkout(){
  const prog=userData.program||[],day=prog.find(d=>d.id===currentDay);if(!day){toast('Pick a day!');return}
  captureInputs();const entry={dayId:day.id,dayTitle:day.title,date:new Date().toISOString(),exercises:[]};let hasData=false,allDone=true,maxW=0;
  day.exercises.forEach((ex,ei)=>{const sets=[];for(let s=0;s<ex.sets;s++){const wEl=$(day.id+'_e'+ei+'_s'+s+'_w'),rEl=$(day.id+'_e'+ei+'_s'+s+'_r'),cEl=$(day.id+'_e'+ei+'_s'+s+'_c');const w=wEl?wEl.value:'',r=rEl?rEl.value:'',d=cEl?cEl.checked:false;if(w||r)hasData=true;if(!d)allDone=false;if(parseInt(w)>maxW)maxW=parseInt(w);sets.push({weight:w,reps:r,done:d,isTime:!!ex.isTime})}entry.exercises.push({name:ex.name,sets})});
  if(!hasData){toast('Fill in sets!');return}
  const ref=await db.collection('users').doc(U.uid).collection('log').add(entry);entry._id=ref.id;workoutLog.unshift(entry);
  let xp=50;if(allDone)xp+=50;const hr=new Date().getHours(),wc=workoutLog.length;
  if(wc>=1)unlockAch('first_workout');if(wc>=10)unlockAch('workouts_10');if(wc>=25)unlockAch('workouts_25');if(wc>=50)unlockAch('workouts_50');if(wc>=100)unlockAch('workouts_100');
  if(hr<7)unlockAch('early_bird');if(hr>=21)unlockAch('night_owl');if(allDone)unlockAch('all_sets_done');
  if(maxW>=200)unlockAch('heavy_day');if(maxW>=315)unlockAch('monster_lift');if(maxW>=405)unlockAch('titan_lift');
  const dids=new Set(workoutLog.map(e=>e.dayId));if(dids.size>=4)unlockAch('variety');
  const streak=calcStreak();if(streak>=7)unlockAch('streak_7');if(streak>=30)unlockAch('streak_30');
  const fw=calcFullWeeks();if(fw>=1)unlockAch('full_week');if(fw>=5)unlockAch('full_week_5');
  const nx=userData.xp+xp;if(nx>=500)unlockAch('rank_d');if(nx>=1500)unlockAch('rank_c');
  await saveUser({xp:nx});await saveLeaderboard();updateTopBar();toast(day.title+' +'+xp+' XP');}
function calcStreak(){const dates=[...new Set(workoutLog.map(e=>new Date(e.date).toDateString()))].sort((a,b)=>new Date(b)-new Date(a));let s=0;for(let i=0;i<dates.length;i++){const exp=new Date();exp.setDate(exp.getDate()-i);if(dates[i]===exp.toDateString())s++;else break}return s}
function calcFullWeeks(){const w={};workoutLog.forEach(e=>{const m=getMonday(new Date(e.date)).toISOString().slice(0,10);if(!w[m])w[m]=new Set();w[m].add(e.dayId)});return Object.values(w).filter(s=>s.size>=4).length}

// ═══════════ ACHIEVEMENTS ═══════════
async function unlockAch(id){if(userData.achievements.includes(id))return;userData.achievements.push(id);const a=ACHIEVEMENTS.find(x=>x.id===id);if(a&&a.xp>0)userData.xp+=a.xp;await saveUser({achievements:userData.achievements,xp:userData.xp});await saveLeaderboard();updateTopBar()}
function renderAchievements(){const ul=userData.achievements||[];$('achSub').textContent=ul.length+' / '+ACHIEVEMENTS.length+' unlocked';$('achGrid').innerHTML=ACHIEVEMENTS.map(a=>{const u=ul.includes(a.id);return`<div class="ach-card${u?' unlocked':''}"><span class="ach-icon">${a.icon}</span><div class="ach-info"><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div>${a.xp?'<div class="ach-xp">+'+a.xp+' XP</div>':''}</div></div>`}).join('')}

// ═══════════ PROFILE ═══════════
function renderProfile(){
  const r=getEffectiveRank(),nr=getNextRank(userData.xp);const pct=nr?Math.min(100,((userData.xp-r.min)/(nr.min-r.min))*100):100;
  const title=(r.title&&r.title[userData.class])||r.name;const st=userData.stats||{};const prs=userData.prs||{};
  let h=`<div class="profile-card"><div class="profile-pic-wrap" onclick="document.getElementById('picInput').click()">${userData.profilePic?'<img src="'+userData.profilePic+'">':'<div class="pp-placeholder">👤</div>'}</div>
    <div class="profile-name">${userData.name||'Hunter'}</div><div class="profile-username">@${userData.username||'???'}</div>
    <div class="profile-friend-code">Friend Code: <strong>${userData.friendCode||'------'}</strong></div>
    <div class="profile-class">${userData.class}${userData.subclass?' — '+userData.subclass:''}</div>
    <div class="profile-rank-badge" style="color:${r.color};background:${r.color}22;border:1px solid ${r.color}44">${r.name} — ${title}</div>
    <div class="xp-bar-wrap"><div class="xp-bar-label"><span>${userData.xp} XP</span><span>${nr?nr.min+' XP':'MAX'}</span></div><div class="xp-bar"><div class="xp-bar-fill" style="width:${pct}%"></div></div></div></div>`;
  h+=`<div class="stats-grid"><div class="stat-card"><div class="sv">${st.height||'—'}</div><div class="sl">Height</div></div><div class="stat-card"><div class="sv">${st.weight?st.weight+' lbs':'—'}</div><div class="sl">Weight</div></div><div class="stat-card"><div class="sv">${st.age||'—'}</div><div class="sl">Age</div></div></div>`;
  h+=`<div class="stats-grid"><div class="stat-card"><div class="sv">${prs.bench||'—'}</div><div class="sl">Bench PR</div></div><div class="stat-card"><div class="sv">${prs.squat||'—'}</div><div class="sl">Squat PR</div></div><div class="stat-card"><div class="sv">${prs.deadlift||'—'}</div><div class="sl">Deadlift PR</div></div></div>`;
  h+=`<div class="stats-grid"><div class="stat-card"><div class="sv">${workoutLog.length}</div><div class="sl">Workouts</div></div><div class="stat-card"><div class="sv">${calcStreak()}</div><div class="sl">Streak</div></div><div class="stat-card"><div class="sv">${(userData.achievements||[]).length}</div><div class="sl">Achieve.</div></div></div>`;
  h+=`<button class="edit-stats-btn" onclick="openSettings()">⚙️ Settings</button>`;
  // Friends
  h+=`<div class="section-title" style="margin:.8rem 0 .4rem">FRIENDS (${(userData.friends||[]).length})</div>`;
  h+=`<div class="friend-add-row"><input type="text" id="friendCodeInput" class="auth-input" placeholder="Enter friend code" maxlength="6" style="margin:0;flex:1"><button class="m-save-btn" style="flex:0 0 auto;padding:10px 14px;border-radius:8px" onclick="addFriend()">Add</button></div>`;
  h+=`<div id="friendsList" style="margin-top:.5rem"></div>`;
  $('profileContent').innerHTML=h;loadFriendsList();
}

// ═══════════ SETTINGS MODAL ═══════════
function openSettings(){
  const st=userData.stats||{},prs=userData.prs||{},priv=userData.privacy||{};
  $('setUsername').value=userData.username||'';$('setDisplayName').value=userData.name||'';
  $('setHeight').value=st.height||'';$('setWeight').value=st.weight||'';$('setAge').value=st.age||'';$('setBodyFat').value=st.bodyFat||'';
  $('setBench').value=prs.bench||'';$('setSquat').value=prs.squat||'';$('setDeadlift').value=prs.deadlift||'';$('setOhp').value=prs.ohp||'';
  $('setGoal').value=userData.goal||'';$('setExperience').value=userData.experience||'';
  $('setHideName').checked=!!priv.hideName;$('setHideStats').checked=!!priv.hideStats;
  $('settingsModal').classList.add('open');
}
function closeSettings(){$('settingsModal').classList.remove('open')}
async function saveSettings(){
  const newUsername=$('setUsername').value.trim().toLowerCase();
  // Username change check
  if(newUsername!==userData.username){
    if(!newUsername||newUsername.length<3){toast('Username must be 3+ chars');return}
    if(/[^a-z0-9_]/.test(newUsername)){toast('Letters, numbers, _ only');return}
    const uc=await db.collection('usernames').doc(newUsername).get();
    if(uc.exists){toast('Username taken');return}
    // Release old, claim new
    if(userData.username)await db.collection('usernames').doc(userData.username).delete();
    await db.collection('usernames').doc(newUsername).set({uid:U.uid});
    userData.username=newUsername;
  }
  const stats={height:$('setHeight').value.trim(),weight:$('setWeight').value.trim(),age:$('setAge').value.trim(),bodyFat:$('setBodyFat').value.trim()};
  const prs={bench:$('setBench').value.trim(),squat:$('setSquat').value.trim(),deadlift:$('setDeadlift').value.trim(),ohp:$('setOhp').value.trim()};
  if(prs.bench&&prs.squat&&prs.deadlift&&prs.ohp)unlockAch('set_prs');
  const privacy={hideName:$('setHideName').checked,hideStats:$('setHideStats').checked};
  await saveUser({username:newUsername,name:$('setDisplayName').value.trim()||userData.name,stats,prs,privacy,goal:$('setGoal').value,experience:$('setExperience').value});
  await saveLeaderboard();closeSettings();renderProfile();toast('Settings saved!');}
async function changePassword(){
  const np=$('setNewPass').value;if(!np||np.length<6){toast('Password must be 6+ chars');return}
  try{await U.updatePassword(np);$('setNewPass').value='';toast('Password changed!')}
  catch(err){toast(friendlyErr(err.code))}}
function changeProgram(){selectedClass=null;selectedSub=null;selectedProg=null;showScreen('classScreen');buildClassSelect()}

// ── PROFILE PIC ──
document.getElementById('picInput').addEventListener('change',async function(){const file=this.files[0];if(!file)return;const reader=new FileReader();reader.onload=async function(e){const img=new Image();img.onload=async function(){const canvas=document.createElement('canvas');const max=200;let w=img.width,h=img.height;if(w>h){h=h*(max/w);w=max}else{w=w*(max/h);h=max}canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);await saveUser({profilePic:canvas.toDataURL('image/jpeg',0.7)});await saveLeaderboard();renderProfile();toast('Photo updated!')};img.src=e.target.result};reader.readAsDataURL(file)});

// ═══════════ FRIENDS ═══════════
async function addFriend(){const code=$('friendCodeInput').value.trim().toUpperCase();if(code.length!==6){toast('Enter 6-char code');return}if(code===userData.friendCode){toast("That's your code!");return}
  const cd=await db.collection('friendCodes').doc(code).get();if(!cd.exists){toast('Code not found');return}const fid=cd.data().uid;if((userData.friends||[]).includes(fid)){toast('Already friends!');return}
  const friends=userData.friends||[];friends.push(fid);await saveUser({friends});
  await db.collection('users').doc(fid).update({friends:firebase.firestore.FieldValue.arrayUnion(U.uid)});
  unlockAch('add_friend');if(friends.length>=5)unlockAch('friends_5');$('friendCodeInput').value='';toast('Friend added!');loadFriendsList()}
async function loadFriendsList(){const list=$('friendsList');if(!list)return;const friends=userData.friends||[];if(!friends.length){list.innerHTML='<p style="color:var(--muted);font-size:.76rem">No friends yet — share your code!</p>';return}
  let h='';for(const fid of friends.slice(0,20)){try{const d=await db.collection('users').doc(fid).get();if(!d.exists)continue;const f=d.data();const r=getRank(f.xp||0);h+=`<div class="friend-row"><div class="lb-pic">${f.profilePic?'<img src="'+f.profilePic+'">':'👤'}</div><div class="lb-info"><div class="lb-name">@${f.username||f.name}</div><div class="lb-class">${f.class||''}</div></div><div class="lb-xp">${f.xp||0}</div><div class="lb-rank" style="color:${r.color}">${r.name}</div></div>`}catch(e){}}list.innerHTML=h}

// ═══════════ LEADERBOARD ═══════════
async function renderLeaderboard(){let list=[];if(lbMode==='friends'){const fids=[U.uid,...(userData.friends||[])];for(const fid of fids.slice(0,30)){try{const d=await db.collection('leaderboard').doc(fid).get();if(d.exists)list.push({uid:d.id,...d.data()})}catch(e){}}list.sort((a,b)=>b.xp-a.xp)}else{const snap=await db.collection('leaderboard').orderBy('xp','desc').limit(50).get();snap.forEach(d=>list.push({uid:d.id,...d.data()}))}
  let h=`<div class="log-filters" style="margin-bottom:.7rem"><div class="log-filter ${lbMode==='all'?'active':''}" onclick="lbMode='all';renderLeaderboard()">All Hunters</div><div class="log-filter ${lbMode==='friends'?'active':''}" onclick="lbMode='friends';renderLeaderboard()">Friends</div></div>`;
  h+=list.length?list.map((u,i)=>{const me=U&&u.uid===U.uid;const r=getRank(u.xp);const pc=i===0?'gold':i===1?'silver':i===2?'bronze':'';return`<div class="lb-row${me?' me':''}"><span class="lb-pos ${pc}">${i+1}</span><div class="lb-pic">${u.profilePic?'<img src="'+u.profilePic+'">':'👤'}</div><div class="lb-info"><div class="lb-name">@${u.username||'hunter'}</div><div class="lb-class">${u.class||''}${u.subclass?' • '+u.subclass:''}</div></div><div class="lb-xp">${u.xp}</div><div class="lb-rank" style="color:${r.color}">${r.name}</div></div>`}).join(''):'<p style="color:var(--muted);font-size:.82rem">No hunters yet.</p>';
  $('lbList').innerHTML=h}

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
