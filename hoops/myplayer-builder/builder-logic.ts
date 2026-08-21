import {
  ATTRIBUTES,
  ATTRIBUTE_LINKS,
  BADGES,
  CAP_ANCHORS,
  CAP_FAMILIES,
  CAP_FAMILY_BUDGETS,
  CATEGORIES,
  MIN_RATING,
  POSITION_CAPS,
  POSITION_WEIGHTS,
  TAKEOVERS,
  TOTAL_POINTS,
} from './builder-data.js';
import type {
  Badge,
  BadgeTier,
  Body,
  CategoryId,
  ComparableBuild,
  Position,
  Ratings,
  Takeover,
} from './builder-types.js';

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Reverse of {@link ATTRIBUTE_LINKS} — for each attribute, the attributes that
 * lean on it. Lowering an attribute drags these down with it.
 */
const DEPENDENTS: Record<string, { attr: string; gap: number }[]> = (() => {
  const map: Record<string, { attr: string; gap: number }[]> = {};
  ATTRIBUTES.forEach((a) => {
    map[a.id] = [];
  });
  Object.entries(ATTRIBUTE_LINKS).forEach(([child, links]) => {
    links.forEach((link) => {
      if (!map[link.attr]) map[link.attr] = [];
      map[link.attr].push({ attr: child, gap: link.gap });
    });
  });
  return map;
})();

/**
 * Attributes that lean on the given attribute.
 *
 * @param attributeId the attribute to inspect.
 * @returns dependent attributes with their allowed gap.
 */
export function dependentsOf(attributeId: string): { attr: string; gap: number }[] {
  return DEPENDENTS[attributeId] ?? [];
}

/**
 * Attributes the given attribute leans on.
 *
 * @param attributeId the attribute to inspect.
 * @returns parent attributes with their allowed gap.
 */
export function parentsOf(attributeId: string): { attr: string; gap: number }[] {
  return ATTRIBUTE_LINKS[attributeId] ?? [];
}

/**
 * Cost curve — higher ratings cost more points per point, like 2K's upgrade cost.
 *
 * @param value the rating value being purchased.
 * @returns the point cost of that single rating point.
 */
function pointCost(value: number): number {
  if (value <= 60) return 1;
  if (value <= 75) return 2;
  if (value <= 85) return 3;
  if (value <= 92) return 4;
  return 6;
}

/**
 * Total points spent to reach a given rating from the minimum.
 *
 * @param value the current rating value.
 * @returns accumulated point cost.
 */
export function costOf(value: number): number {
  let total = 0;
  for (let v = MIN_RATING + 1; v <= value; v += 1) total += pointCost(v);
  return total;
}

/**
 * Points spent across the whole build.
 *
 * @param ratings the current ratings map.
 * @returns total points spent.
 */
export function spentPoints(ratings: Ratings): number {
  return ATTRIBUTES.reduce((sum, attr) => sum + costOf(ratings[attr.id] ?? MIN_RATING), 0);
}

/**
 * Points still available to spend.
 *
 * @param ratings the current ratings map.
 * @returns remaining points.
 */
export function remainingPoints(ratings: Ratings): number {
  return TOTAL_POINTS - spentPoints(ratings);
}

/**
 * The hard ceiling an attribute has from position and body alone, ignoring
 * attribute links. Taller players trade quickness ceilings for interior ones,
 * heavier players gain strength, and long wingspans help defensive attributes.
 *
 * @param attributeId the attribute being capped.
 * @param position the selected position.
 * @param body the player's physical profile.
 * @returns the ceiling value between 40 and 99.
 */

export function getWeightRange(position: Position, height: number): [number, number] {
  switch (position) {
    case 'PG':
      return [
        Math.round(160 + (height - 72) * 3),
        Math.round(185 + (height - 72) * 5),
      ];

    case 'SG':
      return [
        Math.round(180 + (height - 72) * 3),
        Math.round(185 + (height - 72) * 5),
      ];

    case 'SF':
      return [
        Math.round(190 + (height - 72) * 4),
        Math.round(195 + (height - 72) * 5),
      ];

    case 'PF':
      return [
        Math.round(205 + (height - 72) * 4),
        Math.round(220 + (height - 72) * 5),
      ];

    case 'C':
      return [
        Math.round(220 + (height - 72) * 4),
        Math.round(295 + (height - 72) * 5),
      ];
  }
}

/**
 * Body-cap model
 *
 * This section intentionally uses attribute-specific physical curves rather
 * than broad "quickness", "size", or "shooting" modifiers.
 *
 * Important:
 * - Height is not equally valuable for every attribute.
 * - Wingspan is measured relative to the player's height.
 * - Weight is evaluated relative to a height + position-specific ideal.
 * - Extreme bodies create diminishing returns instead of hard cliffs.
 * - POSITION_CAPS remains the positional ceiling/baseline.
 */

type BodyCurveAttribute =
  | 'closeShot'
  | 'drivingLayup'
  | 'drivingDunk'
  | 'standingDunk'
  | 'postControl'
  | 'midRange'
  | 'threePoint'
  | 'freeThrow'
  | 'passAccuracy'
  | 'ballHandle'
  | 'speedWithBall'
  | 'interiorDefense'
  | 'perimeterDefense'
  | 'steal'
  | 'block'
  | 'offensiveRebound'
  | 'defensiveRebound'
  | 'speed'
  | 'agility'
  | 'strength'
  | 'vertical'
  | 'stamina';

/**
 * Convert a physical measurement into a normalized range.
 *
 * Examples:
 * - 6'6" = 78 inches
 * - 6'9" = 81 inches
 * - 7'4" = 88 inches
 */
function normalizedHeight(height: number): number {
  return height - 78;
}

/**
 * Wingspan relative to height.
 *
 * 0  = wingspan exactly equals height
 * +2 = two inches longer
 * +6 = six inches longer
 */
function relativeWingspan(body: Body): number {
  return body.wingspan - body.height;
}

/**
 * Smoothly compress extreme positive/negative values.
 *
 * This is useful for weight because going from +20 to +40 lbs should matter,
 * but going from +40 to +60 should not double the effect.
 */
function softSaturate(value: number, scale: number): number {
  if (value === 0) return 0;

  const magnitude = Math.abs(value);
  const compressed = magnitude / (1 + magnitude / scale);

  return Math.sign(value) * compressed;
}

/**
 * Position-specific ideal weight.
 *
 * The key difference from the previous model:
 *
 * 7'4 C does NOT use the same ideal-weight relationship as a 7'4 PG.
 * Weight therefore remains meaningful at every position and height.
 */
function idealWeight(height: number, position: Position): number {
  const heightAboveSixFoot = height - 72;

  const positionBias: Record<Position, number> = {
    PG: -10,
    SG: -5,
    SF: 4,
    PF: 14,
    C: 25,
  };

  const raw =
    175 +
    heightAboveSixFoot * 6.0 +
    positionBias[position];

  return clamp(raw, 160, 330);
}

/**
 * Weight relative to the player's physical frame.
 *
 * Example:
 * - negative = underweight for the frame
 * - positive = overweight for the frame
 */
function weightDelta(body: Body, position: Position): number {
  return body.weight - idealWeight(body.height, position);
}

/**
 * Returns a weight factor where:
 *
 * - underweight is negative
 * - moderate extra mass is positive
 * - extreme mass eventually gives diminishing returns
 */
function massFactor(body: Body, position: Position): number {
  const delta = weightDelta(body, position);

  if (delta >= 0) {
    return softSaturate(delta, 45);
  }

  return softSaturate(delta, 35);
}

/**
 * Height curve helpers.
 *
 * These intentionally use different shapes for different attribute families.
 */

function heightPenaltyAbove(
  height: number,
  threshold: number,
  coefficient: number,
): number {
  return Math.max(0, height - threshold) * coefficient;
}

function heightBonusAbove(
  height: number,
  threshold: number,
  coefficient: number,
): number {
  return Math.max(0, height - threshold) * coefficient;
}

/**
 * SHOOTING
 *
 * Height begins to matter more above the normal guard range.
 * Wingspan adds another penalty based on length relative to height.
 *
 * Free throw is deliberately less sensitive than field-goal shooting.
 */
function shootingCap(
  attributeId: string,
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position][attributeId] ?? 99;
  const h = body.height;
  const length = relativeWingspan(body);

  let cap = base;

  // 6'6" is approximately neutral.
  if (attributeId === 'threePoint' || attributeId === 'midRange') {
    // Small guards can retain elite shooting.
    if (h < 78) {
      cap += Math.min(4, (78 - h) * 0.75);
    }

    // Height still matters, but the penalty tapers instead of stacking linearly.
    cap -= softSaturate(Math.max(0, h - 78), 8) * 1.8;

    // Long arms are a real shooting tradeoff.
    const excessLength = Math.max(0, length - 2);
    cap -= (length - 2) * (h < 78 ? 1.2 : 0.8);
  }

  if (attributeId === 'freeThrow') {
    // Free throw should be substantially less body-sensitive.
    cap -= heightPenaltyAbove(h, 84, 0.75);
    cap -= Math.max(0, length - 4) * 0.5;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * BALL HANDLING
 *
 * Height is the primary constraint.
 * Wingspan matters, but much less than height.
 * Weight matters only once a player is substantially overweight for their frame.
 *
 * This intentionally leaves room for big creators:
 * 6'7-6'9 wings can still be strong ball handlers.
 */
function ballHandleCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].ballHandle ?? 99;
  const h = body.height;
  const length = relativeWingspan(body);

  let cap = base;

  if (h <= 74) {
    // Small guard advantage.
    cap += (74 - h) * 0.8;
  } else if (h <= 77) {
    // Elite guard window.
    cap += 1;
  } else if (h <= 80) {
    // 6'6-6'8 remains highly playable with the ball.
    cap -= (h - 77) * 2.0;
  } else if (h <= 83) {
    // 6'9-6'11 remains viable for tall creators.
    cap -= 6 + (h - 80) * 2.7;
  } else {
    // 7'0+ becomes increasingly restricted.
    cap -= 14 + (h - 83) * 3.5;
  }

  // Long arms hurt handling, but the penalty is intentionally modest.
  cap -= (length - 2) * 0.7;

  // Only substantial excess weight should affect handle.
  const delta = weightDelta(body, position);
  cap -= Math.max(0, delta - 15) * 0.04;

  return clamp(Math.round(cap), 40, 99);
}

/**
 * SPEED
 *
 * Height is significant.
 * Excess mass hurts, but heavy players retain strength benefits elsewhere.
 */
function speedCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].speed ?? 99;
  const h = body.height;
  const delta = weightDelta(body, position);

  let cap = base;

  if (h < 78) {
    cap += Math.min(5, (78 - h) * 1.1);
  } else {
    cap -= (h - 78) * 1.45;
  }

  // Underweight/light guards retain a small speed benefit.
  if (delta < -15) {
    cap += Math.min(3, (-delta - 15) * 0.05);
  }

  // Extra mass progressively hurts movement.
  if (delta > 0) {
    cap -= softSaturate(delta, 45) * 0.22;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * AGILITY
 *
 * Agility is more sensitive to size than straight-line speed.
 */
function agilityCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].agility ?? 99;
  const h = body.height;
  const delta = weightDelta(body, position);
  const length = relativeWingspan(body);

  let cap = base;

  if (h < 78) {
    cap += Math.min(5, (78 - h) * 1.25);
  } else {
    cap -= (h - 78) * 1.75;
  }

  if (delta > 0) {
    cap -= softSaturate(delta, 40) * 0.26;
  }

  // Very long bodies are harder to change direction with.
  cap -= Math.max(0, length - 4) * 0.35;

  return clamp(Math.round(cap), 40, 99);
}

/**
 * SPEED WITH BALL
 *
 * More restrictive than speed, but less restrictive than ball handle
 * for tall players.
 */
function speedWithBallCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].speedWithBall ?? 99;
  const h = body.height;
  const length = relativeWingspan(body);
  const delta = weightDelta(body, position);

  let cap = base;

  if (h < 78) {
    cap += Math.min(4, (78 - h) * 0.9);
  } else {
    cap -= (h - 78) * 1.6;
  }

  cap -= Math.max(0, length - 3) * 0.6;
  cap -= Math.max(0, delta - 10) * 0.12;

  return clamp(Math.round(cap), 40, 99);
}

/**
 * VERTICAL
 *
 * Shorter/lighter players have the strongest ceiling.
 * Height itself does not completely destroy vertical, especially for bigs.
 */
function verticalCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].vertical ?? 99;
  const h = body.height;
  const delta = weightDelta(body, position);

  let cap = base;

  if (h < 78) {
    cap += Math.min(5, (78 - h) * 1.1);
  } else {
    cap -= (h - 78) * 0.9;
  }

  if (delta > 0) {
    cap -= softSaturate(delta, 45) * 0.16;
  }

  if (position === 'C' && h >= 84 && body.weight >= 275) {
    cap += 10;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * STRENGTH
 *
 * Weight is the primary factor.
 * Height gives a small leverage/size baseline.
 *
 * Critically, 300+ lbs still has value.
 * There is no arbitrary "everything falls off after 288" cutoff.
 */
function strengthCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].strength ?? 99;
  const h = body.height;
  const delta = weightDelta(body, position);

  let cap = base;

  // Tall bodies have more structural strength potential.
  cap += Math.max(0, h - 78) * 0.45;

  // Weight remains beneficial across the high-mass range.
  if (delta >= 0) {
    cap += softSaturate(delta, 60) * 0.42;
  } else {
    // Being dramatically underweight hurts strength potential.
    cap += delta * 0.10;
  }

  if (position === 'C' && h >= 84 && body.weight >= 275) {
    cap += 2;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * STANDING DUNK
 *
 * Primarily height + mass + length.
 * Heavy players retain the benefit of added mass.
 * Extreme weight eventually has diminishing returns rather than a cliff.
 */
function standingDunkCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].standingDunk ?? 70;
  const h = body.height;
  const length = relativeWingspan(body);
  const delta = weightDelta(body, position);

  let cap = base;

  if (h < 74) {
    cap -= (74 - h) * 5;
  } else if (h <= 82) {
    cap += (h - 74) * 1.9;
  } else if (h <= 86) {
    cap += 15 + (h - 82) * 1.6;
  } else {
    // Huge players continue to benefit without instantly hitting 99.
    cap += 21.4 + (h - 86) * 0.9;
  }

  cap += Math.max(0, length - 2) * 0.65;

  if (delta < -20) {
    cap += delta * 0.10;
  } else if (delta <= 30) {
    cap += delta * 0.18;
  } else {
    // Heavy still helps, but each additional pound matters less.
    cap += softSaturate(delta - 30, 45) * 0.10 + 5.4;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * DRIVING DUNK
 *
 * There is an optimal "explosive wing" zone around 6'5-6'9.
 * Extremely short and extremely tall bodies both pay a cost.
 * Wingspan can partially rescue smaller players.
 */
function drivingDunkCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].drivingDunk ?? 80;
  const h = body.height;
  const length = relativeWingspan(body);
  const delta = weightDelta(body, position);

  let cap = base;

  if (h < 73) {
    cap -= (73 - h) * 2.8;
  } else if (h <= 81) {
    cap += (h - 73) * 2.2;
  } else if (h <= 84) {
    cap += 17.6 - (h - 81) * 2.0;
  } else {
    cap += 11.6 - (h - 84) * 3.8;
  }

  // Long arms partially compensate for shorter stature.
  cap += Math.max(0, length - 2) * 0.8;

  // Excessive mass hurts explosive movement.
  cap -= Math.max(0, delta - 20) * 0.07;

  return clamp(Math.round(cap), 40, 99);
}

/**
 * INTERIOR DEFENSE
 *
 * Height + reach are dominant.
 * Weight adds physical resistance, but is not mandatory for tall bodies.
 *
 * This lets a 7'4 C reach elite interior defense even at 235 lbs.
 */
function interiorDefenseCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].interiorDefense ?? 65;
  const h = body.height;
  const length = relativeWingspan(body);
  const delta = weightDelta(body, position);

  let cap = base;

  if (h < 78) {
    cap += (h - 78) * 0.8;
  } else if (h <= 84) {
    cap += (h - 78) * 2.1;
  } else {
    cap += 12.6 + (h - 84) * 1.15;
  }

  cap += Math.max(0, length - 2) * 1.0;

  // Mass is useful but not required for tall defenders.
  if (delta >= 0) {
    cap += softSaturate(delta, 55) * 0.16;
  } else {
    cap += Math.max(delta, -40) * 0.025;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * BLOCK
 *
 * Height and wingspan are the dominant factors.
 * Weight should have a relatively small effect.
 */
function blockCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].block ?? 65;
  const h = body.height;
  const length = relativeWingspan(body);
  const delta = weightDelta(body, position);

  let cap = base;

  if (h < 76) {
    cap += (h - 76) * 1.0;
  } else if (h <= 84) {
    cap += (h - 76) * 2.1;
  } else {
    cap += 16.8 + (h - 84) * 1.2;
  }

  cap += Math.max(0, length - 2) * 1.45;

  // A little mass helps contesting/positioning, but reach matters more.
  cap += softSaturate(delta, 55) * 0.05;

  return clamp(Math.round(cap), 40, 99);
}

/**
 * REBOUNDING
 *
 * Height is primary.
 * Wingspan is secondary.
 * Weight is meaningful but not enough to turn a short guard into a center.
 */
function reboundCap(
  attributeId: string,
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position][attributeId] ?? 60;
  const h = body.height;
  const length = relativeWingspan(body);
  const delta = weightDelta(body, position);

  let cap = base;

  if (h < 78) {
    cap += (h - 78) * 0.5;
  } else if (h <= 84) {
    cap += (h - 78) * 1.9;
  } else {
    cap += 11.4 + (h - 84) * 1.3;
  }

  cap += Math.max(0, length - 2) * 1.15;

  if (delta >= 0) {
    cap += softSaturate(delta, 55) * 0.12;
  } else {
    cap += Math.max(delta, -40) * 0.035;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * POST CONTROL
 *
 * Height helps, weight helps, and reach helps moderately.
 * However, it should not become a free 99 simply because a player is tall.
 */
function postControlCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].postControl ?? 65;
  const h = body.height;
  const length = relativeWingspan(body);
  const delta = weightDelta(body, position);

  let cap = base;

  if (h < 76) {
    cap += (h - 76) * 0.5;
  } else if (h <= 84) {
    cap += (h - 76) * 1.5;
  } else {
    cap += 12 + (h - 84) * 0.8;
  }

  cap += Math.max(0, length - 3) * 0.45;
  cap += softSaturate(delta, 50) * 0.16;

  return clamp(Math.round(cap), 40, 99);
}

/**
 * PERIMETER DEFENSE
 *
 * Height is a mild negative once you move into big-wing territory.
 * Wingspan and mobility are the dominant body advantages.
 */
function perimeterDefenseCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].perimeterDefense ?? 99;
  const h = body.height;
  const length = relativeWingspan(body);

  let cap = base;

  if (h > 78) {
    cap -= (h - 78) * 0.75;
  } else if (h < 76) {
    cap += (76 - h) * 0.45;
  }

  cap += (length - 1) * 1.25;

  // Extremely large players still lose some lateral ceiling.
  if (h >= 84) {
    cap -= (h - 83) * 1.3;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * STEAL
 *
 * Wingspan matters strongly.
 * Quick guards get a mobility advantage.
 * Huge centers can still have long reach, but shouldn't become elite guards.
 */
function stealCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].steal ?? 70;
  const h = body.height;
  const length = relativeWingspan(body);
  const delta = weightDelta(body, position);

  let cap = base;

  if (h < 78) {
    cap += (78 - h) * 0.55;
  } else {
    cap -= (h - 78) * 0.75;
  }

  cap += (length - 1) * 1.3;

  if (delta > 20) {
    cap -= (delta - 20) * 0.04;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * CLOSE SHOT
 *
 * Less sensitive to shooting-body penalties than 3PT/midrange.
 * Size and length provide a moderate benefit around the rim.
 */
function closeShotCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].closeShot ?? 99;
  const h = body.height;
  const length = relativeWingspan(body);

  let cap = base;

  if (h > 78) {
    cap += Math.min(8, (h - 78) * 1.1);
  }

  cap += Math.max(0, length - 3) * 0.35;

  return clamp(Math.round(cap), 40, 99);
}

/**
 * DRIVING LAYUP
 *
 * Quickness + body control matter more than raw size.
 * Small and medium guards retain elite layup potential.
 */
function drivingLayupCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].drivingLayup ?? 99;
  const h = body.height;
  const length = relativeWingspan(body);
  const delta = weightDelta(body, position);

  let cap = base;

  if (h <= 77) {
    cap += (77 - h) * 0.8;
  } else {
    cap -= (h - 77) * 0.8;
  }

  // Long arms still help finishing.
  cap += Math.max(0, length - 2) * 0.45;

  // Excess mass mildly hurts dynamic finishing.
  cap -= Math.max(0, delta - 20) * 0.05;

  return clamp(Math.round(cap), 40, 99);
}

/**
 * PASS ACCURACY
 *
 * Mostly skill-driven, so body dimensions have only modest effects.
 * Taller players are not automatically bad passers.
 */
function passAccuracyCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].passAccuracy ?? 99;
  const h = body.height;
  const length = relativeWingspan(body);

  let cap = base;

  if (h >= 84) {
    cap -= (h - 83) * 0.9;
  }

  if (length > 6) {
    cap -= (length - 6) * 0.35;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * STAMINA
 *
 * Body-sensitive, but much less extreme than movement.
 */
function staminaCap(
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position].stamina ?? 85;
  const h = body.height;
  const delta = weightDelta(body, position);

  let cap = base;

  if (h >= 84) {
    cap -= (h - 83) * 0.5;
  }

  if (delta > 20) {
    cap -= (delta - 20) * 0.04;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * Generic fallback for attributes whose body interaction is intentionally mild.
 */
function genericBodyCap(
  attributeId: string,
  position: Position,
  body: Body,
): number {
  const base = POSITION_CAPS[position][attributeId] ?? 99;

  let cap = base;

  // Mild physical interaction only.
  const h = body.height - 78;
  const length = relativeWingspan(body);

  if (attributeId === 'freeThrow') {
    cap -= Math.max(0, h) * 0.3;
    cap -= Math.max(0, length - 4) * 0.25;
  }

  return clamp(Math.round(cap), 40, 99);
}

/**
 * Final body-based attribute ceiling.
 *
 * Every major body-sensitive attribute has its own model above.
 */
export function bodyCap(
  attributeId: string,
  position: Position,
  body: Body,
): number {
  switch (attributeId as BodyCurveAttribute) {
    case 'closeShot':
      return closeShotCap(position, body);

    case 'drivingLayup':
      return drivingLayupCap(position, body);

    case 'drivingDunk':
      return drivingDunkCap(position, body);

    case 'standingDunk':
      return standingDunkCap(position, body);

    case 'postControl':
      return postControlCap(position, body);

    case 'midRange':
    case 'threePoint':
    case 'freeThrow':
      return shootingCap(attributeId, position, body);

    case 'passAccuracy':
      return passAccuracyCap(position, body);

    case 'ballHandle':
      return ballHandleCap(position, body);

    case 'speedWithBall':
      return speedWithBallCap(position, body);

    case 'interiorDefense':
      return interiorDefenseCap(position, body);

    case 'perimeterDefense':
      return perimeterDefenseCap(position, body);

    case 'steal':
      return stealCap(position, body);

    case 'block':
      return blockCap(position, body);

    case 'offensiveRebound':
    case 'defensiveRebound':
      return reboundCap(attributeId, position, body);

    case 'speed':
      return speedCap(position, body);

    case 'agility':
      return agilityCap(position, body);

    case 'strength':
      return strengthCap(position, body);

    case 'vertical':
      return verticalCap(position, body);

    case 'stamina':
      return staminaCap(position, body);

    default:
      return genericBodyCap(attributeId, position, body);
  }
}

/** Return the family containing an attribute, if it has one. */
function familyOf(attributeId: string): string | undefined {
  return Object.entries(CAP_FAMILIES).find(([, attributes]) => attributes.includes(attributeId))?.[0];
}

/**
 * Apply a shared family budget to a raw body cap. This is deliberately a soft
 * normalization: the highest anchors keep their shape, while broad all-round
 * profiles lose the most access to 99s.
 */
function applyFamilyBudget(
  attributeId: string,
  rawCap: number,
  position: Position,
  body: Body,
): number {
  const family = familyOf(attributeId);
  if (!family) return rawCap;
  if (CAP_ANCHORS[position].includes(attributeId)) return rawCap;

  const familyAttributes = CAP_FAMILIES[family];
  const rawTotal = familyAttributes.reduce(
    (sum, id) => sum + bodyCap(id, position, body),
    0,
  );
  const budget = CAP_FAMILY_BUDGETS[position][family];
  if (rawTotal <= budget) return rawCap;

  // Keep the family identity intact; only part of excess potential is removed.
  // The point budget remains the stronger specialization constraint.
  const excess = (rawTotal - budget) * 0.2;
  const nonMinimumTotal = rawTotal - familyAttributes.length * MIN_RATING;
  const share = nonMinimumTotal > 0 ? (rawCap - MIN_RATING) / nonMinimumTotal : 0;
  return MIN_RATING + Math.max(0, rawCap - MIN_RATING - excess * share);
}

/**
 * The true ceiling for an attribute, accounting for the dependency graph.
 *
 * An attribute can never sit more than `gap` above a parent, so its ceiling is
 * also bounded by what its parents can themselves reach.
 *
 * @param attributeId the attribute being capped.
 * @param position the selected position.
 * @param body the player's physical profile.
 * @param seen guards against cycles during recursion.
 * @returns the effective ceiling value.
 */
export function capFor(
  attributeId: string,
  position: Position,
  body: Body,
  seen: Set<string> = new Set(),
): number {
  if (seen.has(attributeId)) return 99;
  seen.add(attributeId);
  const own = applyFamilyBudget(attributeId, bodyCap(attributeId, position, body), position, body);
  const linked = parentsOf(attributeId).map(
    (link) => capFor(link.attr, position, body, new Set(seen)) + link.gap,
  );
  return Math.round(Math.max(MIN_RATING, Math.min(own, ...linked, 99)));
}

/** Summarize the effective cap distribution for balance diagnostics and tests. */
export function capFamilyTotals(position: Position, body: Body): Record<string, number> {
  return Object.fromEntries(
    Object.entries(CAP_FAMILIES).map(([family, attributes]) => [
      family,
      attributes.reduce((sum, attributeId) => sum + capFor(attributeId, position, body), 0),
    ]),
  );
}

/**
 * The value below which lowering this attribute starts dragging dependents down.
 *
 * @param attributeId the attribute to inspect.
 * @param ratings the current ratings map.
 * @returns the soft floor value.
 */
export function softFloor(attributeId: string, ratings: Ratings): number {
  const pressures = dependentsOf(attributeId).map(
    (dep) => (ratings[dep.attr] ?? MIN_RATING) - dep.gap,
  );
  return Math.max(MIN_RATING, ...pressures);
}

/**
 * Apply an attribute change and cascade it through the dependency graph.
 *
 * Raising an attribute pulls every parent up to the minimum it requires.
 * Lowering an attribute pushes every dependent down to what it can support.
 *
 * @param ratings the current ratings map.
 * @param attributeId the attribute being changed.
 * @param target the requested new value.
 * @param position the selected position.
 * @param body the player's physical profile.
 * @returns a new ratings map with the change and all knock-on effects applied.
 */
export function applyChange(
  ratings: Ratings,
  attributeId: string,
  target: number,
  position: Position,
  body: Body,
): Ratings {
  const cap = capFor(attributeId, position, body);
  const clamped = Math.min(Math.max(target, MIN_RATING), cap);
  const next: Ratings = { ...ratings, [attributeId]: clamped };

  // Raising: walk up the graph so every prerequisite supports the new value.
  const raise = (id: string, guard: Set<string>) => {
    if (guard.has(id)) return;
    guard.add(id);
    parentsOf(id).forEach((link) => {
      const required = (next[id] ?? MIN_RATING) - link.gap;
      const parentCap = capFor(link.attr, position, body);
      const parentValue = next[link.attr] ?? MIN_RATING;
      if (parentValue < required) {
        next[link.attr] = Math.min(required, parentCap);
        raise(link.attr, guard);
      }
    });
  };

  // Lowering: walk down the graph so nothing is left unsupported.
  const lower = (id: string, guard: Set<string>) => {
    if (guard.has(id)) return;
    guard.add(id);
    dependentsOf(id).forEach((dep) => {
      const allowed = (next[id] ?? MIN_RATING) + dep.gap;
      if ((next[dep.attr] ?? MIN_RATING) > allowed) {
        next[dep.attr] = Math.max(MIN_RATING, allowed);
        lower(dep.attr, guard);
      }
    });
  };

  raise(attributeId, new Set());
  lower(attributeId, new Set());
  return next;
}

/**
 * The total point cost of moving an attribute to a target value, including
 * every parent that has to come up with it.
 *
 * @param ratings the current ratings map.
 * @param attributeId the attribute being changed.
 * @param target the requested new value.
 * @param position the selected position.
 * @param body the player's physical profile.
 * @returns the net point delta, which may be negative when lowering.
 */
export function changeCost(
  ratings: Ratings,
  attributeId: string,
  target: number,
  position: Position,
  body: Body,
): number {
  const next = applyChange(ratings, attributeId, target, position, body);
  return spentPoints(next) - spentPoints(ratings);
}

/** Lower the most economical ratings until a preset fits the global budget. */
export function fitToBudget(
  ratings: Ratings,
  position: Position,
  body: Body,
): Ratings {
  let next = clampRatings(ratings, position, body);

  while (spentPoints(next) > TOTAL_POINTS) {
    const candidates = ATTRIBUTES
      .filter((attr) => (next[attr.id] ?? MIN_RATING) > MIN_RATING)
      .map((attr) => {
        const candidate = applyChange(next, attr.id, next[attr.id] - 1, position, body);
        return { candidate, savings: spentPoints(next) - spentPoints(candidate), value: next[attr.id] };
      })
      .sort((a, b) => b.savings - a.savings || b.value - a.value);

    if (candidates.length === 0) break;
    next = candidates[0].candidate;
  }

  return next;
}

/**
 * The highest value an attribute can be raised to right now, limited by both
 * its effective cap and the points left in the budget.
 *
 * @param ratings the current ratings map.
 * @param attributeId the attribute being changed.
 * @param position the selected position.
 * @param body the player's physical profile.
 * @returns the highest affordable value.
 */
export function affordableMax(
  ratings: Ratings,
  attributeId: string,
  position: Position,
  body: Body,
): number {
  const cap = capFor(attributeId, position, body);
  const current = ratings[attributeId] ?? MIN_RATING;
  const budget = remainingPoints(ratings);
  let best = current;
  for (let v = current + 1; v <= cap; v += 1) {
    if (changeCost(ratings, attributeId, v, position, body) > budget) break;
    best = v;
  }
  return best;
}

/**
 * Average rating for a category.
 *
 * @param categoryId the category to average.
 * @param ratings the current ratings map.
 * @returns the rounded category average.
 */
export function categoryAverage(categoryId: CategoryId, ratings: Ratings): number {
  const attrs = ATTRIBUTES.filter((a) => a.category === categoryId);
  const sum = attrs.reduce((acc, a) => acc + (ratings[a.id] ?? MIN_RATING), 0);
  return Math.round(sum / attrs.length);
}

/**
 * The weighted category score a fully optimised build can realistically reach.
 * Anchoring the presentation band here is what makes 99 attainable: a build
 * that spends every point on the categories its position is graded on lands at
 * the top of the scale, while an unfocused build does not.
 */
const PEAK_WEIGHTED = 82;

/** The weighted category score of an untouched build (everything at minimum). */
const FLOOR_WEIGHTED = MIN_RATING;

/**
 * Weighted overall rating for the build. Position weights mean a focused build
 * can reach 99 without maxing categories it does not care about — a shooting
 * guard is not penalised for ignoring rebounding.
 *
 * @param ratings the current ratings map.
 * @param position the selected position.
 * @returns overall rating between 60 and 99.
 */
export function overallRating(ratings: Ratings, position: Position): number {
  const weights = POSITION_WEIGHTS[position];
  const weighted = CATEGORIES.reduce(
    (sum, cat) => sum + categoryAverage(cat.id, ratings) * weights[cat.id],
    0,
  );
  const progress = (weighted - FLOOR_WEIGHTED) / (PEAK_WEIGHTED - FLOOR_WEIGHTED);
  return Math.max(60, Math.min(99, Math.round(60 + progress * 39)));
}

/**
 * Tier a badge has reached given the current ratings.
 *
 * @param badge the badge to evaluate.
 * @param ratings the current ratings map.
 * @returns the tier level, 0 when locked.
 */
export function badgeTier(badge: Badge, ratings: Ratings): BadgeTier {
  const value = ratings[badge.driver] ?? MIN_RATING;
  let tier: BadgeTier = 0;
  badge.tiers.forEach((threshold, index) => {
    if (value >= threshold) tier = (index + 1) as BadgeTier;
  });
  return tier;
}

/**
 * All badges with their unlocked tier, sorted highest tier first.
 *
 * @param ratings the current ratings map.
 * @returns badges paired with their tier.
 */
export function badgeBreakdown(ratings: Ratings): { badge: Badge; tier: BadgeTier }[] {
  return BADGES.map((badge) => ({ badge, tier: badgeTier(badge, ratings) })).sort(
    (a, b) => b.tier - a.tier || a.badge.name.localeCompare(b.badge.name),
  );
}

/**
 * Badges driven by a specific attribute, used to preview what an increase unlocks.
 *
 * @param attributeId the driving attribute.
 * @param ratings the current ratings map.
 * @returns badges for that attribute with their current tier.
 */
export function badgesForAttribute(
  attributeId: string,
  ratings: Ratings,
): { badge: Badge; tier: BadgeTier }[] {
  return BADGES.filter((b) => b.driver === attributeId).map((badge) => ({
    badge,
    tier: badgeTier(badge, ratings),
  }));
}

/**
 * Count of badges at or above bronze.
 *
 * @param ratings the current ratings map.
 * @returns number of unlocked badges.
 */
export function unlockedBadgeCount(ratings: Ratings): number {
  return badgeBreakdown(ratings).filter((b) => b.tier > 0).length;
}

/**
 * Whether every requirement for a takeover is met.
 *
 * @param takeover the takeover to test.
 * @param ratings the current ratings map.
 * @returns true when the takeover is available.
 */
export function isTakeoverUnlocked(takeover: Takeover, ratings: Ratings): boolean {
  return takeover.requirements.every((req) => (ratings[req.attr] ?? MIN_RATING) >= req.min);
}

/**
 * All takeovers with their unlocked state, available ones first.
 *
 * @param ratings the current ratings map.
 * @returns takeovers paired with availability.
 */
export function takeoverBreakdown(ratings: Ratings): { takeover: Takeover; unlocked: boolean }[] {
  return TAKEOVERS.map((takeover) => ({
    takeover,
    unlocked: isTakeoverUnlocked(takeover, ratings),
  })).sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
}

/**
 * Percentage similarity between the current build and a reference build,
 * measured across every attribute.
 *
 * @param ratings the current ratings map.
 * @param other the reference build to compare against.
 * @returns similarity from 0 to 100.
 */
export function similarityTo(ratings: Ratings, other: ComparableBuild): number {
  const totalDiff = ATTRIBUTES.reduce(
    (sum, attr) =>
      sum + Math.abs((ratings[attr.id] ?? MIN_RATING) - (other.ratings[attr.id] ?? MIN_RATING)),
    0,
  );
  const maxDiff = ATTRIBUTES.length * 74;
  return Math.round((1 - totalDiff / maxDiff) * 100);
}

/**
 * Format inches as feet and inches, e.g. 78 -> 6'6".
 *
 * @param inches total height in inches.
 * @returns formatted height string.
 */
export function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  return `${feet}'${inches % 12}"`;
}

/**
 * Clamp every rating to its current cap and re-settle the dependency graph.
 * Used after a position or body change moves the ceilings.
 *
 * @param ratings the current ratings map.
 * @param position the selected position.
 * @param body the player's physical profile.
 * @returns a new ratings map that respects all caps and links.
 */
export function clampRatings(ratings: Ratings, position: Position, body: Body): Ratings {
  const next = ATTRIBUTES.reduce<Ratings>((acc, attr) => {
    acc[attr.id] = Math.min(ratings[attr.id] ?? MIN_RATING, capFor(attr.id, position, body));
    return acc;
  }, {});
  // Settle links: repeatedly push dependents down until nothing is unsupported.
  for (let pass = 0; pass < ATTRIBUTES.length; pass += 1) {
    let changed = false;
    ATTRIBUTES.forEach((attr) => {
      parentsOf(attr.id).forEach((link) => {
        const allowed = (next[link.attr] ?? MIN_RATING) + link.gap;
        if ((next[attr.id] ?? MIN_RATING) > allowed) {
          next[attr.id] = Math.max(MIN_RATING, allowed);
          changed = true;
        }
      });
    });
    if (!changed) break;
  }
  return next;
}
