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
  // Normalize smart quotes/apostrophes from mobile keyboards
  const hNorm=hRaw.replace(/[\u2018\u2019\u0060\u00B4]/g,"'").replace(/[\u201C\u201D]/g,'"').trim();
  if(hNorm.includes("'")){const p=hNorm.replace(/"/g,'').split("'");const ft=parseInt(p[0])||0;const inch=parseInt(p[1])||0;hCm=(ft*12+inch)*2.54}
  else if(hNorm.toLowerCase().includes('cm'))hCm=parseFloat(hNorm);
  else{const n=parseFloat(hNorm);if(!n)return null;hCm=n>100?n:n>10?n*2.54:(n*12)*2.54} // >100=cm, 10-100=inches, <10=feet
  if(!hCm)return null;
  const wKg=w*0.453592,sex=(st.sex||'male');
  const bmr=sex==='female'?(10*wKg+6.25*hCm-5*a-161):(10*wKg+6.25*hCm-5*a+5);
  const al=ACTIVITY_LEVELS.find(x=>x.id===(userData.activityLevel||'moderate'))||ACTIVITY_LEVELS[2];
  // Add step bonus
  const dailySteps=parseInt(userData.dailySteps)||0;
  const stepBonus=stepsToCalories(dailySteps);
  const tdee=Math.round(bmr*al.mult)+stepBonus;
  const goal=userData.nutritionGoal||userData.goal||'';
  let target=tdee,deficit=0;
  // Order: most specific first (Aggressive contains 'Cut' so check it before Fat Loss)
  if(goal.includes('Aggressive'))      {deficit=-750;target=tdee-750}
  else if(goal.includes('Moderate'))   {deficit=-500;target=tdee-500}
  else if(goal.includes('Fat Loss'))   {deficit=-400;target=tdee-400}
  else if(goal.includes('Mild'))       {deficit=-250;target=tdee-250}
  else if(goal.includes('Lean Bulk'))  {deficit=250;target=tdee+250}
  else if(goal.includes('Bulk'))       {deficit=500;target=tdee+500}
  else if(goal.includes('Recomp'))     {deficit=-100;target=tdee-100}
  else if(goal.includes('Muscle Gain')){deficit=300;target=tdee+300}
  const cm=userData.customMacros;
  const bmrR=Math.round(bmr);
  if(cm&&cm.enabled){
    const cTarget=cm.calories||target;
    return{bmr:bmrR,tdee,stepBonus,target:cTarget,maintenance:tdee,deficit,proteinG:cm.protein||Math.round(w*1),fatG:cm.fat||Math.round(cTarget*0.25/9),carbG:cm.carbs||Math.round((cTarget-(cm.protein||Math.round(w*1))*4-(cm.fat||Math.round(cTarget*0.25/9))*9)/4),goal:goal||'Maintenance',custom:true,actName:al.name,steps:dailySteps};
  }
  const proteinG=Math.round(w*1);
  const fatG=Math.round(target*0.25/9);
  const carbG=Math.round((target-proteinG*4-fatG*9)/4);
  return{bmr:bmrR,tdee,stepBonus,target,maintenance:tdee,deficit,proteinG:Math.max(proteinG,50),fatG:Math.max(fatG,30),carbG:Math.max(carbG,50),goal:goal||'Maintenance',custom:false,actName:al.name,steps:dailySteps};
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
// Deficit safety check — evaluates the ACTUAL target vs maintenance, so it fires
// whether the number came from a preset OR a custom override. Informs, never scolds.
function deficitWarning(t){
  if(!t||!t.maintenance||!t.target)return '';
  const deficit=t.target-t.maintenance; // negative = cut
  if(deficit>=0)return '';
  const pctBelow=Math.abs(deficit)/t.maintenance*100;
  const bigPct=pctBelow>=20;
  const lowFloor=t.target<1500;
  if(!bigPct&&!lowFloor)return '';
  let msg='',severe=false;
  if(t.target<1200){
    severe=true;
    msg=`${t.target} cal a day is very low. Staying this low risks muscle loss, hormone disruption and rebound weight gain. Consider a smaller deficit.`;
  }else if(pctBelow>=25){
    severe=true;
    msg=`That's a ${Math.round(pctBelow)}% deficit, steeper than most people can hold. Expect training, sleep and muscle retention to suffer.`;
  }else if(lowFloor){
    msg=`${t.target} cal a day is on the low side. Workable short-term, but hard to sustain and hard to hit ${t.proteinG} g of protein.`;
  }else{
    msg=`Aggressive cut. Fine for a few weeks. Keep protein high and watch your strength and sleep.`;
  }
  return `<button type="button" class="deficit-warn${severe?' severe':''}" onclick="openDeficitInfo()"><span class="dw-i">${icon('info',16)}</span><span class="dw-msg">${msg}</span><span class="dw-learn">Risks</span></button>`;
}
function openDeficitInfo(){const m=$('deficitInfoModal');if(m)m.classList.add('open')}
function renderNutritionPage(){
  const today=getTodayStr();
  const viewDate=foodLogDate||today;
  const isToday=viewDate===today;
  const t=calcTDEE();
  const dayLog=getDayLog(viewDate);
  const totals=getDayTotals(dayLog);
  const mealCount=getMealCount();
  const viewDateObj=new Date(viewDate+'T12:00:00');
  const dateLabel=viewDateObj.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  const dayWord=isToday?'Today':viewDate===getDateStr(new Date(Date.now()-86400000))?'Yesterday':viewDateObj.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  let h=`<div class="pg-head"><div><h1 class="pg-title">Nutrition</h1><div class="mist">${dateLabel}</div></div>
    <div class="nu-date"><button class="icon-btn" aria-label="Previous day" onclick="shiftFoodDate(-1)">${icon('left',18)}</button>
    <button class="nu-date-l" onclick="foodLogDate=null;renderNutritionPage()" ${isToday?'disabled':''}>${dayWord}</button>
    <button class="icon-btn" aria-label="Next day" onclick="shiftFoodDate(1)" ${isToday?'disabled':''}>${icon('chev',18)}</button></div></div>`;
  if(!t){
    h+=`<div class="panel nu-card"><div class="sec">Set up your targets</div><p class="mist" style="margin:6px 0 14px">Add your height, weight and age to get calorie and macro targets.</p>
      <button class="btn-p" onclick="openMacroModal()">Set up nutrition</button></div>`;
    h+=recentDaysHtml(viewDate);
    $('nutritionContent').innerHTML=h;return;
  }
  const calOver=totals.cal>t.target;const left=t.target-totals.cal;
  const tags=[t.custom?'Custom':'Auto',t.goal,t.actName,t.steps?`About ${fmtN(t.steps)} steps`:''].filter(Boolean);
  h+=`<div class="panel nu-card"><div class="nu-tags">${tags.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>
    <div class="nu-cal"><div><span class="num nu-big">${fmtN(totals.cal)}</span><span class="mist nu-of"> / ${fmtN(t.target)} cal</span></div>
    <div class="nu-left${calOver?' over':''}"><div class="num">${fmtN(Math.abs(left))}</div><div class="mist sm">${calOver?'over':'left'}</div></div></div>
    <div class="track nu-track"><div class="fill${calOver?' over':''}" style="width:${Math.min(100,totals.cal/t.target*100)}%"></div></div>
    <div class="mist sm nu-maint">${t.deficit?`Maintenance is ${fmtN(t.maintenance)}. You're eating ${fmtN(Math.abs(t.deficit))} ${t.deficit<0?'under':'over'} it for a ${fmtN(t.target)} target.`:`Maintenance and target: ${fmtN(t.target)} cal.`}</div>
    ${deficitWarning(t)}
    <div class="nu-macros">${nuMacro('Protein',totals.p,t.proteinG,'pro')}${nuMacro('Carbs',totals.c,t.carbG,'carb')}${nuMacro('Fat',totals.f,t.fatG,'fat')}</div>
    <div class="nu-btns"><button class="btn-s" onclick="openMacroModal()">${icon('gear',16)} Adjust targets</button><button class="btn-s" onclick="openMealCountModal()">${icon('note',16)} ${mealCount} meals</button></div></div>`;
  for(let m=1;m<=mealCount;m++){
    const items=dayLog.meals[m]||[];
    const mt=getMealTotals(items);
    const mealTarget=Math.round(t.target/mealCount);
    const mealPct=mealTarget>0?Math.min(100,(mt.cal/mealTarget)*100):0;
    const open=items.length>0||(isToday&&m===firstEmptyMeal(dayLog,mealCount));
    h+=`<div class="panel meal-section${open?' open':''}">
      <button class="meal-header" aria-expanded="${open}" onclick="toggleMealSection(this)">
        <span class="meal-h-t"><span class="sec">${esc(mealName(m))}</span><span class="num mist">${fmtN(mt.cal)} cal</span></span>
        <span class="mist sm">${items.length?`P ${mt.p} g, C ${mt.c} g, F ${mt.f} g`:'Nothing logged yet'}</span>
        <span class="meal-chev">${icon('chev',18)}</span>
        <span class="track"><span class="fill" style="width:${mealPct}%;display:block"></span></span>
      </button>
      <div class="meal-body">`;
    h+=items.map((f,i)=>`<div class="food-item"><div class="food-item-info"><div class="food-item-name">${esc(f.name)}</div>
        <div class="mist sm">${f.serving?esc(f.serving)+', ':''}${fmtN(f.cal)} cal. P ${num(f.protein)}, C ${num(f.carbs)}, F ${num(f.fat)}</div></div>
        <button class="ring" aria-label="Edit ${esc(f.name)}" onclick="${isToday?`editLoggedFood(${m},${i})`:`editPastLoggedFood('${viewDate}',${m},${i})`}">${icon('edit',16)}</button>
        <button class="ring" aria-label="Remove ${esc(f.name)}" onclick="${isToday?`removeMealItem(${m},${i})`:`removePastMealItem('${viewDate}',${m},${i})`}">${icon('x',16)}</button></div>`).join('');
    if(isToday){
      h+=`<div class="meal-add-btns">
        <button class="food-btn" onclick="activeMeal=${m};openFoodSearch()">${icon('search',18)}<span>Search</span></button>
        <button class="food-btn" onclick="activeMeal=${m};openScanner()">${icon('scan',18)}<span>Scan</span></button>
        <button class="food-btn" onclick="activeMeal=${m};openManualFood()">${icon('edit',18)}<span>Manual</span></button>
        <button class="food-btn" onclick="activeMeal=${m};openRecentFoods()">${icon('clock',18)}<span>Recent</span></button></div>`;
    }else{
      h+=`<div class="meal-add-btns one"><button class="food-btn" onclick="activeMeal=${m};editPastMeal('${viewDate}')">${icon('plus',18)}<span>Add to this meal</span></button></div>`;
    }
    h+=`</div></div>`;
  }
  const pLeft=t.proteinG-totals.p;
  if(isToday&&left>100)h+=`<div class="nu-remain">${fmtN(left)} cal left, ${pLeft>0?pLeft+' g protein to go':'protein goal hit'}.</div>`;
  h+=recentDaysHtml(viewDate);
  $('nutritionContent').innerHTML=h;
}

// ═══════════ TDEE SETUP (first time) ═══════════
function renderTDEESetup(){
  const st=userData.stats||{};
  return`<div class="page-title">Nutrition setup</div>
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
  const mc=getMealCount();const names=userData.mealNames||{};
  let h=`<h2>Meals</h2><div class="mist" style="margin-bottom:10px">How many meals do you log a day?</div>
    <div class="meal-count-grid">${[2,3,4,5,6].map(n=>`<button class="chip${n===mc?' on':''}" onclick="setMealCount(${n})">${n}</button>`).join('')}</div>
    <div class="settings-section">Meal names</div><div class="mist sm" style="margin:-4px 0 12px">Optional. Leave blank to keep Meal 1, Meal 2 and so on.</div>`;
  for(let m=1;m<=mc;m++)h+=`<div class="m-field"><label for="mealName${m}">Meal ${m}</label><input type="text" id="mealName${m}" maxlength="24" placeholder="Meal ${m}" value="${esc(names[m]||'')}"></div>`;
  h+=`<div class="m-actions"><button class="m-cancel" onclick="closeMealCountModal()">Cancel</button><button class="m-save-btn" onclick="saveMealNames()">Save</button></div>`;
  $('mealCountModal').querySelector('.modal').innerHTML=h;
  $('mealCountModal').classList.add('open');
}
function closeMealCountModal(){$('mealCountModal').classList.remove('open')}
async function setMealCount(n){
  await saveUser({mealCount:n});
  openMealCountModal();renderNutritionPage();
}

function toggleMealSection(btn){
  const sec=btn.closest('.meal-section');if(!sec)return;
  const open=!sec.classList.contains('open');sec.classList.toggle('open',open);btn.setAttribute('aria-expanded',open);
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
      return{name:String(p.product_name||'Unknown').slice(0,100),calPer100:Math.round(nut['energy-kcal_100g']||nut['energy-kcal']||0),proteinPer100:Math.round(nut.proteins_100g||0),carbsPer100:Math.round(nut.carbohydrates_100g||0),fatPer100:Math.round(nut.fat_100g||0),servingSuggestion:p.serving_size||'',servingGrams:parseServingGrams(p)};
    });
    $('foodSearchResults').innerHTML=window._foodResults.map((f,i)=>
      `<div class="food-result" onclick="openServingModal(${i})"><div class="food-result-name">${esc(f.name)}</div><div class="food-result-macros">${f.calPer100} cal · P:${f.proteinPer100}g C:${f.carbsPer100}g F:${f.fatPer100}g <span style="color:var(--dim)">per 100g</span>${f.servingSuggestion?'<br><span style="color:var(--gold)">Serving: '+esc(f.servingSuggestion)+'</span>':''}</div></div>`
    ).join('');
  }catch(e){$('foodSearchResults').innerHTML='<p style="color:var(--red);font-size:.78rem;padding:.5rem">Search failed. Try again.</p>'}
}

// ── SERVING SIZE MODAL ──
// Open Food Facts gives serving_quantity (numeric, g or ml). Fall back to parsing
// the label, e.g. "2 slices (56 g)" → 56. Returns grams or 0 if unknown.
function parseServingGrams(p){
  const q=parseFloat(p.serving_quantity);
  if(q>0&&q<5000)return q;
  const m=String(p.serving_size||'').match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  return m?parseFloat(m[1]):0;
}
const UNIT_TO_GRAMS={g:1,ml:1,oz:28.35,floz:29.57,cup:240,serving:100};
let pendingFood=null;

function openServingModal(idx){
  pendingFood=window._foodResults[idx];if(!pendingFood)return;
  $('servingFoodName').textContent=pendingFood.name;
  $('servingAmount').value=1;
  const sugg=(pendingFood.servingSuggestion||'').toLowerCase();
  // Known serving size → default to exactly 1 recommended serving
  if(pendingFood.servingGrams>0){
    $('servingUnit').value='serving';
    $('servingAmount').value=1;
    $('servingSuggestion').innerHTML=`Recommended serving: <strong>${esc(pendingFood.servingSuggestion||pendingFood.servingGrams+'g')}</strong> · defaulted to 1 serving`;
    updateServingPreview();
    $('servingModal').classList.add('open');
    return;
  }
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
function servingUnitGrams(unit){
  if(unit==='serving'&&pendingFood&&pendingFood.servingGrams>0)return pendingFood.servingGrams;
  return UNIT_TO_GRAMS[unit]||100;
}
function closeServingModal(){$('servingModal').classList.remove('open');pendingFood=null}
function updateServingPreview(){
  if(!pendingFood)return;
  const amount=parseFloat($('servingAmount').value)||1;
  const unit=$('servingUnit').value;
  const grams=amount*servingUnitGrams(unit);
  const mult=grams/100;
  $('servingPreview').innerHTML=`<strong>${Math.round(pendingFood.calPer100*mult)} cal</strong> · P:${Math.round(pendingFood.proteinPer100*mult)}g · C:${Math.round(pendingFood.carbsPer100*mult)}g · F:${Math.round(pendingFood.fatPer100*mult)}g → <span style="color:var(--gold)">Meal ${activeMeal}</span>`;
}
async function confirmServing(){
  if(!pendingFood)return;
  const amount=parseFloat($('servingAmount').value)||1;
  const unit=$('servingUnit').value;
  const unitLabels={g:'g',ml:'ml',oz:'oz',floz:'fl oz',cup:'cup(s)',serving:'serving(s)'};
  const grams=amount*servingUnitGrams(unit);
  const mult=grams/100;
  const food={
    name:pendingFood.name,
    cal:Math.round(pendingFood.calPer100*mult),
    protein:Math.round(pendingFood.proteinPer100*mult),
    carbs:Math.round(pendingFood.carbsPer100*mult),
    fat:Math.round(pendingFood.fatPer100*mult),
    serving:amount+' '+(unitLabels[unit]||unit)+(unit==='serving'&&pendingFood.servingGrams>0?' ('+Math.round(pendingFood.servingGrams*amount)+'g)':'')
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
  // Track in recent foods (keep last 300 unique by name — the daily food log itself is trimmed to 30 days)
  const recent=userData.recentFoods||[];
  const exists=recent.findIndex(r=>r.name===food.name);
  if(exists>=0)recent.splice(exists,1);
  recent.unshift({name:food.name,cal:food.cal,protein:food.protein,carbs:food.carbs,fat:food.fat,serving:food.serving});
  if(recent.length>300)recent.length=300;
  await saveUser({foodLog:userData.foodLog,recentFoods:recent});
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
    $('scannerStatus').textContent='Point at barcode...';$('scannerStatus').style.color='var(--green)';
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
    window._foodResults=[{name:String(p.product_name||'Unknown').slice(0,100),calPer100:Math.round(nut['energy-kcal_100g']||0),proteinPer100:Math.round(nut.proteins_100g||0),carbsPer100:Math.round(nut.carbohydrates_100g||0),fatPer100:Math.round(nut.fat_100g||0),servingSuggestion:p.serving_size||'',servingGrams:parseServingGrams(p)}];
    unlockAch('scan_1');
    const sc=(userData.scanCount||0)+1;await saveUser({scanCount:sc});if(sc>=5)unlockAch('scan_5');if(sc>=25)unlockAch('scan_25');
    openServingModal(0);
  }catch(e){toast('Lookup failed')}
}

// ── MANUAL FOOD ENTRY ──
function openManualFood(){$('manualFoodModal').classList.add('open');$('mfName').value='';$('mfCal').value='';$('mfProtein').value='';$('mfCarbs').value='';$('mfFat').value='';$('mfServing').value=''}
function closeManualFood(){$('manualFoodModal').classList.remove('open');window._pastFoodDate=null}
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

async function removePastMealItem(date,meal,idx){
  if(!confirm('Remove this item?'))return;
  const dayLog=getDayLog(date);
  if(dayLog.meals[meal])dayLog.meals[meal].splice(idx,1);
  setDayLog(date,dayLog);
  await saveUser({foodLog:userData.foodLog});
  renderNutritionPage();toast('Removed.');
}

// ── EDIT LOGGED FOOD ──
let editLoggedFoodCtx=null; // { date, meal, idx }
function editLoggedFood(meal,idx){
  openEditLoggedFood(getTodayStr(),meal,idx);
}
function editPastLoggedFood(date,meal,idx){
  openEditLoggedFood(date,meal,idx);
}
function openEditLoggedFood(date,meal,idx){
  const dayLog=getDayLog(date);
  const f=dayLog.meals&&dayLog.meals[meal]&&dayLog.meals[meal][idx];
  if(!f){toast('Item not found');return}
  editLoggedFoodCtx={date,meal,idx,original:{...f}};
  const modal=$('editFoodModal');if(!modal)return;
  let h=`<h2>Edit Logged Food</h2>
    <p style="color:var(--muted);font-size:.7rem;margin-bottom:.7rem">${date===getTodayStr()?'Today':new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · Meal ${meal}</p>
    <div class="m-field"><label>Food name</label><input type="text" id="ef-name" value="${esc(f.name||'')}"></div>
    <div class="m-field"><label>Serving / Weight</label><input type="text" id="ef-serving" value="${esc(f.serving||'')}" placeholder="e.g. 150g, 1 cup"></div>
    <div class="m-row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:.4rem">
      <div class="m-field"><label>Calories</label><input type="number" id="ef-cal" value="${f.cal||0}" inputmode="numeric"></div>
      <div class="m-field"><label>Protein (g)</label><input type="number" id="ef-protein" value="${f.protein||0}" inputmode="decimal" step="0.1"></div>
    </div>
    <div class="m-row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="m-field"><label>Carbs (g)</label><input type="number" id="ef-carbs" value="${f.carbs||0}" inputmode="decimal" step="0.1"></div>
      <div class="m-field"><label>Fat (g)</label><input type="number" id="ef-fat" value="${f.fat||0}" inputmode="decimal" step="0.1"></div>
    </div>
    <button class="m-save-btn" onclick="scaleEditedFood()" style="background:var(--surface2);color:var(--accent2);font-size:.74rem;padding:8px;margin-top:.5rem;width:100%">Auto-scale macros from new weight</button>
    <p style="color:var(--dim);font-size:.62rem;margin-top:4px;text-align:center">Tap if you only changed the weight — recalculates macros proportionally</p>
    <div class="m-actions" style="margin-top:.7rem">
      <button class="m-cancel" onclick="closeEditLoggedFood()">Cancel</button>
      <button class="m-save-btn" onclick="saveEditedLoggedFood()">Save Changes</button>
    </div>`;
  modal.querySelector('.modal').innerHTML=h;
  modal.classList.add('open');
}
function closeEditLoggedFood(){$('editFoodModal').classList.remove('open');editLoggedFoodCtx=null}
function scaleEditedFood(){
  if(!editLoggedFoodCtx)return;
  const orig=editLoggedFoodCtx.original;
  const oldServing=orig.serving||'';
  const newServing=$('ef-serving').value.trim();
  const oldGrams=parseFloat(oldServing);
  const newGrams=parseFloat(newServing);
  if(!oldGrams||!newGrams||oldGrams<=0){
    toast('Need numeric weights in both servings (e.g. "100g" → "150g")');
    return;
  }
  const ratio=newGrams/oldGrams;
  $('ef-cal').value=Math.round((orig.cal||0)*ratio);
  $('ef-protein').value=Math.round((orig.protein||0)*ratio*10)/10;
  $('ef-carbs').value=Math.round((orig.carbs||0)*ratio*10)/10;
  $('ef-fat').value=Math.round((orig.fat||0)*ratio*10)/10;
  toast(`Scaled ${ratio.toFixed(2)}× from ${oldGrams}g to ${newGrams}g`);
}
async function saveEditedLoggedFood(){
  if(!editLoggedFoodCtx)return;
  const {date,meal,idx}=editLoggedFoodCtx;
  const dayLog=getDayLog(date);
  if(!dayLog.meals||!dayLog.meals[meal]||!dayLog.meals[meal][idx]){toast('Item gone');closeEditLoggedFood();return}
  const updated={
    name:$('ef-name').value.trim()||'Food',
    serving:$('ef-serving').value.trim(),
    cal:parseInt($('ef-cal').value)||0,
    protein:parseFloat($('ef-protein').value)||0,
    carbs:parseFloat($('ef-carbs').value)||0,
    fat:parseFloat($('ef-fat').value)||0
  };
  dayLog.meals[meal][idx]={...dayLog.meals[meal][idx],...updated};
  setDayLog(date,dayLog);
  await saveUser({foodLog:userData.foodLog});
  closeEditLoggedFood();
  renderNutritionPage();
  toast('✓ Updated');
}

function editPastMeal(date){
  // Open manual entry modal but save to the past date
  $('manualFoodModal').classList.add('open');
  $('mfName').value='';$('mfCal').value='';$('mfProtein').value='';$('mfCarbs').value='';$('mfFat').value='';$('mfServing').value='';
  // Override save to target the past date
  window._pastFoodDate=date;
}
// Patch saveManualFood to handle past dates
const _origSaveManualFood=saveManualFood;
async function saveManualFood(){
  const pastDate=window._pastFoodDate;
  if(pastDate){
    const name=$('mfName').value.trim();if(!name){toast('Enter food name');return}
    const food={name,cal:parseInt($('mfCal').value)||0,protein:parseInt($('mfProtein').value)||0,carbs:parseInt($('mfCarbs').value)||0,fat:parseInt($('mfFat').value)||0,serving:$('mfServing').value.trim()||'manual'};
    if(!userData.foodLog)userData.foodLog={};
    let dayLog=getDayLog(pastDate);
    if(!dayLog.meals)dayLog={meals:{},mealCount:getMealCount()};
    if(!dayLog.meals[activeMeal])dayLog.meals[activeMeal]=[];
    dayLog.meals[activeMeal].push(food);
    setDayLog(pastDate,dayLog);
    await saveUser({foodLog:userData.foodLog});
    closeManualFood();window._pastFoodDate=null;
    renderNutritionPage();toast(food.name+' added to past log');
    return;
  }
  // Normal today flow
  const name=$('mfName').value.trim();if(!name){toast('Enter food name');return}
  const food={name,cal:parseInt($('mfCal').value)||0,protein:parseInt($('mfProtein').value)||0,carbs:parseInt($('mfCarbs').value)||0,fat:parseInt($('mfFat').value)||0,serving:$('mfServing').value.trim()||'manual'};
  await saveFoodItem(food);closeManualFood();
}

// ── MACRO ADJUSTMENT MODAL ──
function openMacroModal(){
  const t=calcTDEE();const cm=userData.customMacros||{};const st=userData.stats||{};
  const curGoal=userData.nutritionGoal||userData.goal||'Maintenance';
  const goalOpts=[
    {v:'Maintenance',l:'Maintenance (±0)'},
    {v:'Mild Cut',l:'Mild Cut (-250)'},
    {v:'Fat Loss',l:'Fat Loss (-400)'},
    {v:'Moderate Cut',l:'Moderate Cut (-500)'},
    {v:'Aggressive Cut',l:'Aggressive Cut (-750)'},
    {v:'Recomp',l:'Recomp (-100)'},
    {v:'Lean Bulk',l:'Lean Bulk (+250)'},
    {v:'Bulk',l:'Bulk (+500)'}
  ];
  let h=`<h2>Nutrition Settings</h2>`;
  h+=`<div class="settings-section" style="margin-top:0">Body stats</div>`;
  h+=`<div class="settings-row-fields"><div class="m-field" style="flex:1"><label>Height</label><input type="text" id="macroHeight" value="${st.height||''}" placeholder="5'10&quot;"></div><div class="m-field" style="flex:1"><label>Weight (lbs)</label><input type="number" id="macroWeight" value="${st.weight||''}"></div></div>`;
  h+=`<div class="settings-row-fields"><div class="m-field" style="flex:1"><label>Age</label><input type="number" id="macroAge" value="${st.age||''}"></div><div class="m-field" style="flex:1"><label>Sex</label><select id="macroSex"><option value="male"${(st.sex||'male')==='male'?' selected':''}>Male</option><option value="female"${st.sex==='female'?' selected':''}>Female</option></select></div></div>`;
  h+=`<div class="settings-section">Activity and goal</div>`;
  h+=`<div class="m-field"><label>Activity Level</label><select id="macroActivity">${ACTIVITY_LEVELS.map(a=>`<option value="${a.id}"${(userData.activityLevel||'moderate')===a.id?' selected':''}>${a.name} — ${a.desc}</option>`).join('')}</select></div>`;
  h+=`<div class="m-field"><label>Daily Steps Estimate</label><select id="macroSteps">
    <option value="2000"${(userData.dailySteps||'')==='2000'?' selected':''}>~2,000 (mostly sitting)</option>
    <option value="4000"${(userData.dailySteps||'')==='4000'?' selected':''}>~4,000 (some walking)</option>
    <option value="6000"${(userData.dailySteps||'6000')==='6000'?' selected':''}>~6,000 (moderate)</option>
    <option value="8000"${(userData.dailySteps||'')==='8000'?' selected':''}>~8,000 (active)</option>
    <option value="10000"${(userData.dailySteps||'')==='10000'?' selected':''}>~10,000 (very active)</option>
    <option value="12000"${(userData.dailySteps||'')==='12000'?' selected':''}>~12,000+</option>
  </select></div>`;
  h+=`<div class="m-field"><label>Goal</label><select id="macroGoal" onchange="onGoalChange()">${goalOpts.map(g=>`<option value="${g.v}"${curGoal===g.v?' selected':''}>${g.l}</option>`).join('')}</select></div>`;
  h+=`<div class="settings-section">Custom overrides</div>`;
  h+=`<label class="toggle-row" style="margin:.3rem 0"><input type="checkbox" class="toggle-cb" id="macroCustomToggle" onchange="toggleMacroFields()" ${cm&&cm.enabled?'checked':''}><span>Override auto-calculated macros</span></label>`;
  h+=`<div class="macro-custom-field"><button type="button" class="tdee-adjust-btn" style="width:100%;margin-bottom:.4rem;font-size:.66rem" onclick="onGoalChange()">↻ Reset calories & macros from my goal</button></div>`;
  h+=`<div class="macro-custom-field"><div class="m-field"><label>Target Calories</label><input type="number" id="macroCalories" value="${cm.calories||(t?t.target:2000)}" oninput="recalcMacros('cal')"></div></div>`;
  h+=`<div class="settings-row-fields macro-custom-field">
    <div class="m-field" style="flex:1"><label>Protein (g) <span class="macro-auto-tag" id="macroAutoP"></span></label><input type="number" id="macroProtein" value="${cm.protein||(t?t.proteinG:150)}" oninput="recalcMacros('protein')"></div>
    <div class="m-field" style="flex:1"><label>Fat (g) <span class="macro-auto-tag" id="macroAutoF"></span></label><input type="number" id="macroFat" value="${cm.fat||(t?t.fatG:60)}" oninput="recalcMacros('fat')"></div>
    <div class="m-field" style="flex:1"><label>Carbs (g) <span class="macro-auto-tag" id="macroAutoC"></span></label><input type="number" id="macroCarbs" value="${cm.carbs||(t?t.carbG:200)}" oninput="recalcMacros('carbs')"></div>
  </div>`;
  h+=`<div style="font-size:.6rem;color:var(--dim);text-align:center;margin-top:2px;font-family:var(--font-mono)">Edit any field — the others adjust to match your calorie target</div>`;
  h+=`<div id="macroPreview" class="macro-preview"></div>`;
  if(t){h+=`<div class="macro-breakdown">BMR: ${t.bmr} · Maintenance: <strong>${t.maintenance||t.tdee}</strong>${t.stepBonus?' (+'+t.stepBonus+' steps)':''} · Target: <strong>${t.target}</strong>${t.deficit?' ('+t.deficit+')':''}</div>`}
  h+=`<div class="m-actions" style="margin-top:.8rem"><button class="m-cancel" onclick="closeMacroModal()">Cancel</button><button class="m-save-btn" onclick="saveMacroSettings()">Save</button></div>`;
  $('macroModal').querySelector('.modal').innerHTML=h;
  toggleMacroFields();
  recalcMacros('init');
  $('macroModal').classList.add('open');
}
function closeMacroModal(){$('macroModal').classList.remove('open')}
function toggleMacroFields(){
  const c=$('macroCustomToggle').checked;
  document.querySelectorAll('.macro-custom-field').forEach(el=>el.style.opacity=c?'1':'.4');
  document.querySelectorAll('.macro-custom-field input').forEach(el=>el.disabled=!c);
  if(c)recalcMacros('init');
}
let lastMacroEdit='carbs'; // tracks which field auto-adjusts
// Goal dropdown changed → recompute the target calories from the new deficit and
// push it into the calorie field, so switching plans (e.g. Aggressive Cut) actually
// re-targets even when custom override is on. This was the "keeps maintenance" bug.
function onGoalChange(){
  const goal=$('macroGoal').value||'';
  // Recompute a fresh TDEE target for the chosen goal, independent of current custom cal
  const st=userData.stats||{};
  const w=parseFloat(st.weight),a=parseFloat(st.age),hRaw=st.height||'';
  if(!w||!a||!hRaw)return;
  let hCm=0;
  const hNorm=String(hRaw).replace(/[\u2018\u2019\u0060\u00B4]/g,"'").replace(/[\u201C\u201D]/g,'"').trim();
  if(hNorm.includes("'")){const p=hNorm.replace(/"/g,'').split("'");hCm=((parseInt(p[0])||0)*12+(parseInt(p[1])||0))*2.54}
  else if(hNorm.toLowerCase().includes('cm'))hCm=parseFloat(hNorm);
  else{const n=parseFloat(hNorm);hCm=n>100?n:n>10?n*2.54:(n*12)*2.54}
  if(!hCm)return;
  const wKg=w*0.453592,sex=(st.sex||'male');
  const bmr=sex==='female'?(10*wKg+6.25*hCm-5*a-161):(10*wKg+6.25*hCm-5*a+5);
  const al=ACTIVITY_LEVELS.find(x=>x.id===($('macroActivity').value||'moderate'))||ACTIVITY_LEVELS[2];
  const stepBonus=stepsToCalories(parseInt($('macroSteps').value)||0);
  const tdee=Math.round(bmr*al.mult)+stepBonus;
  let target=tdee;
  if(goal.includes('Aggressive'))      target=tdee-750;
  else if(goal.includes('Moderate'))   target=tdee-500;
  else if(goal.includes('Fat Loss'))   target=tdee-400;
  else if(goal.includes('Mild'))       target=tdee-250;
  else if(goal.includes('Lean Bulk'))  target=tdee+250;
  else if(goal.includes('Bulk'))       target=tdee+500;
  else if(goal.includes('Recomp'))     target=tdee-100;
  else if(goal.includes('Muscle Gain'))target=tdee+300;
  const calEl=$('macroCalories');
  if(calEl){calEl.value=target;recalcMacros('cal')}
  // Live breakdown line update
  const bd=document.querySelector('.macro-breakdown');
  if(bd)bd.innerHTML=`BMR: ${Math.round(bmr)} · Maintenance: <strong>${tdee}</strong>${stepBonus?' (+'+stepBonus+' steps)':''} · Target: <strong>${target}</strong>${target!==tdee?' ('+(target-tdee>0?'+':'')+(target-tdee)+')':''}`;
}
function recalcMacros(source){
  const calEl=$('macroCalories'),pEl=$('macroProtein'),fEl=$('macroFat'),cEl=$('macroCarbs'),preview=$('macroPreview');
  if(!calEl||!pEl||!fEl||!cEl)return;
  const cal=parseInt(calEl.value)||0;
  let p=parseInt(pEl.value)||0;
  let f=parseInt(fEl.value)||0;
  let c=parseInt(cEl.value)||0;
  // Determine which field to auto-adjust based on what the user edited
  // Rule: the field you're typing in stays, protein is protected unless explicitly changed
  let autoField='carbs'; // default
  if(source==='protein'||source==='cal')autoField='carbs';    // edit P or cal → carbs adjusts
  else if(source==='fat')autoField='carbs';                    // edit fat → carbs adjusts
  else if(source==='carbs')autoField='fat';                    // edit carbs → fat adjusts
  else autoField=lastMacroEdit||'carbs';                       // init: use last
  if(source!=='init')lastMacroEdit=autoField;
  // Calculate the auto field
  if(autoField==='carbs'){
    const remaining=cal-p*4-f*9;
    c=Math.max(0,Math.round(remaining/4));
    cEl.value=c;
  }else if(autoField==='fat'){
    const remaining=cal-p*4-c*4;
    f=Math.max(0,Math.round(remaining/9));
    fEl.value=f;
  }else if(autoField==='protein'){
    const remaining=cal-f*9-c*4;
    p=Math.max(0,Math.round(remaining/4));
    pEl.value=p;
  }
  // Update auto labels
  const tagP=$('macroAutoP'),tagF=$('macroAutoF'),tagC=$('macroAutoC');
  if(tagP)tagP.textContent=autoField==='protein'?'← auto':'';
  if(tagF)tagF.textContent=autoField==='fat'?'← auto':'';
  if(tagC)tagC.textContent=autoField==='carbs'?'← auto':'';
  // Highlight the auto field
  pEl.style.borderColor=autoField==='protein'?'var(--green)':'';
  fEl.style.borderColor=autoField==='fat'?'var(--green)':'';
  cEl.style.borderColor=autoField==='carbs'?'var(--green)':'';
  // Preview
  const pCal=p*4,fCal=f*9,cCal=c*4;
  const total=pCal+fCal+cCal;
  const diff=total-cal;
  let warn='';
  if(autoField==='carbs'&&c<=0)warn='<span style="color:var(--red)">Protein + Fat exceed calories. Reduce one or increase target.</span>';
  else if(autoField==='fat'&&f<=0)warn='<span style="color:var(--red)">Protein + Carbs exceed calories. Reduce one or increase target.</span>';
  else if(c<50&&autoField==='carbs')warn='<span style="color:var(--gold)">Low carbs ('+c+'g). Consider increasing calories or reducing fat.</span>';
  else if(f<20)warn='<span style="color:var(--gold)">Very low fat ('+f+'g). May affect hormones. Consider 40g+ minimum.</span>';
  if(preview){
    preview.innerHTML=`<div class="macro-preview-row">
      <span style="color:var(--red)">P: ${p}g (${pCal})</span> ·
      <span style="color:var(--cyan)">F: ${f}g (${fCal})</span> ·
      <span style="color:var(--gold)">C: ${c}g (${cCal})</span>
    </div>
    <div class="macro-preview-total">Total: ${total} cal${Math.abs(diff)>5?' · <span style="color:var(--red)">'+diff+' off target</span>':' ✓'}</div>
    ${warn?'<div class="macro-preview-warn">'+warn+'</div>':''}`;
  }
}
async function saveMacroSettings(){
  const stats={...(userData.stats||{}),
    height:$('macroHeight').value.trim(),
    weight:$('macroWeight').value.trim(),
    age:$('macroAge').value.trim(),
    sex:$('macroSex').value
  };
  const cm=$('macroCustomToggle').checked?{enabled:true,calories:parseInt($('macroCalories').value)||0,protein:parseInt($('macroProtein').value)||0,carbs:parseInt($('macroCarbs').value)||0,fat:parseInt($('macroFat').value)||0}:{enabled:false};
  // Safety net: custom overrides bypass the preset deficits, so check the raw number too
  if(cm.enabled&&cm.calories>0&&cm.calories<1200){
    if(!confirm(`${cm.calories} cal/day is very low.\n\nSustained intake this low risks muscle loss, hormonal disruption, and rebound weight gain.\n\nSave anyway?`))return;
  }
  await saveUser({stats,activityLevel:$('macroActivity').value,dailySteps:$('macroSteps').value,nutritionGoal:$('macroGoal').value,customMacros:cm});
  closeMacroModal();renderNutritionPage();toast('Nutrition settings saved!');
}

// ── RECENT FOODS + SEARCHABLE HISTORY ──
// Builds one deduped list from the ENTIRE food log plus saved recents, so every food
// ever logged stays findable. Saved recents win on macros (they hold edited defaults).
let foodHistory=[];
function buildFoodHistory(){
  const map={};
  const fl=userData.foodLog||{};
  Object.keys(fl).forEach(day=>{
    const meals=(fl[day]&&fl[day].meals)||{};
    Object.values(meals).forEach(items=>(items||[]).forEach(f=>{
      if(!f||!f.name)return;
      const k=f.name.trim().toLowerCase();
      if(!map[k])map[k]={name:f.name,cal:f.cal||0,protein:f.protein||0,carbs:f.carbs||0,fat:f.fat||0,serving:f.serving||'',count:0,last:''};
      map[k].count++;
      if(day>=map[k].last){
        map[k].last=day;
        Object.assign(map[k],{cal:f.cal||0,protein:f.protein||0,carbs:f.carbs||0,fat:f.fat||0,serving:f.serving||''});
      }
    }));
  });
  (userData.recentFoods||[]).forEach((r,i)=>{
    const k=r.name.trim().toLowerCase();
    map[k]={...(map[k]||{count:0,last:''}),...r,recentRank:i};
  });
  // Recently used first, then by how often you eat it
  return Object.values(map).sort((a,b)=>{
    const ar=a.recentRank??9999,br=b.recentRank??9999;
    if(ar!==br)return ar-br;
    if((b.last||'')!==(a.last||''))return (b.last||'').localeCompare(a.last||'');
    return b.count-a.count;
  });
}
function openRecentFoods(){
  const modal=$('recentFoodsModal');if(!modal)return;
  foodHistory=buildFoodHistory();
  let h=`<h2>Food History</h2>`;
  if(!foodHistory.length){
    h+=`<p style="color:var(--muted);font-size:.78rem;padding:1rem 0">No foods logged yet. Log something first!</p>`;
  }else{
    h+=`<input type="search" id="foodHistSearch" class="food-hist-search" placeholder="Search ${foodHistory.length} foods you've logged…" oninput="renderFoodHistoryList()" autocomplete="off">`;
    h+=`<div class="page-sub" style="margin:.4rem 0 .5rem">Tap to adjust · to log instantly · edit default · Meal ${activeMeal}</div>`;
    h+=`<div class="recent-list" id="foodHistList"></div>`;
  }
  h+=`<div class="m-actions" style="margin-top:.6rem"><button class="m-cancel" onclick="closeRecentFoods()">Close</button></div>`;
  modal.querySelector('.modal').innerHTML=h;
  modal.classList.add('open');
  if(foodHistory.length)renderFoodHistoryList();
}
function renderFoodHistoryList(){
  const el=$('foodHistList');if(!el)return;
  const q=(($('foodHistSearch')||{}).value||'').trim().toLowerCase();
  const terms=q.split(/\s+/).filter(Boolean);
  // Every search word must appear somewhere in the name ("chicken rice" finds "Rice & Chicken Bowl")
  const rows=foodHistory.map((f,i)=>({f,i})).filter(({f})=>terms.every(t=>f.name.toLowerCase().includes(t)));
  const shown=q?rows:rows.slice(0,60);
  if(!shown.length){el.innerHTML=`<p style="color:var(--muted);font-size:.74rem;padding:.8rem 0">No match for "${esc(q)}". Try fewer words, or use Search to look it up.</p>`;return}
  el.innerHTML=shown.map(({f,i})=>{
    const meta=f.count>1?`<span class="fh-count">×${f.count}</span>`:'';
    return `<div class="recent-item" onclick="openRecentServing(${i})">
      <div class="food-item-info">
        <div class="food-item-name">${esc(f.name)} ${meta}</div>
        <div class="food-item-detail">${esc(f.serving||'')} · ${f.cal} cal · P:${f.protein}g C:${f.carbs}g F:${f.fat}g</div>
      </div>
      <button class="recent-edit" onclick="event.stopPropagation();editRecentFood(${i})" title="Edit"></button>
      <div class="recent-quick" onclick="event.stopPropagation();quickRelog(${i})"></div>
    </div>`;
  }).join('')+(!q&&rows.length>60?`<p style="color:var(--dim);font-size:.66rem;text-align:center;padding:.5rem 0">Showing 60 of ${rows.length} — search to find the rest</p>`:'');
}
async function editRecentFood(idx){
  const recent=userData.recentFoods||[];
  const f=foodHistory[idx];if(!f)return;
  const currentServing=f.serving||'1 serving';
  const newServing=prompt(`Edit default serving for ${f.name}:\n\n(e.g. "150g", "1 cup", "2 slices")`,currentServing);
  if(!newServing||newServing.trim()===currentServing)return;
  // Ask if they want to recalculate macros proportionally
  const oldGrams=parseFloat(currentServing);
  const newGrams=parseFloat(newServing);
  let updated={...f,serving:newServing.trim()};
  if(oldGrams&&newGrams&&oldGrams>0){
    if(confirm(`Scale macros proportionally?\n\nOld: ${currentServing} = ${f.cal} cal\nNew: ${newServing} = ${Math.round(f.cal*newGrams/oldGrams)} cal\n\nTap OK to recalculate, Cancel to keep current macros.`)){
      const ratio=newGrams/oldGrams;
      updated.cal=Math.round(f.cal*ratio);
      updated.protein=Math.round(f.protein*ratio*10)/10;
      updated.carbs=Math.round(f.carbs*ratio*10)/10;
      updated.fat=Math.round(f.fat*ratio*10)/10;
    }
  }
  // Upsert by name so edits stick even for foods that only lived in older logs
  const {count,last,recentRank,...clean}=updated;
  const ri=recent.findIndex(r=>r.name===f.name);
  if(ri>=0)recent[ri]=clean;else recent.unshift(clean);
  if(recent.length>300)recent.length=300;
  await saveUser({recentFoods:recent});
  openRecentFoods();
  toast('Default updated');
}
function closeRecentFoods(){$('recentFoodsModal').classList.remove('open')}

// Quick relog — same serving, instant add
async function quickRelog(idx){
  const f=foodHistory[idx];if(!f)return;
  const {count,last,recentRank,...food}=f;
  await saveFoodItem(food);
  closeRecentFoods();
}

// Relog with serving adjustment
let recentPending=null;
function openRecentServing(idx){
  recentPending=foodHistory[idx];if(!recentPending)return;
  closeRecentFoods();
  const modal=$('recentServingModal');if(!modal)return;
  let h=`<h2>Adjust Serving</h2>`;
  h+=`<div class="serving-food-name">${esc(recentPending.name)}</div>`;
  h+=`<div style="font-family:var(--font-mono);font-size:.65rem;color:var(--muted);margin:.3rem 0">Last logged: ${esc(recentPending.serving||'1 serving')} · ${recentPending.cal} cal</div>`;
  h+=`<div class="m-field"><label>Servings (multiplier)</label><input type="number" id="recentServingMult" value="1" min="0.25" step="0.25" oninput="updateRecentPreview()"></div>`;
  h+=`<div id="recentPreview" class="serving-preview"></div>`;
  h+=`<div class="m-actions"><button class="m-cancel" onclick="closeRecentServing()">Cancel</button><button class="m-save-btn" onclick="confirmRecentServing()">Log It → Meal ${activeMeal}</button></div>`;
  modal.querySelector('.modal').innerHTML=h;
  updateRecentPreview();
  modal.classList.add('open');
}
function closeRecentServing(){$('recentServingModal').classList.remove('open');recentPending=null}
function updateRecentPreview(){
  if(!recentPending)return;
  const mult=parseFloat($('recentServingMult').value)||1;
  const el=$('recentPreview');if(!el)return;
  el.innerHTML=`<strong>${Math.round(recentPending.cal*mult)} cal</strong> · P:${Math.round(recentPending.protein*mult)}g · C:${Math.round(recentPending.carbs*mult)}g · F:${Math.round(recentPending.fat*mult)}g`;
}
async function confirmRecentServing(){
  if(!recentPending)return;
  const mult=parseFloat($('recentServingMult').value)||1;
  const food={
    name:recentPending.name,
    cal:Math.round(recentPending.cal*mult),
    protein:Math.round(recentPending.protein*mult),
    carbs:Math.round(recentPending.carbs*mult),
    fat:Math.round(recentPending.fat*mult),
    serving:(mult===1?'':mult+'x ')+(recentPending.serving||'serving')
  };
  await saveFoodItem(food);
  closeRecentServing();
}

// ── RANK INFO ──
function renderRankInfo(){
  const er=getEffectiveRank();
  const lvl=getLevelInfo();
  const cap=getXpCap();
  let h=`<div class="rank-info-header"><div class="ri-label">[ System status ]</div><div class="ri-current" style="color:${er.color}">${er.name}</div><div class="ri-title" style="color:${er.color}">${(er.title&&er.title[userData.class])||er.name}</div>`;
  // Level display
  h+=`<div class="ri-level">Lv <strong>${lvl.level}</strong> / ${lvl.maxLevel}</div>`;
  // Level progress bar
  h+=`<div class="ri-level-bar"><div class="ri-level-bar-fill" style="width:${lvl.progressPct}%;background:${er.color}"></div></div>`;
  if(!lvl.maxed)h+=`<div class="ri-level-sub">${lvl.xpToNextLevel} XP to Lv ${lvl.level+1}</div>`;
  else h+=`<div class="ri-level-sub" style="color:${er.color}">Max level in rank</div>`;
  h+=`<div class="ri-xp">${userData.xp} XP</div>`;
  if(cap.softCap<1){
    const trial=RANK_TRIALS[cap.trialName];
    h+=`<div class="ri-softcap">25% Soft-Cap · Pass ${trial?trial.name:'trial'} for full XP + <strong>${TRIAL_BONUS[cap.trialName]||0}</strong> bonus</div>`;
  }
  h+=`</div><div class="ri-divider"></div>`;
  RANKS.forEach(r=>{const isCurrent=er.name===r.name;const isLocked=userData.xp<r.min;
    h+=`<div class="ri-rank ${isCurrent?'current':''} ${isLocked?'locked':''}"><div class="ri-rank-badge" style="color:${r.color};border-color:${isLocked?'var(--border)':r.color}">${r.name}</div><div class="ri-rank-info"><div class="ri-rank-title" style="color:${isLocked?'var(--dim)':r.color}">${(r.title&&r.title[userData.class])||r.name}</div><div class="ri-rank-xp">${r.min} XP · ${r.levels||10} levels</div><div class="ri-rank-lore">${isLocked?'???':r.lore}</div>${r.trial?`<div class="ri-rank-trial">${isLocked?'Trial required':'Trial: '+RANK_TRIALS[r.trial].name+' (+'+(TRIAL_BONUS[r.trial]||0)+' XP bonus)'}</div>`:''}</div>${isCurrent?'<div class="ri-you">◄ You</div>':''}</div>`});
  return h;
}

// ═══════════ v1.29.0 REDESIGN HELPERS ═══════════
function mealName(m){const n=(userData.mealNames||{})[m];return n&&String(n).trim()?String(n).trim().slice(0,24):'Meal '+m}
function nuMacro(label,have,goal,cls){
  const pct=goal>0?Math.min(100,have/goal*100):0;
  return `<div class="nu-macro ${cls}"><div class="nu-macro-top"><span class="nu-macro-l">${label}</span><span class="num">${fmtN(have)}<span class="mist"> / ${fmtN(goal)} g</span></span></div>
    <div class="track"><div class="fill" style="width:${pct}%"></div></div></div>`;
}
function firstEmptyMeal(dayLog,n){for(let m=1;m<=n;m++){if(!(dayLog.meals[m]||[]).length)return m}return 0}
function recentDaysHtml(viewDate){
  const logDays=Object.keys(userData.foodLog||{}).filter(k=>{
    const d=userData.foodLog[k];
    if(Array.isArray(d))return d.length>0;
    if(d&&d.meals)return getDayItemCount(d)>0;
    return false;
  }).sort().reverse().slice(0,14);
  let h=`<div class="sec" style="margin-top:30px">Recent days</div>`;
  if(!logDays.length)return h+`<div class="empty-note">No history yet.</div>`;
  return h+`<div class="li-list" style="margin-top:6px">`+logDays.map(d=>{
    const dl=getDayLog(d);const tot=getDayTotals(dl);const count=getDayItemCount(dl);
    const label=new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    return `<button class="li${d===viewDate?' cur':''}" onclick="foodLogDate='${d}';renderNutritionPage();window.scrollTo(0,0)"><span class="t">${label}</span>
      <span class="r">${fmtN(tot.cal)} cal, ${fmtN(tot.p)} g protein, ${count} item${count!==1?'s':''}</span><span class="chev">${icon('chev',16)}</span></button>`;
  }).join('')+`</div>`;
}
async function saveMealNames(){
  const mc=getMealCount();const names={};
  for(let m=1;m<=mc;m++){const v=($('mealName'+m)||{}).value;if(v&&v.trim())names[m]=v.trim().slice(0,24)}
  await saveUser({mealNames:names});
  closeMealCountModal();renderNutritionPage();toast('Meals saved');
}
