// ═══════════════════════════════════════════
//  LEXENFITNESS — NUTRITION (Food Log + Scanner + TDEE)
// ═══════════════════════════════════════════
const OFF_API='https://world.openfoodfacts.org';

function calcTDEE(){
  const st=userData.stats||{};const w=parseFloat(st.weight),a=parseFloat(st.age),hRaw=st.height||'';
  if(!w||!a||!hRaw)return null;
  let hCm=0;
  if(hRaw.includes("'")){const p=hRaw.replace(/"/g,'').split("'");hCm=(parseInt(p[0])*12+parseInt(p[1]||0))*2.54}
  else if(hRaw.toLowerCase().includes('cm'))hCm=parseFloat(hRaw);
  else{const n=parseFloat(hRaw);hCm=n>100?n:n*2.54}
  if(!hCm)return null;
  const wKg=w*0.453592,bmr=10*wKg+6.25*hCm-5*a+5;
  const actLevel=userData.activityLevel||'moderate';
  const al=ACTIVITY_LEVELS.find(x=>x.id===actLevel)||ACTIVITY_LEVELS[2];
  const tdee=Math.round(bmr*al.mult);
  const goal=userData.goal||'';
  let target=tdee;
  if(goal.includes('Fat Loss'))target=tdee-400;
  else if(goal.includes('Muscle Gain'))target=tdee+300;
  else if(goal.includes('Recomp'))target=tdee-100;
  // Check custom macros
  const cm=userData.customMacros;
  if(cm&&cm.enabled)return{bmr,tdee,target:cm.calories||target,proteinG:cm.protein||Math.round(wKg*2),fatG:cm.fat||Math.round(target*0.25/9),carbG:cm.carbs||Math.round((target-cm.protein*4-cm.fat*9)/4),goal:goal||'Maintenance',custom:true,actName:al.name};
  const proteinG=Math.round(wKg*2),fatG=Math.round(target*0.25/9),carbG=Math.round((target-proteinG*4-fatG*9)/4);
  return{bmr,tdee,target,proteinG,fatG,carbG,goal:goal||'Maintenance',custom:false,actName:al.name};
}

function renderNutritionPage(){
  const t=calcTDEE();const today=getTodayStr();
  const todayLog=(userData.foodLog&&userData.foodLog[today])||[];
  const totals=todayLog.reduce((s,f)=>({cal:s.cal+(f.cal||0),p:s.p+(f.protein||0),c:s.c+(f.carbs||0),f:s.f+(f.fat||0)}),{cal:0,p:0,c:0,f:0});

  let h=`<div class="page-title" style="display:flex;justify-content:space-between;align-items:center">NUTRITION <span style="font-family:var(--font-mono);font-size:.65rem;color:var(--muted)">${new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span></div>`;

  // TDEE Summary
  if(t){
    const calPct=Math.min(100,(totals.cal/t.target)*100);
    const pPct=Math.min(100,(totals.p/t.proteinG)*100);
    const cPct=Math.min(100,(totals.c/t.carbG)*100);
    const fPct=Math.min(100,(totals.f/t.fatG)*100);
    h+=`<div class="tdee-card">
      <div class="tdee-header">${t.custom?'CUSTOM':'AUTO'} · ${t.goal.toUpperCase()} · ${t.actName}</div>
      <div class="tdee-main"><div class="tdee-cal">${totals.cal} <span style="font-size:1.2rem;opacity:.5">/ ${t.target}</span></div><div class="tdee-cal-label">CALORIES</div></div>
      <div class="macro-bars">
        <div class="macro-bar-row"><span class="macro-label" style="color:var(--red)">P ${totals.p}/${t.proteinG}g</span><div class="macro-bar"><div class="macro-bar-fill" style="width:${pPct}%;background:var(--red)"></div></div></div>
        <div class="macro-bar-row"><span class="macro-label" style="color:var(--gold)">C ${totals.c}/${t.carbG}g</span><div class="macro-bar"><div class="macro-bar-fill" style="width:${cPct}%;background:var(--gold)"></div></div></div>
        <div class="macro-bar-row"><span class="macro-label" style="color:var(--cyan)">F ${totals.f}/${t.fatG}g</span><div class="macro-bar"><div class="macro-bar-fill" style="width:${fPct}%;background:var(--cyan)"></div></div></div>
      </div>
      <button class="tdee-adjust-btn" onclick="openMacroModal()">⚙️ Adjust Targets</button>
    </div>`;
  }else{
    h+=`<div class="tdee-card"><div class="tdee-empty">Add height, weight, age in Settings to see targets</div></div>`;
  }

  // Add food buttons
  h+=`<div class="food-actions">
    <button class="food-btn" onclick="openFoodSearch()">🔍 Search Food</button>
    <button class="food-btn" onclick="openScanner()">📸 Scan Barcode</button>
    <button class="food-btn" onclick="openManualFood()">✏️ Manual Entry</button>
  </div>`;

  // Today's log
  h+=`<div class="section-title" style="margin:.8rem 0 .4rem">TODAY'S LOG</div>`;
  if(!todayLog.length)h+=`<p style="color:var(--muted);font-size:.78rem">No food logged today. Tap above to start.</p>`;
  else h+=todayLog.map((f,i)=>`<div class="food-item">
    <div class="food-item-info"><div class="food-item-name">${esc(f.name)}</div><div class="food-item-detail">${esc(f.serving||'')} · ${f.cal||0} cal · P:${f.protein||0}g C:${f.carbs||0}g F:${f.fat||0}g</div></div>
    <button class="btn-del" onclick="removeFoodItem(${i})">✕</button>
  </div>`).join('');

  $('nutritionContent').innerHTML=h;
}

// ── FOOD SEARCH (Open Food Facts) ──
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
    // Store results safely — reference by index to avoid XSS from product names
    window._foodResults=data.products.map(p=>{
      const nut=p.nutriments||{};
      return{name:String(p.product_name||'Unknown').slice(0,100),cal:Math.round(nut['energy-kcal_100g']||nut['energy-kcal']||0),protein:Math.round(nut.proteins_100g||0),carbs:Math.round(nut.carbohydrates_100g||0),fat:Math.round(nut.fat_100g||0),serving:'per 100g'};
    });
    $('foodSearchResults').innerHTML=window._foodResults.map((f,i)=>
      `<div class="food-result" onclick="addFoodFromSearch(window._foodResults[${i}])"><div class="food-result-name">${esc(f.name)}</div><div class="food-result-macros">${f.cal} cal · P:${f.protein}g C:${f.carbs}g F:${f.fat}g <span style="color:var(--dim)">per 100g</span></div></div>`
    ).join('');
  }catch(e){$('foodSearchResults').innerHTML='<p style="color:var(--red);font-size:.78rem;padding:.5rem">Search failed. Try again.</p>'}
}

async function addFoodFromSearch(food){
  const today=getTodayStr();
  if(!userData.foodLog)userData.foodLog={};
  if(!userData.foodLog[today])userData.foodLog[today]=[];
  userData.foodLog[today].push(food);
  await saveUser({foodLog:userData.foodLog});
  if(userData.foodLog[today].length===1)unlockAch('food_log_1');
  // Check 7-day food logging
  const days=Object.keys(userData.foodLog).filter(k=>userData.foodLog[k].length>0).length;
  if(days>=7)unlockAch('food_log_7');
  closeFoodSearch();renderNutritionPage();toast(`${food.name} logged!`);
}

// ── BARCODE SCANNER (html5-qrcode library — works on iOS + Android + Desktop) ──
let html5Scanner=null;

async function openScanner(){
  $('scannerModal').classList.add('open');
  $('scannerStatus').textContent='Starting camera...';
  $('scannerStatus').style.color='var(--muted)';
  $('scannerManualRow').style.display='flex';
  $('scannerManualInput').value='';

  // Clear previous scanner instance
  if(html5Scanner){try{await html5Scanner.clear()}catch(e){}}
  $('scannerReader').innerHTML='';

  try{
    html5Scanner=new Html5Qrcode('scannerReader');
    await html5Scanner.start(
      {facingMode:'environment'},
      {fps:10,qrbox:{width:250,height:150},aspectRatio:1.5},
      async(decodedText)=>{
        // Barcode found!
        await closeScanner();
        await lookupBarcode(decodedText);
      },
      (errorMessage)=>{
        // Scanning... no barcode yet (this fires constantly, ignore)
      }
    );
    $('scannerStatus').textContent='📷 Point at barcode...';
    $('scannerStatus').style.color='var(--green)';
  }catch(e){
    $('scannerStatus').style.color='var(--red)';
    if(e.toString().includes('NotAllowedError')||e.toString().includes('Permission')){
      $('scannerStatus').textContent='Camera permission denied. Allow camera access or enter barcode below:';
    }else{
      $('scannerStatus').textContent='Camera unavailable. Enter barcode below:';
    }
  }
}

async function closeScanner(){
  if(html5Scanner){
    try{
      const state=html5Scanner.getState();
      if(state===Html5QrcodeScannerState.SCANNING||state===Html5QrcodeScannerState.PAUSED){
        await html5Scanner.stop();
      }
      await html5Scanner.clear();
    }catch(e){}
    html5Scanner=null;
  }
  $('scannerReader').innerHTML='';
  $('scannerStatus').style.color='';
  $('scannerModal').classList.remove('open');
}

async function scannerManualLookup(){
  const code=$('scannerManualInput').value.trim();
  if(!code){toast('Enter a barcode number');return}
  closeScanner();
  await lookupBarcode(code);
}

async function lookupBarcode(code){
  toast('Looking up '+code+'...');
  try{
    const res=await fetch(`${OFF_API}/api/v2/product/${code}.json`);
    const data=await res.json();
    if(data.status!==1||!data.product){toast('Product not found');return}
    const p=data.product;const nut=p.nutriments||{};
    const food={name:String(p.product_name||'Unknown').slice(0,100),cal:Math.round(nut['energy-kcal_100g']||0),protein:Math.round(nut.proteins_100g||0),carbs:Math.round(nut.carbohydrates_100g||0),fat:Math.round(nut.fat_100g||0),serving:'per 100g',barcode:String(code).slice(0,20)};
    unlockAch('scan_1');
    await addFoodFromSearch(food);
  }catch(e){toast('Lookup failed. Try again.')}
}

// ── MANUAL FOOD ENTRY ──
function openManualFood(){$('manualFoodModal').classList.add('open');$('mfName').value='';$('mfCal').value='';$('mfProtein').value='';$('mfCarbs').value='';$('mfFat').value=''}
function closeManualFood(){$('manualFoodModal').classList.remove('open')}
async function saveManualFood(){
  const name=$('mfName').value.trim();if(!name){toast('Enter food name');return}
  const food={name,cal:parseInt($('mfCal').value)||0,protein:parseInt($('mfProtein').value)||0,carbs:parseInt($('mfCarbs').value)||0,fat:parseInt($('mfFat').value)||0,serving:'manual'};
  await addFoodFromSearch(food);closeManualFood();
}

async function removeFoodItem(idx){
  if(!confirm('Remove this item?'))return;
  const today=getTodayStr();
  userData.foodLog[today].splice(idx,1);
  await saveUser({foodLog:userData.foodLog});
  renderNutritionPage();toast('Removed.');
}

// ── MACRO ADJUSTMENT MODAL ──
function openMacroModal(){
  const t=calcTDEE();if(!t)return;
  const cm=userData.customMacros||{};
  $('macroCalories').value=cm.calories||t.target;
  $('macroProtein').value=cm.protein||t.proteinG;
  $('macroCarbs').value=cm.carbs||t.carbG;
  $('macroFat').value=cm.fat||t.fatG;
  // Activity level
  const sel=$('macroActivity');sel.innerHTML=ACTIVITY_LEVELS.map(a=>`<option value="${a.id}"${(userData.activityLevel||'moderate')===a.id?' selected':''}>${a.name} — ${a.desc}</option>`).join('');
  $('macroCustomToggle').checked=!!(cm&&cm.enabled);
  toggleMacroFields();
  $('macroModal').classList.add('open');
}
function closeMacroModal(){$('macroModal').classList.remove('open')}
function toggleMacroFields(){
  const custom=$('macroCustomToggle').checked;
  document.querySelectorAll('.macro-custom-field').forEach(el=>el.style.opacity=custom?'1':'.4');
  document.querySelectorAll('.macro-custom-field input').forEach(el=>el.disabled=!custom);
}
async function saveMacroSettings(){
  const actLevel=$('macroActivity').value;
  const custom=$('macroCustomToggle').checked;
  const cm=custom?{enabled:true,calories:parseInt($('macroCalories').value)||0,protein:parseInt($('macroProtein').value)||0,carbs:parseInt($('macroCarbs').value)||0,fat:parseInt($('macroFat').value)||0}:{enabled:false};
  await saveUser({activityLevel:actLevel,customMacros:cm});
  closeMacroModal();renderNutritionPage();toast('Targets updated!');
}

// ── RANK INFO PAGE ──
function renderRankInfo(){
  const er=getEffectiveRank();
  let h=`<div class="rank-info-header">
    <div class="ri-label">[ SYSTEM STATUS ]</div>
    <div class="ri-current" style="color:${er.color}">${er.name}</div>
    <div class="ri-title" style="color:${er.color}">${(er.title&&er.title[userData.class])||er.name}</div>
    <div class="ri-xp">${userData.xp} XP</div>
  </div>`;
  h+=`<div class="ri-divider"></div>`;
  RANKS.forEach((r,i)=>{
    const isCurrent=er.name===r.name;
    const isLocked=userData.xp<r.min;
    const isPassed=userData.xp>=r.min;
    h+=`<div class="ri-rank ${isCurrent?'current':''} ${isLocked?'locked':''}">
      <div class="ri-rank-badge" style="color:${r.color};border-color:${isLocked?'var(--border)':r.color}">${r.name}</div>
      <div class="ri-rank-info">
        <div class="ri-rank-title" style="color:${isLocked?'var(--dim)':r.color}">${(r.title&&r.title[userData.class])||r.name}</div>
        <div class="ri-rank-xp">${r.min} XP required</div>
        <div class="ri-rank-lore">${isLocked?'???':r.lore}</div>
        ${r.trial?`<div class="ri-rank-trial">${isLocked?'🔒 Trial required':'⚔️ Trial: '+RANK_TRIALS[r.trial].name}</div>`:''}
      </div>
      ${isCurrent?'<div class="ri-you">◄ YOU</div>':''}
    </div>`;
  });
  return h;
}
