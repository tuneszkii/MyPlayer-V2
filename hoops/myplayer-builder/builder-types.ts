/**
 * Playable positions in the builder.
 */
export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

/**
 * Shooting/dribbling hand of the player.
 */
export type Handedness = 'Left' | 'Right';

/**
 * The six attribute categories a build is scored on.
 */
export type CategoryId =
  | 'finishing'
  | 'shooting'
  | 'playmaking'
  | 'defense'
  | 'rebounding'
  | 'physicals';

/**
 * A single tunable attribute (e.g. "Three-Point Shot").
 */
export type Attribute = {
  /** Stable identifier used as a react key and lookup. */
  id: string;
  /** Human readable attribute name. */
  name: string;
  /** Category the attribute rolls up into. */
  category: CategoryId;
  /** Short label used in compact views. */
  short: string;
};

/**
 * A category grouping with display metadata.
 */
export type Category = {
  id: CategoryId;
  name: string;
  /** Accent color used for bars and chips. */
  color: string;
  /** Three letter label used on the radar chart. */
  glyph: string;
};

/**
 * A dependency edge between two attributes.
 *
 * Reads as: this attribute may not exceed `attr` by more than `gap`.
 * Raising the dependent attribute therefore pulls `attr` up with it.
 */
export type AttributeLink = {
  /** The attribute this one depends on. */
  attr: string;
  /** How far above the parent this attribute may sit. */
  gap: number;
};

/**
 * Physical profile of the player.
 */
export type Body = {
  /** Height in inches. */
  height: number;
  /** Weight in pounds. */
  weight: number;
  /** Wingspan in inches. */
  wingspan: number;
  /** Dominant hand. */
  hand: Handedness;
};

/**
 * Map of attribute id to its rating value (25-99).
 */
export type Ratings = Record<string, number>;

/**
 * A badge unlocked by attribute thresholds.
 */
export type Badge = {
  id: string;
  name: string;
  category: CategoryId;
  /** Attribute that drives the badge tier. */
  driver: string;
  /** Rating thresholds for Bronze, Silver, Gold, Hall of Fame. */
  tiers: [number, number, number, number];
};

/**
 * Badge tier levels, 0 meaning locked.
 */
export type BadgeTier = 0 | 1 | 2 | 3 | 4;

/**
 * A takeover unlocked by meeting several attribute requirements.
 */
export type Takeover = {
  id: string;
  name: string;
  /** Short description of what the takeover does. */
  description: string;
  /** Category used for the accent color. */
  category: CategoryId;
  /** Attribute requirements that must all be met to unlock. */
  requirements: { attr: string; min: number }[];
};

/**
 * A reference build used for the "similar builds" comparison.
 */
export type ComparableBuild = {
  id: string;
  name: string;
  position: Position;
  /** Short flavor line describing the build's identity. */
  tagline: string;
  ratings: Ratings;
};

/**
 * Full state of a MyPlayer build.
 */
export type Build = {
  name: string;
  position: Position;
  body: Body;
  ratings: Ratings;
  /** Selected takeover id, when one has been chosen. */
  takeover?: string;
};

/**
 * The ordered wizard steps.
 */
export type StepId = 'body' | 'attributes' | 'takeover' | 'summary';
