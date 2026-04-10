// ═══════════════════════════════════════════
//  LEXENFITNESS — DATA v4 (Solo Leveling)
// ═══════════════════════════════════════════
const RANKS=[
  {name:'E-RANK',min:0,color:'#7c7c9a',auto:true,lore:'You have entered the System. The weakest hunters begin here. Prove yourself.',
    title:{Powerlifter:'Novice Lifter',Bodybuilder:'Untested Rookie',Strongman:'Raw Initiate',Athlete:'Unranked Prospect'}},
  {name:'D-RANK',min:500,color:'#34d399',auto:true,lore:'You survived the early gates. Most hunters plateau here. Will you?',
    title:{Powerlifter:'Iron Lifter',Bodybuilder:'Sculptor',Strongman:'Brawler',Athlete:'Contender'}},
  {name:'C-RANK',min:1500,color:'#22d3ee',auto:true,lore:'You have drawn the System\'s attention. Stronger gates await.',
    title:{Powerlifter:'Iron Will',Bodybuilder:'Aesthetic Warrior',Strongman:'Juggernaut',Athlete:'Competitor'}},
  {name:'B-RANK',min:3500,color:'#a78bfa',auto:false,trial:'iron_gate',lore:'The Iron Gate separates the committed from the casual. Only discipline passes through.',
    title:{Powerlifter:'Powerhouse',Bodybuilder:'Phenom',Strongman:'Warlord',Athlete:'Elite Hunter'}},
  {name:'A-RANK',min:7000,color:'#fb923c',auto:false,trial:'gauntlet',lore:'The Gauntlet tests your will beyond limits. Few survive. Fewer emerge stronger.',
    title:{Powerlifter:'Monster',Bodybuilder:'Olympian',Strongman:'Colossus',Athlete:'All-Star'}},
  {name:'S-RANK',min:15000,color:'#fbbf24',auto:false,trial:'awakening',lore:'The Awakening. You stand at the pinnacle. The System recognizes you as the strongest.',
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
const DAILY_MISSION_POOL=[
  {id:'water_8',icon:'💧',name:'Hydrate',desc:'Drink 8 glasses of water',xp:15},
  {id:'steps_10k',icon:'🚶',name:'Step It Up',desc:'Walk 10,000 steps',xp:20},
  {id:'protein',icon:'🥩',name:'Protein Goal',desc:'Hit your protein target',xp:15},
  {id:'sleep_7',icon:'😴',name:'Recovery',desc:'Get 7+ hours of sleep',xp:15},
  {id:'stretch',icon:'🧘',name:'Limber Up',desc:'5 min of stretching',xp:10},
  {id:'pushups_50',icon:'💪',name:'Push-Up Challenge',desc:'50 push-ups throughout the day',xp:20},
  {id:'cardio_20',icon:'🏃',name:'Cardio Burst',desc:'20 min of any cardio',xp:20},
  {id:'veggies',icon:'🥗',name:'Eat Your Greens',desc:'3+ servings of vegetables',xp:10},
  {id:'no_junk',icon:'🚫',name:'Clean Eater',desc:'No junk food today',xp:15},
  {id:'cold_shower',icon:'🧊',name:'Ice Cold',desc:'Take a cold shower',xp:15},
  {id:'read_15',icon:'📖',name:'Brain Gains',desc:'Read for 15 minutes',xp:10},
  {id:'stairs',icon:'🪜',name:'Elevate',desc:'Take the stairs all day',xp:10},
  {id:'cook',icon:'🍳',name:'Chef Mode',desc:'Cook a meal from scratch',xp:10},
  {id:'no_sugar',icon:'💦',name:'Sugar Free',desc:'No sugary drinks today',xp:10},
  {id:'gratitude',icon:'🙏',name:'Mindset',desc:'Write 3 things you\'re grateful for',xp:10},
  {id:'walk_15',icon:'🌳',name:'Fresh Air',desc:'15-min outdoor walk',xp:10},
  {id:'posture',icon:'🧍',name:'Stand Tall',desc:'Focus on posture all day',xp:10},
  {id:'meal_prep',icon:'🥡',name:'Prep Master',desc:'Meal prep for tomorrow',xp:15},
  {id:'abs_5min',icon:'🔥',name:'Core Blast',desc:'5-min ab routine',xp:10},
  {id:'no_phone',icon:'📵',name:'Unplug',desc:'No phone 30 min before bed',xp:10}
];
const ACHIEVEMENTS=[
  {id:'first_workout',icon:'🎯',name:'First Blood',desc:'Complete first workout',xp:50},
  {id:'workouts_10',icon:'💪',name:'Dedicated',desc:'Log 10 workouts',xp:100},
  {id:'workouts_25',icon:'🔥',name:'On Fire',desc:'Log 25 workouts',xp:200},
  {id:'workouts_50',icon:'⚡',name:'Unstoppable',desc:'Log 50 workouts',xp:300},
  {id:'workouts_100',icon:'👑',name:'Centurion',desc:'Log 100 workouts',xp:500},
  {id:'streak_7',icon:'📅',name:'Week Warrior',desc:'7-day streak',xp:150},
  {id:'streak_30',icon:'🗓️',name:'Iron Discipline',desc:'30-day streak',xp:500},
  {id:'full_week',icon:'✅',name:'Perfect Week',desc:'All sessions in one week',xp:200},
  {id:'full_week_5',icon:'🏅',name:'Consistency King',desc:'5 perfect weeks',xp:400},
  {id:'early_bird',icon:'🌅',name:'Early Bird',desc:'Log before 7 AM',xp:75},
  {id:'night_owl',icon:'🌙',name:'Night Owl',desc:'Log after 9 PM',xp:75},
  {id:'all_sets_done',icon:'💯',name:'No Excuses',desc:'Every set checked',xp:100},
  {id:'heavy_day',icon:'🦾',name:'Heavy Hitter',desc:'200+ lbs logged',xp:100},
  {id:'monster_lift',icon:'🏔️',name:'Mountain Mover',desc:'315+ lbs logged',xp:200},
  {id:'titan_lift',icon:'⚔️',name:'Titan Strength',desc:'405+ lbs logged',xp:300},
  {id:'variety',icon:'🎨',name:'Well Rounded',desc:'All workout days logged',xp:100},
  {id:'customize',icon:'🔧',name:'My Way',desc:'Customize an exercise',xp:50},
  {id:'add_friend',icon:'🤝',name:'Stronger Together',desc:'Add a friend',xp:75},
  {id:'friends_5',icon:'👥',name:'Squad Goals',desc:'Add 5 friends',xp:150},
  {id:'set_prs',icon:'📊',name:'Know Your Numbers',desc:'Record all 4 PR lifts',xp:75},
  {id:'missions_3',icon:'📋',name:'Mission Ready',desc:'3 missions in one day',xp:50},
  {id:'missions_all',icon:'🌟',name:'Mission Complete',desc:'All missions in one day',xp:100},
  {id:'mission_streak_7',icon:'🎖️',name:'Mission Master',desc:'All missions 7 days straight',xp:300},
  {id:'food_log_1',icon:'🍽️',name:'Fuel Up',desc:'Log your first meal',xp:50},
  {id:'food_log_7',icon:'📝',name:'Nutrition Tracker',desc:'Log food 7 days',xp:150},
  {id:'scan_1',icon:'📸',name:'Scanner',desc:'Scan your first barcode',xp:25},
  {id:'rank_d',icon:'🟢',name:'D-Rank Hunter',desc:'Reach D-Rank',xp:0},
  {id:'rank_c',icon:'🔵',name:'C-Rank Hunter',desc:'Reach C-Rank',xp:0},
  {id:'rank_b',icon:'🟣',name:'Passed the Iron Gate',desc:'B-Rank achieved',xp:0},
  {id:'rank_a',icon:'🟠',name:'Survived the Gauntlet',desc:'A-Rank achieved',xp:0},
  {id:'rank_s',icon:'🌟',name:'Awakened',desc:'S-Rank — the strongest',xp:0},
];
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
function getDailyMissions(dateStr){let seed=0;for(let i=0;i<dateStr.length;i++)seed=((seed<<5)-seed)+dateStr.charCodeAt(i);seed=Math.abs(seed);const pool=[...DAILY_MISSION_POOL];const picked=[];for(let i=0;i<5;i++){const idx=seed%(pool.length);picked.push(pool.splice(idx,1)[0]);seed=Math.abs((seed*16807)%2147483647)}return picked}
function getTodayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
