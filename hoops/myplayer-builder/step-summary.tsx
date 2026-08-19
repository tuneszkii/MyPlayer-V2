import { useMemo } from 'react';
import {
  CATEGORIES,
  COMPARABLE_BUILDS,
  TAKEOVERS,
  TIER_COLORS,
  TIER_NAMES,
} from './builder-data.js';
import { badgeBreakdown, similarityTo } from './builder-logic.js';
import type { Position, Ratings } from './builder-types.js';
import shared from './step-shared.module.css';
import styles from './step-summary.module.css';

export type StepSummaryProps = {
  /** Current build name. */
  name: string;
  /** Selected position. */
  position: Position;
  /** Current ratings map. */
  ratings: Ratings;
  /** Selected takeover id, when chosen. */
  takeover?: string;
  /** Called when the build name changes. */
  onName: (name: string) => void;
};

/**
 * Step 4 — name the build and see how it stacks up. Similarity is measured
 * across every attribute against a set of reference archetypes, so the closest
 * named builds surface automatically.
 *
 * @param props the build summary state and name handler.
 * @returns the rendered summary step.
 */
export function StepSummary({ name, position, ratings, takeover, onName }: StepSummaryProps) {
  const similar = useMemo(
    () =>
      COMPARABLE_BUILDS.map((build) => ({ build, score: similarityTo(ratings, build) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    [ratings],
  );

  const suggestions = useMemo(() => {
    const top = similar.slice(0, 3).map((s) => s.build.name);
    return Array.from(new Set(top));
  }, [similar]);

  const badges = badgeBreakdown(ratings);
  const tally = [1, 2, 3, 4].map((tier) => badges.filter((b) => b.tier === tier).length);

  const chosen = TAKEOVERS.find((t) => t.id === takeover);
  const chosenColor = CATEGORIES.find((c) => c.id === chosen?.category)?.color ?? '#8792a6';

  return (
    <div className={`${shared.step} ${shared.stepTwoCol}`}>
      <div className={shared.column}>
        <header className={shared.stepHeader}>
          <h2 className={shared.stepTitle}>Finish your build</h2>
          <p className={shared.stepSub}>
            Give it a name and see the closest known archetypes. Similarity is measured across all
            22 attributes, not just your headline ratings.
          </p>
        </header>

        <section className={shared.panel}>
          <div className={shared.panelHead}>
            <h3 className={shared.panelTitle}>Build Name</h3>
            <span className={shared.panelNote}>{position}</span>
          </div>
          <input
            className={styles.nameInput}
            value={name}
            maxLength={28}
            placeholder="Name your build"
            aria-label="Build name"
            onChange={(e) => onName(e.target.value)}
          />
          <div className={styles.suggestRow}>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className={styles.suggestBtn}
                onClick={() => onName(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </section>

        <section className={shared.panel}>
          <div className={shared.panelHead}>
            <h3 className={shared.panelTitle}>Takeover</h3>
          </div>
          {chosen ? (
            <div className={styles.takeoverSummary}>
              <span className={styles.takeoverDot} style={{ background: chosenColor }} />
              <span>
                <div className={styles.takeoverName}>{chosen.name}</div>
                <div className={styles.takeoverDesc}>{chosen.description}</div>
              </span>
            </div>
          ) : (
            <div className={styles.takeoverSummary}>
              <span className={styles.takeoverDot} style={{ background: '#3a4557' }} />
              <span>
                <div className={styles.takeoverName}>None selected</div>
                <div className={styles.takeoverDesc}>
                  Go back a step to pick one — you need the attributes to unlock it first.
                </div>
              </span>
            </div>
          )}
        </section>

        <section className={shared.panel}>
          <div className={shared.panelHead}>
            <h3 className={shared.panelTitle}>Badge Tally</h3>
            <span className={shared.panelNote}>
              {badges.filter((b) => b.tier > 0).length} total
            </span>
          </div>
          <div className={styles.badgeTally}>
            {tally.map((count, i) => (
              <div key={TIER_NAMES[i + 1]} className={styles.tally}>
                <div className={styles.tallyValue} style={{ color: TIER_COLORS[i + 1] }}>
                  {count}
                </div>
                <div className={styles.tallyLabel}>{TIER_NAMES[i + 1]}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className={shared.column}>
        <section className={shared.panel}>
          <div className={shared.panelHead}>
            <h3 className={shared.panelTitle}>Closest Builds</h3>
            <span className={shared.panelNote}>By attribute match</span>
          </div>
          <div className={styles.compareList}>
            {similar.map(({ build, score }) => (
              <div key={build.id} className={styles.compareRow}>
                <span className={styles.compareTop}>
                  <span className={styles.compareName}>
                    {build.name}
                    <span className={styles.comparePos}>{build.position}</span>
                  </span>
                  <p className={styles.compareTag}>{build.tagline}</p>
                </span>
                <span>
                  <div className={styles.compareScore}>{score}%</div>
                  <span className={styles.compareUnit}>Match</span>
                </span>
                <span className={styles.compareTrack}>
                  <span className={styles.compareFill} style={{ width: `${score}%` }} />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
