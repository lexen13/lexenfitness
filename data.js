// ═══════════════════════════════════════════
//  LEXENFITNESS — DATA & CONSTANTS
// ═══════════════════════════════════════════

const RANKS=[
  {name:'E-RANK',min:0,color:'#7c7c9a',auto:true,title:{Powerlifter:'Novice',Bodybuilder:'Rookie',Strongman:'Initiate',Athlete:'Prospect'}},
  {name:'D-RANK',min:500,color:'#34d399',auto:true,title:{Powerlifter:'Lifter',Bodybuilder:'Sculptor',Strongman:'Brawler',Athlete:'Contender'}},
  {name:'C-RANK',min:1500,color:'#22d3ee',auto:true,title:{Powerlifter:'Iron Will',Bodybuilder:'Aesthetic',Strongman:'Juggernaut',Athlete:'Competitor'}},
  {name:'B-RANK',min:3500,color:'#a78bfa',auto:false,trial:'iron_gate',title:{Powerlifter:'Powerhouse',Bodybuilder:'Phenom',Strongman:'Warlord',Athlete:'Elite'}},
  {name:'A-RANK',min:7000,color:'#fb923c',auto:false,trial:'gauntlet',title:{Powerlifter:'Monster',Bodybuilder:'Olympian',Strongman:'Colossus',Athlete:'All-Star'}},
  {name:'S-RANK',min:15000,color:'#fbbf24',auto:false,trial:'awakening',title:{Powerlifter:'Titan',Bodybuilder:'Mr. Universe',Strongman:'Behemoth',Athlete:'Apex'}}
];

const RANK_TRIALS={
  iron_gate:{name:'IRON GATE',rank:'B-RANK',desc:'Prove your discipline to reach B-Rank',icon:'🚪',
    tasks:[{id:'perfect_weeks_3',desc:'Complete 3 perfect weeks (all sets done, all days logged)',target:3}]},
  gauntlet:{name:'THE GAUNTLET',rank:'A-RANK',desc:'Only the relentless reach A-Rank',icon:'⚔️',
    tasks:[{id:'streak_14',desc:'Achieve a 14-day logging streak',target:14},{id:'log_pr',desc:'Log a 225+ lb compound lift',target:225}]},
  awakening:{name:'AWAKENING',rank:'S-RANK',desc:'The final test — ascend to S-Rank',icon:'👁️',
    tasks:[{id:'streak_30',desc:'Achieve a 30-day logging streak',target:30},{id:'missions_7',desc:'Complete ALL daily missions for 7 consecutive days',target:7},{id:'workouts_50',desc:'Log 50+ total workouts',target:50}]}
};

const CLASSES=[
  {id:'Powerlifter',icon:'🏋️',desc:'Squat, bench, deadlift — chase big numbers',bonus:'+2x XP on PR lifts',color:'#f87171'},
  {id:'Bodybuilder',icon:'💪',desc:'Hypertrophy, volume, sculpt the physique',bonus:'+2x XP full session completion',color:'#a78bfa'},
  {id:'Strongman',icon:'🪨',desc:'Odd lifts, carries, brutal conditioning',bonus:'+2x XP endurance achievements',color:'#fb923c'},
  {id:'Athlete',icon:'⚡',desc:'Sport-specific power & performance',bonus:'+2x XP consistency streaks',color:'#22d3ee',
    subclasses:['Basketball','Football','Soccer','MMA','Track & Field','Swimming','General']}
];

// Programs organized by class
const CLASS_PROGRAMS={
  Powerlifter:[
    {key:'pl_classic',name:'Classic Powerlifting',desc:'SBD focused, low rep, peak strength',icon:'🏋️',
      days:[
        {id:'day1',title:'SQUAT DAY',subtitle:'Monday',exercises:[{name:'Back Squat',sets:5,reps:'3-5'},{name:'Pause Squat',sets:3,reps:'3-5'},{name:'Leg Press',sets:3,reps:'8-10'},{name:'Barbell Lunges',sets:3,reps:'8/leg'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
        {id:'day2',title:'BENCH DAY',subtitle:'Tuesday',exercises:[{name:'Barbell Bench Press',sets:5,reps:'3-5'},{name:'Close-Grip Bench',sets:3,reps:'6-8'},{name:'Overhead Press',sets:3,reps:'6-8'},{name:'Dumbbell Rows',sets:3,reps:'8-10'},{name:'Tricep Dips',sets:3,reps:'8-12'}]},
        {id:'day3',title:'DEADLIFT DAY',subtitle:'Thursday',exercises:[{name:'Conventional Deadlift',sets:5,reps:'3-5'},{name:'Deficit Deadlift',sets:3,reps:'3-5'},{name:'Barbell Row',sets:3,reps:'6-8'},{name:'Pull-Ups',sets:3,reps:'6-10'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]},
        {id:'day4',title:'ACCESSORY',subtitle:'Friday',exercises:[{name:'Front Squat',sets:3,reps:'6-8'},{name:'Incline Bench',sets:3,reps:'8-10'},{name:'Romanian Deadlift',sets:3,reps:'8-10'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'Bicep Curls',sets:3,reps:'12-15'}]}]},
    {key:'pl_powerbuild',name:'Powerbuild',desc:'Strength + hypertrophy hybrid — best of both',icon:'🔥',
      days:[
        {id:'day1',title:'HEAVY UPPER',subtitle:'Monday',exercises:[{name:'Barbell Bench Press',sets:5,reps:'3-5'},{name:'Barbell Row',sets:4,reps:'5-8'},{name:'Overhead Press',sets:3,reps:'6-8'},{name:'Lat Pulldown',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:3,reps:'12-15'},{name:'Tricep Pushdowns',sets:3,reps:'10-12'}]},
        {id:'day2',title:'HEAVY LOWER',subtitle:'Tuesday',exercises:[{name:'Back Squat',sets:5,reps:'3-5'},{name:'Romanian Deadlift',sets:4,reps:'6-8'},{name:'Leg Press',sets:3,reps:'10-12'},{name:'Leg Curl',sets:3,reps:'10-12'},{name:'Calf Raises',sets:4,reps:'12-15'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
        {id:'day3',title:'VOLUME UPPER',subtitle:'Thursday',exercises:[{name:'Incline DB Press',sets:4,reps:'8-12'},{name:'Seated Cable Row',sets:4,reps:'10-12'},{name:'DB Shoulder Press',sets:3,reps:'10-12'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'EZ Bar Curl',sets:3,reps:'10-12'},{name:'Overhead Tricep Ext',sets:3,reps:'10-12'}]},
        {id:'day4',title:'VOLUME LOWER',subtitle:'Friday',exercises:[{name:'Conventional Deadlift',sets:4,reps:'3-5'},{name:'Front Squat',sets:3,reps:'8-10'},{name:'Bulgarian Split Squat',sets:3,reps:'10/leg'},{name:'Leg Extension',sets:3,reps:'12-15'},{name:'Seated Calf Raises',sets:4,reps:'12-15'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]}]},
    {key:'pl_powerbuild2',name:'Powerbuild 2.0',desc:'Advanced version — DUP periodization',icon:'⚡',
      days:[
        {id:'day1',title:'STRENGTH A',subtitle:'Monday — SBD Heavy',exercises:[{name:'Back Squat',sets:4,reps:'2-4'},{name:'Bench Press',sets:4,reps:'2-4'},{name:'Pendlay Row',sets:4,reps:'5-8'},{name:'Dips (weighted)',sets:3,reps:'6-8'},{name:'Ab Wheel',sets:3,reps:'10-15'}]},
        {id:'day2',title:'HYPERTROPHY A',subtitle:'Tuesday — Upper Volume',exercises:[{name:'Incline DB Press',sets:4,reps:'10-12'},{name:'Cable Row',sets:4,reps:'10-12'},{name:'Arnold Press',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:4,reps:'15-20'},{name:'Hammer Curls',sets:3,reps:'12-15'},{name:'Rope Pushdowns',sets:3,reps:'12-15'}]},
        {id:'day3',title:'STRENGTH B',subtitle:'Thursday — Deadlift Focus',exercises:[{name:'Conventional Deadlift',sets:4,reps:'2-4'},{name:'Overhead Press',sets:4,reps:'4-6'},{name:'Weighted Pull-Ups',sets:4,reps:'5-8'},{name:'Close-Grip Bench',sets:3,reps:'6-8'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]},
        {id:'day4',title:'HYPERTROPHY B',subtitle:'Friday — Lower Volume',exercises:[{name:'Leg Press',sets:4,reps:'10-15'},{name:'Romanian Deadlift',sets:4,reps:'10-12'},{name:'Walking Lunges',sets:3,reps:'12/leg'},{name:'Leg Curl',sets:3,reps:'12-15'},{name:'Leg Extension',sets:3,reps:'12-15'},{name:'Calf Raises',sets:4,reps:'15-20'}]}]}
  ],
  Bodybuilder:[
    {key:'bb_ppl',name:'Push / Pull / Legs',desc:'Classic bodybuilding split — balanced growth',icon:'💪',
      days:[
        {id:'day1',title:'PUSH',subtitle:'Monday — Chest, Shoulders, Tris',exercises:[{name:'Barbell Bench Press',sets:4,reps:'8-10'},{name:'Incline DB Press',sets:4,reps:'10-12'},{name:'Cable Flyes',sets:3,reps:'12-15'},{name:'Seated DB Shoulder Press',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:4,reps:'12-15'},{name:'Overhead Tricep Ext',sets:3,reps:'10-12'},{name:'Tricep Pushdowns',sets:3,reps:'12-15'}]},
        {id:'day2',title:'PULL',subtitle:'Tuesday — Back & Biceps',exercises:[{name:'Barbell Row',sets:4,reps:'8-10'},{name:'Lat Pulldown',sets:4,reps:'10-12'},{name:'Seated Cable Row',sets:3,reps:'10-12'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'Barbell Curl',sets:3,reps:'10-12'},{name:'Hammer Curls',sets:3,reps:'12-15'}]},
        {id:'day3',title:'LEGS',subtitle:'Thursday — Full Lower',exercises:[{name:'Back Squat',sets:4,reps:'8-10'},{name:'Romanian Deadlift',sets:4,reps:'10-12'},{name:'Leg Press',sets:3,reps:'10-12'},{name:'Leg Curl',sets:3,reps:'10-12'},{name:'Leg Extension',sets:3,reps:'12-15'},{name:'Calf Raises',sets:4,reps:'12-15'}]},
        {id:'day4',title:'UPPER',subtitle:'Friday — Detail & Arms',exercises:[{name:'Arnold Press',sets:4,reps:'10-12'},{name:'Chest-Supported Row',sets:4,reps:'10-12'},{name:'Cable Lateral Raise',sets:3,reps:'12-15'},{name:'Rear Delt Fly',sets:3,reps:'12-15'},{name:'EZ Bar Curl',sets:3,reps:'10-12'},{name:'Skull Crushers',sets:3,reps:'10-12'}]}]},
    {key:'bb_brosplit',name:'Bro Split',desc:'Classic muscle group per day — max focus',icon:'🎯',
      days:[
        {id:'day1',title:'CHEST & TRIS',subtitle:'Monday',exercises:[{name:'Flat Bench Press',sets:4,reps:'8-10'},{name:'Incline DB Press',sets:4,reps:'10-12'},{name:'Cable Flyes',sets:3,reps:'12-15'},{name:'Dips',sets:3,reps:'8-12'},{name:'Tricep Pushdowns',sets:3,reps:'10-12'},{name:'Overhead Tricep Ext',sets:3,reps:'10-12'}]},
        {id:'day2',title:'BACK & BIS',subtitle:'Tuesday',exercises:[{name:'Deadlift',sets:4,reps:'6-8'},{name:'Barbell Row',sets:4,reps:'8-10'},{name:'Lat Pulldown',sets:3,reps:'10-12'},{name:'Seated Cable Row',sets:3,reps:'10-12'},{name:'Barbell Curl',sets:3,reps:'10-12'},{name:'Incline DB Curl',sets:3,reps:'12-15'}]},
        {id:'day3',title:'SHOULDERS',subtitle:'Thursday',exercises:[{name:'Overhead Press',sets:4,reps:'6-8'},{name:'DB Lateral Raise',sets:4,reps:'12-15'},{name:'Rear Delt Fly',sets:4,reps:'12-15'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'Shrugs',sets:3,reps:'10-12'},{name:'Front Raise',sets:3,reps:'12-15'}]},
        {id:'day4',title:'LEGS',subtitle:'Friday',exercises:[{name:'Back Squat',sets:4,reps:'8-10'},{name:'Romanian Deadlift',sets:4,reps:'10-12'},{name:'Leg Press',sets:3,reps:'10-12'},{name:'Leg Curl',sets:3,reps:'10-12'},{name:'Walking Lunges',sets:3,reps:'10/leg'},{name:'Calf Raises',sets:4,reps:'15-20'}]}]},
    {key:'bb_volume',name:'High Volume',desc:'GVT-inspired — 10x10 on compounds, serious growth',icon:'📈',
      days:[
        {id:'day1',title:'CHEST & BACK',subtitle:'Monday',exercises:[{name:'Bench Press (10x10)',sets:10,reps:'10'},{name:'Barbell Row (10x10)',sets:10,reps:'10'},{name:'Dumbbell Flyes',sets:3,reps:'12-15'},{name:'Face Pulls',sets:3,reps:'12-15'}]},
        {id:'day2',title:'LEGS',subtitle:'Tuesday',exercises:[{name:'Back Squat (10x10)',sets:10,reps:'10'},{name:'Leg Curl',sets:3,reps:'12-15'},{name:'Calf Raises',sets:3,reps:'15-20'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
        {id:'day3',title:'SHOULDERS & ARMS',subtitle:'Thursday',exercises:[{name:'Overhead Press (10x10)',sets:10,reps:'10'},{name:'EZ Bar Curl',sets:3,reps:'10-12'},{name:'Skull Crushers',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:3,reps:'15-20'}]},
        {id:'day4',title:'POSTERIOR',subtitle:'Friday',exercises:[{name:'Romanian Deadlift (10x10)',sets:10,reps:'10'},{name:'Pull-Ups',sets:3,reps:'8-12'},{name:'Seated Cable Row',sets:3,reps:'10-12'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]}]}
  ],
  Strongman:[
    {key:'sm_classic',name:'Classic Strongman',desc:'Events + raw strength — become a beast',icon:'🪨',
      days:[
        {id:'day1',title:'PRESS DAY',subtitle:'Monday',exercises:[{name:'Overhead Press',sets:5,reps:'3-5'},{name:'Push Press',sets:3,reps:'5-8'},{name:'Incline Bench',sets:3,reps:'8-10'},{name:'DB Press',sets:3,reps:'10-12'},{name:'Tricep Dips',sets:3,reps:'8-12'}]},
        {id:'day2',title:'DEADLIFT & CARRY',subtitle:'Tuesday',exercises:[{name:'Deadlift',sets:5,reps:'3-5'},{name:'Farmers Walk',sets:4,reps:'40m'},{name:'Barbell Row',sets:4,reps:'6-8'},{name:'Good Mornings',sets:3,reps:'8-10'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
        {id:'day3',title:'SQUAT & LOAD',subtitle:'Thursday',exercises:[{name:'Back Squat',sets:5,reps:'3-5'},{name:'Front Squat',sets:3,reps:'6-8'},{name:'Walking Lunges',sets:3,reps:'10/leg'},{name:'Sandbag Load',sets:4,reps:'5'},{name:'Calf Raises',sets:4,reps:'12-15'}]},
        {id:'day4',title:'EVENT DAY',subtitle:'Friday',exercises:[{name:'Tire Flips / Box Jumps',sets:5,reps:'5'},{name:'Sled Push/Pull',sets:4,reps:'30m'},{name:'Keg/Sandbag Carry',sets:3,reps:'40m'},{name:'Pull-Ups',sets:3,reps:'5-8'},{name:'Ab Wheel',sets:3,reps:'10-15'}]}]},
    {key:'sm_conditioning',name:'Strongman Conditioning',desc:'Cardio meets chaos — events + endurance',icon:'🫁',
      days:[
        {id:'day1',title:'PUSH & CARRY',subtitle:'Monday',exercises:[{name:'Overhead Press',sets:4,reps:'5-8'},{name:'Log Press / Push Press',sets:3,reps:'5-8'},{name:'Farmers Walk',sets:5,reps:'50m'},{name:'Sled Push',sets:4,reps:'40m'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
        {id:'day2',title:'PULL & DRAG',subtitle:'Tuesday',exercises:[{name:'Deadlift',sets:4,reps:'3-5'},{name:'Barbell Row',sets:4,reps:'6-8'},{name:'Sled Drag',sets:4,reps:'40m'},{name:'Rope Climb / Pull-Ups',sets:3,reps:'5-8'},{name:'Battle Ropes',sets:4,reps:'30s',isTime:true}]},
        {id:'day3',title:'SQUAT & LOAD',subtitle:'Thursday',exercises:[{name:'Back Squat',sets:4,reps:'5-8'},{name:'Sandbag / Stone Load',sets:5,reps:'3'},{name:'Walking Lunges (heavy)',sets:3,reps:'10/leg'},{name:'Box Jumps',sets:3,reps:'8'},{name:'Prowler Sprint',sets:4,reps:'30m'}]},
        {id:'day4',title:'MEDLEY',subtitle:'Friday — Timed circuits',exercises:[{name:'Tire Flips',sets:3,reps:'8'},{name:'Keg Carry',sets:3,reps:'40m'},{name:'Farmers Walk (heavy)',sets:3,reps:'50m'},{name:'Burpees',sets:3,reps:'15'},{name:'Kettlebell Swings',sets:3,reps:'20'}]}]}
  ],
  Athlete:[
    {key:'ath_performance',name:'Athletic Performance',desc:'Power, speed, agility — all-around athlete',icon:'⚡',
      days:[
        {id:'day1',title:'POWER',subtitle:'Monday — Explosive',exercises:[{name:'Power Clean',sets:4,reps:'3-5'},{name:'Box Jumps',sets:4,reps:'5'},{name:'Back Squat',sets:4,reps:'5-8'},{name:'Broad Jumps',sets:3,reps:'5'},{name:'Plank',sets:3,reps:'45s',isTime:true}]},
        {id:'day2',title:'UPPER STRENGTH',subtitle:'Tuesday',exercises:[{name:'Bench Press',sets:4,reps:'6-8'},{name:'Pull-Ups',sets:4,reps:'6-10'},{name:'DB Shoulder Press',sets:3,reps:'8-10'},{name:'Barbell Row',sets:3,reps:'8-10'},{name:'Med Ball Slam',sets:3,reps:'10'}]},
        {id:'day3',title:'SPEED & AGILITY',subtitle:'Thursday',exercises:[{name:'Front Squat',sets:4,reps:'5-8'},{name:'Romanian Deadlift',sets:3,reps:'8-10'},{name:'Bulgarian Split Squat',sets:3,reps:'8/leg'},{name:'Lateral Lunges',sets:3,reps:'8/side'},{name:'Sprint Intervals',sets:6,reps:'30s',isTime:true}]},
        {id:'day4',title:'CONDITIONING',subtitle:'Friday',exercises:[{name:'Hang Clean',sets:3,reps:'5'},{name:'Kettlebell Swings',sets:4,reps:'15'},{name:'Battle Ropes',sets:4,reps:'30s',isTime:true},{name:'Farmer Walks',sets:3,reps:'40m'},{name:'Russian Twists',sets:3,reps:'20'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]}]},
    {key:'ath_sport',name:'Sport-Specific',desc:'Tailored to your sport — position & movement',icon:'🏆',
      days:[
        {id:'day1',title:'STRENGTH',subtitle:'Monday — Foundation',exercises:[{name:'Back Squat',sets:4,reps:'5-8'},{name:'Bench Press',sets:4,reps:'6-8'},{name:'Barbell Row',sets:3,reps:'8-10'},{name:'Overhead Press',sets:3,reps:'8-10'},{name:'Core Circuit',sets:3,reps:'45s',isTime:true}]},
        {id:'day2',title:'EXPLOSIVE',subtitle:'Tuesday — Power',exercises:[{name:'Power Clean',sets:4,reps:'3-5'},{name:'Box Jumps',sets:4,reps:'5'},{name:'Trap Bar Deadlift',sets:4,reps:'5'},{name:'Plyometric Push-Ups',sets:3,reps:'8'},{name:'Broad Jumps',sets:3,reps:'5'}]},
        {id:'day3',title:'MOVEMENT',subtitle:'Thursday — Agility',exercises:[{name:'Front Squat',sets:3,reps:'6-8'},{name:'Single-Leg RDL',sets:3,reps:'8/leg'},{name:'Lateral Bounds',sets:4,reps:'6/side'},{name:'Shuttle Runs',sets:6,reps:'20m'},{name:'Copenhagen Plank',sets:3,reps:'20s/side',isTime:true}]},
        {id:'day4',title:'ENDURANCE',subtitle:'Friday — Gas Tank',exercises:[{name:'Sled Push',sets:4,reps:'30m'},{name:'Kettlebell Swings',sets:4,reps:'20'},{name:'Rowing Machine',sets:4,reps:'500m'},{name:'Burpees',sets:3,reps:'12'},{name:'Farmer Walks',sets:3,reps:'40m'},{name:'Plank to Push-Up',sets:3,reps:'10'}]}]}
  ]
};

const DAILY_MISSION_POOL=[
  {id:'water_8',icon:'💧',name:'Hydrate',desc:'Drink 8 glasses of water',xp:15},
  {id:'steps_10k',icon:'🚶',name:'Step It Up',desc:'Walk 10,000 steps',xp:20},
  {id:'protein',icon:'🥩',name:'Protein Goal',desc:'Hit your protein target today',xp:15},
  {id:'sleep_7',icon:'😴',name:'Recovery',desc:'Get 7+ hours of sleep',xp:15},
  {id:'stretch',icon:'🧘',name:'Limber Up',desc:'5 minutes of stretching',xp:10},
  {id:'pushups_50',icon:'💪',name:'Push-Up Challenge',desc:'Do 50 push-ups throughout the day',xp:20},
  {id:'cardio_20',icon:'🏃',name:'Cardio Burst',desc:'20 minutes of any cardio',xp:20},
  {id:'veggies',icon:'🥗',name:'Eat Your Greens',desc:'3+ servings of vegetables',xp:10},
  {id:'no_junk',icon:'🚫',name:'Clean Eater',desc:'No junk food today',xp:15},
  {id:'cold_shower',icon:'🧊',name:'Ice Cold',desc:'Take a cold shower',xp:15},
  {id:'read_15',icon:'📖',name:'Brain Gains',desc:'Read for 15 minutes',xp:10},
  {id:'stairs',icon:'🪜',name:'Elevate',desc:'Take the stairs all day',xp:10},
  {id:'cook',icon:'🍳',name:'Chef Mode',desc:'Cook a meal from scratch',xp:10},
  {id:'no_sugar_drinks',icon:'💦',name:'Sugar Free',desc:'No sugary drinks today',xp:10},
  {id:'gratitude',icon:'🙏',name:'Mindset',desc:'Write down 3 things you\'re grateful for',xp:10},
  {id:'walk_15',icon:'🌳',name:'Fresh Air',desc:'15-minute outdoor walk',xp:10},
  {id:'posture',icon:'🧍',name:'Stand Tall',desc:'Focus on posture all day',xp:10},
  {id:'meal_prep',icon:'🥡',name:'Prep Master',desc:'Meal prep for tomorrow',xp:15},
  {id:'abs_5min',icon:'🔥',name:'Core Blast',desc:'5-minute ab routine',xp:10},
  {id:'no_phone_bed',icon:'📵',name:'Unplug',desc:'No phone 30 min before bed',xp:10}
];

const ACHIEVEMENTS=[
  {id:'first_workout',icon:'🎯',name:'First Blood',desc:'Complete your first workout',xp:50},
  {id:'workouts_10',icon:'💪',name:'Dedicated',desc:'Log 10 workouts',xp:100},
  {id:'workouts_25',icon:'🔥',name:'On Fire',desc:'Log 25 workouts',xp:200},
  {id:'workouts_50',icon:'⚡',name:'Unstoppable',desc:'Log 50 workouts',xp:300},
  {id:'workouts_100',icon:'👑',name:'Centurion',desc:'Log 100 workouts',xp:500},
  {id:'streak_7',icon:'📅',name:'Week Warrior',desc:'7-day logging streak',xp:150},
  {id:'streak_30',icon:'🗓️',name:'Iron Discipline',desc:'30-day logging streak',xp:500},
  {id:'full_week',icon:'✅',name:'Perfect Week',desc:'All sessions in one week',xp:200},
  {id:'full_week_5',icon:'🏅',name:'Consistency King',desc:'5 perfect weeks',xp:400},
  {id:'early_bird',icon:'🌅',name:'Early Bird',desc:'Log before 7 AM',xp:75},
  {id:'night_owl',icon:'🌙',name:'Night Owl',desc:'Log after 9 PM',xp:75},
  {id:'all_sets_done',icon:'💯',name:'No Excuses',desc:'Every set checked in a session',xp:100},
  {id:'heavy_day',icon:'🦾',name:'Heavy Hitter',desc:'Log 200+ lbs on any lift',xp:100},
  {id:'monster_lift',icon:'🏔️',name:'Mountain Mover',desc:'Log 315+ lbs',xp:200},
  {id:'titan_lift',icon:'⚔️',name:'Titan Strength',desc:'Log 405+ lbs',xp:300},
  {id:'variety',icon:'🎨',name:'Well Rounded',desc:'Log all workout days',xp:100},
  {id:'customize',icon:'🔧',name:'My Way',desc:'Customize an exercise',xp:50},
  {id:'add_friend',icon:'🤝',name:'Stronger Together',desc:'Add a friend',xp:75},
  {id:'friends_5',icon:'👥',name:'Squad Goals',desc:'Add 5 friends',xp:150},
  {id:'set_prs',icon:'📊',name:'Know Your Numbers',desc:'Record all 4 PR lifts',xp:75},
  {id:'missions_3',icon:'📋',name:'Mission Ready',desc:'Complete 3 daily missions in one day',xp:50},
  {id:'missions_all',icon:'🌟',name:'Mission Complete',desc:'Complete ALL daily missions in one day',xp:100},
  {id:'mission_streak_7',icon:'🎖️',name:'Mission Master',desc:'All missions 7 days straight',xp:300},
  {id:'rank_d',icon:'🟢',name:'D-Rank Hunter',desc:'Reach D-Rank',xp:0},
  {id:'rank_c',icon:'🔵',name:'C-Rank Hunter',desc:'Reach C-Rank',xp:0},
  {id:'rank_b',icon:'🟣',name:'B-Rank Hunter',desc:'Passed the Iron Gate',xp:0},
  {id:'rank_a',icon:'🟠',name:'A-Rank Hunter',desc:'Survived the Gauntlet',xp:0},
  {id:'rank_s',icon:'🌟',name:'S-Rank Hunter',desc:'Achieved Awakening',xp:0},
];

const GOALS=['Fat Loss','Muscle Gain','Build Strength','General Fitness','Athletic Performance','Body Recomp'];
const EXPERIENCE=['Beginner (< 1 year)','Intermediate (1-3 years)','Advanced (3+ years)','Elite (5+ years)'];

function getRank(xp){for(let i=RANKS.length-1;i>=0;i--)if(xp>=RANKS[i].min)return RANKS[i];return RANKS[0]}
function getNextRank(xp){for(let i=0;i<RANKS.length;i++)if(xp<RANKS[i].min)return RANKS[i];return null}
function genFriendCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let r='';for(let i=0;i<6;i++)r+=c[Math.floor(Math.random()*c.length)];return r}
function getDailyMissions(dateStr){
  // Seeded shuffle so everyone gets same missions per day
  let seed=0;for(let i=0;i<dateStr.length;i++)seed=((seed<<5)-seed)+dateStr.charCodeAt(i);seed=Math.abs(seed);
  const pool=[...DAILY_MISSION_POOL];const picked=[];
  for(let i=0;i<5;i++){const idx=seed%(pool.length);picked.push(pool.splice(idx,1)[0]);seed=Math.abs((seed*16807)%2147483647)}
  return picked;
}
function getTodayStr(){return new Date().toISOString().slice(0,10)}
