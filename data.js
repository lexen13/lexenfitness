// ═══════════════════════════════════════════
//  LEXENFITNESS — DATA & CONSTANTS
// ═══════════════════════════════════════════

const RANKS = [
  { name:'E-RANK', min:0, color:'#7c7c9a', title:{ Powerlifter:'Novice', Bodybuilder:'Rookie', Strongman:'Initiate', Athlete:'Prospect', Custom:'Beginner' }},
  { name:'D-RANK', min:500, color:'#34d399', title:{ Powerlifter:'Lifter', Bodybuilder:'Sculptor', Strongman:'Brawler', Athlete:'Contender', Custom:'Dedicated' }},
  { name:'C-RANK', min:1500, color:'#22d3ee', title:{ Powerlifter:'Iron Will', Bodybuilder:'Aesthetic', Strongman:'Juggernaut', Athlete:'Competitor', Custom:'Disciplined' }},
  { name:'B-RANK', min:3500, color:'#a78bfa', title:{ Powerlifter:'Powerhouse', Bodybuilder:'Phenom', Strongman:'Warlord', Athlete:'Elite', Custom:'Veteran' }},
  { name:'A-RANK', min:7000, color:'#fb923c', title:{ Powerlifter:'Monster', Bodybuilder:'Olympian', Strongman:'Colossus', Athlete:'All-Star', Custom:'Master' }},
  { name:'S-RANK', min:15000, color:'#fbbf24', title:{ Powerlifter:'Titan', Bodybuilder:'Mr. Universe', Strongman:'Behemoth', Athlete:'Apex', Custom:'Legend' }}
];

const CLASSES = [
  { id:'Powerlifter', icon:'🏋️', desc:'Heavy compounds, low reps, raw strength', bonus:'+2x XP on PR lifts', color:'#f87171' },
  { id:'Bodybuilder', icon:'💪', desc:'Hypertrophy, volume, sculpt the physique', bonus:'+2x XP full session completion', color:'#a78bfa' },
  { id:'Strongman', icon:'🪨', desc:'Odd lifts, carries, brutal conditioning', bonus:'+2x XP endurance achievements', color:'#fb923c' },
  { id:'Athlete', icon:'⚡', desc:'Sport-specific power & performance', bonus:'+2x XP consistency streaks', color:'#22d3ee',
    subclasses:['Basketball','Football','Soccer','MMA','Track & Field','Swimming','General'] },
  { id:'Custom', icon:'🔧', desc:'Build your own program from scratch', bonus:'+2x XP for variety', color:'#34d399' }
];

const ACHIEVEMENTS = [
  { id:'first_workout', icon:'🎯', name:'First Blood', desc:'Complete your first workout', xp:50 },
  { id:'workouts_10', icon:'💪', name:'Dedicated', desc:'Log 10 workouts', xp:100 },
  { id:'workouts_25', icon:'🔥', name:'On Fire', desc:'Log 25 workouts', xp:200 },
  { id:'workouts_50', icon:'⚡', name:'Unstoppable', desc:'Log 50 workouts', xp:300 },
  { id:'workouts_100', icon:'👑', name:'Centurion', desc:'Log 100 workouts', xp:500 },
  { id:'streak_7', icon:'📅', name:'Week Warrior', desc:'7-day logging streak', xp:150 },
  { id:'streak_30', icon:'🗓️', name:'Iron Discipline', desc:'30-day logging streak', xp:500 },
  { id:'full_week', icon:'✅', name:'Perfect Week', desc:'All 4 sessions in one week', xp:200 },
  { id:'full_week_5', icon:'🏅', name:'Consistency King', desc:'5 perfect weeks', xp:400 },
  { id:'early_bird', icon:'🌅', name:'Early Bird', desc:'Log before 7 AM', xp:75 },
  { id:'night_owl', icon:'🌙', name:'Night Owl', desc:'Log after 9 PM', xp:75 },
  { id:'all_sets_done', icon:'💯', name:'No Excuses', desc:'Check off every set in a session', xp:100 },
  { id:'heavy_day', icon:'🦾', name:'Heavy Hitter', desc:'Log 200+ lbs on any lift', xp:100 },
  { id:'monster_lift', icon:'🏔️', name:'Mountain Mover', desc:'Log 315+ lbs on any lift', xp:200 },
  { id:'titan_lift', icon:'⚔️', name:'Titan Strength', desc:'Log 405+ lbs on any lift', xp:300 },
  { id:'variety', icon:'🎨', name:'Well Rounded', desc:'Log all 4 days at least once', xp:100 },
  { id:'customize', icon:'🔧', name:'My Way', desc:'Customize an exercise', xp:50 },
  { id:'add_friend', icon:'🤝', name:'Stronger Together', desc:'Add your first friend', xp:75 },
  { id:'friends_5', icon:'👥', name:'Squad Goals', desc:'Add 5 friends', xp:150 },
  { id:'rank_d', icon:'🟢', name:'D-Rank Hunter', desc:'Reach D-Rank', xp:0 },
  { id:'rank_c', icon:'🔵', name:'C-Rank Hunter', desc:'Reach C-Rank', xp:0 },
  { id:'rank_b', icon:'🟣', name:'B-Rank Hunter', desc:'Reach B-Rank', xp:0 },
  { id:'rank_a', icon:'🟠', name:'A-Rank Hunter', desc:'Reach A-Rank', xp:0 },
  { id:'rank_s', icon:'🌟', name:'S-Rank Hunter', desc:'Reach S-Rank', xp:0 },
];

// ── PREMADE PROGRAMS ──
const PROGRAMS = {
  Powerlifter: {
    name:'Powerlifter', desc:'Squat / Bench / Deadlift focused', icon:'🏋️',
    days:[
      { id:'day1', title:'SQUAT DAY', subtitle:'Monday — Squat Focus', exercises:[
        {name:'Back Squat',sets:5,reps:'3-5'},{name:'Pause Squat',sets:3,reps:'3-5'},{name:'Leg Press',sets:3,reps:'8-10'},{name:'Barbell Lunges',sets:3,reps:'8/leg'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
      { id:'day2', title:'BENCH DAY', subtitle:'Tuesday — Bench Focus', exercises:[
        {name:'Barbell Bench Press',sets:5,reps:'3-5'},{name:'Close-Grip Bench',sets:3,reps:'6-8'},{name:'Overhead Press',sets:3,reps:'6-8'},{name:'Dumbbell Rows',sets:3,reps:'8-10'},{name:'Tricep Dips',sets:3,reps:'8-12'}]},
      { id:'day3', title:'DEADLIFT DAY', subtitle:'Thursday — Deadlift Focus', exercises:[
        {name:'Conventional Deadlift',sets:5,reps:'3-5'},{name:'Deficit Deadlift',sets:3,reps:'3-5'},{name:'Barbell Row',sets:3,reps:'6-8'},{name:'Pull-Ups',sets:3,reps:'6-10'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]},
      { id:'day4', title:'ACCESSORY', subtitle:'Friday — Volume & Weak Points', exercises:[
        {name:'Front Squat',sets:3,reps:'6-8'},{name:'Incline Bench',sets:3,reps:'8-10'},{name:'Romanian Deadlift',sets:3,reps:'8-10'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'Bicep Curls',sets:3,reps:'12-15'}]}
    ]},
  Bodybuilder: {
    name:'Bodybuilder', desc:'Push / Pull / Legs / Upper hypertrophy', icon:'💪',
    days:[
      { id:'day1', title:'PUSH', subtitle:'Monday — Chest, Shoulders, Triceps', exercises:[
        {name:'Barbell Bench Press',sets:4,reps:'8-10'},{name:'Incline DB Press',sets:4,reps:'10-12'},{name:'Cable Flyes',sets:3,reps:'12-15'},{name:'Seated DB Shoulder Press',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:4,reps:'12-15'},{name:'Overhead Tricep Extension',sets:3,reps:'10-12'},{name:'Tricep Pushdowns',sets:3,reps:'12-15'}]},
      { id:'day2', title:'PULL', subtitle:'Tuesday — Back & Biceps', exercises:[
        {name:'Barbell Row',sets:4,reps:'8-10'},{name:'Lat Pulldown',sets:4,reps:'10-12'},{name:'Seated Cable Row',sets:3,reps:'10-12'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'Barbell Curl',sets:3,reps:'10-12'},{name:'Hammer Curls',sets:3,reps:'12-15'}]},
      { id:'day3', title:'LEGS', subtitle:'Thursday — Quads, Hams, Calves', exercises:[
        {name:'Back Squat',sets:4,reps:'8-10'},{name:'Romanian Deadlift',sets:4,reps:'10-12'},{name:'Leg Press',sets:3,reps:'10-12'},{name:'Leg Curl',sets:3,reps:'10-12'},{name:'Leg Extension',sets:3,reps:'12-15'},{name:'Calf Raises',sets:4,reps:'12-15'}]},
      { id:'day4', title:'UPPER', subtitle:'Friday — Arms & Shoulders Detail', exercises:[
        {name:'Arnold Press',sets:4,reps:'10-12'},{name:'Chest-Supported Row',sets:4,reps:'10-12'},{name:'Cable Lateral Raise',sets:3,reps:'12-15'},{name:'Rear Delt Fly',sets:3,reps:'12-15'},{name:'EZ Bar Curl',sets:3,reps:'10-12'},{name:'Skull Crushers',sets:3,reps:'10-12'}]}
    ]},
  Strongman: {
    name:'Strongman', desc:'Press / Carry / Squat / Events', icon:'🪨',
    days:[
      { id:'day1', title:'PRESS DAY', subtitle:'Monday — Overhead Strength', exercises:[
        {name:'Overhead Press',sets:5,reps:'3-5'},{name:'Push Press',sets:3,reps:'5-8'},{name:'Incline Bench',sets:3,reps:'8-10'},{name:'Dumbbell Press',sets:3,reps:'10-12'},{name:'Tricep Dips',sets:3,reps:'8-12'}]},
      { id:'day2', title:'DEADLIFT & CARRY', subtitle:'Tuesday — Posterior Chain', exercises:[
        {name:'Deadlift',sets:5,reps:'3-5'},{name:'Farmers Walk',sets:4,reps:'40m'},{name:'Barbell Row',sets:4,reps:'6-8'},{name:'Good Mornings',sets:3,reps:'8-10'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
      { id:'day3', title:'SQUAT & LOAD', subtitle:'Thursday — Leg Drive', exercises:[
        {name:'Back Squat',sets:5,reps:'3-5'},{name:'Front Squat',sets:3,reps:'6-8'},{name:'Walking Lunges',sets:3,reps:'10/leg'},{name:'Sandbag Load',sets:4,reps:'5'},{name:'Calf Raises',sets:4,reps:'12-15'}]},
      { id:'day4', title:'EVENT DAY', subtitle:'Friday — Mixed Events', exercises:[
        {name:'Tire Flips / Box Jumps',sets:5,reps:'5'},{name:'Sled Push/Pull',sets:4,reps:'30m'},{name:'Keg/Sandbag Carry',sets:3,reps:'40m'},{name:'Pull-Ups',sets:3,reps:'5-8'},{name:'Ab Wheel',sets:3,reps:'10-15'}]}
    ]},
  Athlete: {
    name:'Athlete', desc:'Power / Upper / Speed / Conditioning', icon:'⚡',
    days:[
      { id:'day1', title:'POWER', subtitle:'Monday — Explosive Strength', exercises:[
        {name:'Power Clean',sets:4,reps:'3-5'},{name:'Box Jumps',sets:4,reps:'5'},{name:'Back Squat',sets:4,reps:'5-8'},{name:'Broad Jumps',sets:3,reps:'5'},{name:'Plank',sets:3,reps:'45s',isTime:true}]},
      { id:'day2', title:'UPPER STRENGTH', subtitle:'Tuesday — Push & Pull', exercises:[
        {name:'Bench Press',sets:4,reps:'6-8'},{name:'Pull-Ups',sets:4,reps:'6-10'},{name:'DB Shoulder Press',sets:3,reps:'8-10'},{name:'Barbell Row',sets:3,reps:'8-10'},{name:'Medicine Ball Slam',sets:3,reps:'10'}]},
      { id:'day3', title:'SPEED & AGILITY', subtitle:'Thursday — Athletic Movement', exercises:[
        {name:'Front Squat',sets:4,reps:'5-8'},{name:'Romanian Deadlift',sets:3,reps:'8-10'},{name:'Bulgarian Split Squat',sets:3,reps:'8/leg'},{name:'Lateral Lunges',sets:3,reps:'8/side'},{name:'Sprint Intervals',sets:6,reps:'30s',isTime:true}]},
      { id:'day4', title:'CONDITIONING', subtitle:'Friday — Endurance & Core', exercises:[
        {name:'Hang Clean',sets:3,reps:'5'},{name:'Kettlebell Swings',sets:4,reps:'15'},{name:'Battle Ropes',sets:4,reps:'30s',isTime:true},{name:'Farmer Walks',sets:3,reps:'40m'},{name:'Russian Twists',sets:3,reps:'20'},{name:'Hanging Leg Raise',sets:3,reps:'10-15'}]}
    ]},
  UpperLower: {
    name:'Upper / Lower Split', desc:'Classic 4-day hypertrophy & strength', icon:'🔄',
    days:[
      { id:'day1', title:'UPPER A', subtitle:'Monday — Push + Pull Strength', exercises:[
        {name:'Barbell Bench Press',sets:4,reps:'6-8'},{name:'Overhead Press',sets:3,reps:'8-10'},{name:'Bent-Over Row',sets:4,reps:'8-10'},{name:'Lat Pulldown',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:3,reps:'12-15'},{name:'Tricep Pushdowns',sets:3,reps:'10-12'},{name:'Bicep Curls',sets:3,reps:'12-15'}]},
      { id:'day2', title:'LOWER A', subtitle:'Tuesday — Quad + Posterior', exercises:[
        {name:'Back Squat',sets:4,reps:'6-8'},{name:'Romanian Deadlift',sets:4,reps:'8-10'},{name:'Bulgarian Split Squats',sets:3,reps:'10/leg'},{name:'Leg Curl',sets:3,reps:'10-12'},{name:'Calf Raises',sets:4,reps:'12-15'},{name:'Plank',sets:3,reps:'60s',isTime:true}]},
      { id:'day3', title:'UPPER B', subtitle:'Thursday — Growth Angles', exercises:[
        {name:'Incline DB Press',sets:4,reps:'8-10'},{name:'Seated DB Shoulder Press',sets:3,reps:'8-12'},{name:'Seated Cable Row',sets:4,reps:'8-10'},{name:'Pull-Ups',sets:3,reps:'6-10'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'Overhead Tricep Extension',sets:3,reps:'10-12'},{name:'Hammer Curls',sets:3,reps:'12-15'}]},
      { id:'day4', title:'LOWER B', subtitle:'Friday — Hip-Dominant', exercises:[
        {name:'Conventional Deadlift',sets:3,reps:'5-7'},{name:'Front Squat',sets:3,reps:'8-10'},{name:'Hip Thrusts',sets:3,reps:'10-12'},{name:'Walking Lunges',sets:3,reps:'10/leg'},{name:'Seated Calf Raises',sets:4,reps:'12-15'},{name:'Hanging Leg Raises',sets:3,reps:'10-15'}]}
    ]},
  FullBody3: {
    name:'Full Body 3-Day', desc:'Hit everything 3x per week — great for beginners', icon:'🌟',
    days:[
      { id:'day1', title:'DAY A', subtitle:'Monday — Squat Focus', exercises:[
        {name:'Back Squat',sets:4,reps:'6-8'},{name:'Bench Press',sets:3,reps:'8-10'},{name:'Barbell Row',sets:3,reps:'8-10'},{name:'Overhead Press',sets:3,reps:'10-12'},{name:'Bicep Curls',sets:2,reps:'12-15'},{name:'Plank',sets:3,reps:'45s',isTime:true}]},
      { id:'day2', title:'DAY B', subtitle:'Wednesday — Deadlift Focus', exercises:[
        {name:'Deadlift',sets:4,reps:'5-7'},{name:'Incline DB Press',sets:3,reps:'8-10'},{name:'Lat Pulldown',sets:3,reps:'10-12'},{name:'Lateral Raises',sets:3,reps:'12-15'},{name:'Tricep Pushdowns',sets:2,reps:'12-15'},{name:'Leg Curl',sets:3,reps:'10-12'}]},
      { id:'day3', title:'DAY C', subtitle:'Friday — Volume', exercises:[
        {name:'Front Squat',sets:3,reps:'8-10'},{name:'Dumbbell Bench Press',sets:3,reps:'10-12'},{name:'Seated Cable Row',sets:3,reps:'10-12'},{name:'Romanian Deadlift',sets:3,reps:'10-12'},{name:'Face Pulls',sets:3,reps:'12-15'},{name:'Hammer Curls',sets:2,reps:'12-15'}]},
      { id:'day4', title:'OPTIONAL', subtitle:'Saturday — Active Recovery / Cardio', exercises:[
        {name:'Light Cycling or Walk',sets:1,reps:'20-30min',isTime:true},{name:'Foam Rolling',sets:1,reps:'10min',isTime:true},{name:'Stretching',sets:1,reps:'10min',isTime:true}]}
    ]}
};

function getRank(xp) { for (let i = RANKS.length - 1; i >= 0; i--) if (xp >= RANKS[i].min) return RANKS[i]; return RANKS[0]; }
function getNextRank(xp) { for (let i = 0; i < RANKS.length; i++) if (xp < RANKS[i].min) return RANKS[i]; return null; }
function genFriendCode() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; }
