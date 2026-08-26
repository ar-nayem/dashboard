/**
 * The stock exercise library and workout templates.
 *
 * Kept separate from the demo seed because this is real, reusable reference
 * data — you want it after `db:reset` wipes everything else, whereas demo
 * projects and fake revenue are throwaway.
 *
 * Installed idempotently by `npm run seed:workouts`, which upserts by name and
 * never touches logged workouts.
 */

export type ExerciseSeed = {
  name: string;
  equipment: "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "plate_loaded" | "other";
  muscleGroup: string;
};

export const EXERCISES: ExerciseSeed[] = [
  // --- Chest ---------------------------------------------------------------
  { name: "Bench Press (Barbell)", equipment: "barbell", muscleGroup: "Chest" },
  { name: "Bench Press (Dumbbell)", equipment: "dumbbell", muscleGroup: "Chest" },
  { name: "Incline Bench Press (Barbell)", equipment: "barbell", muscleGroup: "Chest" },
  { name: "Incline Bench Press (Dumbbell)", equipment: "dumbbell", muscleGroup: "Chest" },
  { name: "Incline Chest Press (Machine)", equipment: "machine", muscleGroup: "Chest" },
  { name: "Chest Fly (Cable)", equipment: "cable", muscleGroup: "Chest" },
  { name: "Chest Dip", equipment: "bodyweight", muscleGroup: "Chest" },
  { name: "Push Up", equipment: "bodyweight", muscleGroup: "Chest" },

  // --- Shoulders -----------------------------------------------------------
  { name: "Overhead Press (Barbell)", equipment: "barbell", muscleGroup: "Shoulders" },
  { name: "Overhead Press (Dumbbell)", equipment: "dumbbell", muscleGroup: "Shoulders" },
  { name: "Lateral Raise (Dumbbell)", equipment: "dumbbell", muscleGroup: "Shoulders" },
  { name: "Front Raise (Dumbbell)", equipment: "dumbbell", muscleGroup: "Shoulders" },
  { name: "Rear Delt Fly (Dumbbell)", equipment: "dumbbell", muscleGroup: "Shoulders" },
  { name: "Face Pull (Cable)", equipment: "cable", muscleGroup: "Shoulders" },
  { name: "Pike Push Up", equipment: "bodyweight", muscleGroup: "Shoulders" },

  // --- Triceps -------------------------------------------------------------
  { name: "Rope Tricep Pushdown", equipment: "cable", muscleGroup: "Triceps" },
  { name: "Skull Crusher", equipment: "barbell", muscleGroup: "Triceps" },
  { name: "Overhead Tricep Extension", equipment: "dumbbell", muscleGroup: "Triceps" },
  { name: "Close-Grip Bench Press", equipment: "barbell", muscleGroup: "Triceps" },
  { name: "Bench Dip", equipment: "bodyweight", muscleGroup: "Triceps" },

  // --- Back ----------------------------------------------------------------
  { name: "Deadlift", equipment: "barbell", muscleGroup: "Back" },
  { name: "Pull Up", equipment: "bodyweight", muscleGroup: "Back" },
  { name: "Chin Up", equipment: "bodyweight", muscleGroup: "Back" },
  { name: "Bent-Over Row (Barbell)", equipment: "barbell", muscleGroup: "Back" },
  { name: "Single-Arm Row (Dumbbell)", equipment: "dumbbell", muscleGroup: "Back" },
  { name: "Lat Pulldown", equipment: "cable", muscleGroup: "Back" },
  { name: "Seated Row (Machine)", equipment: "machine", muscleGroup: "Back" },
  { name: "Inverted Row", equipment: "bodyweight", muscleGroup: "Back" },
  { name: "Shrug (Dumbbell)", equipment: "dumbbell", muscleGroup: "Back" },

  // --- Biceps --------------------------------------------------------------
  { name: "Barbell Curl", equipment: "barbell", muscleGroup: "Biceps" },
  { name: "Dumbbell Curl", equipment: "dumbbell", muscleGroup: "Biceps" },
  { name: "Hammer Curl", equipment: "dumbbell", muscleGroup: "Biceps" },
  { name: "Incline Dumbbell Curl", equipment: "dumbbell", muscleGroup: "Biceps" },
  { name: "Preacher Curl", equipment: "machine", muscleGroup: "Biceps" },

  // --- Forearms ------------------------------------------------------------
  { name: "Wrist Curl", equipment: "dumbbell", muscleGroup: "Forearms" },
  { name: "Reverse Curl", equipment: "barbell", muscleGroup: "Forearms" },
  { name: "Farmer's Carry", equipment: "dumbbell", muscleGroup: "Forearms" },

  // --- Quads ---------------------------------------------------------------
  { name: "Squat (Barbell)", equipment: "barbell", muscleGroup: "Quads" },
  { name: "Front Squat", equipment: "barbell", muscleGroup: "Quads" },
  { name: "Goblet Squat", equipment: "dumbbell", muscleGroup: "Quads" },
  { name: "Leg Press", equipment: "machine", muscleGroup: "Quads" },
  { name: "Leg Extension", equipment: "machine", muscleGroup: "Quads" },
  { name: "Bulgarian Split Squat", equipment: "dumbbell", muscleGroup: "Quads" },
  { name: "Walking Lunge", equipment: "dumbbell", muscleGroup: "Quads" },
  { name: "Reverse Lunge", equipment: "bodyweight", muscleGroup: "Quads" },

  // --- Hamstrings / Glutes -------------------------------------------------
  { name: "Romanian Deadlift", equipment: "barbell", muscleGroup: "Hamstrings" },
  { name: "Lying Leg Curl", equipment: "machine", muscleGroup: "Hamstrings" },
  { name: "Seated Leg Curl", equipment: "machine", muscleGroup: "Hamstrings" },
  { name: "Good Morning", equipment: "barbell", muscleGroup: "Hamstrings" },
  { name: "Hip Thrust", equipment: "barbell", muscleGroup: "Glutes" },
  { name: "Glute Bridge", equipment: "bodyweight", muscleGroup: "Glutes" },

  // --- Calves --------------------------------------------------------------
  { name: "Standing Calf Raise", equipment: "machine", muscleGroup: "Calves" },
  { name: "Seated Calf Raise", equipment: "machine", muscleGroup: "Calves" },

  // --- Abs -----------------------------------------------------------------
  { name: "Hanging Leg Raise", equipment: "bodyweight", muscleGroup: "Abs" },
  { name: "Plank", equipment: "bodyweight", muscleGroup: "Abs" },
  { name: "Cable Crunch", equipment: "cable", muscleGroup: "Abs" },
  { name: "Ab Wheel Rollout", equipment: "other", muscleGroup: "Abs" },
  { name: "Russian Twist", equipment: "bodyweight", muscleGroup: "Abs" },
];

export type TemplateSeed = {
  name: string;
  groupName: string;
  description: string;
  /** [exercise name, target sets, rep range] */
  exercises: [string, number, string][];
};

/**
 * Rep ranges follow the usual split: heavy compounds low (5–8) where load
 * matters, isolation higher (10–15) where it does not. Sets are a starting
 * point — the live session lets you add or drop them per workout without
 * editing the template.
 */
export const TEMPLATES: TemplateSeed[] = [
  // --- Push / Pull / Legs --------------------------------------------------
  {
    name: "Push",
    groupName: "Push / Pull / Legs",
    description: "Chest, shoulders, triceps. Day 1 of a 3-day rotation.",
    exercises: [
      ["Bench Press (Barbell)", 4, "5-8"],
      ["Incline Bench Press (Dumbbell)", 3, "8-12"],
      ["Overhead Press (Barbell)", 3, "6-10"],
      ["Lateral Raise (Dumbbell)", 3, "12-15"],
      ["Rope Tricep Pushdown", 3, "10-15"],
      ["Overhead Tricep Extension", 3, "10-15"],
    ],
  },
  {
    name: "Pull",
    groupName: "Push / Pull / Legs",
    description: "Back and biceps. Day 2 of a 3-day rotation.",
    exercises: [
      ["Pull Up", 4, "6-10"],
      ["Bent-Over Row (Barbell)", 4, "6-10"],
      ["Lat Pulldown", 3, "10-12"],
      ["Seated Row (Machine)", 3, "10-12"],
      ["Face Pull (Cable)", 3, "12-15"],
      ["Barbell Curl", 3, "8-12"],
      ["Hammer Curl", 3, "10-15"],
    ],
  },
  {
    name: "Legs",
    groupName: "Push / Pull / Legs",
    description: "Quads, hamstrings, calves. Day 3 of a 3-day rotation.",
    exercises: [
      ["Squat (Barbell)", 4, "5-8"],
      ["Romanian Deadlift", 3, "8-10"],
      ["Leg Press", 3, "10-12"],
      ["Lying Leg Curl", 3, "10-15"],
      ["Standing Calf Raise", 4, "12-20"],
      ["Hanging Leg Raise", 3, "10-15"],
    ],
  },

  // --- Three body parts per day -------------------------------------------
  // The same weekly volume as PPL, organised explicitly by body part so each
  // session has three clear blocks rather than one push/pull label.
  {
    name: "Day 1 — Chest · Shoulders · Triceps",
    groupName: "3-Part Split",
    description: "Two exercises per body part. Heaviest pressing first.",
    exercises: [
      ["Bench Press (Barbell)", 4, "5-8"],
      ["Incline Chest Press (Machine)", 3, "10-12"],
      ["Overhead Press (Dumbbell)", 3, "8-12"],
      ["Lateral Raise (Dumbbell)", 3, "12-15"],
      ["Close-Grip Bench Press", 3, "8-10"],
      ["Rope Tricep Pushdown", 3, "12-15"],
    ],
  },
  {
    name: "Day 2 — Back · Biceps · Forearms",
    groupName: "3-Part Split",
    description: "Vertical and horizontal pulling, then arms.",
    exercises: [
      ["Deadlift", 3, "4-6"],
      ["Pull Up", 3, "6-10"],
      ["Single-Arm Row (Dumbbell)", 3, "10-12"],
      ["Barbell Curl", 3, "8-12"],
      ["Incline Dumbbell Curl", 3, "10-12"],
      ["Reverse Curl", 3, "12-15"],
      ["Farmer's Carry", 3, "40-60s"],
    ],
  },
  {
    name: "Day 3 — Legs · Glutes · Abs",
    groupName: "3-Part Split",
    description: "Squat pattern, hinge pattern, then core.",
    exercises: [
      ["Squat (Barbell)", 4, "5-8"],
      ["Leg Press", 3, "10-12"],
      ["Romanian Deadlift", 3, "8-10"],
      ["Hip Thrust", 3, "10-12"],
      ["Seated Calf Raise", 4, "12-20"],
      ["Cable Crunch", 3, "12-15"],
      ["Plank", 3, "45-60s"],
    ],
  },

  // --- Full body -----------------------------------------------------------
  // For 2–3 sessions a week: every session hits push, pull, legs and core, so
  // missing one costs you less than missing a dedicated day in a split.
  {
    name: "Full Body A",
    groupName: "Full Body",
    description: "Squat-led. Push, pull, hinge, core in one session.",
    exercises: [
      ["Squat (Barbell)", 3, "5-8"],
      ["Bench Press (Barbell)", 3, "5-8"],
      ["Bent-Over Row (Barbell)", 3, "8-10"],
      ["Overhead Press (Dumbbell)", 3, "8-12"],
      ["Lying Leg Curl", 3, "10-15"],
      ["Plank", 3, "45-60s"],
    ],
  },
  {
    name: "Full Body B",
    groupName: "Full Body",
    description: "Hinge-led. Heavier posterior chain, vertical pulling.",
    exercises: [
      ["Deadlift", 3, "4-6"],
      ["Incline Bench Press (Barbell)", 3, "6-10"],
      ["Pull Up", 3, "6-10"],
      ["Leg Press", 3, "10-12"],
      ["Lateral Raise (Dumbbell)", 3, "12-15"],
      ["Hanging Leg Raise", 3, "10-15"],
    ],
  },
  {
    name: "Full Body C",
    groupName: "Full Body",
    description: "Single-leg and machine work. Lighter on the spine.",
    exercises: [
      ["Bulgarian Split Squat", 3, "8-12"],
      ["Incline Chest Press (Machine)", 3, "10-12"],
      ["Seated Row (Machine)", 3, "10-12"],
      ["Hip Thrust", 3, "10-12"],
      ["Face Pull (Cable)", 3, "12-15"],
      ["Cable Crunch", 3, "12-15"],
    ],
  },

  // --- Bodyweight ----------------------------------------------------------
  {
    name: "Bodyweight A",
    groupName: "Bodyweight",
    description: "No equipment beyond a bar to hang from.",
    exercises: [
      ["Push Up", 4, "10-20"],
      ["Pull Up", 4, "5-10"],
      ["Bulgarian Split Squat", 3, "10-15"],
      ["Inverted Row", 3, "10-15"],
      ["Reverse Lunge", 3, "12-15"],
      ["Plank", 3, "45-60s"],
    ],
  },
  {
    name: "Bodyweight B",
    groupName: "Bodyweight",
    description: "Chin grip and posterior chain emphasis.",
    exercises: [
      ["Pike Push Up", 3, "8-15"],
      ["Chin Up", 4, "5-10"],
      ["Glute Bridge", 3, "15-20"],
      ["Bench Dip", 3, "10-20"],
      ["Reverse Lunge", 3, "12-15"],
      ["Hanging Leg Raise", 3, "8-15"],
    ],
  },
];
