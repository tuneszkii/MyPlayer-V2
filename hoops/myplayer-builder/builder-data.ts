import type {
  Attribute,
  AttributeLink,
  Badge,
  Category,
  CategoryId,
  ComparableBuild,
  Position,
  Ratings,
  StepId,
  Takeover,
} from './builder-types.js';

/** All attribute categories with display metadata. */
export const CATEGORIES: Category[] = [
  { id: 'finishing', name: 'Finishing', color: '#ff5b3a', glyph: 'FIN' },
  { id: 'shooting', name: 'Shooting', color: '#3ba9ff', glyph: 'SHT' },
  { id: 'playmaking', name: 'Playmaking', color: '#c46bff', glyph: 'PLY' },
  { id: 'defense', name: 'Defense', color: '#2fe0a0', glyph: 'DEF' },
  { id: 'rebounding', name: 'Rebounding', color: '#ffc93a', glyph: 'REB' },
  { id: 'physicals', name: 'Physicals', color: '#ff4f8b', glyph: 'ATH' },
];

/** Every tunable attribute in the builder. */
export const ATTRIBUTES: Attribute[] = [
  { id: 'closeShot', name: 'Close Shot', short: 'CLS', category: 'finishing' },
  { id: 'drivingLayup', name: 'Driving Layup', short: 'LAY', category: 'finishing' },
  { id: 'drivingDunk', name: 'Driving Dunk', short: 'DNK', category: 'finishing' },
  { id: 'standingDunk', name: 'Standing Dunk', short: 'SDK', category: 'finishing' },
  { id: 'postControl', name: 'Post Control', short: 'PST', category: 'finishing' },

  { id: 'midRange', name: 'Mid-Range Shot', short: 'MID', category: 'shooting' },
  { id: 'threePoint', name: 'Three-Point Shot', short: '3PT', category: 'shooting' },
  { id: 'freeThrow', name: 'Free Throw', short: 'FT', category: 'shooting' },

  { id: 'passAccuracy', name: 'Pass Accuracy', short: 'PAS', category: 'playmaking' },
  { id: 'ballHandle', name: 'Ball Handle', short: 'HND', category: 'playmaking' },
  { id: 'speedWithBall', name: 'Speed With Ball', short: 'SWB', category: 'playmaking' },

  { id: 'interiorDefense', name: 'Interior Defense', short: 'ID', category: 'defense' },
  { id: 'perimeterDefense', name: 'Perimeter Defense', short: 'PD', category: 'defense' },
  { id: 'steal', name: 'Steal', short: 'STL', category: 'defense' },
  { id: 'block', name: 'Block', short: 'BLK', category: 'defense' },

  { id: 'offensiveRebound', name: 'Offensive Rebound', short: 'OREB', category: 'rebounding' },
  { id: 'defensiveRebound', name: 'Defensive Rebound', short: 'DREB', category: 'rebounding' },

  { id: 'speed', name: 'Speed', short: 'SPD', category: 'physicals' },
  { id: 'agility', name: 'Agility', short: 'AGI', category: 'physicals' },
  { id: 'strength', name: 'Strength', short: 'STR', category: 'physicals' },
  { id: 'vertical', name: 'Vertical', short: 'VRT', category: 'physicals' },
  { id: 'stamina', name: 'Stamina', short: 'STA', category: 'physicals' },
];

/**
 * The attribute dependency graph.
 *
 * Each entry lists the attributes a given rating leans on, and how far it is
 * allowed to sit above them. Raising a rating pulls its parents up; dropping a
 * parent pushes its dependents back down. This is what stops a build from being
 * a faster ball handler than it is a runner.
 */
export const ATTRIBUTE_LINKS: Record<string, AttributeLink[]> = {
  // Finishing leans on touch, handles and athleticism.
  drivingLayup: [
    { attr: 'closeShot', gap: 10 },
    { attr: 'ballHandle', gap: 10 },
  ],
  drivingDunk: [
    { attr: 'vertical', gap: 6 },
    { attr: 'speed', gap: 12 },
  ],
  standingDunk: [
    { attr: 'vertical', gap: 8 },
    { attr: 'strength', gap: 12 },
  ],
  postControl: [
    { attr: 'strength', gap: 10 },
    { attr: 'closeShot', gap: 12 },
  ],

  // Shooting builds outward from the rim.
  midRange: [
    { attr: 'closeShot', gap: 12 },
    { attr: 'freeThrow', gap: 25 }
  ],
  threePoint: [{ attr: 'midRange', gap: 6 }],

  // Playmaking: you cannot move faster with the ball than without it.
  passAccuracy: [{ attr: 'ballHandle', gap: 14 }],
  ballHandle: [
    { attr: 'speedWithBall', gap: 6 },
  ],
  speedWithBall: [
    { attr: 'speed', gap: 0 },
  ],

  // Defense leans on frame and footwork.
  interiorDefense: [
    { attr: 'strength', gap: 14 },
    { attr: 'defensiveRebound', gap: 23 },
    { attr: 'block', gap: 19 }
  ],
  perimeterDefense: [
    { attr: 'agility', gap: 8 },
    { attr: 'steal', gap: 22 }
  ],
  steal: [
    { attr: 'agility', gap: 16 }
  ],
  block: [
    { attr: 'vertical', gap: 8 },
  ],

  // Rebounding leans on bounce and strength.
  offensiveRebound: [
    { attr: 'vertical', gap: 12 },
    { attr: 'strength', gap: 12 },
  ],
  defensiveRebound: [
    { attr: 'vertical', gap: 12 },
    { attr: 'strength', gap: 10 },
  ],

  // Physicals: speed rides on agility, bounce rides on agility.
  speed: [
    { attr: 'agility', gap: 8 },
    { attr: 'stamina', gap: 17 }
  ],
  vertical: [
  ],
  agility: [],
  stamina: [],

  // Roots — nothing sits beneath these.
  closeShot: [],
  strength: [],
};

/** Badges unlocked by attribute thresholds. */
export const BADGES: Badge[] = [
  { id: 'posterizer', name: 'Posterizer', category: 'finishing', driver: 'drivingDunk', tiers: [70, 80, 88, 94] },
  { id: 'aerialWizard', name: 'Aerial Wizard', category: 'finishing', driver: 'standingDunk', tiers: [65, 76, 85, 92] },
  { id: 'layupMixmaster', name: 'Layup Mixmaster', category: 'finishing', driver: 'drivingLayup', tiers: [68, 78, 86, 93] },
  { id: 'floatGame', name: 'Float Game', category: 'finishing', driver: 'closeShot', tiers: [62, 74, 84, 91] },
  { id: 'postPowerhouse', name: 'Post Powerhouse', category: 'finishing', driver: 'postControl', tiers: [65, 75, 85, 92] },

  { id: 'deadeye', name: 'Deadeye', category: 'shooting', driver: 'threePoint', tiers: [70, 80, 88, 94] },
  { id: 'limitless', name: 'Limitless Range', category: 'shooting', driver: 'threePoint', tiers: [75, 84, 90, 96] },
  { id: 'middyMagician', name: 'Middy Magician', category: 'shooting', driver: 'midRange', tiers: [70, 80, 88, 94] },
  { id: 'freePoints', name: 'Free Points', category: 'shooting', driver: 'freeThrow', tiers: [60, 72, 82, 90] },

  { id: 'dimer', name: 'Dimer', category: 'playmaking', driver: 'passAccuracy', tiers: [68, 78, 86, 93] },
  { id: 'unpluckable', name: 'Unpluckable', category: 'playmaking', driver: 'ballHandle', tiers: [65, 76, 85, 92] },
  { id: 'ankleBreaker', name: 'Ankle Breaker', category: 'playmaking', driver: 'ballHandle', tiers: [72, 82, 89, 95] },
  { id: 'handlesForDays', name: 'Handles For Days', category: 'playmaking', driver: 'speedWithBall', tiers: [68, 78, 86, 93] },

  { id: 'clamps', name: 'Clamps', category: 'defense', driver: 'perimeterDefense', tiers: [70, 80, 88, 94] },
  { id: 'paintPatroller', name: 'Paint Patroller', category: 'defense', driver: 'interiorDefense', tiers: [70, 80, 88, 94] },
  { id: 'challenger', name: 'Challenger', category: 'defense', driver: 'block', tiers: [65, 76, 85, 92] },
  { id: 'glove', name: 'Glove', category: 'defense', driver: 'steal', tiers: [68, 78, 86, 93] },

  { id: 'reboundChaser', name: 'Rebound Chaser', category: 'rebounding', driver: 'defensiveRebound', tiers: [68, 78, 86, 93] },
  { id: 'boxoutBeast', name: 'Boxout Beast', category: 'rebounding', driver: 'offensiveRebound', tiers: [65, 76, 85, 92] },

  { id: 'immovable', name: 'Immovable Enforcer', category: 'physicals', driver: 'strength', tiers: [70, 80, 88, 94] },
  { id: 'brickWall', name: 'Brick Wall', category: 'physicals', driver: 'strength', tiers: [62, 74, 84, 91] },
  { id: 'workHorse', name: 'Work Horse', category: 'physicals', driver: 'stamina', tiers: [66, 77, 86, 93] },
  { id: 'bunnies', name: 'Bunnies', category: 'physicals', driver: 'vertical', tiers: [68, 78, 86, 93] },
];

/** Takeovers, unlocked when every requirement is met. */
export const TAKEOVERS: Takeover[] = [
  {
    id: 'shotCreator',
    name: 'Shot Creator',
    category: 'shooting',
    description: 'Pull-ups, step-backs and contested jumpers go in at a much higher clip.',
    requirements: [
      { attr: 'midRange', min: 80 },
      { attr: 'ballHandle', min: 78 },
      { attr: 'threePoint', min: 75 },
    ],
  },
  {
    id: 'spotUpShooter',
    name: 'Spot-Up Precision',
    category: 'shooting',
    description: 'Catch-and-shoot threes become near automatic when you are set.',
    requirements: [
      { attr: 'threePoint', min: 85 },
      { attr: 'midRange', min: 75 },
    ],
  },
  {
    id: 'slasher',
    name: 'Slasher',
    category: 'finishing',
    description: 'Blow-by speed and finishing through contact at the rim.',
    requirements: [
      { attr: 'drivingLayup', min: 80 },
      { attr: 'drivingDunk', min: 80 },
      { attr: 'speedWithBall', min: 75 },
    ],
  },
  {
    id: 'postScorer',
    name: 'Post Scorer',
    category: 'finishing',
    description: 'Back-downs, hooks and fadeaways become unstoppable on the block.',
    requirements: [
      { attr: 'postControl', min: 80 },
      { attr: 'closeShot', min: 82 },
      { attr: 'strength', min: 75 },
    ],
  },
  {
    id: 'playmaker',
    name: 'Playmaker',
    category: 'playmaking',
    description: 'Passes are crisper and teammates get a shot boost off your dimes.',
    requirements: [
      { attr: 'passAccuracy', min: 85 },
      { attr: 'ballHandle', min: 80 },
    ],
  },
  {
    id: 'lockdown',
    name: 'Lockdown Defender',
    category: 'defense',
    description: 'Stay glued to your matchup and strip ball handlers at will.',
    requirements: [
      { attr: 'perimeterDefense', min: 85 },
      { attr: 'steal', min: 78 },
      { attr: 'agility', min: 78 },
    ],
  },
  {
    id: 'rimProtector',
    name: 'Rim Protector',
    category: 'defense',
    description: 'Wall off the paint, swat everything and alter shots you do not block.',
    requirements: [
      { attr: 'block', min: 82 },
      { attr: 'interiorDefense', min: 82 },
      { attr: 'vertical', min: 75 },
    ],
  },
  {
    id: 'glassCleaner',
    name: 'Glass Cleaner',
    category: 'rebounding',
    description: 'Own both backboards and kick out outlet passes in stride.',
    requirements: [
      { attr: 'defensiveRebound', min: 85 },
      { attr: 'offensiveRebound', min: 78 },
      { attr: 'strength', min: 72 },
    ],
  },
];

/** Tier names indexed by tier level. */
export const TIER_NAMES = ['Locked', 'Bronze', 'Silver', 'Gold', 'Hall of Fame'];

/** Tier colors indexed by tier level. */
export const TIER_COLORS = ['#2a2f3d', '#b06a3b', '#9fa8b8', '#f0b429', '#8b5cf6'];

/** Selectable positions. */
export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

/** Descriptive blurb per position. */
export const POSITION_BLURB: Record<Position, string> = {
  PG: 'Floor general. Lives off handles, vision and pull-up threes.',
  SG: 'Three-level scorer with size to defend on the wing.',
  SF: 'Two-way wing. Slashing, spacing and switchable defense.',
  PF: 'Stretch or bruiser. Glass work with a face-up game.',
  C: 'Rim protection, lob threat and interior dominance.',
};

/**
 * Per-position attribute ceilings. Attributes not listed cap at 99.
 */
export const POSITION_CAPS: Record<Position, Partial<Record<string, number>>> = {
  PG: {
    standingDunk: 78, postControl: 74, interiorDefense: 82, block: 80,
    offensiveRebound: 80, defensiveRebound: 84, strength: 84,
    passAccuracy: 99, ballHandle: 99, speedWithBall: 99, perimeterDefense: 99,
    steal: 99, speed: 99, agility: 99, threePoint: 99, midRange: 99,
    closeShot: 99, freeThrow: 99,
  },
  SG: {
    standingDunk: 84, postControl: 80, interiorDefense: 86, block: 85,
    offensiveRebound: 85, strength: 89,
    passAccuracy: 96, ballHandle: 96, speedWithBall: 96, perimeterDefense: 99,
    steal: 99, speed: 99, agility: 99, threePoint: 99, midRange: 99,
    closeShot: 99, freeThrow: 99,
  },
  SF: { standingDunk: 91, postControl: 87, ballHandle: 96, speedWithBall: 96 },
  PF: { threePoint: 93, ballHandle: 84, speedWithBall: 83, speed: 93, agility: 91 },
  C: {
    threePoint: 93, ballHandle: 84, speedWithBall: 84, drivingDunk: 99,
    standingDunk: 99, postControl: 99, interiorDefense: 99, block: 99,
    offensiveRebound: 99, defensiveRebound: 99, strength: 99, vertical: 99,
  },
};

/** Height ranges (inches) allowed per position. */
export const POSITION_HEIGHT: Record<Position, [number, number]> = {
  PG: [67, 79],
  SG: [76, 80],
  SF: [77, 81],
  PF: [80, 83],
  C: [82, 88],
};

/** Category weight per position, used for the overall rating. */
export const POSITION_WEIGHTS: Record<Position, Record<CategoryId, number>> = {
  PG: { finishing: 0.14, shooting: 0.24, playmaking: 0.26, defense: 0.16, rebounding: 0.04, physicals: 0.16 },
  SG: { finishing: 0.18, shooting: 0.26, playmaking: 0.16, defense: 0.2, rebounding: 0.05, physicals: 0.15 },
  SF: { finishing: 0.2, shooting: 0.22, playmaking: 0.14, defense: 0.22, rebounding: 0.08, physicals: 0.14 },
  PF: { finishing: 0.22, shooting: 0.16, playmaking: 0.1, defense: 0.22, rebounding: 0.16, physicals: 0.14 },
  C: { finishing: 0.24, shooting: 0.1, playmaking: 0.08, defense: 0.24, rebounding: 0.2, physicals: 0.14 },
};

/** Lowest value any attribute can be set to. */
export const MIN_RATING = 25;

/** Total attribute points available to spend. */
export const TOTAL_POINTS = 1850;

/** The wizard steps in order. */
export const STEPS: { id: StepId; label: string; hint: string }[] = [
  { id: 'body', label: 'Body', hint: 'Frame and physical profile' },
  { id: 'attributes', label: 'Attributes', hint: 'Spend your points' },
  { id: 'takeover', label: 'Takeover', hint: 'Pick your superpower' },
  { id: 'summary', label: 'Finish', hint: 'Name and compare' },
];

/**
 * Build a fresh ratings map with every attribute at the minimum.
 *
 * @returns a ratings map keyed by attribute id.
 */
export function baseRatings(): Ratings {
  return ATTRIBUTES.reduce<Ratings>((acc, attr) => {
    acc[attr.id] = MIN_RATING;
    return acc;
  }, {});
}

/** Reference builds used for the "similar builds" comparison on the last step. */
export const COMPARABLE_BUILDS: ComparableBuild[] = [
  {
    id: 'two-way-shot-creator',
    name: '2-Way Shot Creator',
    position: 'SG',
    tagline: 'Bucket getter that guards the other team\u2019s best wing.',
    ratings: {
      closeShot: 76, drivingLayup: 84, drivingDunk: 85, standingDunk: 58, postControl: 45,
      midRange: 86, threePoint: 88, freeThrow: 80,
      passAccuracy: 74, ballHandle: 88, speedWithBall: 84,
      interiorDefense: 58, perimeterDefense: 86, steal: 80, block: 56,
      offensiveRebound: 44, defensiveRebound: 62,
      speed: 86, agility: 84, strength: 64, vertical: 82, stamina: 88,
    },
  },
  {
    id: 'paint-beast',
    name: 'Paint Beast',
    position: 'C',
    tagline: 'Lob magnet, glass cleaner, nothing gets to the rim.',
    ratings: {
      closeShot: 86, drivingLayup: 66, drivingDunk: 88, standingDunk: 92, postControl: 84,
      midRange: 52, threePoint: 30, freeThrow: 62,
      passAccuracy: 58, ballHandle: 44, speedWithBall: 44,
      interiorDefense: 92, perimeterDefense: 60, steal: 52, block: 92,
      offensiveRebound: 88, defensiveRebound: 92,
      speed: 64, agility: 62, strength: 92, vertical: 86, stamina: 82,
    },
  },
  {
    id: 'pass-first-general',
    name: 'Pass-First General',
    position: 'PG',
    tagline: 'Elite vision and handles, keeps everyone fed.',
    ratings: {
      closeShot: 66, drivingLayup: 82, drivingDunk: 62, standingDunk: 34, postControl: 40,
      midRange: 76, threePoint: 82, freeThrow: 80,
      passAccuracy: 94, ballHandle: 92, speedWithBall: 88,
      interiorDefense: 44, perimeterDefense: 80, steal: 85, block: 42,
      offensiveRebound: 34, defensiveRebound: 56,
      speed: 88, agility: 90, strength: 56, vertical: 72, stamina: 90,
    },
  },
  {
    id: 'stretch-four',
    name: '2-Way Stretch Four',
    position: 'PF',
    tagline: 'Spaces the floor, switches everything, cleans the glass.',
    ratings: {
      closeShot: 78, drivingLayup: 74, drivingDunk: 84, standingDunk: 82, postControl: 70,
      midRange: 80, threePoint: 86, freeThrow: 76,
      passAccuracy: 68, ballHandle: 64, speedWithBall: 62,
      interiorDefense: 82, perimeterDefense: 78, steal: 66, block: 80,
      offensiveRebound: 78, defensiveRebound: 88,
      speed: 74, agility: 74, strength: 85, vertical: 82, stamina: 84,
    },
  },
  {
    id: 'inside-out-slasher',
    name: 'Inside-Out Slasher',
    position: 'SF',
    tagline: 'Downhill force who punishes closeouts at the rim.',
    ratings: {
      closeShot: 84, drivingLayup: 92, drivingDunk: 94, standingDunk: 76, postControl: 62,
      midRange: 74, threePoint: 72, freeThrow: 70,
      passAccuracy: 72, ballHandle: 84, speedWithBall: 84,
      interiorDefense: 68, perimeterDefense: 80, steal: 74, block: 68,
      offensiveRebound: 70, defensiveRebound: 76,
      speed: 88, agility: 86, strength: 78, vertical: 90, stamina: 88,
    },
  },
  {
    id: 'point-forward',
    name: 'Point Forward',
    position: 'SF',
    tagline: 'Runs the offense from the wing with size and vision.',
    ratings: {
      closeShot: 78, drivingLayup: 84, drivingDunk: 80, standingDunk: 66, postControl: 72,
      midRange: 80, threePoint: 82, freeThrow: 78,
      passAccuracy: 92, ballHandle: 88, speedWithBall: 84,
      interiorDefense: 70, perimeterDefense: 80, steal: 76, block: 66,
      offensiveRebound: 66, defensiveRebound: 80,
      speed: 82, agility: 82, strength: 76, vertical: 78, stamina: 88,
    },
  },
  {
    id: 'three-and-d-wing',
    name: '3&D Wing',
    position: 'SG',
    tagline: 'Low usage, high impact. Spaces the floor and locks up.',
    ratings: {
      closeShot: 68, drivingLayup: 72, drivingDunk: 78, standingDunk: 58, postControl: 44,
      midRange: 78, threePoint: 92, freeThrow: 84,
      passAccuracy: 64, ballHandle: 68, speedWithBall: 66,
      interiorDefense: 68, perimeterDefense: 92, steal: 84, block: 66,
      offensiveRebound: 52, defensiveRebound: 72,
      speed: 82, agility: 84, strength: 72, vertical: 78, stamina: 88,
    },
  },
  {
    id: 'stretch-five',
    name: 'Stretch Five',
    position: 'C',
    tagline: 'Pulls the rim protector out of the paint and still walls it off.',
    ratings: {
      closeShot: 82, drivingLayup: 62, drivingDunk: 76, standingDunk: 86, postControl: 76,
      midRange: 80, threePoint: 84, freeThrow: 80,
      passAccuracy: 70, ballHandle: 56, speedWithBall: 54,
      interiorDefense: 86, perimeterDefense: 62, steal: 54, block: 88,
      offensiveRebound: 80, defensiveRebound: 90,
      speed: 62, agility: 60, strength: 88, vertical: 78, stamina: 82,
    },
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    position: 'PG',
    tagline: 'Pure pace. Gets anywhere on the floor whenever he wants.',
    ratings: {
      closeShot: 84, drivingLayup: 90, drivingDunk: 89, standingDunk: 36, postControl: 42,
      midRange: 88, threePoint: 82, freeThrow: 76,
      passAccuracy: 82, ballHandle: 94, speedWithBall: 90,
      interiorDefense: 58, perimeterDefense: 86, steal: 82, block: 68,
      offensiveRebound: 36, defensiveRebound: 54,
      speed: 94, agility: 95, strength: 58, vertical: 88, stamina: 96,
    },
  },
  {
    id: 'glass-cleaning-lock',
    name: 'Glass-Cleaning Lock',
    position: 'PF',
    tagline: 'Switches one through five and ends every possession with a board.',
    ratings: {
      closeShot: 76, drivingLayup: 70, drivingDunk: 80, standingDunk: 84, postControl: 66,
      midRange: 66, threePoint: 62, freeThrow: 68,
      passAccuracy: 66, ballHandle: 60, speedWithBall: 58,
      interiorDefense: 90, perimeterDefense: 84, steal: 76, block: 86,
      offensiveRebound: 86, defensiveRebound: 94,
      speed: 76, agility: 78, strength: 90, vertical: 86, stamina: 88,
    },
  },
];

/** Archetype quick-starts offered on the attributes step. */
export const PRESETS = COMPARABLE_BUILDS.slice(0, 5);
