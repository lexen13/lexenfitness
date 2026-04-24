// ═══════════════════════════════════════════
//  LEXENFITNESS — DATA v4 (Solo Leveling)
// ═══════════════════════════════════════════
const APP_VERSION='1.12.0';
const WELCOME_MESSAGE=`Welcome to Lexen Fitness! A Solo-Leveling inspired, gamified Fitness App to help friends and family stay motivated by giving fitness a game-like experience.\n\nThis app is developed by one person, and is very much still in the testing phase. Not everything will be perfect, but please bear with me. If you have any suggestions, feel free to pass them along as I continue to make this the best app that I can, before I actually have to start buying dev rights with Apple and Google.\n\nFeel free to share this with your own family and friends as we build a community that becomes healthier together!\n\n— Gavin (founder)`;
const CHANGELOG=[
  {version:'1.12.0',date:'Apr 2026',title:'Internal Levels, Soft Cap & Trial Bonuses',items:[
    '📊 NEW: Internal levels inside each rank. E-Rank has 10 levels, S-Rank has 100. Small wins on the way to rank-ups',
    '⚠️ Hard XP cap replaced with 25% SOFT cap — you still earn XP toward trials, just slower. No more "frozen" feeling',
    '⚔️ Trial bonuses: Iron Gate +250 XP · Gauntlet +500 XP · Awakening +1,000 XP',
    '📈 Rank Info screen now shows your current level, a progress bar, and XP to next level',
    '🎯 Level-up toasts when you progress inside your rank',
    '🏅 Level badge shown next to XP in the top bar'
  ]},
  {version:'1.11.1',date:'Apr 2026',title:'Backdate XP Exploit Closed',items:[
    '🔒 Backdated entries now award ZERO XP (was 50%). Anti-exploit measure.',
    '💡 Backdating still saves streaks and fills in the log — just no XP or achievements',
    '📝 Updated all backdate prompts to reflect "no XP" policy'
  ]},
  {version:'1.11.0',date:'Apr 2026',title:'Session Mode, Timer & Backdating',items:[
    '⚔️ NEW: Session Mode — tap "▶ START SESSION" on any workout day. Session clock tracks duration, auto-rest timer between sets, finish to log it all',
    '📖 Train tab reorganized: Workout / Learn / Logs. New Learn tab now includes training principles, progressive overload, deload, recovery, and the existing exercise library',
    '📅 Backdate logs up to 7 days. Use "📅 Log for Earlier Day" on the Workout tab. No XP awarded. Backdated entries save streaks but don\'t unlock achievements',
    '⏱️ Workout duration now shown in the Log with the ⏱ icon',
    '✏️ Recent Foods: edit the default serving size — tap ✏️ to update weight/macros',
    '👋 Poke buttons now appear on the Friends leaderboard too'
  ]},
  {version:'1.10.6',date:'Apr 2026',title:'HOTFIX: App Spinner Fix',items:[
    '🚨 Fixed the app hanging on the loading spinner after v1.10.5 deploy',
    '⏱️ Added a 20-second safety timeout — spinner will never hang forever again',
    '🛡️ All heavy init tasks (achievement checks, notifications) now run in background — app page renders first',
    '🔧 Added guards to prevent crashes on entries with missing exercises array',
    '🧯 Every init function wrapped in try/catch — one failure no longer takes down the whole app'
  ]},
  {version:'1.10.5',date:'Apr 2026',title:'Log Display Fix',items:[
    '🔧 Exercise Log was silently crashing on activity entries (bowling/cardio) which made whole weeks "disappear"',
    '🏃 Activities now render nicely in the Log with duration, calories, steps, and notes',
    '😴 Rest days now show in the Log with notes if provided',
    '⚠️ Failed-to-render entries show a clear error row instead of killing the whole week',
    '📊 Bumped log history limit from 200 to 500 entries (~70 weeks of heavy use)'
  ]},
  {version:'1.10.4',date:'Apr 2026',title:'Bug Fixes: Mission XP & Poke Streaks',items:[
    '🔧 Mission XP toast was lying — showed base XP (+10) instead of multiplied XP (+15 on weekends). Now shows actual gained',
    '🔧 Poke streaks now only advance when BOTH users poke same day (true mutual). Miss a day of reciprocation = streak dies',
    '🔥 At-risk streak indicator — streak flame pulses orange if the other person hasn\'t poked back yet today',
    '💡 Poke toast now tells you if you\'re waiting for a reply vs streak counted'
  ]},
  {version:'1.10.3',date:'Apr 2026',title:'Real Push Notifications',items:[
    '🔔 Real OS notifications for new messages, friend requests, pokes, and event missions',
    '⚙️ New Notifications settings panel — toggle each type on/off',
    '📱 iPhone users: tap Share → Add to Home Screen in Safari to enable push notifications',
    '💬 Messages list now tracks last-message metadata for instant alerts',
    '🔗 Notification clicks deep-link directly to the right page',
    '🎯 Daily event mission ping — never miss a 30-50 XP bonus again'
  ]},
  {version:'1.10.2',date:'Apr 2026',title:'Pokes, Better Trainer View & Permission Fixes',items:[
    '👋 Poke your friends! Daily limit, 5 XP per poke, build poke streaks 🔥 (like Snap streaks). 4 new achievements',
    '📊 Trainer client view now shows XP, rank, PRs, 30-day activity averages, body stats, weight trend, last 10 logs + check-ins',
    '🔧 Fixed Trainer Dashboard button (was using switchPage instead of sub-tab navigation)',
    '🔒 Firestore rules updated — dev can now repair/create trainer codes for other users, and new poke writes permitted',
    '🏆 +4 poke achievements'
  ]},
  {version:'1.10.1',date:'Apr 2026',title:'Progress Photos & Cleaner Train Page',items:[
    '📸 Progress Photos — device-only (IndexedDB), never uploaded, auto-resized to 1200px. Compare First vs Latest at a glance',
    '⚙️ Workout Settings button — Train page decluttered; Rename/Remove/Notes/Add Day/Change Program all live in one menu now',
    '🔧 Trainer promotion bug fixed (was silently failing due to empty arrayUnion)',
    '🔧 New dev tool: Repair Trainer Code — regenerates codes for trainers with missing code docs',
    '🏆 3 new progress-photo achievements'
  ]},
  {version:'1.10.0',date:'Apr 2026',title:'Rest Days, Check-ins & Trainer Mode',items:[
    '😴 Rest Day logging — Active Rest (counts for streak) vs Full Rest',
    '📏 Weekly Check-in system — track weight, body fat, and progress over time',
    '👨‍🏫 Trainer Mode — connect with a trainer via 6-char code so they can monitor your progress',
    '🔒 Photo privacy disclosure — transparent handling of profile pics and progress photos',
    '🏆 35+ new achievements — class-specific PRs, goal-based (5 down/10 down), behavioral (Dawn Patrol, Clockwork), and more secrets',
    '🎯 11 new daily missions — cold plunge, meditation, PR hunt, tech detox, gallon challenge, and more',
    '🎪 5 new event missions — PR Day (50 XP), Bullseye protein target, Double Move, Early Grind, Check-in day',
    '🔧 Fixed activity entries breaking streak/PR calculations',
    '🔧 Workout vs activity counts now tracked separately on profile + leaderboard'
  ]},
  {version:'1.9.2',date:'Apr 2026',title:'Activity Logging & Fixes',items:[
    '🏃 Cardio / Activity logging — walking, running, bowling, and 13 more activities with auto calorie estimates',
    '📊 XP bar now shows remaining XP to next rank (not total threshold)',
    '🎪 Event missions fixed — proper 30% daily distribution',
    '🔥 Weekend/Holiday XP banner now properly displays',
    '✏️ Edit past food logs — add or remove items from any date',
    '🔔 Notification timing improved (fires on app open, wider window)',
    '🏆 New cardio achievements'
  ]},
  {version:'1.9.0',date:'Apr 2026',title:'Polish & Community',items:[
    '⚙️ Full TDEE editor on Nutrition page — height, weight, sex, steps, all in one place',
    '👋 Welcome message for all new users from the founder',
    '🏆 Achievement filtering — toggle locked/unlocked, collapsible sections',
    '🤫 Secret achievements — hidden until unlocked',
    '📧 Welcome email on signup'
  ]},
  {version:'1.8.0',date:'Apr 2026',title:'Progression System',items:[
    '🎮 CoD-style progression tracks — 3 tiers per class',
    '🎪 Random event missions — bonus XP with ~30% daily chance',
    '🔥 Weekend 1.5x XP + First of Month 2x XP',
    '📅 Weekly streak system (3+ sessions/week = streak continues)',
    '🏆 65+ achievements rebalanced with sane XP values',
    '🔔 Smart notifications (push if installed, badges if not)',
    '📊 XP milestone achievements (1K, 5K, 10K)',
    '📝 New achievements: bio, profile pic, barcode pro, chatty, and more'
  ]},
  {version:'1.7.0',date:'Apr 2026',title:'Nutrition Overhaul',items:[
    '🍽️ Meal-based food logging — Meal 1, Meal 2, etc. with per-meal macro tracking',
    '⚙️ TDEE Setup Wizard — configure everything right on the Nutrition page',
    '🚶 Daily steps estimation factored into calorie calculations',
    '🎯 Nutrition goals — Cut, Lean Bulk, Recomp, Maintenance & more',
    '📊 Per-meal mini progress bars and remaining macro hints',
    '🗺️ Improved onboarding tour covering all features',
    '🅰️ Full Body ABC program template (shared across all classes)'
  ]},
  {version:'1.6.0',date:'Apr 2026',title:'Class Missions & Social',items:[
    '🎯 Class-specific daily missions — tailored to your class',
    '👤 Tap leaderboard users to view profile & add friend',
    '📝 Bio / About Me — show off your story',
    '📋 Copy friend code with one tap',
    '🛡️ XP exploit fix — no more double-logging',
    '📋 "Log All Days" — log multiple workout days at once',
    '📋 Log button now shows which day you\'re logging'
  ]},
  {version:'1.5.0',date:'Apr 2026',title:'Social & QoL Update',items:[
    '💬 Chat unread badge — see new messages at a glance',
    '🗺️ Onboarding tour — new users get a guided walkthrough',
    '🔥 Streak warnings — alerts when your streak is at risk',
    '⚙️ TDEE fix — added biological sex for accurate calorie calculations',
    '🏆 15 new achievements — more dopamine, more grind',
    '🔒 Tightened Firestore security rules'
  ]},
  {version:'1.4.0',date:'Mar 2026',title:'Chat & AI Coach',items:[
    '💬 Friend-to-friend messaging',
    '🤖 AI Coach with personalized advice',
    '📸 Barcode scanner for food logging',
    '🍽️ Serving size selector with unit conversion'
  ]},
  {version:'1.3.0',date:'Feb 2026',title:'Nutrition Tracker',items:[
    '🍽️ Full nutrition tracking with TDEE/macro calculator',
    '🔍 Food search via Open Food Facts',
    '✏️ Manual food entry',
    '📊 Daily macro progress bars'
  ]},
  {version:'1.2.0',date:'Feb 2026',title:'Social Features',items:[
    '👥 Friends system with 6-character codes',
    '🏅 Leaderboard (global + friends)',
    '📋 Daily missions with streak tracking',
    '⚔️ Rank-up trials (Iron Gate, Gauntlet, Awakening)'
  ]},
  {version:'1.0.0',date:'Jan 2026',title:'Launch',items:[
    '🚀 LexenFitness goes live',
    '🏋️ Class-based workout programs',
    '📈 XP & ranking system (E through S rank)',
    '📋 Workout logging with weekly progression'
  ]}
];
const RANKS=[
  {name:'E-RANK',min:0,color:'#7c7c9a',auto:true,levels:10,xpPerLevel:50,lore:'You have entered the System. The weakest hunters begin here. Prove yourself.',
    title:{Powerlifter:'Novice Lifter',Bodybuilder:'Untested Rookie',Strongman:'Raw Initiate',Athlete:'Unranked Prospect'}},
  {name:'D-RANK',min:500,color:'#34d399',auto:true,levels:15,xpPerLevel:67,lore:'You survived the early gates. Most hunters plateau here. Will you?',
    title:{Powerlifter:'Iron Lifter',Bodybuilder:'Sculptor',Strongman:'Brawler',Athlete:'Contender'}},
  {name:'C-RANK',min:1500,color:'#22d3ee',auto:true,levels:20,xpPerLevel:100,lore:'You have drawn the System\'s attention. Stronger gates await.',
    title:{Powerlifter:'Iron Will',Bodybuilder:'Aesthetic Warrior',Strongman:'Juggernaut',Athlete:'Competitor'}},
  {name:'B-RANK',min:3500,color:'#a78bfa',auto:false,trial:'iron_gate',levels:30,xpPerLevel:117,lore:'The Iron Gate separates the committed from the casual. Only discipline passes through.',
    title:{Powerlifter:'Powerhouse',Bodybuilder:'Phenom',Strongman:'Warlord',Athlete:'Elite Hunter'}},
  {name:'A-RANK',min:7000,color:'#fb923c',auto:false,trial:'gauntlet',levels:50,xpPerLevel:160,lore:'The Gauntlet tests your will beyond limits. Few survive. Fewer emerge stronger.',
    title:{Powerlifter:'Monster',Bodybuilder:'Olympian',Strongman:'Colossus',Athlete:'All-Star'}},
  {name:'S-RANK',min:15000,color:'#fbbf24',auto:false,trial:'awakening',levels:100,xpPerLevel:400,lore:'The Awakening. You stand at the pinnacle. The System recognizes you as the strongest.',
    title:{Powerlifter:'Titan',Bodybuilder:'Mr. Universe',Strongman:'Behemoth',Athlete:'Apex Predator'}}
];
const RANK_TRIALS={
  iron_gate:{name:'THE IRON GATE',rank:'B-RANK',desc:'Only the disciplined pass through.',icon:'🚪',
    tasks:[{id:'perfect_weeks_3',desc:'Complete 3 perfect weeks (all sets ✓, all days logged)',target:3}]},
  gauntlet:{name:'THE GAUNTLET',rank:'A-RANK',desc:'The System demands proof of relentless will.',icon:'⚔️',
    tasks:[{id:'streak_14',desc:'14-day consecutive logging streak',target:14},{id:'log_pr',desc:'Log a 225+ lb compound lift',target:225}]},
  awakening:{name:'THE AWAKENING',rank:'S-RANK',desc:'Final trial. Transcend your limits.',icon:'👁️',
    tasks:[{id:'streak_30',desc:'30-day logging streak',target:30},{id:'missions_7',desc:'All daily missions completed 7 days straight',target:7},{id:'workouts_50',desc:'50+ total workouts logged',target:50}]}
};
const CLASSES=[
  {id:'Powerlifter',icon:'🏋️',desc:'Squat, bench, deadlift — chase numbers',bonus:'+2x XP on PRs',color:'#f87171'},
  {id:'Bodybuilder',icon:'💪',desc:'Hypertrophy & volume — sculpt the physique',bonus:'+2x XP full sessions',color:'#a78bfa'},
  {id:'Strongman',icon:'🪨',desc:'Odd lifts, carries, brutal conditioning',bonus:'+2x XP endurance',color:'#fb923c'},
  {id:'Athlete',icon:'⚡',desc:'Sport-specific power & performance',bonus:'+2x XP streaks',color:'#22d3ee',
    subclasses:['Basketball','Football','Soccer','MMA','Track & Field','Swimming','General']}
];
const CLASS_PROGRAMS={
  Powerlifter:[
    {key:'pl_classic',name:'Classic Powerlifting',desc:'SBD focused, low rep, peak strength',icon:'🏋️',days:[
      {id:'day1',title:'SQUAT DAY',subtitle:'Monday',exercises:[{name:'Back Squat',sets:5,reps:'3-5'},{name:'Pause Squat',sets:3,reps:'3-5'},{name:'Leg Press',sets:3,reps:'8-10'},{name:'Barbell Lunges',sets:3,reps:'8/leg'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
      {id:'day2',title:'BENCH DAY',subtitle:'Tuesday',exercises:[{name:'Barbell Bench Press',sets:5,reps:'3-5'},{name:'Close-Grip Bench',sets:3,reps:'6-8'},{name:'Overhead Press',sets:3,reps:'6-8'},{name:'Dumbbell Rows',sets:3,reps:'8-10'},{name:'Tricep Dips',sets:3,reps:'8-12'}]},
      {id:'day3',title:'DEADLIFT DAY',subtitle:'Thursday',exercises:[{name:'Conventional Deadlift',sets:5,reps:'3-5'},{name:'Deficit Deadlift',sets:3,reps:'3-5'},{name:'Barbell Row',sets:3,reps:'6-8'},{name:'Pull-Ups',sets:3,reps:'6-10'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]},
      {id:'day4',title:'ACCESSORY',subtitle:'Friday',exercises:[{name:'Front Squat',sets:3,reps:'6-8'},{name:'Incline Bench',sets:3,reps:'8-10'},{name:'Romanian Deadlift',sets:3,reps:'8-10'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'Bicep Curls',sets:3,reps:'12-15'}]}]},
    {key:'pl_powerbuild',name:'Powerbuild',desc:'Strength + hypertrophy hybrid',icon:'🔥',days:[
      {id:'day1',title:'HEAVY UPPER',subtitle:'Monday',exercises:[{name:'Barbell Bench Press',sets:5,reps:'3-5'},{name:'Barbell Row',sets:4,reps:'5-8'},{name:'Overhead Press',sets:3,reps:'6-8'},{name:'Lat Pulldown',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:3,reps:'12-15'},{name:'Tricep Pushdowns',sets:3,reps:'10-12'}]},
      {id:'day2',title:'HEAVY LOWER',subtitle:'Tuesday',exercises:[{name:'Back Squat',sets:5,reps:'3-5'},{name:'Romanian Deadlift',sets:4,reps:'6-8'},{name:'Leg Press',sets:3,reps:'10-12'},{name:'Leg Curl',sets:3,reps:'10-12'},{name:'Calf Raises',sets:4,reps:'12-15'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
      {id:'day3',title:'VOLUME UPPER',subtitle:'Thursday',exercises:[{name:'Incline DB Press',sets:4,reps:'8-12'},{name:'Cable Row',sets:4,reps:'10-12'},{name:'DB Shoulder Press',sets:3,reps:'10-12'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'EZ Bar Curl',sets:3,reps:'10-12'},{name:'Overhead Tricep Ext',sets:3,reps:'10-12'}]},
      {id:'day4',title:'VOLUME LOWER',subtitle:'Friday',exercises:[{name:'Conventional Deadlift',sets:4,reps:'3-5'},{name:'Front Squat',sets:3,reps:'8-10'},{name:'Bulgarian Split Squat',sets:3,reps:'10/leg'},{name:'Leg Extension',sets:3,reps:'12-15'},{name:'Seated Calf Raises',sets:4,reps:'12-15'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]}]},
    {key:'pl_powerbuild2',name:'Powerbuild 2.0',desc:'DUP periodization — advanced',icon:'⚡',days:[
      {id:'day1',title:'STRENGTH A',subtitle:'Monday',exercises:[{name:'Back Squat',sets:4,reps:'2-4'},{name:'Bench Press',sets:4,reps:'2-4'},{name:'Pendlay Row',sets:4,reps:'5-8'},{name:'Dips (weighted)',sets:3,reps:'6-8'},{name:'Ab Wheel',sets:3,reps:'10-15'}]},
      {id:'day2',title:'HYPERTROPHY A',subtitle:'Tuesday',exercises:[{name:'Incline DB Press',sets:4,reps:'10-12'},{name:'Cable Row',sets:4,reps:'10-12'},{name:'Arnold Press',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:4,reps:'15-20'},{name:'Hammer Curls',sets:3,reps:'12-15'},{name:'Rope Pushdowns',sets:3,reps:'12-15'}]},
      {id:'day3',title:'STRENGTH B',subtitle:'Thursday',exercises:[{name:'Conventional Deadlift',sets:4,reps:'2-4'},{name:'Overhead Press',sets:4,reps:'4-6'},{name:'Weighted Pull-Ups',sets:4,reps:'5-8'},{name:'Close-Grip Bench',sets:3,reps:'6-8'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]},
      {id:'day4',title:'HYPERTROPHY B',subtitle:'Friday',exercises:[{name:'Leg Press',sets:4,reps:'10-15'},{name:'Romanian Deadlift',sets:4,reps:'10-12'},{name:'Walking Lunges',sets:3,reps:'12/leg'},{name:'Leg Curl',sets:3,reps:'12-15'},{name:'Leg Extension',sets:3,reps:'12-15'},{name:'Calf Raises',sets:4,reps:'15-20'}]}]}
  ],
  Bodybuilder:[
    {key:'bb_ppl',name:'Push / Pull / Legs',desc:'Classic split — balanced growth',icon:'💪',days:[
      {id:'day1',title:'PUSH',subtitle:'Chest, Shoulders, Tris',exercises:[{name:'Barbell Bench Press',sets:4,reps:'8-10'},{name:'Incline DB Press',sets:4,reps:'10-12'},{name:'Cable Flyes',sets:3,reps:'12-15'},{name:'DB Shoulder Press',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:4,reps:'12-15'},{name:'Overhead Tricep Ext',sets:3,reps:'10-12'},{name:'Tricep Pushdowns',sets:3,reps:'12-15'}]},
      {id:'day2',title:'PULL',subtitle:'Back & Biceps',exercises:[{name:'Barbell Row',sets:4,reps:'8-10'},{name:'Lat Pulldown',sets:4,reps:'10-12'},{name:'Cable Row',sets:3,reps:'10-12'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'Barbell Curl',sets:3,reps:'10-12'},{name:'Hammer Curls',sets:3,reps:'12-15'}]},
      {id:'day3',title:'LEGS',subtitle:'Full Lower',exercises:[{name:'Back Squat',sets:4,reps:'8-10'},{name:'Romanian Deadlift',sets:4,reps:'10-12'},{name:'Leg Press',sets:3,reps:'10-12'},{name:'Leg Curl',sets:3,reps:'10-12'},{name:'Leg Extension',sets:3,reps:'12-15'},{name:'Calf Raises',sets:4,reps:'12-15'}]},
      {id:'day4',title:'UPPER',subtitle:'Detail & Arms',exercises:[{name:'Arnold Press',sets:4,reps:'10-12'},{name:'Chest-Supported Row',sets:4,reps:'10-12'},{name:'Cable Lateral Raise',sets:3,reps:'12-15'},{name:'Rear Delt Fly',sets:3,reps:'12-15'},{name:'EZ Bar Curl',sets:3,reps:'10-12'},{name:'Skull Crushers',sets:3,reps:'10-12'}]}]},
    {key:'bb_brosplit',name:'Bro Split',desc:'One muscle group per day',icon:'🎯',days:[
      {id:'day1',title:'CHEST & TRIS',subtitle:'Monday',exercises:[{name:'Flat Bench',sets:4,reps:'8-10'},{name:'Incline DB Press',sets:4,reps:'10-12'},{name:'Cable Flyes',sets:3,reps:'12-15'},{name:'Dips',sets:3,reps:'8-12'},{name:'Tricep Pushdowns',sets:3,reps:'10-12'},{name:'Overhead Tricep Ext',sets:3,reps:'10-12'}]},
      {id:'day2',title:'BACK & BIS',subtitle:'Tuesday',exercises:[{name:'Deadlift',sets:4,reps:'6-8'},{name:'Barbell Row',sets:4,reps:'8-10'},{name:'Lat Pulldown',sets:3,reps:'10-12'},{name:'Cable Row',sets:3,reps:'10-12'},{name:'Barbell Curl',sets:3,reps:'10-12'},{name:'Incline DB Curl',sets:3,reps:'12-15'}]},
      {id:'day3',title:'SHOULDERS',subtitle:'Thursday',exercises:[{name:'Overhead Press',sets:4,reps:'6-8'},{name:'Lateral Raise',sets:4,reps:'12-15'},{name:'Rear Delt Fly',sets:4,reps:'12-15'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'Shrugs',sets:3,reps:'10-12'}]},
      {id:'day4',title:'LEGS',subtitle:'Friday',exercises:[{name:'Back Squat',sets:4,reps:'8-10'},{name:'Romanian Deadlift',sets:4,reps:'10-12'},{name:'Leg Press',sets:3,reps:'10-12'},{name:'Leg Curl',sets:3,reps:'10-12'},{name:'Walking Lunges',sets:3,reps:'10/leg'},{name:'Calf Raises',sets:4,reps:'15-20'}]}]},
    {key:'bb_volume',name:'High Volume (GVT)',desc:'10x10 on compounds — serious growth',icon:'📈',days:[
      {id:'day1',title:'CHEST & BACK',subtitle:'Monday',exercises:[{name:'Bench Press (10x10)',sets:10,reps:'10'},{name:'Barbell Row (10x10)',sets:10,reps:'10'},{name:'DB Flyes',sets:3,reps:'12-15'},{name:'Face Pulls',sets:3,reps:'12-15'}]},
      {id:'day2',title:'LEGS',subtitle:'Tuesday',exercises:[{name:'Back Squat (10x10)',sets:10,reps:'10'},{name:'Leg Curl',sets:3,reps:'12-15'},{name:'Calf Raises',sets:3,reps:'15-20'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
      {id:'day3',title:'SHOULDERS & ARMS',subtitle:'Thursday',exercises:[{name:'OHP (10x10)',sets:10,reps:'10'},{name:'EZ Bar Curl',sets:3,reps:'10-12'},{name:'Skull Crushers',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:3,reps:'15-20'}]},
      {id:'day4',title:'POSTERIOR',subtitle:'Friday',exercises:[{name:'RDL (10x10)',sets:10,reps:'10'},{name:'Pull-Ups',sets:3,reps:'8-12'},{name:'Cable Row',sets:3,reps:'10-12'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]}]}
  ],
  Strongman:[
    {key:'sm_classic',name:'Classic Strongman',desc:'Events + raw strength',icon:'🪨',days:[
      {id:'day1',title:'PRESS DAY',subtitle:'Monday',exercises:[{name:'Overhead Press',sets:5,reps:'3-5'},{name:'Push Press',sets:3,reps:'5-8'},{name:'Incline Bench',sets:3,reps:'8-10'},{name:'DB Press',sets:3,reps:'10-12'},{name:'Tricep Dips',sets:3,reps:'8-12'}]},
      {id:'day2',title:'DEADLIFT & CARRY',subtitle:'Tuesday',exercises:[{name:'Deadlift',sets:5,reps:'3-5'},{name:'Farmers Walk',sets:4,reps:'40m'},{name:'Barbell Row',sets:4,reps:'6-8'},{name:'Good Mornings',sets:3,reps:'8-10'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
      {id:'day3',title:'SQUAT & LOAD',subtitle:'Thursday',exercises:[{name:'Back Squat',sets:5,reps:'3-5'},{name:'Front Squat',sets:3,reps:'6-8'},{name:'Walking Lunges',sets:3,reps:'10/leg'},{name:'Sandbag Load',sets:4,reps:'5'},{name:'Calf Raises',sets:4,reps:'12-15'}]},
      {id:'day4',title:'EVENT DAY',subtitle:'Friday',exercises:[{name:'Tire Flips / Box Jumps',sets:5,reps:'5'},{name:'Sled Push/Pull',sets:4,reps:'30m'},{name:'Keg Carry',sets:3,reps:'40m'},{name:'Pull-Ups',sets:3,reps:'5-8'},{name:'Ab Wheel',sets:3,reps:'10-15'}]}]},
    {key:'sm_conditioning',name:'Strongman Conditioning',desc:'Events + endurance',icon:'🫁',days:[
      {id:'day1',title:'PUSH & CARRY',subtitle:'Monday',exercises:[{name:'Overhead Press',sets:4,reps:'5-8'},{name:'Push Press',sets:3,reps:'5-8'},{name:'Farmers Walk',sets:5,reps:'50m'},{name:'Sled Push',sets:4,reps:'40m'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
      {id:'day2',title:'PULL & DRAG',subtitle:'Tuesday',exercises:[{name:'Deadlift',sets:4,reps:'3-5'},{name:'Barbell Row',sets:4,reps:'6-8'},{name:'Sled Drag',sets:4,reps:'40m'},{name:'Pull-Ups',sets:3,reps:'5-8'},{name:'Battle Ropes',sets:4,reps:'30s',isTime:true}]},
      {id:'day3',title:'SQUAT & LOAD',subtitle:'Thursday',exercises:[{name:'Back Squat',sets:4,reps:'5-8'},{name:'Sandbag Load',sets:5,reps:'3'},{name:'Walking Lunges',sets:3,reps:'10/leg'},{name:'Box Jumps',sets:3,reps:'8'},{name:'Prowler Sprint',sets:4,reps:'30m'}]},
      {id:'day4',title:'MEDLEY',subtitle:'Friday',exercises:[{name:'Tire Flips',sets:3,reps:'8'},{name:'Keg Carry',sets:3,reps:'40m'},{name:'Farmers Walk',sets:3,reps:'50m'},{name:'Burpees',sets:3,reps:'15'},{name:'KB Swings',sets:3,reps:'20'}]}]}
  ],
  Athlete:[
    {key:'ath_performance',name:'Athletic Performance',desc:'Power, speed, agility',icon:'⚡',days:[
      {id:'day1',title:'POWER',subtitle:'Monday',exercises:[{name:'Power Clean',sets:4,reps:'3-5'},{name:'Box Jumps',sets:4,reps:'5'},{name:'Back Squat',sets:4,reps:'5-8'},{name:'Broad Jumps',sets:3,reps:'5'},{name:'Plank',sets:3,reps:'45s',isTime:true}]},
      {id:'day2',title:'UPPER STRENGTH',subtitle:'Tuesday',exercises:[{name:'Bench Press',sets:4,reps:'6-8'},{name:'Pull-Ups',sets:4,reps:'6-10'},{name:'DB Shoulder Press',sets:3,reps:'8-10'},{name:'Barbell Row',sets:3,reps:'8-10'},{name:'Med Ball Slam',sets:3,reps:'10'}]},
      {id:'day3',title:'SPEED & AGILITY',subtitle:'Thursday',exercises:[{name:'Front Squat',sets:4,reps:'5-8'},{name:'Romanian Deadlift',sets:3,reps:'8-10'},{name:'Bulgarian Split Squat',sets:3,reps:'8/leg'},{name:'Lateral Lunges',sets:3,reps:'8/side'},{name:'Sprint Intervals',sets:6,reps:'30s',isTime:true}]},
      {id:'day4',title:'CONDITIONING',subtitle:'Friday',exercises:[{name:'Hang Clean',sets:3,reps:'5'},{name:'KB Swings',sets:4,reps:'15'},{name:'Battle Ropes',sets:4,reps:'30s',isTime:true},{name:'Farmer Walks',sets:3,reps:'40m'},{name:'Russian Twists',sets:3,reps:'20'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]}]},
    {key:'ath_sport',name:'Sport-Specific',desc:'Tailored to your sport',icon:'🏆',days:[
      {id:'day1',title:'STRENGTH',subtitle:'Monday',exercises:[{name:'Back Squat',sets:4,reps:'5-8'},{name:'Bench Press',sets:4,reps:'6-8'},{name:'Barbell Row',sets:3,reps:'8-10'},{name:'Overhead Press',sets:3,reps:'8-10'},{name:'Core Circuit',sets:3,reps:'45s',isTime:true}]},
      {id:'day2',title:'EXPLOSIVE',subtitle:'Tuesday',exercises:[{name:'Power Clean',sets:4,reps:'3-5'},{name:'Box Jumps',sets:4,reps:'5'},{name:'Trap Bar Deadlift',sets:4,reps:'5'},{name:'Plyo Push-Ups',sets:3,reps:'8'},{name:'Broad Jumps',sets:3,reps:'5'}]},
      {id:'day3',title:'MOVEMENT',subtitle:'Thursday',exercises:[{name:'Front Squat',sets:3,reps:'6-8'},{name:'Single-Leg RDL',sets:3,reps:'8/leg'},{name:'Lateral Bounds',sets:4,reps:'6/side'},{name:'Shuttle Runs',sets:6,reps:'20m'},{name:'Copenhagen Plank',sets:3,reps:'20s/side',isTime:true}]},
      {id:'day4',title:'ENDURANCE',subtitle:'Friday',exercises:[{name:'Sled Push',sets:4,reps:'30m'},{name:'KB Swings',sets:4,reps:'20'},{name:'Rowing',sets:4,reps:'500m'},{name:'Burpees',sets:3,reps:'12'},{name:'Farmer Walks',sets:3,reps:'40m'}]}]}
  ]
};
const SHARED_PROGRAMS=[
  {key:'fb_abc',name:'Full Body ABC',desc:'3-day full body — strength & hypertrophy',icon:'🅰️',days:[
    {id:'day1',title:'WORKOUT A',subtitle:'Full Body — Compound Focus',notes:'Rest: 2-3 min for compounds, 60-90 sec for accessories. Warm up with 5-10 min cardio + dynamic stretching.',exercises:[
      {name:'Squats (Barbell or Goblet)',sets:4,reps:'4-8',notes:'Push to near failure; 2-3 min rest'},
      {name:'Bench Press (Barbell/Dumbbell)',sets:4,reps:'4-8',notes:'Warm-up sets first'},
      {name:'Bent-Over Rows (Barbell/Dumbbell)',sets:3,reps:'4-8',notes:'Focus on form'},
      {name:'Overhead Press (Dumbbell/Machine)',sets:3,reps:'4-8',notes:'Seated if possible'},
      {name:'Romanian Deadlifts',sets:3,reps:'4-8',notes:'Controlled descent'},
      {name:'Plank',sets:3,reps:'20-30s',isTime:true,notes:'If time allows'}
    ]},
    {id:'day2',title:'WORKOUT B',subtitle:'Full Body — Posterior Chain',notes:'Rest: 60-90 sec between sets for hypertrophy, 2-3 min for main compound lifts.',exercises:[
      {name:'Romanian Deadlifts',sets:4,reps:'4-8',notes:'Replacement for deadlifts'},
      {name:'Incline Press (Dumbbell)',sets:4,reps:'4-8',notes:'Slight incline'},
      {name:'Pull-Ups or Lat Pulldowns',sets:3,reps:'4-8',notes:'Assisted if needed'},
      {name:'Leg Extensions',sets:3,reps:'4-8',notes:'Alternate legs if lunges'},
      {name:'Tricep Extensions',sets:3,reps:'4-8',notes:'Assisted dips alternative'},
      {name:'Leg Raises (Optional Core)',sets:3,reps:'8-12',notes:'Hanging or lying'}
    ]},
    {id:'day3',title:'WORKOUT C',subtitle:'Full Body — Compound + Core',notes:'Rest: 60-90 sec between sets for hypertrophy, 2-3 min for main compound lifts. Always warm up with 5-10 min cardio + dynamic stretching.',exercises:[
      {name:'Front Squats (Barbell or Dumbbell)',sets:4,reps:'4-8',notes:'Variation for emphasis'},
      {name:'Dumbbell Bench Press',sets:4,reps:'4-8',notes:'Flat or slight incline'},
      {name:'Seated Rows (Cable or Machine)',sets:3,reps:'4-8',notes:'Squeeze at top'},
      {name:'Arnold Press (Dumbbell)',sets:3,reps:'4-8',notes:'Rotational movement'},
      {name:'Good Mornings or Hamstring Curls',sets:3,reps:'4-8',notes:'Light weight for form'},
      {name:'Bicycle Crunches (Optional Core)',sets:3,reps:'10-15/side',notes:'Alternate sides'}
    ]}
  ]}
];
// Append shared programs to all classes
Object.keys(CLASS_PROGRAMS).forEach(k=>CLASS_PROGRAMS[k]=[...CLASS_PROGRAMS[k],...SHARED_PROGRAMS]);
const UNIVERSAL_MISSIONS=[
  {id:'water_8',icon:'💧',name:'Hydrate',desc:'Drink 8 glasses of water',xp:15},
  {id:'protein',icon:'🥩',name:'Protein Goal',desc:'Hit your protein target',xp:15},
  {id:'sleep_7',icon:'😴',name:'Recovery',desc:'Get 7+ hours of sleep',xp:15},
  {id:'stretch',icon:'🧘',name:'Limber Up',desc:'5 min of stretching',xp:10},
  {id:'veggies',icon:'🥗',name:'Eat Your Greens',desc:'3+ servings of vegetables',xp:10},
  {id:'no_junk',icon:'🚫',name:'Clean Eater',desc:'No junk food today',xp:15},
  {id:'read_15',icon:'📖',name:'Brain Gains',desc:'Read for 15 minutes',xp:10},
  {id:'stairs',icon:'🪜',name:'Elevate',desc:'Take the stairs all day',xp:10},
  {id:'cook',icon:'🍳',name:'Chef Mode',desc:'Cook a meal from scratch',xp:10},
  {id:'no_sugar',icon:'💦',name:'Sugar Free',desc:'No sugary drinks today',xp:10},
  {id:'gratitude',icon:'🙏',name:'Mindset',desc:'Write 3 things you\'re grateful for',xp:10},
  {id:'walk_15',icon:'🌳',name:'Fresh Air',desc:'15-min outdoor walk',xp:10},
  {id:'posture',icon:'🧍',name:'Stand Tall',desc:'Focus on posture all day',xp:10},
  {id:'meal_prep',icon:'🥡',name:'Prep Master',desc:'Meal prep for tomorrow',xp:15},
  {id:'no_phone',icon:'📵',name:'Unplug',desc:'No phone 30 min before bed',xp:10},
  {id:'steps_10k',icon:'🚶',name:'Step It Up',desc:'Walk 10,000 steps',xp:20},
  {id:'abs_5min',icon:'🔥',name:'Core Blast',desc:'5-min ab routine',xp:10},
  // New universal missions
  {id:'cold_shower',icon:'🥶',name:'Cold Plunge',desc:'2-min cold shower or ice bath',xp:15},
  {id:'meditate',icon:'🧠',name:'Meditate',desc:'5 min of meditation or breathwork',xp:10},
  {id:'pr_hunt',icon:'🎯',name:'PR Hunt',desc:'Add weight or reps over last session on any lift',xp:20},
  {id:'call_friend',icon:'📞',name:'Connect',desc:'Call or message a friend/family member',xp:10},
  {id:'tech_detox',icon:'🚫',name:'Tech Detox',desc:'1 hour with phone off',xp:15},
  {id:'journal',icon:'📓',name:'Journal',desc:'Write for 5 minutes',xp:10},
  {id:'cook_social',icon:'👨‍🍳',name:'Break Bread',desc:'Cook and eat a meal with family/friends',xp:15},
  {id:'no_alcohol',icon:'🚱',name:'Dry Day',desc:'No alcohol today',xp:15},
  {id:'nap',icon:'💤',name:'Power Nap',desc:'20-30 min nap',xp:10},
  {id:'gallon',icon:'🚰',name:'Gallon Challenge',desc:'Drink a full gallon of water',xp:20},
  {id:'sunlight',icon:'☀️',name:'Sunshine',desc:'10+ min of direct sunlight',xp:10},
  {id:'stretch_long',icon:'🤸',name:'Deep Stretch',desc:'15+ min mobility/yoga session',xp:15}
];
const CLASS_MISSIONS={
  Powerlifter:[
    {id:'pl_heavy_single',icon:'🏋️',name:'Heavy Single',desc:'Work up to a heavy single on any compound',xp:25},
    {id:'pl_pause_reps',icon:'⏸️',name:'Pause Reps',desc:'3 sets of paused reps on squat, bench, or deadlift',xp:20},
    {id:'pl_pr_attempt',icon:'📈',name:'PR Attempt',desc:'Attempt a new PR on any lift',xp:30},
    {id:'pl_mobility',icon:'🧘',name:'Squat Mobility',desc:'10 min hip & ankle mobility work',xp:15},
    {id:'pl_accessories',icon:'🔧',name:'Weak Point Work',desc:'Extra accessory work on your weakest lift',xp:15},
    {id:'pl_tempo',icon:'⏱️',name:'Tempo Work',desc:'3 sets with 3-sec eccentrics on a compound',xp:20},
    {id:'pl_belt_squat',icon:'🦵',name:'Volume Legs',desc:'100 total reps of leg work (any exercise)',xp:20},
    {id:'pl_grip',icon:'✊',name:'Grip Training',desc:'5 min of grip/forearm work',xp:10},
    {id:'pl_walkout',icon:'🚶',name:'Heavy Walkout',desc:'Unrack and hold 100%+ of your squat max',xp:15},
    {id:'pl_cardio',icon:'🏃',name:'Active Recovery',desc:'20 min light cardio (walk, bike, swim)',xp:15}
  ],
  Bodybuilder:[
    {id:'bb_pump',icon:'💪',name:'Pump Finisher',desc:'100-rep burnout set on any muscle group',xp:20},
    {id:'bb_posing',icon:'🪞',name:'Posing Practice',desc:'10 min practicing poses',xp:15},
    {id:'bb_slow_ecc',icon:'⏬',name:'Slow Eccentrics',desc:'4-sec negatives on every set this session',xp:25},
    {id:'bb_dropsets',icon:'📉',name:'Drop Set City',desc:'3 exercises with drop sets today',xp:20},
    {id:'bb_mmc',icon:'🧠',name:'Mind-Muscle',desc:'One exercise with eyes closed, pure feel',xp:15},
    {id:'bb_supersets',icon:'⚡',name:'Superset Session',desc:'Pair 3+ exercises as supersets',xp:20},
    {id:'bb_calves',icon:'🦵',name:'Calf Priority',desc:'4 sets of calves (they need it)',xp:10},
    {id:'bb_rear_delts',icon:'🎯',name:'Rear Delt Work',desc:'3 sets of rear delt isolation',xp:10},
    {id:'bb_cardio',icon:'🚶',name:'Incline Walk',desc:'20 min incline treadmill walk',xp:15},
    {id:'bb_flex',icon:'💪',name:'Progress Photo',desc:'Take a progress photo for comparison',xp:10}
  ],
  Strongman:[
    {id:'sm_carry',icon:'🧱',name:'Loaded Carry',desc:'Farmer walks or sandbag carry — 4 sets',xp:25},
    {id:'sm_conditioning',icon:'🫁',name:'Conditioning',desc:'10-min EMOM or Tabata circuit',xp:25},
    {id:'sm_grip',icon:'✊',name:'Grip Work',desc:'Dead hangs, plate pinches, or fat grips',xp:15},
    {id:'sm_events',icon:'🏟️',name:'Event Practice',desc:'Practice a strongman event (tire, stone, sled)',xp:25},
    {id:'sm_sled',icon:'🛷',name:'Sled Work',desc:'Sled push or drag — 6 rounds',xp:20},
    {id:'sm_overhead',icon:'🏋️',name:'Overhead Volume',desc:'50 total overhead press reps',xp:20},
    {id:'sm_core',icon:'🔥',name:'Braced Core',desc:'Heavy carries + planks — brace like competition',xp:15},
    {id:'sm_cardio',icon:'🚣',name:'Row or Bike',desc:'15 min on rower or assault bike',xp:15},
    {id:'sm_stones',icon:'🪨',name:'Atlas Stone Work',desc:'Stone loads or heavy ball slams',xp:20},
    {id:'sm_yoke',icon:'🏗️',name:'Yoke Walk',desc:'Yoke or heavy barbell walk — 4 sets',xp:20}
  ],
  Athlete:[
    {id:'ath_sprints',icon:'🏃',name:'Sprint Intervals',desc:'6-8 sprints, 30 sec on / 60 sec off',xp:25},
    {id:'ath_agility',icon:'🔀',name:'Agility Drill',desc:'Ladder, cone, or shuttle drill — 10 min',xp:20},
    {id:'ath_sport',icon:'🏆',name:'Sport Practice',desc:'30+ min of sport-specific practice',xp:25},
    {id:'ath_plyo',icon:'💥',name:'Plyometrics',desc:'Box jumps, bounds, or depth jumps — 4 sets',xp:20},
    {id:'ath_footwork',icon:'👟',name:'Footwork Drill',desc:'10 min footwork or coordination drill',xp:15},
    {id:'ath_conditioning',icon:'🫁',name:'Game Conditioning',desc:'Sport-simulated conditioning (intervals at game pace)',xp:25},
    {id:'ath_flexibility',icon:'🧘',name:'Dynamic Stretch',desc:'15 min dynamic stretching routine',xp:15},
    {id:'ath_jump',icon:'🦘',name:'Vertical Jump',desc:'Test or train your vertical — 20 max jumps',xp:15},
    {id:'ath_reaction',icon:'⚡',name:'Reaction Drill',desc:'Reaction ball, partner drill, or visual cue work',xp:15},
    {id:'ath_cardio',icon:'🏃',name:'Tempo Run',desc:'20-min steady-state run at moderate pace',xp:20}
  ]
};
// Backwards compat — flat pool for any edge cases
const DAILY_MISSION_POOL=UNIVERSAL_MISSIONS;
const ACHIEVEMENTS=[
  // ── Getting Started (10-25 XP) ──
  {id:'first_workout',icon:'🎯',name:'First Blood',desc:'Complete first workout',xp:25},
  {id:'tour_done',icon:'🗺️',name:'System Initiated',desc:'Complete the onboarding tour',xp:10},
  {id:'customize',icon:'🔧',name:'My Way',desc:'Customize an exercise',xp:10},
  {id:'set_bio',icon:'📝',name:'Identity',desc:'Set your bio',xp:10},
  {id:'set_pic',icon:'📸',name:'Face Reveal',desc:'Upload a profile picture',xp:10},
  {id:'set_prs',icon:'📊',name:'Know Your Numbers',desc:'Record all 4 PR lifts',xp:15},
  // ── Workout Milestones (15-100 XP) ──
  {id:'workouts_10',icon:'💪',name:'Dedicated',desc:'Log 10 workouts',xp:25},
  {id:'workouts_25',icon:'🔥',name:'On Fire',desc:'Log 25 workouts',xp:40},
  {id:'workouts_50',icon:'⚡',name:'Unstoppable',desc:'Log 50 workouts',xp:50},
  {id:'workouts_100',icon:'👑',name:'Centurion',desc:'Log 100 workouts',xp:75},
  {id:'workouts_200',icon:'💎',name:'Diamond Grind',desc:'Log 200 workouts',xp:75},
  {id:'workouts_300',icon:'🏛️',name:'Legendary',desc:'Log 300 workouts',xp:100},
  {id:'workouts_500',icon:'🌌',name:'Mythic',desc:'Log 500 workouts',xp:100},
  // ── Weekly Streaks (15-100 XP) ──
  {id:'wk_streak_2',icon:'📅',name:'Two Weeks',desc:'2-week training streak',xp:15},
  {id:'wk_streak_4',icon:'🔥',name:'Month Strong',desc:'4-week streak',xp:25},
  {id:'wk_streak_8',icon:'💪',name:'Two Months',desc:'8-week streak',xp:40},
  {id:'wk_streak_12',icon:'🗓️',name:'Iron Discipline',desc:'12-week streak',xp:50},
  {id:'wk_streak_26',icon:'🏆',name:'Half Year',desc:'26-week streak',xp:75},
  {id:'wk_streak_52',icon:'👑',name:'Unbreakable',desc:'52-week streak',xp:100},
  // ── Perfect Weeks ──
  {id:'full_week',icon:'✅',name:'Perfect Week',desc:'All sessions in one week',xp:25},
  {id:'full_week_5',icon:'🏅',name:'Consistency King',desc:'5 perfect weeks',xp:40},
  {id:'full_week_10',icon:'💪',name:'Perfect Ten',desc:'10 perfect weeks',xp:50},
  {id:'full_week_20',icon:'🗡️',name:'Relentless',desc:'20 perfect weeks',xp:75},
  // ── Lifting ──
  {id:'early_bird',icon:'🌅',name:'Early Bird',desc:'Log before 7 AM',xp:15},
  {id:'night_owl',icon:'🌙',name:'Night Owl',desc:'Log after 9 PM',xp:15},
  {id:'midnight',icon:'🕛',name:'Midnight Grind',desc:'Log between 12-4 AM',xp:15},
  {id:'all_sets_done',icon:'💯',name:'No Excuses',desc:'Every set checked',xp:20},
  {id:'heavy_day',icon:'🦾',name:'Heavy Hitter',desc:'200+ lbs logged',xp:20},
  {id:'monster_lift',icon:'🏔️',name:'Mountain Mover',desc:'315+ lbs logged',xp:30},
  {id:'titan_lift',icon:'⚔️',name:'Titan Strength',desc:'405+ lbs logged',xp:50},
  {id:'heavy_500',icon:'🌋',name:'Volcanic Force',desc:'500+ lbs logged',xp:75},
  {id:'variety',icon:'🎨',name:'Well Rounded',desc:'All workout days logged',xp:20},
  {id:'weekend_warrior',icon:'🌅',name:'Weekend Warrior',desc:'Log on Sat & Sun same week',xp:15},
  {id:'pr_breaker',icon:'📈',name:'PR Breaker',desc:'Beat a logged weight',xp:25},
  // ── Social ──
  {id:'add_friend',icon:'🤝',name:'Stronger Together',desc:'Add a friend',xp:15},
  {id:'friends_5',icon:'👥',name:'Squad Goals',desc:'Add 5 friends',xp:25},
  {id:'friends_10',icon:'🎯',name:'Inner Circle',desc:'Add 10 friends',xp:40},
  {id:'chat_first',icon:'💬',name:'Connected',desc:'Send first message',xp:10},
  {id:'chat_10',icon:'💬',name:'Chatty',desc:'Send 10 messages',xp:15},
  // ── Missions ──
  {id:'missions_3',icon:'📋',name:'Mission Ready',desc:'3 missions in one day',xp:10},
  {id:'missions_all',icon:'🌟',name:'Mission Complete',desc:'All missions in one day',xp:20},
  {id:'missions_total_25',icon:'🎖️',name:'Mission Grinder',desc:'Complete 25 total missions',xp:25},
  {id:'missions_total_100',icon:'🎖️',name:'Mission Veteran',desc:'Complete 100 total missions',xp:50},
  {id:'mission_streak_7',icon:'🎖️',name:'Mission Master',desc:'All missions 7 days straight',xp:40},
  {id:'missions_streak_14',icon:'⚡',name:'Mission Legend',desc:'All missions 14 days straight',xp:50},
  {id:'event_first',icon:'🎪',name:'Lucky Day',desc:'Complete a random event mission',xp:15},
  {id:'event_5',icon:'🎪',name:'Fortune Hunter',desc:'Complete 5 event missions',xp:25},
  // ── Nutrition ──
  {id:'food_log_1',icon:'🍽️',name:'Fuel Up',desc:'Log your first meal',xp:10},
  {id:'food_log_7',icon:'📝',name:'Nutrition Tracker',desc:'Log food 7 days',xp:20},
  {id:'food_log_14',icon:'📝',name:'Two Weeks Tracking',desc:'Log food 14 days',xp:30},
  {id:'food_log_30',icon:'📊',name:'Nutrition Master',desc:'Log food 30 days',xp:50},
  {id:'food_log_60',icon:'🥇',name:'Nutrition Elite',desc:'Log food 60 days',xp:75},
  {id:'scan_1',icon:'📸',name:'Scanner',desc:'Scan your first barcode',xp:10},
  {id:'scan_5',icon:'📸',name:'Barcode Pro',desc:'Scan 5 barcodes',xp:15},
  {id:'all_meals',icon:'🍽️',name:'Full Day',desc:'Log food in every meal slot',xp:15},
  {id:'protein_hit',icon:'🥩',name:'Protein Target',desc:'Hit daily protein target',xp:15},
  // ── Rank (0 XP) ──
  {id:'rank_d',icon:'🟢',name:'D-Rank Hunter',desc:'Reach D-Rank',xp:0},
  {id:'rank_c',icon:'🔵',name:'C-Rank Hunter',desc:'Reach C-Rank',xp:0},
  {id:'rank_b',icon:'🟣',name:'Passed the Iron Gate',desc:'B-Rank achieved',xp:0},
  {id:'rank_a',icon:'🟠',name:'Survived the Gauntlet',desc:'A-Rank achieved',xp:0},
  {id:'rank_s',icon:'🌟',name:'Awakened',desc:'S-Rank',xp:0},
  // ── XP Milestones (0 XP) ──
  {id:'xp_1k',icon:'⭐',name:'1K Club',desc:'Reach 1,000 XP',xp:0},
  {id:'xp_5k',icon:'⭐',name:'5K Club',desc:'Reach 5,000 XP',xp:0},
  {id:'xp_10k',icon:'🌟',name:'10K Club',desc:'Reach 10,000 XP',xp:0},
  // ── Cardio / Activity ──
  {id:'cardio_first',icon:'🏃',name:'Active Life',desc:'Log your first cardio/activity',xp:10},
  {id:'cardio_5',icon:'🏃',name:'Cardio Regular',desc:'Log 5 activities',xp:20},
  {id:'cardio_20',icon:'🏃',name:'Cardio Machine',desc:'Log 20 activities',xp:40},
  // ── Secret Achievements ──
  {id:'secret_founder',icon:'🔑',name:'Founder\'s Circle',desc:'Found by those who look closely...',xp:50,secret:true},
  {id:'secret_5am',icon:'🌑',name:'5AM Club',desc:'Log a workout at exactly 5 AM',xp:25,secret:true},
  {id:'secret_404',icon:'👻',name:'404 Not Found',desc:'Reach exactly 404 XP',xp:25,secret:true},
  {id:'secret_palindrome',icon:'🪞',name:'Mirror',desc:'Log on a palindrome date',xp:25,secret:true},
  {id:'secret_lucky7',icon:'🎰',name:'Lucky 7s',desc:'7 workouts, 7-week streak, 7 friends',xp:50,secret:true},
  {id:'secret_100pct',icon:'💯',name:'Completionist',desc:'Unlock 50 achievements',xp:75,secret:true},
  {id:'secret_night_shift',icon:'🦇',name:'Night Shift',desc:'Log 5 workouts between midnight and 5 AM',xp:40,secret:true},
  {id:'secret_og',icon:'👑',name:'OG Hunter',desc:'Account created before May 2026',xp:50,secret:true},
  // ── Rest & Recovery ──
  {id:'rest_first',icon:'😴',name:'Self-Aware',desc:'Log your first rest day',xp:10},
  {id:'rest_5',icon:'🛏️',name:'Recovery Mindset',desc:'Log 5 rest days',xp:20},
  {id:'recovery_pro',icon:'🧘',name:'Recovery Pro',desc:'Log 20 rest days',xp:40},
  {id:'active_rest_10',icon:'🚶',name:'Never Stops Moving',desc:'Log 10 active rest days',xp:25},
  // ── Weekly Check-ins ──
  {id:'first_weighin',icon:'📏',name:'Baseline',desc:'Log your first weekly check-in',xp:15},
  {id:'weighin_4',icon:'📊',name:'One Month In',desc:'4 weekly check-ins',xp:30},
  {id:'weighin_12',icon:'📈',name:'Quarter Tracker',desc:'12 weekly check-ins',xp:50},
  {id:'weighin_26',icon:'🏆',name:'Half-Year Disciplined',desc:'26 weekly check-ins',xp:75},
  // ── Trainer ──
  {id:'trainer_connected',icon:'👨‍🏫',name:'Coached Up',desc:'Connect with a trainer',xp:25},
  {id:'trainer_first_client',icon:'🧑‍🏫',name:'Mentor',desc:'Onboard your first client (trainers)',xp:50},
  // ── Class-Specific: Powerlifter ──
  {id:'pl_1000_club',icon:'🏛️',name:'1000 Club',desc:'Bench + Squat + Deadlift PRs ≥ 1000 lbs',xp:100},
  {id:'pl_pr_month',icon:'📈',name:'PR Machine',desc:'Beat a PR 5 times in one month',xp:50},
  {id:'pl_bench_100',icon:'💪',name:'Bench Veteran',desc:'Log bench press 100 times',xp:40},
  {id:'pl_squat_100',icon:'🦵',name:'Squat Veteran',desc:'Log squats 100 times',xp:40},
  {id:'pl_dl_100',icon:'⚡',name:'Deadlift Veteran',desc:'Log deadlifts 100 times',xp:40},
  // ── Class-Specific: Bodybuilder ──
  {id:'bb_volume_king',icon:'📊',name:'Volume King',desc:'Log 1000+ total reps in one session',xp:50},
  {id:'bb_pump_week',icon:'🔥',name:'Pump Week',desc:'Train 6 sessions in 7 days',xp:40},
  {id:'bb_symmetry',icon:'⚖️',name:'Symmetry',desc:'Hit all major muscle groups in one week',xp:30},
  {id:'bb_100_session',icon:'💎',name:'100 Sessions',desc:'Log 100 bodybuilder sessions',xp:50},
  // ── Class-Specific: Strongman ──
  {id:'sm_odd_object',icon:'🪨',name:'Odd Object',desc:'Log 5 different carry exercises',xp:30},
  {id:'sm_event_ready',icon:'🏟️',name:'Event Ready',desc:'Hit all 4 Strongman day types in one week',xp:50},
  {id:'sm_grip_master',icon:'✊',name:'Grip Master',desc:'Complete grip mission 20 times',xp:40},
  // ── Class-Specific: Athlete ──
  {id:'ath_sprint_king',icon:'💨',name:'Sprint King',desc:'30 sprint training sessions',xp:40},
  {id:'ath_court_time',icon:'🏆',name:'Court Time',desc:'30 sport-specific sessions',xp:40},
  {id:'ath_jumper',icon:'🦘',name:'Aerial',desc:'20 plyometric sessions',xp:30},
  // ── Goal-Based ──
  {id:'goal_5down',icon:'📉',name:'5 Down',desc:'Lose 5 lbs (via check-ins)',xp:50},
  {id:'goal_10down',icon:'⬇️',name:'10 Down',desc:'Lose 10 lbs',xp:75},
  {id:'goal_5up',icon:'📈',name:'5 Up',desc:'Gain 5 lbs with a PR improvement',xp:50},
  {id:'goal_consistent_cut',icon:'🎯',name:'Consistent Cut',desc:'4 weeks of consecutive check-ins during cut',xp:40},
  {id:'goal_body_recomp',icon:'🔄',name:'Recomp Real',desc:'8 weeks of recomp tracking',xp:60},
  // ── Behavioral / Hard ──
  {id:'dawn_patrol',icon:'🌅',name:'Dawn Patrol',desc:'10 workouts before 6 AM',xp:40},
  {id:'twice_day',icon:'⚡',name:'Twice the Grind',desc:'Log 2 workouts in one day, 3 times',xp:30},
  {id:'perfectionist',icon:'💎',name:'Perfectionist',desc:'10 consecutive perfect weeks',xp:75},
  {id:'same_time',icon:'⏰',name:'Clockwork',desc:'Log at same time of day 14 days straight',xp:40},
  {id:'travel_grind',icon:'✈️',name:'No Excuses',desc:'Log while tagged as traveling',xp:30},
  // ── More Nutrition ──
  {id:'protein_streak_7',icon:'🥩',name:'Protein Week',desc:'Hit protein target 7 days in a row',xp:30},
  {id:'protein_streak_30',icon:'🥩',name:'Protein Month',desc:'Hit protein target 30 days in a row',xp:60,secret:true},
  {id:'macro_master',icon:'🎯',name:'Macro Master',desc:'Hit all 3 macros (±10%) for 7 days',xp:40},
  // ── More Social ──
  {id:'message_100',icon:'💬',name:'Always Chatting',desc:'Send 100 messages',xp:30},
  {id:'help_friend',icon:'🤝',name:'Accountability Partner',desc:'Both you + a friend log same day, 10 times',xp:30},
  // ── More Secrets ──
  {id:'secret_3am',icon:'🕒',name:'Gym Ghost',desc:'Log at 3:33 AM',xp:40,secret:true},
  {id:'secret_7days',icon:'📆',name:'Perfect Attendance',desc:'Log every day of a full calendar week (Sun-Sat)',xp:50,secret:true},
  {id:'secret_no_miss',icon:'🔒',name:'Never Missed',desc:'100 days without a missed week',xp:100,secret:true},
  {id:'secret_bowler',icon:'🎳',name:'Strike',desc:'Log bowling as an activity',xp:20,secret:true},
  // ── Progress Photos ──
  {id:'progress_photo_1',icon:'📸',name:'Before Shot',desc:'Take your first progress photo',xp:10},
  {id:'progress_photo_4',icon:'📸',name:'Visible Progress',desc:'4 progress photos taken',xp:20},
  {id:'progress_photo_12',icon:'📸',name:'Year in Review',desc:'12 progress photos taken',xp:40},
  // ── Pokes ──
  {id:'poke_first',icon:'👋',name:'Poke Buddy',desc:'Send your first poke to a friend',xp:10},
  {id:'poke_streak_3',icon:'🔥',name:'Back and Forth',desc:'3-day poke streak with a friend',xp:15},
  {id:'poke_streak_7',icon:'🔥',name:'Dedicated Poker',desc:'7-day poke streak with a friend',xp:30},
  {id:'poke_streak_30',icon:'🔥',name:'Poke Legend',desc:'30-day poke streak with a friend',xp:75},
];
// ═══════════ COD-STYLE PROGRESSION TRACKS ═══════════
const PROGRESSION_TRACKS={
  Powerlifter:[
    {id:'pl_t1',name:'Iron Foundation',icon:'🔩',desc:'Establish your base',tasks:[
      {id:'pl_t1_1',desc:'Log 5 compound lift sessions',check:'workouts',target:5,xp:15},
      {id:'pl_t1_2',desc:'Hit 135 lbs on any lift',check:'maxlift',target:135,xp:15},
      {id:'pl_t1_3',desc:'Complete all program days in one week',check:'full_weeks',target:1,xp:20}]},
    {id:'pl_t2',name:'Strength Protocol',icon:'🔗',desc:'Build real strength',requires:'pl_t1',tasks:[
      {id:'pl_t2_1',desc:'Log 20 sessions',check:'workouts',target:20,xp:20},
      {id:'pl_t2_2',desc:'Hit 225 lbs on any lift',check:'maxlift',target:225,xp:25},
      {id:'pl_t2_3',desc:'4-week training streak',check:'wk_streak',target:4,xp:25}]},
    {id:'pl_t3',name:'Iron Mastery',icon:'⚔️',desc:'Enter the elite',requires:'pl_t2',tasks:[
      {id:'pl_t3_1',desc:'Log 50 sessions',check:'workouts',target:50,xp:30},
      {id:'pl_t3_2',desc:'Hit 315 lbs on any lift',check:'maxlift',target:315,xp:40},
      {id:'pl_t3_3',desc:'10 perfect weeks',check:'full_weeks',target:10,xp:50}]}
  ],
  Bodybuilder:[
    {id:'bb_t1',name:'Volume I',icon:'💪',desc:'Learn the pump',tasks:[
      {id:'bb_t1_1',desc:'Log 5 sessions',check:'workouts',target:5,xp:15},
      {id:'bb_t1_2',desc:'Complete all program days in one week',check:'full_weeks',target:1,xp:15},
      {id:'bb_t1_3',desc:'Complete 5 class missions',check:'class_missions',target:5,xp:20}]},
    {id:'bb_t2',name:'Volume II',icon:'🔥',desc:'Chase the pump',requires:'bb_t1',tasks:[
      {id:'bb_t2_1',desc:'Log 25 sessions',check:'workouts',target:25,xp:20},
      {id:'bb_t2_2',desc:'4-week training streak',check:'wk_streak',target:4,xp:25},
      {id:'bb_t2_3',desc:'Complete 15 class missions',check:'class_missions',target:15,xp:25}]},
    {id:'bb_t3',name:'Aesthetic Elite',icon:'🏆',desc:'Sculpted physique',requires:'bb_t2',tasks:[
      {id:'bb_t3_1',desc:'Log 75 sessions',check:'workouts',target:75,xp:30},
      {id:'bb_t3_2',desc:'12-week training streak',check:'wk_streak',target:12,xp:40},
      {id:'bb_t3_3',desc:'Complete 40 class missions',check:'class_missions',target:40,xp:50}]}
  ],
  Strongman:[
    {id:'sm_t1',name:'Raw Power',icon:'🪨',desc:'Build the foundation',tasks:[
      {id:'sm_t1_1',desc:'Log 5 sessions',check:'workouts',target:5,xp:15},
      {id:'sm_t1_2',desc:'Hit 200 lbs on any lift',check:'maxlift',target:200,xp:15},
      {id:'sm_t1_3',desc:'Complete 5 class missions',check:'class_missions',target:5,xp:20}]},
    {id:'sm_t2',name:'Brute Force',icon:'⚡',desc:'Unleash the beast',requires:'sm_t1',tasks:[
      {id:'sm_t2_1',desc:'Log 25 sessions',check:'workouts',target:25,xp:20},
      {id:'sm_t2_2',desc:'Hit 315 lbs on any lift',check:'maxlift',target:315,xp:25},
      {id:'sm_t2_3',desc:'4-week training streak',check:'wk_streak',target:4,xp:25}]},
    {id:'sm_t3',name:'Colossus',icon:'🏗️',desc:'Unbreakable',requires:'sm_t2',tasks:[
      {id:'sm_t3_1',desc:'Log 75 sessions',check:'workouts',target:75,xp:30},
      {id:'sm_t3_2',desc:'Hit 405 lbs on any lift',check:'maxlift',target:405,xp:40},
      {id:'sm_t3_3',desc:'12-week training streak',check:'wk_streak',target:12,xp:50}]}
  ],
  Athlete:[
    {id:'ath_t1',name:'Prospect',icon:'🏃',desc:'Enter the arena',tasks:[
      {id:'ath_t1_1',desc:'Log 5 sessions',check:'workouts',target:5,xp:15},
      {id:'ath_t1_2',desc:'Complete 5 class missions',check:'class_missions',target:5,xp:15},
      {id:'ath_t1_3',desc:'Complete all program days in one week',check:'full_weeks',target:1,xp:20}]},
    {id:'ath_t2',name:'Competitor',icon:'🏅',desc:'Sharpen your edge',requires:'ath_t1',tasks:[
      {id:'ath_t2_1',desc:'Log 25 sessions',check:'workouts',target:25,xp:20},
      {id:'ath_t2_2',desc:'4-week training streak',check:'wk_streak',target:4,xp:25},
      {id:'ath_t2_3',desc:'Complete 15 class missions',check:'class_missions',target:15,xp:25}]},
    {id:'ath_t3',name:'Apex Predator',icon:'👑',desc:'Top of the food chain',requires:'ath_t2',tasks:[
      {id:'ath_t3_1',desc:'Log 75 sessions',check:'workouts',target:75,xp:30},
      {id:'ath_t3_2',desc:'12-week training streak',check:'wk_streak',target:12,xp:40},
      {id:'ath_t3_3',desc:'Complete 40 class missions',check:'class_missions',target:40,xp:50}]}
  ]
};
// ═══════════ RANDOM EVENT MISSIONS ═══════════
const EVENT_MISSION_POOL=[
  {id:'evt_double',icon:'⚡',name:'DOUBLE DOWN',desc:'Log 2 separate workouts today',xp:40},
  {id:'evt_protein',icon:'🥩',name:'PROTEIN OVERLOAD',desc:'Hit 150% of your protein target',xp:35},
  {id:'evt_social',icon:'💬',name:'SOCIAL BUTTERFLY',desc:'Send 3 messages to friends',xp:25},
  {id:'evt_allmeals',icon:'🍽️',name:'EVERY BITE COUNTS',desc:'Log food in all meal slots',xp:30},
  {id:'evt_speedrun',icon:'⏱️',name:'SPEED RUN',desc:'Log a workout before 8 AM',xp:35},
  {id:'evt_heavy',icon:'🏋️',name:'HEAVY DAY',desc:'Log a set with 200+ lbs',xp:30},
  {id:'evt_volume',icon:'📊',name:'VOLUME CHECK',desc:'Log 20+ total sets in one workout',xp:35},
  {id:'evt_clean',icon:'🥗',name:'CLEAN SWEEP',desc:'No food over 500 cal in a single entry',xp:25},
  {id:'evt_streak_saver',icon:'🔥',name:'STREAK SAVER',desc:'Train today (any workout)',xp:20},
  {id:'evt_mission_rush',icon:'🎯',name:'MISSION RUSH',desc:'Complete all daily missions',xp:30},
  {id:'evt_midnight',icon:'🌙',name:'MIDNIGHT OIL',desc:'Log a workout after 10 PM',xp:30},
  {id:'evt_explore',icon:'🔍',name:'FOOD EXPLORER',desc:'Scan a new barcode today',xp:25},
  // New event missions
  {id:'evt_pr_day',icon:'🌟',name:'PR DAY',desc:'Beat a previous weight on any lift',xp:50},
  {id:'evt_bullseye',icon:'🎯',name:'BULLSEYE',desc:'Hit exact protein target (±5g)',xp:30},
  {id:'evt_double_move',icon:'🏃',name:'DOUBLE MOVE',desc:'Log a workout AND an activity today',xp:40},
  {id:'evt_early_grind',icon:'🕐',name:'EARLY GRIND',desc:'Train AND log breakfast before 10 AM',xp:35},
  {id:'evt_checkin',icon:'📏',name:'CHECK-IN',desc:'Log a weekly weight check-in',xp:25}
];
function getEventMission(dateStr){
  // Better hash for even distribution
  let h=0;for(let i=0;i<dateStr.length;i++){h=((h<<5)-h)+dateStr.charCodeAt(i);h=Math.imul(h,2654435761);h=h>>>0}
  if(h%100>=30)return null; // ~30% chance
  return EVENT_MISSION_POOL[(h>>>8)%EVENT_MISSION_POOL.length];
}
// ═══════════ XP MULTIPLIERS ═══════════
function getXpMultiplier(){
  const now=new Date(),dow=now.getDay(),dom=now.getDate();
  if(dom===1)return{mult:2,label:'🎉 FIRST OF THE MONTH — 2x XP'};
  if(dow===0||dow===6)return{mult:1.5,label:'🔥 WEEKEND — 1.5x XP'};
  return{mult:1,label:null};
}

const GOALS=['Fat Loss','Muscle Gain','Build Strength','General Fitness','Athletic Performance','Body Recomp'];
const EXPERIENCE=['Beginner (< 1 year)','Intermediate (1-3 years)','Advanced (3+ years)','Elite (5+ years)'];
const ACTIVITY_LEVELS=[
  {id:'sedentary',name:'Sedentary',desc:'Desk job, little exercise',mult:1.2},
  {id:'light',name:'Lightly Active',desc:'Light exercise 1-3 days/wk',mult:1.375},
  {id:'moderate',name:'Moderately Active',desc:'Exercise 3-5 days/wk',mult:1.55},
  {id:'active',name:'Very Active',desc:'Hard exercise 6-7 days/wk',mult:1.725},
  {id:'extreme',name:'Extremely Active',desc:'Athlete / physical job + training',mult:1.9}
];
function getRank(xp){for(let i=RANKS.length-1;i>=0;i--)if(xp>=RANKS[i].min)return RANKS[i];return RANKS[0]}
function getNextRank(xp){for(let i=0;i<RANKS.length;i++)if(xp<RANKS[i].min)return RANKS[i];return null}
function genFriendCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let r='';for(let i=0;i<6;i++)r+=c[Math.floor(Math.random()*c.length)];return r}
function getDailyMissions(dateStr,cls){
  let seed=0;for(let i=0;i<dateStr.length;i++)seed=((seed<<5)-seed)+dateStr.charCodeAt(i);seed=Math.abs(seed);
  // Pick 3 universal + 2 class-specific (or 5 universal if no class)
  const uPool=[...UNIVERSAL_MISSIONS];const picked=[];
  const cPool=cls&&CLASS_MISSIONS[cls]?[...CLASS_MISSIONS[cls]]:[];
  const uCount=cPool.length?3:5;const cCount=cPool.length?2:0;
  for(let i=0;i<uCount&&uPool.length;i++){const idx=seed%uPool.length;picked.push(uPool.splice(idx,1)[0]);seed=Math.abs((seed*16807)%2147483647)}
  for(let i=0;i<cCount&&cPool.length;i++){const idx=seed%cPool.length;picked.push(cPool.splice(idx,1)[0]);seed=Math.abs((seed*16807)%2147483647)}
  return picked;
}
function getTodayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

// ═══════════ EXERCISE LIBRARY ═══════════
const EXERCISE_LIBRARY=[
  // ── CHEST ──
  {name:'Barbell Bench Press',group:'Chest',tags:['compound','push'],reps:'6-10',cues:['Retract shoulder blades, arch slightly','Drive feet into floor, lower to mid-chest','Control the descent — 2 sec down, explosive up'],yt:'barbell+bench+press+form'},
  {name:'Incline Dumbbell Press',group:'Chest',tags:['compound','push'],reps:'8-12',cues:['30-45° incline — not too steep','Squeeze at the top, slow lowering phase','Dumbbells in line with upper chest'],yt:'incline+dumbbell+press+form+eugene+teo'},
  {name:'Dumbbell Floor Press',group:'Chest',tags:['compound','push'],reps:'8-12',cues:['Elbows touch floor for a brief pause','Joint-friendly chest builder','Great for lockout strength'],yt:'dumbbell+floor+press+form'},
  {name:'Cable Flyes',group:'Chest',tags:['isolation','push'],reps:'12-15',cues:['Slight bend in elbows throughout','Think "hugging a tree"','Squeeze hard at peak contraction'],yt:'cable+flyes+form+eugene+teo'},
  {name:'Push-Ups',group:'Chest',tags:['compound','bodyweight','push'],reps:'10-20',cues:['Hands shoulder-width, body in a straight line','Full range of motion — chest to floor','Squeeze chest at the top'],yt:'push+ups+proper+form'},
  {name:'Dips (Chest)',group:'Chest',tags:['compound','bodyweight','push'],reps:'8-12',cues:['Lean forward for chest emphasis','Lower until shoulders are below elbows','Add weight once bodyweight is easy'],yt:'chest+dips+form+eugene+teo'},
  // ── BACK ──
  {name:'Barbell Row',group:'Back',tags:['compound','pull'],reps:'6-10',cues:['Hinge at hips, flat back, ~45° torso angle','Pull to lower chest/upper abs','Squeeze shoulder blades at the top'],yt:'barbell+row+form+eugene+teo'},
  {name:'Pull-Ups',group:'Back',tags:['compound','bodyweight','pull'],reps:'5-12',cues:['Full dead hang at bottom, chin over bar at top','Initiate by depressing shoulder blades','Use bands for assistance if needed'],yt:'pull+ups+form+tutorial'},
  {name:'Lat Pulldown',group:'Back',tags:['compound','pull'],reps:'8-12',cues:['Slight lean back, pull to upper chest','Squeeze lats — think "elbows to pockets"','Full stretch at the top, control the return'],yt:'lat+pulldown+form+eugene+teo'},
  {name:'Seated Cable Row',group:'Back',tags:['compound','pull'],reps:'8-12',cues:['Chest up, pull to lower ribcage','Squeeze at peak for 1 sec','Don\'t lean too far forward or back'],yt:'seated+cable+row+form+eugene+teo'},
  {name:'Dumbbell Row',group:'Back',tags:['compound','pull'],reps:'8-12',cues:['Knee and hand on bench for support','Row to hip, not to chest','Control the negative — no swinging'],yt:'dumbbell+row+form'},
  {name:'Face Pulls',group:'Back',tags:['isolation','pull'],reps:'15-20',cues:['High cable, rope attachment','Pull to forehead, externally rotate','Great for posture and shoulder health'],yt:'face+pulls+form+jeff+nippard'},
  {name:'Chest-Supported Row',group:'Back',tags:['compound','pull'],reps:'8-12',cues:['Incline bench support removes low back stress','Great for strict pulling form','Squeeze at top, full stretch at bottom'],yt:'chest+supported+row+form+eugene+teo'},
  // ── SHOULDERS ──
  {name:'Overhead Press',group:'Shoulders',tags:['compound','push'],reps:'5-8',cues:['Bar starts at front rack position','Brace core hard, press straight up','Lockout overhead, head through the window'],yt:'overhead+press+form+eugene+teo'},
  {name:'Dumbbell Shoulder Press',group:'Shoulders',tags:['compound','push'],reps:'8-12',cues:['Seated or standing, dumbbells at shoulder height','Press up and slightly inward','Control the descent'],yt:'dumbbell+shoulder+press+form'},
  {name:'Arnold Press',group:'Shoulders',tags:['compound','push'],reps:'8-12',cues:['Start palms facing you, rotate as you press','Full rotational range of motion','Great for all three delt heads'],yt:'arnold+press+form+tutorial'},
  {name:'Lateral Raises',group:'Shoulders',tags:['isolation'],reps:'12-20',cues:['Slight bend in elbows, raise to shoulder height','Lead with elbows, not hands','Light weight — ego check this one'],yt:'lateral+raises+form+eugene+teo'},
  {name:'Rear Delt Fly',group:'Shoulders',tags:['isolation','pull'],reps:'12-15',cues:['Bent over or chest-supported','Think "pouring water" with pinkies up','Most neglected muscle — prioritize it'],yt:'rear+delt+fly+form'},
  // ── ARMS ──
  {name:'Barbell Curl',group:'Biceps',tags:['isolation'],reps:'8-12',cues:['Elbows pinned to sides','Full stretch at bottom, squeeze at top','Don\'t swing — reduce weight if needed'],yt:'barbell+curl+form'},
  {name:'Hammer Curls',group:'Biceps',tags:['isolation'],reps:'10-15',cues:['Neutral grip — thumbs up','Works brachialis for arm thickness','Alternate or simultaneous'],yt:'hammer+curls+form'},
  {name:'Incline Dumbbell Curl',group:'Biceps',tags:['isolation'],reps:'10-12',cues:['Incline bench puts bicep on stretch','Full range of motion is key','Lighter weight than standing curls'],yt:'incline+dumbbell+curl+form+eugene+teo'},
  {name:'Tricep Pushdowns',group:'Triceps',tags:['isolation','push'],reps:'10-15',cues:['Elbows locked at sides','Full extension at bottom, squeeze','Rope or bar attachment both work'],yt:'tricep+pushdowns+form'},
  {name:'Skull Crushers',group:'Triceps',tags:['isolation','push'],reps:'8-12',cues:['Lower to forehead or behind head','Elbows stay pointed at ceiling','EZ bar is easier on wrists'],yt:'skull+crushers+form'},
  {name:'Overhead Tricep Extension',group:'Triceps',tags:['isolation','push'],reps:'10-15',cues:['Cable or dumbbell behind head','Full stretch at bottom','Elbows close to ears'],yt:'overhead+tricep+extension+form'},
  // ── QUADS ──
  {name:'Barbell Back Squat',group:'Quads',tags:['compound'],reps:'4-8',cues:['Bar on upper traps, brace core hard','Break at hips and knees simultaneously','Drive through full foot, knees track toes'],yt:'barbell+squat+form+eugene+teo'},
  {name:'Front Squat',group:'Quads',tags:['compound'],reps:'6-10',cues:['Bar in front rack or cross-arm grip','Upright torso — more quad dominant','Elbows high throughout'],yt:'front+squat+form+eugene+teo'},
  {name:'Goblet Squat',group:'Quads',tags:['compound'],reps:'8-12',cues:['Hold dumbbell at chest level','Great for learning squat mechanics','Elbows between knees at bottom'],yt:'goblet+squat+form'},
  {name:'Leg Press',group:'Quads',tags:['compound'],reps:'8-15',cues:['Feet shoulder-width on platform','Full range — don\'t cut it short','Never lock knees at the top'],yt:'leg+press+form'},
  {name:'Bulgarian Split Squat',group:'Quads',tags:['compound','unilateral'],reps:'8-12/leg',cues:['Rear foot elevated on bench','Most of the weight on front leg','Great for fixing imbalances'],yt:'bulgarian+split+squat+form+eugene+teo'},
  {name:'Leg Extension',group:'Quads',tags:['isolation'],reps:'10-15',cues:['Full extension at top, squeeze quad','Control the negative','Good finisher for quad pump'],yt:'leg+extension+form'},
  // ── HAMSTRINGS & GLUTES ──
  {name:'Romanian Deadlift',group:'Hamstrings',tags:['compound','pull'],reps:'6-10',cues:['Hinge at hips, slight knee bend','Bar stays close to legs','Feel the stretch in hamstrings, squeeze glutes at top'],yt:'romanian+deadlift+form+eugene+teo'},
  {name:'Conventional Deadlift',group:'Hamstrings',tags:['compound','pull'],reps:'3-6',cues:['Bar over mid-foot, grip just outside knees','Brace core, push floor away','Lockout with glutes — don\'t hyperextend'],yt:'deadlift+form+eugene+teo'},
  {name:'Hip Thrust',group:'Glutes',tags:['compound'],reps:'8-12',cues:['Upper back on bench, bar across hips','Drive through heels, squeeze glutes hard at top','Chin tucked, ribs down'],yt:'hip+thrust+form+eugene+teo'},
  {name:'Leg Curl',group:'Hamstrings',tags:['isolation'],reps:'10-15',cues:['Lying or seated — both effective','Full stretch at bottom, curl all the way','Control the eccentric'],yt:'leg+curl+form'},
  {name:'Good Mornings',group:'Hamstrings',tags:['compound'],reps:'8-12',cues:['Bar on upper back, hinge at hips','Light weight — this is a stretch movement','Keep slight knee bend'],yt:'good+mornings+form'},
  // ── CORE ──
  {name:'Plank',group:'Core',tags:['isometric','bodyweight'],reps:'30-60s',cues:['Straight line from head to heels','Brace like someone\'s about to punch your gut','Don\'t let hips sag or pike up'],yt:'plank+proper+form'},
  {name:'Hanging Leg Raise',group:'Core',tags:['bodyweight'],reps:'10-15',cues:['Dead hang, raise legs to parallel','Posterior pelvic tilt at the top','Slow descent — no swinging'],yt:'hanging+leg+raise+form'},
  {name:'Cable Crunch',group:'Core',tags:['isolation'],reps:'12-15',cues:['Kneel facing cable, rope behind head','Crunch ribs toward hips','Exhale hard at peak contraction'],yt:'cable+crunch+form'},
  {name:'Ab Wheel Rollout',group:'Core',tags:['bodyweight'],reps:'8-12',cues:['Start on knees, extend as far as you can control','Brace hard — don\'t let low back sag','Build up to standing rollouts'],yt:'ab+wheel+rollout+form'},
  {name:'Russian Twist',group:'Core',tags:['bodyweight'],reps:'15-20/side',cues:['Lean back slightly, feet off ground','Rotate torso — not just arms','Add weight for more challenge'],yt:'russian+twist+form'},
  {name:'Bicycle Crunch',group:'Core',tags:['bodyweight'],reps:'15-20/side',cues:['Opposite elbow to knee','Fully extend the non-working leg','Slow and controlled — not a speed race'],yt:'bicycle+crunch+form'},
  // ── FULL BODY / COMPOUND ──
  {name:'Power Clean',group:'Full Body',tags:['compound','olympic'],reps:'3-5',cues:['Triple extension — hips, knees, ankles','Catch in front rack position','Learn with a coach if possible'],yt:'power+clean+form+tutorial'},
  {name:'Trap Bar Deadlift',group:'Full Body',tags:['compound'],reps:'5-8',cues:['Neutral grip, stand in center of trap bar','More quad-friendly than conventional','Great for athletes and beginners'],yt:'trap+bar+deadlift+form+eugene+teo'},
  {name:'Farmers Walk',group:'Full Body',tags:['compound','carry'],reps:'30-40m',cues:['Heavy dumbbells or farmer handles','Tall posture, engaged core, steady steps','Builds grip, core, traps, everything'],yt:'farmers+walk+form'},
  {name:'Kettlebell Swing',group:'Full Body',tags:['compound','conditioning'],reps:'15-20',cues:['Hinge — not a squat','Explosive hip snap drives the bell up','Arms are just along for the ride'],yt:'kettlebell+swing+form+eugene+teo'},
  {name:'Burpees',group:'Full Body',tags:['bodyweight','conditioning'],reps:'10-15',cues:['Chest to floor, explosive jump at top','Scale by removing the push-up or jump','Great for conditioning, terrible for fun'],yt:'burpees+proper+form'},
  // ── CALVES ──
  {name:'Standing Calf Raise',group:'Calves',tags:['isolation'],reps:'12-20',cues:['Full stretch at bottom, pause at top','Straight legs for gastrocnemius','Train calves more than you think'],yt:'standing+calf+raise+form'},
  {name:'Seated Calf Raise',group:'Calves',tags:['isolation'],reps:'12-20',cues:['Bent knee targets soleus muscle','Full range of motion — both directions','Slow eccentrics for growth'],yt:'seated+calf+raise+form'},
  // ── CONDITIONING ──
  {name:'Battle Ropes',group:'Conditioning',tags:['cardio'],reps:'30s',cues:['Alternating waves or slams','Keep core braced, slight squat stance','Full arm extension on each wave'],yt:'battle+ropes+workout'},
  {name:'Sled Push',group:'Conditioning',tags:['cardio','compound'],reps:'30-40m',cues:['Low body position, drive through legs','Arms locked out on handles','Scale weight for speed vs. strength'],yt:'sled+push+form'},
  {name:'Box Jumps',group:'Conditioning',tags:['plyometric'],reps:'5-8',cues:['Land softly with bent knees','Step down — don\'t jump down','Focus on explosive hip extension'],yt:'box+jumps+form+tutorial'},
  {name:'Sprint Intervals',group:'Conditioning',tags:['cardio'],reps:'30s on/60s off',cues:['6-8 rounds, full effort on sprints','Walk or light jog during rest','Warm up properly first'],yt:'sprint+interval+training'}
];
const LIBRARY_GROUPS=[...new Set(EXERCISE_LIBRARY.map(e=>e.group))];
