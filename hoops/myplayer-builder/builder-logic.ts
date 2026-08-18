import {
  ATTRIBUTES,
  ATTRIBUTE_LINKS,
  BADGES,
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
export function bodyCap(attributeId: string, position: Position, body: Body): number {
  const base = POSITION_CAPS[position][attributeId] ?? 99;
  const heightDelta = body.height - 78;
  let modifier = 0;
  if (['speed', 'agility', 'speedWithBall', 'ballHandle', 'threePoint'].includes(attributeId)) {
    modifier = -heightDelta * 1.5;
  }
  if (
    ['interiorDefense', 'block', 'standingDunk', 'offensiveRebound', 'defensiveRebound', 'postControl'].includes(
      attributeId,
    )
  ) {
    modifier = heightDelta * 1.5;
  }
  if (attributeId === 'strength') modifier = (body.weight - 215) * 0.08;
  if (['block', 'steal', 'perimeterDefense'].includes(attributeId)) {
    modifier += (body.wingspan - body.height) * 0.8;
  }
  return Math.max(40, Math.min(99, Math.round(base + modifier)));
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
  const own = bodyCap(attributeId, position, body);
  const linked = parentsOf(attributeId).map(
    (link) => capFor(link.attr, position, body, new Set(seen)) + link.gap,
  );
  return Math.max(MIN_RATING, Math.min(own, ...linked, 99));
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
