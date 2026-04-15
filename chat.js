// ═══════════════════════════════════════════
//  LEXENFITNESS — CHAT (Friends + AI Coach)
// ═══════════════════════════════════════════

let currentChatFriend=null;
let chatListener=null;

function renderChatPage(){
  let h=`<div class="sub-tabs" id="chatTabs">
    <div class="stab active" data-st="friendchat" onclick="switchSubTab('chat','friendchat')">Friends</div>
    <div class="stab" data-st="aicoach" onclick="switchSubTab('chat','aicoach')">AI Coach</div>
    <div class="stab" data-st="updates" onclick="switchSubTab('chat','updates')">Updates</div>
  </div>`;
  h+=`<div class="sub-page active" id="sp-friendchat"><div id="chatListContent"></div></div>`;
  h+=`<div class="sub-page" id="sp-aicoach"><div id="aiCoachContent"></div></div>`;
  h+=`<div class="sub-page" id="sp-updates"><div id="updatesContent"></div></div>`;
  $('chatPageContent').innerHTML=h;
  renderChatList();
}

// ═══════════ FRIENDS CHAT ═══════════
async function renderChatList(){
  const el=$('chatListContent');if(!el)return;
  const friends=userData.friends||[];
  if(!friends.length){el.innerHTML='<div class="page-title">MESSAGES</div><p style="color:var(--muted);font-size:.82rem;padding:.5rem 0">Add friends from your Profile to start chatting.</p>';return}
  let h='<div class="page-title">MESSAGES</div><div class="page-sub">Tap a friend to chat</div>';
  let loaded=0;
  for(const fid of friends.slice(0,30)){
    try{
      const d=await db.collection('users').doc(fid).get();
      if(!d.exists)continue;
      const f=d.data();const r=getRank(f.xp||0);
      let preview='No messages yet';let previewTime='';
      try{
        const chatId=getChatId(U.uid,fid);
        const lastMsg=await db.collection('chats').doc(chatId).collection('messages').orderBy('ts','desc').limit(1).get();
        if(!lastMsg.empty){
          const m=lastMsg.docs[0].data();
          preview=(m.from===U.uid?'You: ':'')+String(m.text||'').slice(0,40);
          if(m.ts){const dt=m.ts.toDate();previewTime=dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
        }
      }catch(e){}
      h+=`<div class="chat-list-item" onclick="openChat('${fid}')">
        <div class="lb-pic">${f.profilePic?'<img src="'+f.profilePic+'">':'👤'}</div>
        <div class="chat-list-info">
          <div class="chat-list-name">@${esc(f.username||'hunter')} <span class="chat-list-rank" style="color:${r.color}">${r.name}</span></div>
          <div class="chat-list-preview">${esc(preview)}</div>
        </div>
        <div class="chat-list-time">${previewTime}</div>
      </div>`;
      loaded++;
    }catch(e){
      h+=`<div class="chat-list-item" style="opacity:.5"><div class="lb-pic">👤</div><div class="chat-list-info"><div class="chat-list-name">Unable to load</div><div class="chat-list-preview" style="color:var(--red)">Check Firestore rules</div></div></div>`;
    }
  }
  if(!loaded&&friends.length)h+='<p style="color:var(--red);font-size:.78rem;padding:.5rem">Could not load friends. Make sure Firestore rules allow reading user docs.</p>';
  el.innerHTML=h;
}

function getChatId(uid1,uid2){return [uid1,uid2].sort().join('_')}

async function openChat(friendUid){
  currentChatFriend=friendUid;
  let friend={username:'hunter',profilePic:''};
  try{const fDoc=await db.collection('users').doc(friendUid).get();if(fDoc.exists)friend=fDoc.data()}catch(e){}
  const chatId=getChatId(U.uid,friendUid);

  // Create chat doc if needed — use set+merge to avoid read-before-write permission issue
  try{
    await db.collection('chats').doc(chatId).set({
      members:[U.uid,friendUid],
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
  }catch(e){}

  const el=$('chatListContent');
  el.innerHTML=`
    <div class="chat-header">
      <button class="chat-back" onclick="closeChat()">← Back</button>
      <div class="lb-pic" style="width:28px;height:28px">${friend.profilePic?'<img src="'+friend.profilePic+'">':'👤'}</div>
      <span class="chat-header-name">@${esc(friend.username||'hunter')}</span>
    </div>
    <div class="chat-messages" id="chatMessages"><p style="color:var(--muted);font-size:.78rem;text-align:center;padding:2rem 0">Loading...</p></div>
    <div class="chat-input-row">
      <input type="text" id="chatInput" class="auth-input" placeholder="Type a message..." style="margin:0;flex:1" onkeydown="if(event.key==='Enter')sendMessage()">
      <button class="chat-send-btn" onclick="sendMessage()">➤</button>
    </div>`;

  if(chatListener)chatListener();
  markChatRead(friendUid);
  chatListener=db.collection('chats').doc(chatId).collection('messages')
    .orderBy('ts','asc').limitToLast(100)
    .onSnapshot(snap=>{
      const msgs=[];snap.forEach(d=>msgs.push(d.data()));
      renderMessages(msgs);
    },err=>{
      $('chatMessages').innerHTML='<p style="color:var(--red);font-size:.78rem;text-align:center;padding:2rem 0">Chat error: '+err.message+'</p>';
    });
}

function renderMessages(msgs){
  const el=$('chatMessages');if(!el)return;
  if(!msgs.length){el.innerHTML='<p style="color:var(--muted);font-size:.78rem;text-align:center;padding:2rem 0">No messages yet. Say hi! 👋</p>';return}
  el.innerHTML=msgs.map(m=>{
    const isMe=m.from===U.uid;
    const time=m.ts?m.ts.toDate().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'';
    return`<div class="chat-msg ${isMe?'me':'them'}"><div class="chat-bubble">${esc(m.text)}</div><div class="chat-time">${time}</div></div>`;
  }).join('');
  el.scrollTop=el.scrollHeight;
}

async function sendMessage(){
  if(!currentChatFriend)return;
  const text=$('chatInput').value.trim();if(!text)return;
  $('chatInput').value='';
  const chatId=getChatId(U.uid,currentChatFriend);
  try{
    await db.collection('chats').doc(chatId).collection('messages').add({
      from:U.uid,text:text.slice(0,500),ts:firebase.firestore.FieldValue.serverTimestamp()
    });
    unlockAch('chat_first');
    const mc=(userData.messageCount||0)+1;await saveUser({messageCount:mc});if(mc>=10)unlockAch('chat_10');
  }catch(e){toast('Send failed: '+e.message)}
}

function closeChat(){
  if(chatListener){chatListener();chatListener=null}
  currentChatFriend=null;renderChatList();
}

// ═══════════ AI COACH (Chat-style interface) ═══════════
let coachHistory=[];

function renderAICoach(){
  const el=$('aiCoachContent');if(!el)return;
  // Init with greeting if empty
  if(!coachHistory.length){
    coachHistory.push({role:'coach',text:getMotivation()});
    coachHistory.push({role:'coach',text:generateMainTip()});
  }

  let h=`<div class="chat-header" style="border-bottom:none;padding-bottom:.3rem">
    <div class="coach-avatar" style="width:32px;height:32px;font-size:1rem;border-radius:8px">🤖</div>
    <span class="coach-name" style="font-size:.95rem">SYSTEM COACH</span>
  </div>`;

  // Chat messages
  h+=`<div class="chat-messages" id="coachMessages" style="max-height:45vh">`;
  coachHistory.forEach(m=>{
    if(m.role==='coach'){
      h+=`<div class="chat-msg them"><div class="chat-bubble" style="background:linear-gradient(135deg,rgba(123,92,255,.15),rgba(251,191,36,.05));border:1px solid var(--accent)">${m.text}</div></div>`;
    }else{
      h+=`<div class="chat-msg me"><div class="chat-bubble">${esc(m.text)}</div></div>`;
    }
  });
  h+=`</div>`;

  // Quick question buttons
  h+=`<div class="coach-questions">
    <div class="coach-q-label">Ask me about:</div>
    <div class="coach-q-btns">
      <button onclick="askCoach('nutrition')">🍽️ What should I eat?</button>
      <button onclick="askCoach('training')">🏋️ Training advice</button>
      <button onclick="askCoach('progress')">📊 Am I on track?</button>
      <button onclick="askCoach('recovery')">😴 Recovery tips</button>
      <button onclick="askCoach('motivation')">🔥 Motivate me</button>
    </div>
  </div>`;

  el.innerHTML=h;
  const msgs=$('coachMessages');if(msgs)msgs.scrollTop=msgs.scrollHeight;
}

function askCoach(topic){
  const labels={nutrition:'What should I eat today?',training:'What should I train?',progress:'Am I on track?',recovery:'Any recovery tips?',motivation:'I need motivation'};
  coachHistory.push({role:'user',text:labels[topic]||topic});
  coachHistory.push({role:'coach',text:generateCoachResponse(topic)});
  renderAICoach();
}

function generateCoachResponse(topic){
  const streak=calcStreak();const wc=workoutLog.length;const st=userData.stats||{};const prs=userData.prs||{};
  const goal=userData.goal||'General Fitness';const cls=userData.class||'';
  const t=calcTDEE();const today=getTodayStr();
  const todayFood=(userData.foodLog&&userData.foodLog[today])||[];
  const todayCal=todayFood.reduce((s,f)=>s+(f.cal||0),0);
  const todayP=todayFood.reduce((s,f)=>s+(f.protein||0),0);
  const rank=getEffectiveRank();

  if(topic==='nutrition'){
    if(!t)return"I don't have your body stats yet. Go to <strong>Profile → Settings</strong> and add your height, weight, and age. Then I can give you real numbers.";
    const calLeft=t.target-todayCal;const pLeft=t.proteinG-todayP;
    if(!todayFood.length)return`Your target today is <strong>${t.target} cal</strong> with <strong>${t.proteinG}g protein</strong>. You haven't logged anything yet — start tracking! For ${goal.toLowerCase()}, protein timing matters. Hit at least 30g protein per meal across 3-4 meals.`;
    if(calLeft>500)return`You've eaten <strong>${todayCal} cal</strong> so far — still <strong>${calLeft} cal</strong> to go. You need <strong>${pLeft}g more protein</strong>. ${goal.includes('Muscle')?"Don't skip meals — you need the surplus to grow.":"Keep it clean — lean protein, complex carbs, healthy fats."}`;
    if(calLeft<-200)return`⚠️ You're <strong>${Math.abs(calLeft)} cal over</strong> your ${t.target} target. ${goal.includes('Fat Loss')?"This will slow your cut. Tomorrow is a new day — tighten up.":"A little over isn't terrible for a growth phase, but don't make it a habit."}`;
    return`Looking good! <strong>${todayCal}/${t.target} cal</strong>, <strong>${todayP}/${t.proteinG}g protein</strong>. ${pLeft>20?'Prioritize protein in your next meal.':'Protein is on track. Keep it up.'}`;
  }

  if(topic==='training'){
    const lastW=workoutLog[0];const hoursSince=lastW?((Date.now()-new Date(lastW.date).getTime())/3600000):999;
    let resp='';
    if(hoursSince<16)resp=`You trained ${Math.round(hoursSince)} hours ago. <strong>Rest today</strong> — muscles grow during recovery, not during the workout. `;
    else if(hoursSince>72)resp=`It's been <strong>${Math.round(hoursSince/24)} days</strong> since your last session. Time to get back in. `;
    else resp=`Good window for training. `;
    if(cls==='Powerlifter')resp+=`Focus on your compounds today. ${prs.squat?`Your squat PR is ${prs.squat} lbs — `:''}warm up properly, hit your working sets with intent, save energy for the heavy lifts.`;
    else if(cls==='Bodybuilder')resp+='Prioritize the mind-muscle connection. Slow eccentrics (3-4 sec), full range of motion, chase the pump. Volume is king.';
    else if(cls==='Strongman')resp+='Event work and compound strength. Farmer walks, deadlifts, overhead press. Train heavy, train gritty.';
    else if(cls==='Athlete')resp+='Power and explosiveness first (cleans, jumps), then sport-specific work. Keep conditioning in every session.';
    else resp+='Pick your program day and train with intention. Consistency beats perfection.';
    return resp;
  }

  if(topic==='progress'){
    let resp=`<strong>${rank.name}</strong> · ${userData.xp} XP · ${wc} workouts · ${streak}-day streak.<br><br>`;
    if(streak===0)resp+='⚠️ Your streak is broken. One session brings it back. ';
    else if(streak>=7)resp+=`✅ ${streak}-day streak — elite consistency. `;
    if(wc<10)resp+='You\'re in the foundation phase. Focus on showing up regularly — the gains will follow.';
    else if(wc<30)resp+='Building momentum. You should be seeing early strength gains and improved recovery.';
    else if(wc<50)resp+='Solid training base. Consider tracking progressive overload more closely — add weight or reps each week.';
    else resp+=`${wc} workouts in the bank. You're a veteran. Time to optimize: periodization, deloads, and nutrition precision.`;
    const trial=getAvailableTrial();
    if(trial)resp+=`<br><br>🚪 <strong>${trial.trial.name}</strong> is your next gate. Check Missions for progress.`;
    return resp;
  }

  if(topic==='recovery'){
    const lastW=workoutLog[0];const hoursSince=lastW?((Date.now()-new Date(lastW.date).getTime())/3600000):999;
    let resp='Recovery is where gains actually happen. Key priorities:<br><br>';
    resp+='<strong>🛏 Sleep:</strong> 7-9 hours. Growth hormone peaks during deep sleep. Non-negotiable.<br>';
    resp+='<strong>💧 Water:</strong> Half your bodyweight in ounces, minimum. More on training days.<br>';
    resp+=`<strong>🥩 Protein:</strong> ${t?t.proteinG+'g/day spread across meals.':'Set up your stats for a specific number.'}<br>`;
    if(hoursSince<24)resp+='<br>You trained recently — prioritize all three today. Tomorrow you\'ll feel the difference.';
    return resp;
  }

  if(topic==='motivation'){
    const msgs=[
      `You're <strong>${rank.name}</strong> with ${userData.xp} XP. Every hunter ahead of you started exactly where you are. The only difference? They didn't quit.`,
      `${streak>0?streak+'-day streak.':'Streak is at zero.'} ${streak>0?'Every day you show up, you widen the gap between you and the version of you that gave up.':'The best time to start was yesterday. The second best time is right now.'}`,
      `${wc} workouts logged. That's ${wc} times you chose discipline over comfort. That's ${wc} reps of character. Keep stacking.`,
      "The iron doesn't care about your excuses. It doesn't care about your bad day. It only respects the work. So put in the work.",
      "You didn't come this far to only come this far. The System sees everything. Level up.",
      `${cls?'You chose '+cls+'. Own it.':'Pick a class and commit.'} The strongest hunters aren't the most talented — they're the most consistent.`
    ];
    let seed=Date.now();return msgs[seed%msgs.length];
  }

  return"Train hard. Eat right. Sleep well. The System rewards consistency above all else.";
}

function generateMainTip(){
  const streak=calcStreak();const wc=workoutLog.length;const t=calcTDEE();
  const today=getTodayStr();const todayFood=(userData.foodLog&&userData.foodLog[today])||[];
  if(!userData.class)return"First things first — pick your class and program in the <strong>Train</strong> tab. That's step one.";
  if(wc===0)return"Welcome, hunter. Your first workout awaits. Go to <strong>Train</strong>, fill in your weights, and log it. That's how you earn your first XP.";
  if(streak===0)return"Your streak is at zero. One workout today fixes that. The gate won't open for hunters who rest too long.";
  if(t&&!todayFood.length)return`You haven't logged any food today. Your target is <strong>${t.target} cal</strong> and <strong>${t.proteinG}g protein</strong>. Nutrition is half the battle — tap <strong>🍽️ What should I eat?</strong> for details.`;
  if(streak>=7)return`${streak}-day streak. You're proving yourself. Keep pushing — the next rank gate is waiting.`;
  return"Consistency is everything. Train, eat, recover, repeat. The System rewards those who don't stop.";
}

function getMotivation(){
  const messages=[
    "The System sees your effort. Every rep brings you closer to the next rank.",
    "Hunters who rest too long get left behind. Stay sharp.",
    "You chose this path. The iron doesn't lie — put in the work.",
    "Discipline is choosing between what you want now and what you want most.",
    "The gate ahead won't open for the weak. Train harder.",
    "Consistency beats intensity. Show up every day.",
    "The strongest hunters aren't born — they're forged.",
    "The System rewards those who never stop leveling up."
  ];
  const today=getTodayStr();let seed=0;for(let i=0;i<today.length;i++)seed+=today.charCodeAt(i);
  return'<em>"'+messages[seed%messages.length]+'"</em>';
}

// ═══════════ UPDATES / CHANGELOG TAB ═══════════
function renderUpdatesTab(){
  const el=$('updatesContent');if(!el)return;
  let h=`<div class="page-title" style="display:flex;align-items:center;gap:.5rem">SYSTEM UPDATES <span class="updates-ver">v${APP_VERSION}</span></div>`;
  h+=`<div class="page-sub">Patch notes & version history</div>`;
  // Founder message (always at top)
  h+=`<div class="founder-card"><div class="founder-header"><span class="founder-icon">⚔️</span><span class="founder-name">Message from the Founder</span></div><div class="founder-body">${WELCOME_MESSAGE.replace(/\n/g,'<br>')}</div></div>`;
  CHANGELOG.forEach((entry,i)=>{
    const isCurrent=entry.version===APP_VERSION;
    h+=`<div class="update-card${isCurrent?' current':''}">
      <div class="update-header">
        <div class="update-version">${entry.version}</div>
        <div class="update-title">${entry.title}</div>
        <div class="update-date">${entry.date}</div>
      </div>
      <ul class="update-items">${entry.items.map(item=>`<li>${item}</li>`).join('')}</ul>
      ${isCurrent?'<div class="update-current-badge">CURRENT</div>':''}
    </div>`;
  });
  el.innerHTML=h;
}
