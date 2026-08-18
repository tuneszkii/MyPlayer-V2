import { describe, expect, it } from 'vitest';
import { ATTRIBUTES, MIN_RATING, TOTAL_POINTS, baseRatings } from './builder-data.js';
import {
  applyChange,
  capFor,
  clampRatings,
  overallRating,
  remainingPoints,
  spentPoints,
} from './builder-logic.js';
import type { Body, Position } from './builder-types.js';

const GUARD_BODY: Body = { height: 76, weight: 200, wingspan: 82, hand: 'Right' };

describe('attribute dependency graph', () => {
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

describe('point budget', () => {
  it('starts with the full budget and never lets a build overspend', () => {
    expect(remainingPoints(baseRatings())).toBe(TOTAL_POINTS);
    let ratings = baseRatings();
    ATTRIBUTES.forEach((attr) => {
      ratings = applyChange(ratings, attr.id, 99, 'SF', GUARD_BODY);
    });
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
    expect(overallRating(ratings, position)).toBe(99);
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
