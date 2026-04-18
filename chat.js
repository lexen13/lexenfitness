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
  const lastRead=userData.lastReadTimestamps||{};
  // Collect chat data for sorting
  const chatItems=[];
  for(const fid of friends.slice(0,30)){
    try{
      const d=await db.collection('users').doc(fid).get();
      if(!d.exists)continue;
      const f=d.data();const r=getRank(f.xp||0);
      let preview='No messages yet',previewTime='',sortTime=0,isUnread=false,senderName='';
      try{
        const chatId=getChatId(U.uid,fid);
        const lastMsg=await db.collection('chats').doc(chatId).collection('messages').orderBy('ts','desc').limit(1).get();
        if(!lastMsg.empty){
          const m=lastMsg.docs[0].data();
          const isMe=m.from===U.uid;
          preview=(isMe?'You: ':'')+(String(m.text||'').slice(0,40));
          if(m.ts){
            const dt=m.ts.toDate();sortTime=dt.getTime();
            const now=new Date();const isToday=dt.toDateString()===now.toDateString();
            const yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);
            const isYesterday=dt.toDateString()===yesterday.toDateString();
            if(isToday)previewTime=dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
            else if(isYesterday)previewTime='Yesterday';
            else previewTime=dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
            // Unread check
            if(!isMe){
              const readTime=lastRead[fid]||0;
              if(dt.getTime()>readTime){isUnread=true;senderName=f.username||'hunter'}
            }
          }
        }
      }catch(e){}
      chatItems.push({fid,f,r,preview,previewTime,sortTime,isUnread,senderName});
    }catch(e){}
  }
  // Sort: unread first, then by most recent message
  chatItems.sort((a,b)=>{
    if(a.isUnread&&!b.isUnread)return -1;
    if(!a.isUnread&&b.isUnread)return 1;
    return b.sortTime-a.sortTime;
  });
  let h='<div class="page-title">MESSAGES</div><div class="page-sub">Tap a friend to chat</div>';
  if(!chatItems.length)h+='<p style="color:var(--red);font-size:.78rem;padding:.5rem">Could not load friends. Make sure Firestore rules allow reading user docs.</p>';
  chatItems.forEach(c=>{
    h+=`<div class="chat-list-item${c.isUnread?' unread':''}" onclick="openChat('${c.fid}')">
      <div class="lb-pic">${c.f.profilePic?'<img src="'+c.f.profilePic+'">':'👤'}</div>
      <div class="chat-list-info">
        <div class="chat-list-name">@${esc(c.f.username||'hunter')} <span class="chat-list-rank" style="color:${c.r.color}">${c.r.name}</span></div>
        <div class="chat-list-preview${c.isUnread?' unread-text':''}">${c.isUnread?'<strong>@'+esc(c.senderName)+':</strong> ':''}${esc(c.preview)}</div>
      </div>
      <div class="chat-list-meta">
        <div class="chat-list-time">${c.previewTime}</div>
        ${c.isUnread?'<div class="chat-unread-dot"></div>':''}
      </div>
    </div>`;
  });
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
  const now=new Date();const todayStr=now.toDateString();
  const yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);const yestStr=yesterday.toDateString();
  let lastDateStr='';
  let h='';
  msgs.forEach(m=>{
    const isMe=m.from===U.uid;
    if(!m.ts){h+=`<div class="chat-msg ${isMe?'me':'them'}"><div class="chat-bubble">${esc(m.text)}</div><div class="chat-time">sending...</div></div>`;return}
    const dt=m.ts.toDate();
    const dateStr=dt.toDateString();
    // Date separator
    if(dateStr!==lastDateStr){
      let dateLabel;
      if(dateStr===todayStr)dateLabel='Today';
      else if(dateStr===yestStr)dateLabel='Yesterday';
      else dateLabel=dt.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',year:dt.getFullYear()!==now.getFullYear()?'numeric':undefined});
      h+=`<div class="chat-date-sep">${dateLabel}</div>`;
      lastDateStr=dateStr;
    }
    const time=dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    h+=`<div class="chat-msg ${isMe?'me':'them'}"><div class="chat-bubble">${esc(m.text)}</div><div class="chat-time">${time}</div></div>`;
  });
  el.innerHTML=h;
  el.scrollTop=el.scrollHeight;
}

async function sendMessage(){
  if(!currentChatFriend)return;
  const text=$('chatInput').value.trim();if(!text)return;
  $('chatInput').value='';
  const chatId=getChatId(U.uid,currentChatFriend);
  try{
    const msg={from:U.uid,text:text.slice(0,500),ts:firebase.firestore.FieldValue.serverTimestamp()};
    await db.collection('chats').doc(chatId).collection('messages').add(msg);
    // Update parent chat doc with last message metadata for notification listeners
    await db.collection('chats').doc(chatId).set({
      members:[U.uid,currentChatFriend].sort(),
      lastMessage:text.slice(0,100),
      lastFrom:U.uid,
      lastAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
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
let coachSending=false;

function renderAICoach(){
  const el=$('aiCoachContent');if(!el)return;
  // Init with greeting if empty
  if(!coachHistory.length){
    coachHistory.push({role:'coach',text:getGreeting()});
  }

  let h=`<div class="coach-header">
    <div class="coach-avatar">🤖</div>
    <div><div class="coach-name">SYSTEM COACH</div><div class="coach-sub">Ask me anything about training, nutrition, or progress</div></div>
  </div>`;

  // Chat messages
  h+=`<div class="coach-messages" id="coachMessages">`;
  coachHistory.forEach(m=>{
    if(m.role==='coach'){
      h+=`<div class="chat-msg them"><div class="chat-bubble coach-bubble">${m.text}</div></div>`;
    }else{
      h+=`<div class="chat-msg me"><div class="chat-bubble">${esc(m.text)}</div></div>`;
    }
  });
  if(coachSending){
    h+=`<div class="chat-msg them"><div class="chat-bubble coach-bubble coach-typing"><span></span><span></span><span></span></div></div>`;
  }
  h+=`</div>`;

  // Quick suggestion chips (shown on first render only)
  if(coachHistory.length<=1){
    h+=`<div class="coach-suggestions">
      <div class="coach-sug-label">Try asking:</div>
      <div class="coach-sug-chips">
        <button class="coach-chip" onclick="askCoachQuick('What should I eat today?')">🍽️ What should I eat?</button>
        <button class="coach-chip" onclick="askCoachQuick('What should I train?')">🏋️ What should I train?</button>
        <button class="coach-chip" onclick="askCoachQuick('Am I on track?')">📊 Am I on track?</button>
        <button class="coach-chip" onclick="askCoachQuick('I need motivation')">🔥 Motivate me</button>
        <button class="coach-chip" onclick="askCoachQuick('How much protein should I eat?')">🥩 Protein needs</button>
        <button class="coach-chip" onclick="askCoachQuick('Help me with recovery')">😴 Recovery tips</button>
      </div>
    </div>`;
  }

  // Input box (ALWAYS visible)
  h+=`<div class="coach-input-row">
    <textarea id="coachInput" class="coach-input" placeholder="Ask your coach anything..." rows="1" onkeydown="coachKeyDown(event)" oninput="autoGrowCoach(this)"></textarea>
    <button class="chat-send-btn" onclick="sendCoachMessage()">➤</button>
  </div>`;

  el.innerHTML=h;
  const msgs=$('coachMessages');if(msgs)msgs.scrollTop=msgs.scrollHeight;
}

function coachKeyDown(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCoachMessage()}
}
function autoGrowCoach(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,100)+'px'}

function askCoachQuick(text){
  const input=$('coachInput');if(input)input.value=text;
  sendCoachMessage();
}

async function sendCoachMessage(){
  const input=$('coachInput');if(!input)return;
  const text=input.value.trim();if(!text||coachSending)return;
  input.value='';input.style.height='auto';
  coachHistory.push({role:'user',text});
  coachSending=true;renderAICoach();
  // Simulate thinking delay
  await new Promise(r=>setTimeout(r,400+Math.random()*600));
  const response=generateCoachResponse(text);
  coachHistory.push({role:'coach',text:response});
  coachSending=false;renderAICoach();
}

// ─── Intent detection from freeform text ───
function detectIntent(text){
  const t=text.toLowerCase();
  // Nutrition keywords
  if(/\b(eat|food|meal|nutrition|calorie|carb|fat|protein|macro|diet|cut|bulk|weight loss|weight gain|hungry)\b/.test(t)){
    if(/\bprotein\b/.test(t))return'protein';
    if(/\b(carb|rice|pasta|bread)\b/.test(t))return'carbs';
    if(/\bfat\b/.test(t))return'fats';
    if(/\b(cut|deficit|weight loss|lose weight|fat loss|shredded|lean)\b/.test(t))return'cutting';
    if(/\b(bulk|surplus|gain|muscle|size|bigger)\b/.test(t))return'bulking';
    return'nutrition';
  }
  // Training keywords
  if(/\b(train|workout|lift|exercise|rep|set|gym|program|routine|split|push|pull|leg|chest|back|shoulder|arm|bench|squat|deadlift)\b/.test(t)){
    if(/\b(squat|back squat|front squat)\b/.test(t))return'squat';
    if(/\b(bench|bench press|chest press)\b/.test(t))return'bench';
    if(/\b(deadlift|pull)\b/.test(t))return'deadlift';
    if(/\b(rest day|rest|off day|active recovery)\b/.test(t))return'rest';
    if(/\b(volume|sets|reps|how many)\b/.test(t))return'volume';
    return'training';
  }
  // Recovery
  if(/\b(sleep|recover|sore|rest|tired|fatigue|stretch|mobility|deload)\b/.test(t))return'recovery';
  // Progress
  if(/\b(progress|track|goal|rank|level|xp|streak|improve|plateau|stuck)\b/.test(t))return'progress';
  // Motivation
  if(/\b(motivat|lazy|quit|give up|can't|hard|struggle|pump me up|hype)\b/.test(t))return'motivation';
  // PR / Strength
  if(/\b(pr|personal record|max|1rm|strength|stronger)\b/.test(t))return'strength';
  // Supplements
  if(/\b(supplement|creatine|pre.?workout|protein powder|whey|caffeine|vitamin|omega|fish oil)\b/.test(t))return'supplements';
  // Water/hydration
  if(/\b(water|hydrat|drink|thirst)\b/.test(t))return'hydration';
  // Greeting
  if(/^(hi|hey|hello|yo|sup|what'?s up)\b/.test(t))return'greeting';
  // Thanks
  if(/\b(thanks|thank you|thx|appreciate)\b/.test(t))return'thanks';
  return'unknown';
}

function generateCoachResponse(userText){
  const intent=detectIntent(userText);
  const streak=calcWeeklyStreak();const wc=workoutLog.length;
  const st=userData.stats||{};const prs=userData.prs||{};
  const goal=userData.goal||'General Fitness';const cls=userData.class||'';
  const t=calcTDEE();const today=getTodayStr();
  const dayLog=typeof getDayLog==='function'?getDayLog(today):{meals:{}};
  const todayTotals=typeof getDayTotals==='function'?getDayTotals(dayLog):{cal:0,p:0};
  const rank=getEffectiveRank();
  const lastW=workoutLog[0];const hoursSince=lastW?((Date.now()-new Date(lastW.date).getTime())/3600000):999;

  switch(intent){
    case 'greeting':
      return`Hey${userData.name?', '+esc(userData.name.split(' ')[0]):''}. ${rank.name} rank, ${wc} workouts deep. What's on your mind?`;
    case 'thanks':
      return"Anytime. Now get back to work. 💪";
    case 'protein':
      if(!t)return"Set up your stats (<strong>Nutrition → Set Up Nutrition</strong>) and I'll give you a real number. General rule: <strong>1g per pound of bodyweight</strong> for anyone lifting seriously.";
      return`Your target is <strong>${t.proteinG}g protein</strong> per day. You've had <strong>${todayTotals.p}g</strong> so far (${Math.round(todayTotals.p/t.proteinG*100)}%). Spread it across 3-4 meals, 30-50g each. Whey shake post-workout is a shortcut, not a cheat code.`;
    case 'carbs':
      if(!t)return"Set up your stats first. Carbs should be your biggest macro for training fuel.";
      return`You're at <strong>${t.carbG}g carbs</strong> daily. Time them around training — more on lift days, fewer on rest days. Rice, oats, potatoes, fruit. Stop fearing carbs — they fuel your lifts.`;
    case 'fats':
      if(!t)return"Fats matter for hormones. Set up your stats for a specific number.";
      return`Your target is <strong>${t.fatG}g fat</strong>. Don't drop below <strong>40-50g minimum</strong> or your test levels tank. Sources: eggs, olive oil, nuts, fatty fish, avocado.`;
    case 'cutting':
      if(!t)return"For a clean cut: moderate deficit (-400 to -500 cal), keep protein high (1g/lb), lift heavy to preserve muscle, and sleep 8+ hours. Set up your stats to get specific numbers.";
      return`<strong>Cutting checklist:</strong><br>• Target: <strong>${t.target} cal</strong> (${t.deficit?t.deficit+' deficit':'set a goal'})<br>• Maintenance: ${t.maintenance||t.tdee} cal<br>• Protein floor: ${t.proteinG}g<br>• Keep lifting heavy — don't switch to endurance<br>• Weigh yourself 3-4x/week, take weekly average<br>• Aim for 0.5-1% bodyweight loss per week`;
    case 'bulking':
      if(!t)return"Lean bulk = slight surplus (+200-300 cal). Dirty bulk just makes you fat. Set up your stats for a specific target.";
      return`<strong>Lean bulk protocol:</strong><br>• Target: <strong>${t.target} cal</strong><br>• 0.25-0.5% bodyweight gain per week (faster = more fat)<br>• Hit protein (${t.proteinG}g) first, fill rest with carbs<br>• Progressive overload every week<br>• Track strength — if the weight on the bar isn't going up, neither is muscle`;
    case 'nutrition':
      if(!t)return"Tap <strong>Nutrition → Set Up Nutrition</strong> first. I need your stats to give real advice.";
      const calLeft=t.target-todayTotals.cal;
      if(todayTotals.cal===0)return`Day's target: <strong>${t.target} cal, ${t.proteinG}g protein</strong>. You haven't logged anything. Start with breakfast — 30g+ protein. Eggs, greek yogurt, shake. Your move.`;
      if(calLeft>500)return`You've had <strong>${todayTotals.cal}/${t.target} cal</strong>, <strong>${todayTotals.p}/${t.proteinG}g protein</strong>. ${calLeft} cal left. ${t.proteinG-todayTotals.p>30?'Prioritize protein — you\'re behind.':'Protein on track. Balance the rest.'}`;
      if(calLeft<-200)return`⚠️ <strong>${Math.abs(calLeft)} over</strong> your ${t.target} target. ${goal.includes('Fat Loss')||t.deficit<0?'This undoes your cut. Tomorrow, tighten up.':'Not the end of the world on a growth phase — just don\'t make it a pattern.'}`;
      return`You're on track: <strong>${todayTotals.cal}/${t.target} cal</strong>, <strong>${todayTotals.p}/${t.proteinG}g protein</strong>. Keep eating like this.`;
    case 'training':
      let resp='';
      if(hoursSince<16)resp=`You trained ${Math.round(hoursSince)}h ago. <strong>Take a rest day</strong> or hit a different muscle group. Recovery = growth. `;
      else if(hoursSince>72)resp=`It's been <strong>${Math.round(hoursSince/24)} days</strong> since your last session. Get back in. `;
      else resp='Solid window to train. ';
      if(cls==='Powerlifter')resp+=`As a Powerlifter: warm up, work up to a top set, save energy for the big 3. ${prs.squat?`Your squat PR is ${prs.squat} — `:''}push intensity over volume.`;
      else if(cls==='Bodybuilder')resp+='Bodybuilder mode: slow eccentrics (3-4s), full ROM, mind-muscle connection. Chase the pump, not ego.';
      else if(cls==='Strongman')resp+='Strongman: carries, presses, deadlifts, events. Train heavy, train gritty.';
      else if(cls==='Athlete')resp+='Athlete split: power first (cleans, jumps, sprints), then sport-specific work.';
      else resp+='Pick your program day in <strong>Train</strong> and execute. Consistency beats optimization.';
      return resp;
    case 'squat':
      return"<strong>Squat tips:</strong><br>• Bar on upper traps, not neck<br>• Brace core hard before descending<br>• Knees track over toes<br>• Break parallel if mobility allows<br>• Drive through full foot, not just heels<br>Check the <strong>Library</strong> tab for Eugene Teo's squat video.";
    case 'bench':
      return"<strong>Bench tips:</strong><br>• Retract shoulder blades, pin to bench<br>• Slight arch, feet planted<br>• Bar touches mid-chest, elbows ~75°<br>• Drive feet into floor for leg drive<br>• Pause 1s on chest for power<br>Watch the tutorial in the <strong>Library</strong>.";
    case 'deadlift':
      return"<strong>Deadlift tips:</strong><br>• Bar over mid-foot before setup<br>• Hinge, grip just outside knees<br>• Brace like you're about to get punched<br>• Push floor away, don't 'pull'<br>• Lockout with glutes, not lower back<br>Trap bar is friendlier if conventional hurts.";
    case 'rest':
      return`Rest days matter as much as training days.${hoursSince<48?` You just trained ${Math.round(hoursSince)}h ago — absolutely take one.`:''} On rest days: walk (5-8k steps), hydrate, hit protein target, stretch, sleep 8+hrs. Active recovery > sitting on the couch.`;
    case 'volume':
      return"<strong>Weekly volume guidelines:</strong><br>• Beginners: 8-12 sets per muscle per week<br>• Intermediate: 12-18 sets per muscle<br>• Advanced: 15-22 sets per muscle (diminishing returns after)<br>• 4-8 reps for strength, 8-15 for hypertrophy, 15+ for endurance<br>Track it in the <strong>Log</strong> tab.";
    case 'recovery':
      return`<strong>Recovery protocol:</strong><br>🛏 <strong>Sleep 7-9 hrs</strong> — non-negotiable<br>💧 Bodyweight (lbs) ÷ 2 = oz of water minimum<br>🥩 ${t?t.proteinG+'g protein daily':'Protein — hit 1g/lb bodyweight'}<br>🚶 5-8k steps on rest days<br>🧘 Stretch / mobility 10 min post-workout<br>${hoursSince<24?'You trained recently. Lock these in today.':''}`;
    case 'progress':
      let p=`<strong>${rank.name}</strong> · ${userData.xp} XP · ${wc} workouts · ${streak}-week streak.<br><br>`;
      if(streak===0&&wc>0)p+='⚠️ Streak is broken. Get 3 sessions this week to restart it. ';
      else if(streak>=4)p+=`🔥 ${streak}-week streak — elite territory. `;
      if(wc<10)p+='You\'re in the foundation phase. Show up, that\'s the whole job right now.';
      else if(wc<30)p+='Momentum building. Strength should be climbing weekly.';
      else if(wc<100)p+='Solid base. Start tracking progressive overload — add 2.5-5 lbs or 1 rep weekly.';
      else p+=`${wc} sessions in the bank. You're a veteran. Focus on periodization and nutrition precision now.`;
      const trial=getAvailableTrial();if(trial)p+=`<br><br>🚪 <strong>${trial.trial.name}</strong> is your next gate. See Missions.`;
      return p;
    case 'motivation':
      const msgs=[
        `<strong>${rank.name}</strong> with ${userData.xp} XP. Every hunter above you started where you are. The only difference? They didn't stop.`,
        `${streak>0?streak+'-week streak. Don\'t let it die on your watch.':'Your streak is 0. Rebuild starts today.'} The version of you that gives up is watching. Beat him.`,
        `${wc} workouts logged. That's ${wc} times you chose discipline over comfort. Stack another one today.`,
        "The iron doesn't care about your feelings. It respects work. Show up and put it in.",
        "You didn't come this far to only come this far. The System sees everything. Level up.",
        `${cls?'You chose '+cls+'. Now earn it.':'No class yet? Pick one. Commit.'} The strongest hunters aren't the most gifted — they're the most consistent.`
      ];
      return msgs[Math.floor(Math.random()*msgs.length)];
    case 'strength':
      let s='<strong>To get stronger:</strong><br>';
      s+='• Progressive overload — add weight/reps every week<br>';
      s+='• Lower reps (3-6), heavier weight (80-90% 1RM)<br>';
      s+='• Longer rest between sets (3-5 min for compounds)<br>';
      s+='• Eat in a surplus or maintenance (can\'t build in a big deficit)<br>';
      s+='• Sleep 8+ hours — CNS recovery drives strength<br>';
      if(prs.bench||prs.squat||prs.deadlift){s+='<br>Your current PRs: ';const list=[];if(prs.bench)list.push(`Bench ${prs.bench}`);if(prs.squat)list.push(`Squat ${prs.squat}`);if(prs.deadlift)list.push(`DL ${prs.deadlift}`);if(prs.ohp)list.push(`OHP ${prs.ohp}`);s+=list.join(' · ')}
      return s;
    case 'supplements':
      return"<strong>The essentials (in order):</strong><br>1. <strong>Whey protein</strong> — if you can't hit protein from food<br>2. <strong>Creatine</strong> — 5g/day, most researched supplement ever<br>3. <strong>Vitamin D3</strong> — most people are deficient<br>4. <strong>Fish oil</strong> — if you don't eat fatty fish 2x/wk<br><br>Pre-workout = glorified caffeine. Amino acids = usually unnecessary if protein is dialed in. Don't chase fancy stuff before the basics.";
    case 'hydration':
      return`<strong>Water targets:</strong><br>• Minimum: bodyweight (lbs) ÷ 2 = oz/day<br>• Training days: add 16-20 oz<br>• Hot weather: add more<br>${st.weight?'For you ('+st.weight+' lbs): <strong>'+Math.round(st.weight/2)+' oz minimum</strong>':'Set your weight in Settings for a specific number'}<br><br>Thirst = already behind. Drink regularly, not just when thirsty.`;
    case 'unknown':
    default:
      return `I'm not quite sure what you're asking. Try rephrasing, or ask about:<br>• <strong>Training</strong> — workouts, form, specific lifts<br>• <strong>Nutrition</strong> — calories, macros, cutting, bulking<br>• <strong>Recovery</strong> — sleep, soreness, rest days<br>• <strong>Progress</strong> — your stats, how you're tracking<br><br>Or just chat — I'll do my best.`;
  }
}

function getGreeting(){
  const rank=getEffectiveRank();const wc=workoutLog.length;const ws=calcWeeklyStreak();
  const hr=new Date().getHours();
  let greeting='';
  if(hr<12)greeting='Morning';else if(hr<17)greeting='Afternoon';else greeting='Evening';
  let second='';
  if(wc===0)second=" Let's get your first workout logged. Ask me anything about getting started.";
  else if(ws===0&&wc>0)second=` Your streak is at 0 — let's fix that. ${wc} workouts in the bank.`;
  else if(ws>=4)second=` ${ws}-week streak going strong. ${rank.name} rank. What do you need?`;
  else second=` ${rank.name} · ${userData.xp} XP · ${wc} workouts logged. What's on your mind?`;
  return`${greeting}, hunter.${second}`;
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
