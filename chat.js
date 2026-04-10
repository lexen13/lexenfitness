// ═══════════════════════════════════════════
//  LEXENFITNESS — CHAT (Friends + AI Coach)
// ═══════════════════════════════════════════

let currentChatFriend=null;
let chatListener=null;

// ── CHAT PAGE RENDER ──
function renderChatPage(){
  const friends=userData.friends||[];
  let h=`<div class="sub-tabs" id="chatTabs">
    <div class="stab active" data-st="friendchat" onclick="switchSubTab('chat','friendchat')">Friends</div>
    <div class="stab" data-st="aicoach" onclick="switchSubTab('chat','aicoach')">AI Coach</div>
  </div>`;
  h+=`<div class="sub-page active" id="sp-friendchat"><div id="chatListContent"></div></div>`;
  h+=`<div class="sub-page" id="sp-aicoach"><div id="aiCoachContent"></div></div>`;
  $('chatPageContent').innerHTML=h;
  renderChatList();
}

// ═══════════ FRIENDS CHAT ═══════════
async function renderChatList(){
  const el=$('chatListContent');if(!el)return;
  const friends=userData.friends||[];
  if(!friends.length){el.innerHTML='<p style="color:var(--muted);font-size:.82rem;padding:1rem 0">Add friends from your Profile to start chatting.</p>';return}
  let h='<div class="page-title">MESSAGES</div><div class="page-sub">Tap a friend to chat</div>';
  for(const fid of friends.slice(0,30)){
    try{
      const d=await db.collection('users').doc(fid).get();
      if(!d.exists)continue;
      const f=d.data();const r=getRank(f.xp||0);
      // Get last message preview
      const chatId=getChatId(U.uid,fid);
      const lastMsg=await db.collection('chats').doc(chatId).collection('messages').orderBy('ts','desc').limit(1).get();
      let preview='No messages yet';let previewTime='';
      if(!lastMsg.empty){
        const m=lastMsg.docs[0].data();
        preview=(m.from===U.uid?'You: ':'')+String(m.text||'').slice(0,40);
        if(m.ts){const d=m.ts.toDate();previewTime=d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
      }
      h+=`<div class="chat-list-item" onclick="openChat('${fid}')">
        <div class="lb-pic">${f.profilePic?'<img src="'+f.profilePic+'">':'👤'}</div>
        <div class="chat-list-info">
          <div class="chat-list-name">@${esc(f.username||'hunter')} <span class="chat-list-rank" style="color:${r.color}">${r.name}</span></div>
          <div class="chat-list-preview">${esc(preview)}</div>
        </div>
        <div class="chat-list-time">${previewTime}</div>
      </div>`;
    }catch(e){}
  }
  el.innerHTML=h;
}

function getChatId(uid1,uid2){return [uid1,uid2].sort().join('_')}

async function openChat(friendUid){
  currentChatFriend=friendUid;
  // Get friend data
  const fDoc=await db.collection('users').doc(friendUid).get();
  const friend=fDoc.exists?fDoc.data():{username:'hunter',profilePic:''};
  const chatId=getChatId(U.uid,friendUid);

  // Ensure chat doc exists
  const chatDoc=await db.collection('chats').doc(chatId).get();
  if(!chatDoc.exists){
    await db.collection('chats').doc(chatId).set({
      members:[U.uid,friendUid],
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  const el=$('chatListContent');
  el.innerHTML=`
    <div class="chat-header">
      <button class="chat-back" onclick="closeChat()">← Back</button>
      <div class="lb-pic" style="width:28px;height:28px">${friend.profilePic?'<img src="'+friend.profilePic+'">':'👤'}</div>
      <span class="chat-header-name">@${esc(friend.username||'hunter')}</span>
    </div>
    <div class="chat-messages" id="chatMessages"></div>
    <div class="chat-input-row">
      <input type="text" id="chatInput" class="auth-input" placeholder="Type a message..." style="margin:0;flex:1" onkeydown="if(event.key==='Enter')sendMessage()">
      <button class="chat-send-btn" onclick="sendMessage()">➤</button>
    </div>`;

  // Load messages + listen for real-time updates
  if(chatListener)chatListener(); // unsubscribe previous
  chatListener=db.collection('chats').doc(chatId).collection('messages')
    .orderBy('ts','asc').limitToLast(100)
    .onSnapshot(snap=>{
      const msgs=[];
      snap.forEach(d=>{const m=d.data();msgs.push(m)});
      renderMessages(msgs);
    });
}

function renderMessages(msgs){
  const el=$('chatMessages');if(!el)return;
  if(!msgs.length){el.innerHTML='<p style="color:var(--muted);font-size:.78rem;text-align:center;padding:2rem 0">No messages yet. Say hi!</p>';return}
  el.innerHTML=msgs.map(m=>{
    const isMe=m.from===U.uid;
    const time=m.ts?m.ts.toDate().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'';
    return`<div class="chat-msg ${isMe?'me':'them'}">
      <div class="chat-bubble">${esc(m.text)}</div>
      <div class="chat-time">${time}</div>
    </div>`;
  }).join('');
  el.scrollTop=el.scrollHeight;
}

async function sendMessage(){
  if(!currentChatFriend)return;
  const text=$('chatInput').value.trim();
  if(!text)return;
  $('chatInput').value='';
  const chatId=getChatId(U.uid,currentChatFriend);
  await db.collection('chats').doc(chatId).collection('messages').add({
    from:U.uid,
    text:text.slice(0,500), // cap at 500 chars
    ts:firebase.firestore.FieldValue.serverTimestamp()
  });
}

function closeChat(){
  if(chatListener){chatListener();chatListener=null}
  currentChatFriend=null;
  renderChatList();
}

// ═══════════ AI COACH ═══════════
function renderAICoach(){
  const el=$('aiCoachContent');if(!el)return;
  const tips=generateCoachTips();

  let h=`<div class="coach-header">
    <div class="coach-avatar">🤖</div>
    <div><div class="coach-name">SYSTEM COACH</div><div class="coach-sub">Personalized based on your data</div></div>
  </div>`;

  // Motivational message
  h+=`<div class="coach-bubble main">${getMotivation()}</div>`;

  // Contextual tips
  tips.forEach(tip=>{
    h+=`<div class="coach-bubble"><span class="coach-tip-icon">${tip.icon}</span> <strong>${tip.title}</strong><br>${tip.text}</div>`;
  });

  // Quick stats the coach "sees"
  h+=`<div class="coach-bubble dim">Based on: ${workoutLog.length} workouts · ${calcStreak()}-day streak · ${userData.class||'no class'} · ${userData.goal||'no goal set'}</div>`;

  el.innerHTML=h;
}

function generateCoachTips(){
  const tips=[];
  const streak=calcStreak();
  const wc=workoutLog.length;
  const st=userData.stats||{};
  const prs=userData.prs||{};
  const goal=userData.goal||'';
  const t=calcTDEE();
  const today=getTodayStr();
  const todayFood=(userData.foodLog&&userData.foodLog[today])||[];
  const todayCal=todayFood.reduce((s,f)=>s+(f.cal||0),0);
  const todayProtein=todayFood.reduce((s,f)=>s+(f.protein||0),0);

  // Streak advice
  if(streak===0)tips.push({icon:'🔥',title:'Get Back In',text:'You haven\'t logged a workout today. Even a short session keeps your streak alive.'});
  else if(streak>=7&&streak<14)tips.push({icon:'📅',title:'Week Warrior',text:`${streak}-day streak! You're building real momentum. Don't break the chain.`});
  else if(streak>=14)tips.push({icon:'🏆',title:'Unstoppable',text:`${streak}-day streak. You're in the top tier of consistency. Your body is adapting.`});

  // Workout volume
  if(wc<5)tips.push({icon:'🎯',title:'Early Days',text:'Focus on form over weight. The first 2 weeks are about building the habit and learning movements.'});
  else if(wc>=20&&wc<50)tips.push({icon:'📈',title:'Progressive Overload',text:'You\'ve built a solid base. Time to push — add 5 lbs to your compounds every 1-2 weeks.'});
  else if(wc>=50)tips.push({icon:'⚡',title:'Veteran',text:`${wc} workouts logged. Consider a deload week if you haven't taken one recently.`});

  // Nutrition
  if(t){
    if(!todayFood.length)tips.push({icon:'🍽️',title:'Log Your Food',text:`Your target is ${t.target} cal today. Start logging meals to stay on track.`});
    else if(todayProtein<t.proteinG*0.5)tips.push({icon:'🥩',title:'Protein Check',text:`Only ${todayProtein}g protein so far — target is ${t.proteinG}g. Prioritize protein in your next meal.`});
    if(goal.includes('Fat Loss'))tips.push({icon:'🔥',title:'Fat Loss Tip',text:'Keep the deficit moderate (300-500 cal). Too aggressive = muscle loss. Protein is your best friend right now.'});
    else if(goal.includes('Muscle Gain'))tips.push({icon:'💪',title:'Growth Mode',text:'You need a surplus to grow. Make sure you\'re actually eating enough — most people undereat in a bulk.'});
  }else{
    tips.push({icon:'⚙️',title:'Set Up Stats',text:'Add your height, weight, and age in Settings to unlock personalized nutrition targets and macro calculations.'});
  }

  // PRs
  if(!prs.bench&&!prs.squat)tips.push({icon:'📊',title:'Track Your PRs',text:'Log your bench, squat, deadlift, and OHP in Settings. Knowing your numbers is the first step to beating them.'});

  // Class-specific
  if(userData.class==='Powerlifter')tips.push({icon:'🏋️',title:'Powerlifter Tip',text:'Compound lifts should be first in every session when you\'re freshest. Save accessories for after the big 3.'});
  else if(userData.class==='Bodybuilder')tips.push({icon:'💪',title:'Bodybuilder Tip',text:'Mind-muscle connection matters. Slow your eccentrics to 3 seconds — you\'ll feel the difference immediately.'});
  else if(userData.class==='Strongman')tips.push({icon:'🪨',title:'Strongman Tip',text:'Grip strength is often the limiting factor. Add farmer walks and dead hangs to every session.'});
  else if(userData.class==='Athlete')tips.push({icon:'⚡',title:'Athlete Tip',text:'Explosive power comes from the hips. Prioritize cleans, jumps, and sprint work over isolation exercises.'});

  // Recovery
  const lastWorkout=workoutLog[0];
  if(lastWorkout){
    const hoursSince=(Date.now()-new Date(lastWorkout.date).getTime())/3600000;
    if(hoursSince<12)tips.push({icon:'😴',title:'Recovery',text:'You trained recently. Prioritize sleep (7-9 hours), hydration, and protein to maximize your gains from that session.'});
  }

  // Cap at 5 tips
  return tips.slice(0,5);
}

function getMotivation(){
  const messages=[
    "The System sees your effort. Every rep brings you closer to the next rank.",
    "Hunters who rest too long get left behind. Stay sharp.",
    "You chose this path. The iron doesn't lie — put in the work.",
    "Discipline is choosing between what you want now and what you want most.",
    "The gate ahead won't open for the weak. Train harder.",
    "Your body can handle more than your mind thinks. Push through.",
    "Consistency beats intensity. Show up every day.",
    "The strongest hunters aren't born — they're forged.",
    "Rest is part of the process, not an excuse to quit.",
    "The System rewards those who never stop leveling up."
  ];
  // Rotate daily based on date
  const today=getTodayStr();
  let seed=0;for(let i=0;i<today.length;i++)seed+=today.charCodeAt(i);
  return messages[seed%messages.length];
}
