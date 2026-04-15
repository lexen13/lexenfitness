// ═══════════════════════════════════════════
//  LEXENFITNESS — NUTRITION v3 (Meal-Based)
// ═══════════════════════════════════════════
const OFF_API='https://world.openfoodfacts.org';

const STEP_CALORIES={
  2000:0, 4000:80, 6000:160, 8000:250, 10000:350, 12000:450, 15000:600
};
function stepsToCalories(steps){
  const keys=Object.keys(STEP_CALORIES).map(Number).sort((a,b)=>a-b);
  if(steps<=keys[0])return 0;
  if(steps>=keys[keys.length-1])return STEP_CALORIES[keys[keys.length-1]];
  for(let i=0;i<keys.length-1;i++){
    if(steps>=keys[i]&&steps<keys[i+1]){
      const pct=(steps-keys[i])/(keys[i+1]-keys[i]);
      return Math.round(STEP_CALORIES[keys[i]]+(STEP_CALORIES[keys[i+1]]-STEP_CALORIES[keys[i]])*pct);
    }
  }
  return 0;
}

function calcTDEE(){
  const st=userData.stats||{};const w=parseFloat(st.weight),a=parseFloat(st.age),hRaw=st.height||'';
  if(!w||!a||!hRaw)return null;
  let hCm=0;
  if(hRaw.includes("'")){const p=hRaw.replace(/"/g,'').split("'");hCm=(parseInt(p[0])*12+parseInt(p[1]||0))*2.54}
  else if(hRaw.toLowerCase().includes('cm'))hCm=parseFloat(hRaw);
  else{const n=parseFloat(hRaw);hCm=n>100?n:n*2.54}
  if(!hCm)return null;
  const wKg=w*0.453592,sex=(st.sex||'male');
  const bmr=sex==='female'?(10*wKg+6.25*hCm-5*a-161):(10*wKg+6.25*hCm-5*a+5);
  const al=ACTIVITY_LEVELS.find(x=>x.id===(userData.activityLevel||'moderate'))||ACTIVITY_LEVELS[2];
  // Add step bonus
  const dailySteps=parseInt(userData.dailySteps)||0;
  const stepBonus=stepsToCalories(dailySteps);
  const tdee=Math.round(bmr*al.mult)+stepBonus;
  const goal=userData.nutritionGoal||userData.goal||'';
  let target=tdee;
  if(goal.includes('Fat Loss')||goal.includes('Cut'))target=tdee-400;
  else if(goal.includes('Aggressive Cut'))target=tdee-600;
  else if(goal.includes('Lean Bulk')||goal.includes('Muscle Gain'))target=tdee+250;
  else if(goal.includes('Bulk'))target=tdee+500;
  else if(goal.includes('Recomp'))target=tdee-100;
  const cm=userData.customMacros;
  if(cm&&cm.enabled)return{bmr,tdee,stepBonus,target:cm.calories||target,proteinG:cm.protein||Math.round(wKg*2.2),fatG:cm.fat||Math.round(target*0.25/9),carbG:cm.carbs||Math.round((target-(cm.protein||Math.round(wKg*2.2))*4-(cm.fat||Math.round(target*0.25/9))*9)/4),goal:goal||'Maintenance',custom:true,actName:al.name,steps:dailySteps};
  // Auto macros: protein 1g/lb, fat 25%, carbs fill the rest
  const proteinG=Math.round(w*1);
  const fatG=Math.round(target*0.25/9);
  const carbG=Math.round((target-proteinG*4-fatG*9)/4);
  return{bmr,tdee,stepBonus,target,proteinG:Math.max(proteinG,50),fatG:Math.max(fatG,30),carbG:Math.max(carbG,50),goal:goal||'Maintenance',custom:false,actName:al.name,steps:dailySteps};
}

// ═══════════ MEAL HELPERS ═══════════
function getMealCount(){return parseInt(userData.mealCount)||3}
function getDayLog(date){
  const raw=userData.foodLog&&userData.foodLog[date];
  if(!raw)return{meals:{},mealCount:getMealCount()};
  // Backwards compat: old format is flat array, migrate to meal 1
  if(Array.isArray(raw))return{meals:{1:raw},mealCount:getMealCount()};
  return raw;
}
function setDayLog(date,dayLog){
  if(!userData.foodLog)userData.foodLog={};
  userData.foodLog[date]=dayLog;
}
function getDayTotals(dayLog){
  const t={cal:0,p:0,c:0,f:0};
  Object.values(dayLog.meals||{}).forEach(items=>{
    (items||[]).forEach(f=>{t.cal+=(f.cal||0);t.p+=(f.protein||0);t.c+=(f.carbs||0);t.f+=(f.fat||0)});
  });
  return t;
}
function getMealTotals(items){
  return(items||[]).reduce((s,f)=>({cal:s.cal+(f.cal||0),p:s.p+(f.protein||0),c:s.c+(f.carbs||0),f:s.f+(f.fat||0)}),{cal:0,p:0,c:0,f:0});
}
function getDayItemCount(dayLog){
  return Object.values(dayLog.meals||{}).reduce((s,items)=>s+(items||[]).length,0);
}

let foodLogDate=null;
let activeMeal=1; // which meal we're adding food to

// ═══════════ MAIN RENDER ═══════════
function renderNutritionPage(){
  const today=getTodayStr();
  const viewDate=foodLogDate||today;
  const isToday=viewDate===today;
  const t=calcTDEE();
  const dayLog=getDayLog(viewDate);
  const totals=getDayTotals(dayLog);
  const mealCount=getMealCount();
  const viewDateObj=new Date(viewDate+'T12:00:00');
  const dateLabel=viewDateObj.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});

  let h='';

  // ── Header + Date Nav (always show) ──
  h+=`<div class="page-title" style="display:flex;justify-content:space-between;align-items:center">NUTRITION <span style="font-family:var(--font-mono);font-size:.65rem;color:var(--muted)">${dateLabel}</span></div>`;
  h+=`<div class="date-nav">
    <button class="date-btn" onclick="shiftFoodDate(-1)">◄</button>
    <button class="date-btn ${isToday?'active':''}" onclick="foodLogDate=null;renderNutritionPage()">Today</button>
    <button class="date-btn" onclick="shiftFoodDate(1)" ${isToday?'disabled':''}>►</button>
  </div>`;

  // ── TDEE Card or Setup Prompt ──
  if(!t){
    h+=`<div class="tdee-card" style="text-align:center">
      <div class="tdee-empty">Set up your body stats to get calorie & macro targets</div>
      <button class="auth-btn primary" onclick="openMacroModal()" style="margin-top:.6rem;max-width:280px;margin-left:auto;margin-right:auto">⚙️ Set Up Nutrition</button>
    </div>`;
  }else{
  const calPct=Math.min(100,(totals.cal/t.target)*100);
  const pPct=Math.min(100,(totals.p/t.proteinG)*100);
  const cPct=Math.min(100,(totals.c/t.carbG)*100);
  const fPct=Math.min(100,(totals.f/t.fatG)*100);
  const calOver=totals.cal>t.target;
  h+=`<div class="tdee-card">
    <div class="tdee-header">${t.custom?'CUSTOM':'AUTO'} · ${t.goal.toUpperCase()} · ${t.actName}${t.steps?' · ~'+t.steps+' steps':''}</div>
    <div class="tdee-main"><div class="tdee-cal${calOver?' over':''}">${totals.cal} <span style="font-size:1.2rem;opacity:.5">/ ${t.target}</span></div><div class="tdee-cal-label">CALORIES${calOver?' ⚠️ OVER':''}${!calOver&&calPct>=90?' ✅ ON TRACK':''}</div></div>
    <div class="macro-bars">
      <div class="macro-bar-row"><span class="macro-label" style="color:var(--red)">P ${totals.p}/${t.proteinG}g</span><div class="macro-bar"><div class="macro-bar-fill" style="width:${pPct}%;background:var(--red)"></div></div></div>
      <div class="macro-bar-row"><span class="macro-label" style="color:var(--gold)">C ${totals.c}/${t.carbG}g</span><div class="macro-bar"><div class="macro-bar-fill" style="width:${cPct}%;background:var(--gold)"></div></div></div>
      <div class="macro-bar-row"><span class="macro-label" style="color:var(--cyan)">F ${totals.f}/${t.fatG}g</span><div class="macro-bar"><div class="macro-bar-fill" style="width:${fPct}%;background:var(--cyan)"></div></div></div>
    </div>
    <div class="tdee-btns"><button class="tdee-adjust-btn" onclick="openMacroModal()">⚙️ Adjust Targets</button><button class="tdee-adjust-btn" onclick="openMealCountModal()">🍽️ ${mealCount} Meals</button></div>
  </div>`;
  } // end TDEE if/else

  // ── MEAL SECTIONS ──
  for(let m=1;m<=mealCount;m++){
    const items=dayLog.meals[m]||[];
    const mt=getMealTotals(items);
    const mealTarget=Math.round(t.target/mealCount);
    const mealPct=mealTarget>0?Math.min(100,(mt.cal/mealTarget)*100):0;
    h+=`<div class="meal-section">
      <div class="meal-header" onclick="toggleMealSection(this)">
        <div class="meal-title">🍽️ MEAL ${m}</div>
        <div class="meal-summary">${mt.cal} cal · P:${mt.p}g · C:${mt.c}g · F:${mt.f}g</div>
        <div class="meal-mini-bar"><div class="meal-mini-fill" style="width:${mealPct}%"></div></div>
        <span class="meal-toggle">▼</span>
      </div>
      <div class="meal-body">`;
    if(items.length){
      h+=items.map((f,i)=>`<div class="food-item">
        <div class="food-item-info"><div class="food-item-name">${esc(f.name)}</div><div class="food-item-detail">${esc(f.serving||'')} · ${f.cal} cal · P:${f.protein}g C:${f.carbs}g F:${f.fat}g</div></div>
        ${isToday?`<button class="btn-del" onclick="removeMealItem(${m},${i})">✕</button>`:''}
      </div>`).join('');
    }else{
      h+=`<p style="color:var(--dim);font-size:.74rem;padding:.3rem 0">No items logged</p>`;
    }
    if(isToday){
      h+=`<div class="food-actions meal-add-btns">
        <button class="food-btn sm" onclick="activeMeal=${m};openFoodSearch()">🔍</button>
        <button class="food-btn sm" onclick="activeMeal=${m};openScanner()">📸</button>
        <button class="food-btn sm" onclick="activeMeal=${m};openManualFood()">✏️</button>
      </div>`;
    }
    h+=`</div></div>`;
  }

  // ── Remaining macros hint ──
  const calLeft=t.target-totals.cal;
  const pLeft=t.proteinG-totals.p;
  if(isToday&&calLeft>100){
    h+=`<div class="remaining-hint">${calLeft} cal remaining · ${pLeft>0?pLeft+'g protein to go':'Protein hit! ✅'}</div>`;
  }

  // ── Recent days ──
  h+=`<div class="section-title" style="margin:1rem 0 .4rem">RECENT DAYS</div>`;
  const logDays=Object.keys(userData.foodLog||{}).filter(k=>{
    const d=userData.foodLog[k];
    if(Array.isArray(d))return d.length>0;
    if(d&&d.meals)return getDayItemCount(d)>0;
    return false;
  }).sort().reverse().slice(0,14);
  if(!logDays.length)h+=`<p style="color:var(--muted);font-size:.78rem">No history yet.</p>`;
  else h+=`<div class="food-history">${logDays.map(d=>{
    const dl=getDayLog(d);const tot=getDayTotals(dl);const count=getDayItemCount(dl);
    const dt=new Date(d+'T12:00:00');const label=dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    const isCurrent=d===viewDate;
    return`<div class="food-history-day${isCurrent?' current':''}" onclick="foodLogDate='${d}';renderNutritionPage()"><div class="fh-date">${label}</div><div class="fh-stats">${tot.cal} cal · ${tot.p}g P · ${count} items</div></div>`;
  }).join('')}</div>`;

  $('nutritionContent').innerHTML=h;
}

// ═══════════ TDEE SETUP (first time) ═══════════
function renderTDEESetup(){
  const st=userData.stats||{};
  return`<div class="page-title">NUTRITION SETUP</div>
  <div class="page-sub">Set up your body stats to get accurate calorie & macro targets</div>
  <div class="tdee-setup">
    <div class="settings-row-fields"><div class="m-field" style="flex:1"><label>Height</label><input type="text" id="tsHeight" placeholder='5\\'10"' value="${st.height||''}"></div><div class="m-field" style="flex:1"><label>Weight (lbs)</label><input type="number" id="tsWeight" value="${st.weight||''}"></div></div>
    <div class="settings-row-fields"><div class="m-field" style="flex:1"><label>Age</label><input type="number" id="tsAge" value="${st.age||''}"></div><div class="m-field" style="flex:1"><label>Sex</label><select id="tsSex"><option value="male"${(st.sex||'male')==='male'?' selected':''}>Male</option><option value="female"${st.sex==='female'?' selected':''}>Female</option></select></div></div>
    <div class="m-field"><label>Activity Level</label><select id="tsActivity">${ACTIVITY_LEVELS.map(a=>`<option value="${a.id}"${(userData.activityLevel||'moderate')===a.id?' selected':''}>${a.name} — ${a.desc}</option>`).join('')}</select></div>
    <div class="m-field"><label>Estimated Daily Steps</label><select id="tsSteps">
      <option value="2000"${(userData.dailySteps||'')==='2000'?' selected':''}>~2,000 (mostly sitting)</option>
      <option value="4000"${(userData.dailySteps||'')==='4000'?' selected':''}>~4,000 (some walking)</option>
      <option value="6000"${(userData.dailySteps||'6000')==='6000'?' selected':''}>~6,000 (moderate)</option>
      <option value="8000"${(userData.dailySteps||'')==='8000'?' selected':''}>~8,000 (active)</option>
      <option value="10000"${(userData.dailySteps||'')==='10000'?' selected':''}>~10,000 (very active)</option>
      <option value="12000"${(userData.dailySteps||'')==='12000'?' selected':''}>~12,000+ (on your feet all day)</option>
    </select></div>
    <div class="m-field"><label>Nutrition Goal</label><select id="tsGoal">
      <option value="Maintenance">Maintenance</option>
      <option value="Fat Loss">Fat Loss (-400 cal)</option>
      <option value="Aggressive Cut">Aggressive Cut (-600 cal)</option>
      <option value="Lean Bulk">Lean Bulk (+250 cal)</option>
      <option value="Bulk">Bulk (+500 cal)</option>
      <option value="Recomp">Body Recomp (-100 cal)</option>
    </select></div>
    <div class="m-field"><label>Meals per day</label><select id="tsMeals">
      <option value="2">2 meals</option>
      <option value="3" selected>3 meals</option>
      <option value="4">4 meals</option>
      <option value="5">5 meals</option>
      <option value="6">6 meals</option>
    </select></div>
    <button class="auth-btn primary" onclick="saveTDEESetup()" style="margin-top:.6rem">Calculate & Start Tracking</button>
  </div>`;
}
async function saveTDEESetup(){
  const stats={...(userData.stats||{}),
    height:$('tsHeight').value.trim(),
    weight:$('tsWeight').value.trim(),
    age:$('tsAge').value.trim(),
    sex:$('tsSex').value
  };
  if(!stats.height||!stats.weight||!stats.age){toast('Fill in all fields');return}
  await saveUser({
    stats,
    activityLevel:$('tsActivity').value,
    dailySteps:$('tsSteps').value,
    nutritionGoal:$('tsGoal').value,
    mealCount:parseInt($('tsMeals').value)||3
  });
  renderNutritionPage();toast('Nutrition targets set!');
}

// ═══════════ MEAL COUNT MODAL ═══════════
function openMealCountModal(){
  const mc=getMealCount();
  const h=`<h2>🍽️ Meals Per Day</h2>
    <div class="meal-count-grid">${[2,3,4,5,6].map(n=>
      `<button class="meal-count-opt${n===mc?' active':''}" onclick="setMealCount(${n})">${n}</button>`
    ).join('')}</div>
    <div class="m-actions" style="margin-top:.6rem"><button class="m-cancel" onclick="closeMealCountModal()">Close</button></div>`;
  $('mealCountModal').querySelector('.modal').innerHTML=h;
  $('mealCountModal').classList.add('open');
}
function closeMealCountModal(){$('mealCountModal').classList.remove('open')}
async function setMealCount(n){
  await saveUser({mealCount:n});
  closeMealCountModal();renderNutritionPage();
  toast(n+' meals/day set');
}

function toggleMealSection(el){
  const body=el.nextElementSibling;
  const toggle=el.querySelector('.meal-toggle');
  if(body.style.maxHeight&&body.style.maxHeight!=='0px'){
    body.style.maxHeight='0px';body.style.overflow='hidden';toggle.textContent='▶';
  }else{
    body.style.maxHeight=body.scrollHeight+'px';body.style.overflow='visible';toggle.textContent='▼';
  }
}

function shiftFoodDate(dir){
  const current=foodLogDate||getTodayStr();
  const d=new Date(current+'T12:00:00');
  d.setDate(d.getDate()+dir);
  const newDate=d.toISOString().slice(0,10);
  if(newDate>getTodayStr())return;
  foodLogDate=newDate===getTodayStr()?null:newDate;
  renderNutritionPage();
}

// ═══════════ FOOD SEARCH ═══════════
function openFoodSearch(){
  $('foodSearchModal').classList.add('open');
  $('foodSearchInput').value='';$('foodSearchResults').innerHTML='';$('foodSearchInput').focus();
}
function closeFoodSearch(){$('foodSearchModal').classList.remove('open')}

async function searchFood(){
  const q=$('foodSearchInput').value.trim();if(!q)return;
  $('foodSearchResults').innerHTML='<p style="color:var(--muted);font-size:.78rem;padding:.5rem">Searching...</p>';
  try{
    const res=await fetch(`${OFF_API}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10`);
    const data=await res.json();
    if(!data.products||!data.products.length){$('foodSearchResults').innerHTML='<p style="color:var(--muted);font-size:.78rem;padding:.5rem">No results found.</p>';return}
    window._foodResults=data.products.map(p=>{
      const nut=p.nutriments||{};
      return{name:String(p.product_name||'Unknown').slice(0,100),calPer100:Math.round(nut['energy-kcal_100g']||nut['energy-kcal']||0),proteinPer100:Math.round(nut.proteins_100g||0),carbsPer100:Math.round(nut.carbohydrates_100g||0),fatPer100:Math.round(nut.fat_100g||0),servingSuggestion:p.serving_size||''};
    });
    $('foodSearchResults').innerHTML=window._foodResults.map((f,i)=>
      `<div class="food-result" onclick="openServingModal(${i})"><div class="food-result-name">${esc(f.name)}</div><div class="food-result-macros">${f.calPer100} cal · P:${f.proteinPer100}g C:${f.carbsPer100}g F:${f.fatPer100}g <span style="color:var(--dim)">per 100g</span>${f.servingSuggestion?'<br><span style="color:var(--gold)">Serving: '+esc(f.servingSuggestion)+'</span>':''}</div></div>`
    ).join('');
  }catch(e){$('foodSearchResults').innerHTML='<p style="color:var(--red);font-size:.78rem;padding:.5rem">Search failed. Try again.</p>'}
}

// ── SERVING SIZE MODAL ──
const UNIT_TO_GRAMS={g:1,ml:1,oz:28.35,floz:29.57,cup:240,serving:100};
let pendingFood=null;

function openServingModal(idx){
  pendingFood=window._foodResults[idx];if(!pendingFood)return;
  $('servingFoodName').textContent=pendingFood.name;
  $('servingAmount').value=1;
  const sugg=(pendingFood.servingSuggestion||'').toLowerCase();
  let defaultUnit='serving';
  if(sugg.includes('ml')||sugg.includes('fl'))defaultUnit='ml';
  else if(sugg.includes('oz'))defaultUnit='floz';
  else if(sugg.includes('cup'))defaultUnit='cup';
  else if(sugg.includes('g'))defaultUnit='g';
  $('servingUnit').value=defaultUnit;
  if(defaultUnit==='g')$('servingAmount').value=100;
  else if(defaultUnit==='ml')$('servingAmount').value=250;
  else if(defaultUnit==='floz')$('servingAmount').value=12;
  else if(defaultUnit==='cup')$('servingAmount').value=1;
  else if(defaultUnit==='oz')$('servingAmount').value=4;
  else $('servingAmount').value=1;
  $('servingSuggestion').innerHTML=pendingFood.servingSuggestion?`Suggested: <strong>${esc(pendingFood.servingSuggestion)}</strong>`:'';
  updateServingPreview();
  $('servingModal').classList.add('open');
}
function closeServingModal(){$('servingModal').classList.remove('open');pendingFood=null}
function updateServingPreview(){
  if(!pendingFood)return;
  const amount=parseFloat($('servingAmount').value)||1;
  const unit=$('servingUnit').value;
  const grams=amount*(UNIT_TO_GRAMS[unit]||100);
  const mult=grams/100;
  $('servingPreview').innerHTML=`<strong>${Math.round(pendingFood.calPer100*mult)} cal</strong> · P:${Math.round(pendingFood.proteinPer100*mult)}g · C:${Math.round(pendingFood.carbsPer100*mult)}g · F:${Math.round(pendingFood.fatPer100*mult)}g → <span style="color:var(--gold)">Meal ${activeMeal}</span>`;
}
async function confirmServing(){
  if(!pendingFood)return;
  const amount=parseFloat($('servingAmount').value)||1;
  const unit=$('servingUnit').value;
  const unitLabels={g:'g',ml:'ml',oz:'oz',floz:'fl oz',cup:'cup(s)',serving:'serving(s)'};
  const grams=amount*(UNIT_TO_GRAMS[unit]||100);
  const mult=grams/100;
  const food={
    name:pendingFood.name,
    cal:Math.round(pendingFood.calPer100*mult),
    protein:Math.round(pendingFood.proteinPer100*mult),
    carbs:Math.round(pendingFood.carbsPer100*mult),
    fat:Math.round(pendingFood.fatPer100*mult),
    serving:amount+' '+(unitLabels[unit]||unit)
  };
  await saveFoodItem(food);
  closeServingModal();closeFoodSearch();
}

async function saveFoodItem(food){
  const today=getTodayStr();
  if(!userData.foodLog)userData.foodLog={};
  let dayLog=getDayLog(today);
  // Ensure meal-based structure
  if(!dayLog.meals)dayLog={meals:{},mealCount:getMealCount()};
  if(!dayLog.meals[activeMeal])dayLog.meals[activeMeal]=[];
  dayLog.meals[activeMeal].push(food);
  setDayLog(today,dayLog);
  await saveUser({foodLog:userData.foodLog});
  // Achievements
  const totalItems=getDayItemCount(dayLog);
  if(totalItems===1)unlockAch('food_log_1');
  const days=Object.keys(userData.foodLog).filter(k=>{
    const d=userData.foodLog[k];
    if(Array.isArray(d))return d.length>0;
    if(d&&d.meals)return getDayItemCount(d)>0;
    return false;
  }).length;
  if(days>=7)unlockAch('food_log_7');
  if(days>=14)unlockAch('food_log_14');
  if(days>=30)unlockAch('food_log_30');
  if(days>=60)unlockAch('food_log_60');
  // All meals filled check
  const mc=getMealCount();const allFilled=Array.from({length:mc},(_,i)=>(dayLog.meals[i+1]||[]).length>0).every(Boolean);
  if(allFilled)unlockAch('all_meals');
  // Protein target check
  const t=calcTDEE();if(t){const totals=getDayTotals(dayLog);if(totals.p>=t.proteinG)unlockAch('protein_hit')}
  renderNutritionPage();toast(`${food.name} → Meal ${activeMeal}`);
}

// ── BARCODE SCANNER ──
let html5Scanner=null;
async function openScanner(){
  $('scannerModal').classList.add('open');
  $('scannerStatus').textContent='Starting camera...';
  $('scannerStatus').style.color='var(--muted)';
  $('scannerManualRow').style.display='flex';
  $('scannerManualInput').value='';
  if(html5Scanner){try{await html5Scanner.clear()}catch(e){}}
  $('scannerReader').innerHTML='';
  try{
    html5Scanner=new Html5Qrcode('scannerReader');
    await html5Scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:150},aspectRatio:1.5},
      async(decodedText)=>{await closeScanner();await lookupBarcode(decodedText)},()=>{});
    $('scannerStatus').textContent='📷 Point at barcode...';$('scannerStatus').style.color='var(--green)';
  }catch(e){
    $('scannerStatus').style.color='var(--red)';
    $('scannerStatus').textContent=e.toString().includes('Permission')?'Camera denied. Enter barcode below:':'Camera unavailable. Enter barcode below:';
  }
}
async function closeScanner(){
  if(html5Scanner){try{const s=html5Scanner.getState();if(s===Html5QrcodeScannerState.SCANNING||s===Html5QrcodeScannerState.PAUSED)await html5Scanner.stop();await html5Scanner.clear()}catch(e){}html5Scanner=null}
  $('scannerReader').innerHTML='';$('scannerStatus').style.color='';$('scannerModal').classList.remove('open');
}
async function scannerManualLookup(){const code=$('scannerManualInput').value.trim();if(!code){toast('Enter a barcode');return}closeScanner();await lookupBarcode(code)}
async function lookupBarcode(code){
  toast('Looking up '+code+'...');
  try{
    const res=await fetch(`${OFF_API}/api/v2/product/${code}.json`);
    const data=await res.json();
    if(data.status!==1||!data.product){toast('Product not found');return}
    const p=data.product;const nut=p.nutriments||{};
    window._foodResults=[{name:String(p.product_name||'Unknown').slice(0,100),calPer100:Math.round(nut['energy-kcal_100g']||0),proteinPer100:Math.round(nut.proteins_100g||0),carbsPer100:Math.round(nut.carbohydrates_100g||0),fatPer100:Math.round(nut.fat_100g||0),servingSuggestion:p.serving_size||''}];
    unlockAch('scan_1');
    const sc=(userData.scanCount||0)+1;await saveUser({scanCount:sc});if(sc>=5)unlockAch('scan_5');
    openServingModal(0);
  }catch(e){toast('Lookup failed')}
}

// ── MANUAL FOOD ENTRY ──
function openManualFood(){$('manualFoodModal').classList.add('open');$('mfName').value='';$('mfCal').value='';$('mfProtein').value='';$('mfCarbs').value='';$('mfFat').value='';$('mfServing').value=''}
function closeManualFood(){$('manualFoodModal').classList.remove('open')}
async function saveManualFood(){
  const name=$('mfName').value.trim();if(!name){toast('Enter food name');return}
  const food={name,cal:parseInt($('mfCal').value)||0,protein:parseInt($('mfProtein').value)||0,carbs:parseInt($('mfCarbs').value)||0,fat:parseInt($('mfFat').value)||0,serving:$('mfServing').value.trim()||'manual'};
  await saveFoodItem(food);closeManualFood();
}

async function removeMealItem(meal,idx){
  if(!confirm('Remove this item?'))return;
  const today=getTodayStr();
  const dayLog=getDayLog(today);
  if(dayLog.meals[meal])dayLog.meals[meal].splice(idx,1);
  setDayLog(today,dayLog);
  await saveUser({foodLog:userData.foodLog});
  renderNutritionPage();toast('Removed.');
}

// ── MACRO ADJUSTMENT MODAL ──
function openMacroModal(){
  const t=calcTDEE();const cm=userData.customMacros||{};const st=userData.stats||{};
  let h=`<h2>⚙️ Nutrition Settings</h2>`;
  h+=`<div class="settings-section" style="margin-top:0">BODY STATS</div>`;
  h+=`<div class="settings-row-fields"><div class="m-field" style="flex:1"><label>Height</label><input type="text" id="macroHeight" value="${st.height||''}" placeholder="5'10&quot;"></div><div class="m-field" style="flex:1"><label>Weight (lbs)</label><input type="number" id="macroWeight" value="${st.weight||''}"></div></div>`;
  h+=`<div class="settings-row-fields"><div class="m-field" style="flex:1"><label>Age</label><input type="number" id="macroAge" value="${st.age||''}"></div><div class="m-field" style="flex:1"><label>Sex</label><select id="macroSex"><option value="male"${(st.sex||'male')==='male'?' selected':''}>Male</option><option value="female"${st.sex==='female'?' selected':''}>Female</option></select></div></div>`;
  h+=`<div class="settings-section">ACTIVITY & GOAL</div>`;
  h+=`<div class="m-field"><label>Activity Level</label><select id="macroActivity">${ACTIVITY_LEVELS.map(a=>`<option value="${a.id}"${(userData.activityLevel||'moderate')===a.id?' selected':''}>${a.name} — ${a.desc}</option>`).join('')}</select></div>`;
  h+=`<div class="m-field"><label>Daily Steps Estimate</label><select id="macroSteps">
    <option value="2000"${(userData.dailySteps||'')==='2000'?' selected':''}>~2,000 (mostly sitting)</option>
    <option value="4000"${(userData.dailySteps||'')==='4000'?' selected':''}>~4,000 (some walking)</option>
    <option value="6000"${(userData.dailySteps||'6000')==='6000'?' selected':''}>~6,000 (moderate)</option>
    <option value="8000"${(userData.dailySteps||'')==='8000'?' selected':''}>~8,000 (active)</option>
    <option value="10000"${(userData.dailySteps||'')==='10000'?' selected':''}>~10,000 (very active)</option>
    <option value="12000"${(userData.dailySteps||'')==='12000'?' selected':''}>~12,000+</option>
  </select></div>`;
  h+=`<div class="m-field"><label>Goal</label><select id="macroGoal">
    ${['Maintenance','Fat Loss','Aggressive Cut','Lean Bulk','Bulk','Recomp'].map(g=>`<option value="${g}"${(userData.nutritionGoal||userData.goal||'')==g?' selected':''}>${g}</option>`).join('')}
  </select></div>`;
  h+=`<div class="settings-section">CUSTOM OVERRIDES</div>`;
  h+=`<label class="toggle-row" style="margin:.3rem 0"><input type="checkbox" class="toggle-cb" id="macroCustomToggle" onchange="toggleMacroFields()" ${cm&&cm.enabled?'checked':''}><span>Override auto-calculated macros</span></label>`;
  h+=`<div class="macro-custom-field"><div class="m-field"><label>Calories</label><input type="number" id="macroCalories" value="${cm.calories||(t?t.target:2000)}"></div></div>`;
  h+=`<div class="settings-row-fields macro-custom-field"><div class="m-field" style="flex:1"><label>Protein (g)</label><input type="number" id="macroProtein" value="${cm.protein||(t?t.proteinG:150)}"></div><div class="m-field" style="flex:1"><label>Carbs (g)</label><input type="number" id="macroCarbs" value="${cm.carbs||(t?t.carbG:200)}"></div><div class="m-field" style="flex:1"><label>Fat (g)</label><input type="number" id="macroFat" value="${cm.fat||(t?t.fatG:60)}"></div></div>`;
  if(t){h+=`<div style="font-family:var(--font-mono);font-size:.62rem;color:var(--muted);margin-top:.4rem;text-align:center">BMR: ${t.bmr} · TDEE: ${t.tdee}${t.stepBonus?' (+'+t.stepBonus+' steps)':''} · Target: ${t.target}</div>`}
  h+=`<div class="m-actions" style="margin-top:.8rem"><button class="m-cancel" onclick="closeMacroModal()">Cancel</button><button class="m-save-btn" onclick="saveMacroSettings()">Save</button></div>`;
  $('macroModal').querySelector('.modal').innerHTML=h;
  toggleMacroFields();
  $('macroModal').classList.add('open');
}
function closeMacroModal(){$('macroModal').classList.remove('open')}
function toggleMacroFields(){const c=$('macroCustomToggle').checked;document.querySelectorAll('.macro-custom-field').forEach(el=>el.style.opacity=c?'1':'.4');document.querySelectorAll('.macro-custom-field input').forEach(el=>el.disabled=!c)}
async function saveMacroSettings(){
  const stats={...(userData.stats||{}),
    height:$('macroHeight').value.trim(),
    weight:$('macroWeight').value.trim(),
    age:$('macroAge').value.trim(),
    sex:$('macroSex').value
  };
  const cm=$('macroCustomToggle').checked?{enabled:true,calories:parseInt($('macroCalories').value)||0,protein:parseInt($('macroProtein').value)||0,carbs:parseInt($('macroCarbs').value)||0,fat:parseInt($('macroFat').value)||0}:{enabled:false};
  await saveUser({stats,activityLevel:$('macroActivity').value,dailySteps:$('macroSteps').value,nutritionGoal:$('macroGoal').value,customMacros:cm});
  closeMacroModal();renderNutritionPage();toast('Nutrition settings saved!');
}

// ── RANK INFO ──
function renderRankInfo(){
  const er=getEffectiveRank();
  let h=`<div class="rank-info-header"><div class="ri-label">[ SYSTEM STATUS ]</div><div class="ri-current" style="color:${er.color}">${er.name}</div><div class="ri-title" style="color:${er.color}">${(er.title&&er.title[userData.class])||er.name}</div><div class="ri-xp">${userData.xp} XP</div></div><div class="ri-divider"></div>`;
  RANKS.forEach(r=>{const isCurrent=er.name===r.name;const isLocked=userData.xp<r.min;
    h+=`<div class="ri-rank ${isCurrent?'current':''} ${isLocked?'locked':''}"><div class="ri-rank-badge" style="color:${r.color};border-color:${isLocked?'var(--border)':r.color}">${r.name}</div><div class="ri-rank-info"><div class="ri-rank-title" style="color:${isLocked?'var(--dim)':r.color}">${(r.title&&r.title[userData.class])||r.name}</div><div class="ri-rank-xp">${r.min} XP required</div><div class="ri-rank-lore">${isLocked?'???':r.lore}</div>${r.trial?`<div class="ri-rank-trial">${isLocked?'🔒 Trial required':'⚔️ Trial: '+RANK_TRIALS[r.trial].name}</div>`:''}</div>${isCurrent?'<div class="ri-you">◄ YOU</div>':''}</div>`});
  return h;
}
