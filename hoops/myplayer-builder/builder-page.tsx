import { useCallback, useMemo, useState } from 'react';
import {
  COMPARABLE_BUILDS,
  MIN_RATING,
  POSITION_HEIGHT,
  STEPS,
  TOTAL_POINTS,
  baseRatings,
} from './builder-data.js';
import {
  applyChange,
  clampRatings,
  isTakeoverUnlocked,
  overallRating,
  remainingPoints,
  spentPoints,
  takeoverBreakdown,
  getWeightRange
} from './builder-logic.js';
import type { Body, Position, Ratings, StepId } from './builder-types.js';
import { StepAttributes } from './step-attributes.js';
import { StepBody } from './step-body.js';
import { StepSummary } from './step-summary.js';
import { StepTakeover } from './step-takeover.js';
import styles from './builder-page.module.css';

const DEFAULT_BODY: Body = { height: 78, weight: 215, wingspan: 82, hand: 'Right' };

/**
 * Keep a body profile inside the legal range for a position.
 *
 * @param body the requested body values.
 * @param position the selected position.
 * @returns a body clamped to the position's height range.
 */
function clampBody(body: Body, position: Position): Body {
  const [minHeight, maxHeight] = POSITION_HEIGHT[position];

  const height = Math.min(
    Math.max(body.height, minHeight),
    maxHeight
  );

  const [minWeight, maxWeight] = getWeightRange(position, height);

  return {
    ...body,
    height,
    weight: Math.min(
      Math.max(body.weight, minWeight),
      maxWeight
    ),
    wingspan: Math.min(
      Math.max(body.wingspan, height - 2),
      height + 6
    ),
  };
}

/**
 * The MyPlayer builder, run as a four step wizard: body, attributes, takeover
 * and finish. Attribute changes cascade through the dependency graph so the
 * build always stays internally consistent.
 *
 * @returns the rendered builder.
 */
export function BuilderPage() {
  const [step, setStep] = useState<StepId>('body');
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('SG');
  const [body, setBody] = useState<Body>(DEFAULT_BODY);
  const [ratings, setRatings] = useState<Ratings>(() => baseRatings());
  const [takeover, setTakeover] = useState<string | undefined>();

  const remaining = useMemo(() => remainingPoints(ratings), [ratings]);
  const overall = useMemo(() => overallRating(ratings, position), [ratings, position]);
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const handleAttributeChange = useCallback(
    (attributeId: string, next: number) => {
      setRatings((prev) => {
        const current = prev[attributeId] ?? MIN_RATING;
        if (next === current) return prev;
        let target = next;
        if (target > current) {
          const budget = TOTAL_POINTS - spentPoints(prev);
          // Walk the target back until the change and its cascade fit the budget.
          while (target > current) {
            const candidate = applyChange(prev, attributeId, target, position, body);
            if (spentPoints(candidate) - spentPoints(prev) <= budget) break;
            target -= 1;
          }
          if (target === current) return prev;
        }
        return applyChange(prev, attributeId, target, position, body);
      });
    },
    [position, body],
  );

  const handlePosition = useCallback((next: Position) => {
    setPosition(next);
    setBody((prevBody) => {
      const nextBody = clampBody(prevBody, next);
      setRatings((prev) => clampRatings(prev, next, nextBody));
      return nextBody;
    });
  }, []);

  const handleBody = useCallback(
    (patch: Partial<Body>) => {
      setBody((prev) => {
        const nextBody = clampBody({ ...prev, ...patch }, position);
        setRatings((prevRatings) => clampRatings(prevRatings, position, nextBody));
        return nextBody;
      });
    },
    [position],
  );

  const handlePreset = useCallback((presetId: string) => {
    const preset = COMPARABLE_BUILDS.find((p) => p.id === presetId);
    if (!preset) return;
    const nextBody = clampBody(DEFAULT_BODY, preset.position);
    setPosition(preset.position);
    setBody(nextBody);
    const settled = clampRatings(preset.ratings, preset.position, nextBody);
    setRatings(settled);
    // Drop a takeover that the new ratings no longer support.
    setTakeover((prev) => {
      const match = takeoverBreakdown(settled).find((t) => t.takeover.id === prev);
      return match?.unlocked ? prev : undefined;
    });
  }, []);

  const handleTakeover = useCallback(
    (takeoverId: string) => {
      const match = takeoverBreakdown(ratings).find((t) => t.takeover.id === takeoverId);
      if (!match?.unlocked) return;
      setTakeover((prev) => (prev === takeoverId ? undefined : takeoverId));
    },
    [ratings],
  );

  const reset = useCallback(() => {
    setRatings(baseRatings());
    setTakeover(undefined);
  }, []);

  // A takeover can fall out of reach if attributes drop after it was chosen.
  const activeTakeover = useMemo(() => {
    const match = takeoverBreakdown(ratings).find((t) => t.takeover.id === takeover);
    return match && isTakeoverUnlocked(match.takeover, ratings) ? takeover : undefined;
  }, [takeover, ratings]);

  const footerMeta: Record<StepId, string> = {
    body: 'Your frame sets every attribute ceiling',
    attributes: `${remaining} of ${TOTAL_POINTS} points left`,
    takeover: activeTakeover ? 'Takeover selected' : 'Pick a takeover to continue',
    summary: name ? `Saved as \u201C${name}\u201D` : 'Name your build to finish',
  };

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>2K</span>
          <span>
            MyPlayer Builder
            <div className={styles.brandSub}>Season 26 Preview</div>
          </span>
        </div>
        <div className={styles.topRight}>
          <div className={styles.overallPill}>
            <span className={styles.overallBubble}>{overall}</span>
            <span className={styles.overallText}>Overall</span>
          </div>
          <div className={styles.pointsPill}>
            <span className={`${styles.pointsValue} ${remaining < 0 ? styles.over : ''}`}>
              {remaining}
            </span>
            <span className={styles.pointsLabel}>pts left</span>
          </div>
          <button type="button" className={styles.resetBtn} onClick={reset}>
            Reset
          </button>
        </div>
      </header>

      <nav className={styles.stepper} aria-label="Build steps">
        {STEPS.map((s, i) => {
          const isActive = s.id === step;
          const isDone = i < stepIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`${styles.stepChip} ${isActive ? styles.stepChipActive : ''} ${
                isDone ? styles.stepChipDone : ''
              }`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                className={`${styles.stepIndex} ${isActive ? styles.stepIndexActive : ''} ${
                  isDone ? styles.stepIndexDone : ''
                }`}
              >
                {isDone ? '✓' : i + 1}
              </span>
              <span className={styles.stepChipBody}>
                <span className={styles.stepChipLabel}>{s.label}</span>
                <div className={styles.stepChipHint}>{s.hint}</div>
              </span>
            </button>
          );
        })}
      </nav>

      <main className={styles.content}>
        {step === 'body' && (
          <StepBody position={position} body={body} onPosition={handlePosition} onBody={handleBody} />
        )}
        {step === 'attributes' && (
          <StepAttributes
            ratings={ratings}
            position={position}
            body={body}
            remaining={remaining}
            onChange={handleAttributeChange}
            onPreset={handlePreset}
          />
        )}
        {step === 'takeover' && (
          <StepTakeover ratings={ratings} selected={activeTakeover} onSelect={handleTakeover} />
        )}
        {step === 'summary' && (
          <StepSummary
            name={name}
            position={position}
            ratings={ratings}
            takeover={activeTakeover}
            onName={setName}
          />
        )}
      </main>

      <footer className={styles.footerBar}>
        <div className={styles.footerInner}>
          <span className={styles.footerMeta}>{footerMeta[step]}</span>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.navBtn}
              disabled={stepIndex === 0}
              onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].id)}
            >
              Back
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navPrimary}`}
              disabled={stepIndex === STEPS.length - 1}
              onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].id)}
            >
              {stepIndex === STEPS.length - 2 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
