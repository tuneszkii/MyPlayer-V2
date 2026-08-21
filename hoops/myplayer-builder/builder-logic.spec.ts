import { describe, expect, it } from 'vitest';
import { ATTRIBUTES, MIN_RATING, TOTAL_POINTS, baseRatings } from './builder-data.js';
import {
  applyChange,
  capFor,
  clampRatings,
  fitToBudget,
  overallRating,
  parentsOf,
  remainingPoints,
  spentPoints,
} from './builder-logic.js';
import type { Body, Position } from './builder-types.js';

const GUARD_BODY: Body = { height: 76, weight: 200, wingspan: 82, hand: 'Right' };

describe('attribute dependency graph', () => {
  it('keeps dependency links acyclic and one-directional', () => {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) throw new Error(`cycle at ${id}`);
      if (visited.has(id)) return;
      visiting.add(id);
      parentsOf(id).forEach((link) => visit(link.attr));
      visiting.delete(id);
      visited.add(id);
    };

    ATTRIBUTES.forEach((attr) => visit(attr.id));
  });

  it('pulls prerequisites up when a dependent attribute is raised', () => {
    // Speed With Ball may never exceed Speed (gap 0), and Speed rides on Agility (gap 8).
    const next = applyChange(baseRatings(), 'speedWithBall', 90, 'SG', GUARD_BODY);
    expect(next.speedWithBall).toBe(90);
    expect(next.speed).toBeGreaterThanOrEqual(90);
    expect(next.agility).toBeGreaterThanOrEqual(82);
  });

  it('pushes dependents down when a prerequisite is lowered', () => {
    const raised = applyChange(baseRatings(), 'ballHandle', 88, 'SG', GUARD_BODY);
    expect(raised.speedWithBall).toBeGreaterThanOrEqual(82);
    const lowered = applyChange(raised, 'speed', 50, 'SG', GUARD_BODY);
    // Speed With Ball cannot outrun Speed, and Ball Handle cannot outrun it either.
    expect(lowered.speedWithBall).toBeLessThanOrEqual(lowered.speed);
    expect(lowered.ballHandle).toBeLessThanOrEqual(lowered.speedWithBall + 6);
  });

  it('caps an attribute by what its prerequisites can themselves reach', () => {
    // A tall centre has a suppressed Speed ceiling, which bounds Speed With Ball.
    const bigBody: Body = { height: 86, weight: 265, wingspan: 92, hand: 'Right' };
    const speedCap = capFor('speed', 'C', bigBody);
    expect(capFor('speedWithBall', 'C', bigBody)).toBeLessThanOrEqual(speedCap);
  });
});

describe('position and body caps', () => {
  it('supports creator archetypes across guard, wing, forward, and centre frames', () => {
    const guard: Body = { height: 74, weight: 176, wingspan: 79, hand: 'Right' };
    const wing: Body = { height: 81, weight: 225, wingspan: 86, hand: 'Right' };
    const forward: Body = { height: 82, weight: 240, wingspan: 87, hand: 'Right' };
    const centre: Body = { height: 88, weight: 295, wingspan: 94, hand: 'Right' };

    expect(capFor('ballHandle', 'PG', guard)).toBeGreaterThanOrEqual(95);
    expect(capFor('passAccuracy', 'SF', wing)).toBeGreaterThanOrEqual(85);
    expect(capFor('ballHandle', 'SF', wing)).toBeGreaterThanOrEqual(85);
    expect(capFor('passAccuracy', 'PF', forward)).toBeGreaterThanOrEqual(85);
    expect(capFor('threePoint', 'C', centre)).toBeGreaterThanOrEqual(80);
    expect(capFor('passAccuracy', 'C', centre)).toBeGreaterThanOrEqual(90);
  });

  it('does not give SF or PF creators an implicit 75 ceiling', () => {
    const wing: Body = { height: 80, weight: 220, wingspan: 85, hand: 'Right' };
    const forward: Body = { height: 82, weight: 240, wingspan: 87, hand: 'Right' };

    expect(capFor('passAccuracy', 'SF', wing)).toBeGreaterThanOrEqual(85);
    expect(capFor('ballHandle', 'SF', wing)).toBeGreaterThanOrEqual(85);
    expect(capFor('passAccuracy', 'PF', forward)).toBeGreaterThanOrEqual(85);
    expect(capFor('ballHandle', 'PF', forward)).toBeGreaterThanOrEqual(80);
  });

  it('responds to wingspan and weight changes instead of plateauing', () => {
    const compact: Body = { height: 80, weight: 205, wingspan: 78, hand: 'Right' };
    const long: Body = { height: 80, weight: 205, wingspan: 86, hand: 'Right' };
    const heavy: Body = { height: 80, weight: 250, wingspan: 78, hand: 'Right' };

    expect(capFor('ballHandle', 'SF', compact)).toBeGreaterThan(capFor('ballHandle', 'SF', long));
    expect(capFor('speed', 'SF', compact)).toBeGreaterThan(capFor('speed', 'SF', heavy));
    expect(capFor('perimeterDefense', 'SF', long)).toBeGreaterThan(
      capFor('perimeterDefense', 'SF', compact),
    );
  });

  it('lets a light 6\'2 guard reach elite perimeter skills', () => {
    const body: Body = { height: 74, weight: 176, wingspan: 79, hand: 'Right' };

    expect(capFor('ballHandle', 'PG', body)).toBeGreaterThanOrEqual(95);
    expect(capFor('speedWithBall', 'PG', body)).toBeGreaterThanOrEqual(95);
    expect(capFor('passAccuracy', 'PG', body)).toBeGreaterThanOrEqual(95);
    expect(capFor('threePoint', 'PG', body)).toBeGreaterThanOrEqual(95);
    expect(capFor('perimeterDefense', 'PG', body)).toBeGreaterThanOrEqual(95);
  });

  it('forces small guards to sacrifice big-man skills', () => {
    const body: Body = { height: 74, weight: 176, wingspan: 79, hand: 'Right' };

    expect(capFor('offensiveRebound', 'PG', body)).toBeLessThanOrEqual(55);
    expect(capFor('defensiveRebound', 'PG', body)).toBeLessThanOrEqual(68);
    expect(capFor('interiorDefense', 'PG', body)).toBeLessThanOrEqual(78);
    expect(capFor('block', 'PG', body)).toBeLessThanOrEqual(75);
    expect(capFor('standingDunk', 'PG', body)).toBeLessThanOrEqual(75);
    expect(capFor('postControl', 'PG', body)).toBeLessThanOrEqual(70);
  });

  it('makes a long guard trade shooting for downhill finishing reach', () => {
    const compact: Body = { height: 74, weight: 176, wingspan: 72, hand: 'Right' };
    const long: Body = { height: 74, weight: 176, wingspan: 80, hand: 'Right' };

    expect(capFor('drivingDunk', 'PG', long)).toBeGreaterThan(capFor('drivingDunk', 'PG', compact));
    expect(capFor('threePoint', 'PG', long)).toBeLessThan(capFor('threePoint', 'PG', compact));
  });

  it('lets a large centre max core interior attributes', () => {
    const body: Body = { height: 88, weight: 295, wingspan: 94, hand: 'Right' };

    expect(capFor('standingDunk', 'C', body)).toBe(99);
    expect(capFor('interiorDefense', 'C', body)).toBe(99);
    expect(capFor('block', 'C', body)).toBe(99);
    expect(capFor('strength', 'C', body)).toBe(99);
    expect(capFor('defensiveRebound', 'C', body)).toBe(99);
  });
});

describe('point budget', () => {
  it('uses a progressive cost curve for elite ratings', () => {
    expect(spentPoints({ ...baseRatings(), threePoint: 75 }) - spentPoints(baseRatings())).toBe(65);
    expect(spentPoints({ ...baseRatings(), threePoint: 85 }) - spentPoints({ ...baseRatings(), threePoint: 75 })).toBe(30);
    expect(spentPoints({ ...baseRatings(), threePoint: 93 }) - spentPoints({ ...baseRatings(), threePoint: 92 })).toBe(6);
  });

  it('starts with the full budget and never lets a build overspend', () => {
    expect(remainingPoints(baseRatings())).toBe(TOTAL_POINTS);
    const ratings = ATTRIBUTES.reduce((all, attr) => ({ ...all, [attr.id]: 99 }), {});
    // Maxing everything must cost more than the budget — the build has to specialise.
    expect(spentPoints(ratings)).toBeGreaterThan(TOTAL_POINTS);
  });
});

describe('overall rating', () => {
  it('is reachable at 99 for a focused build inside the point budget', () => {
    const position: Position = 'SG';
    const body: Body = { height: 78, weight: 215, wingspan: 84, hand: 'Right' };
    // Spend on what a shooting guard is actually graded on.
    const priority = [
      'threePoint', 'midRange', 'closeShot', 'freeThrow',
      'drivingLayup', 'drivingDunk', 'ballHandle', 'speedWithBall', 'passAccuracy',
      'perimeterDefense', 'steal', 'agility', 'speed', 'vertical', 'stamina', 'strength',
    ];
    let ratings = baseRatings();
    priority.forEach((id) => {
      const cap = capFor(id, position, body);
      for (let target = cap; target > MIN_RATING; target -= 1) {
        const candidate = applyChange(ratings, id, target, position, body);
        if (spentPoints(candidate) <= TOTAL_POINTS) {
          ratings = candidate;
          break;
        }
      }
    });
    expect(spentPoints(ratings)).toBeLessThanOrEqual(TOTAL_POINTS);
    expect(overallRating(ratings, position)).toBeGreaterThanOrEqual(94);
  });
});

describe('clampRatings', () => {
  it('re-settles the graph after the body changes the ceilings', () => {
    const guard = applyChange(baseRatings(), 'speedWithBall', 92, 'PG', {
      height: 72, weight: 180, wingspan: 76, hand: 'Right',
    });
    // Moving to a 7'0" centre frame must drag ball-handling ratings back down.
    const bigBody: Body = { height: 84, weight: 270, wingspan: 90, hand: 'Right' };
    const settled = clampRatings(guard, 'C', bigBody);
    expect(settled.speedWithBall).toBeLessThanOrEqual(capFor('speedWithBall', 'C', bigBody));
    expect(settled.speedWithBall).toBeLessThanOrEqual(settled.speed);
  });
});

describe('budget fitting', () => {
  it('fits an archetype inside the budget without exceeding any cap', () => {
    const body: Body = { height: 78, weight: 215, wingspan: 84, hand: 'Right' };
    const ratings = ATTRIBUTES.reduce((all, attr) => ({ ...all, [attr.id]: 99 }), {});
    const fitted = fitToBudget(ratings, 'SG', body);

    expect(spentPoints(fitted)).toBeLessThanOrEqual(TOTAL_POINTS);
    ATTRIBUTES.forEach((attr) => {
      expect(fitted[attr.id]).toBeLessThanOrEqual(capFor(attr.id, 'SG', body));
    });
  });
});
