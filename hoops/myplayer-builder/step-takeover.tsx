import { ATTRIBUTES, CATEGORIES, MIN_RATING } from './builder-data.js';
import { takeoverBreakdown } from './builder-logic.js';
import type { Ratings } from './builder-types.js';
import shared from './step-shared.module.css';
import styles from './step-takeover.module.css';

export type StepTakeoverProps = {
  /** Current ratings map, used to resolve which takeovers are available. */
  ratings: Ratings;
  /** Currently selected takeover id. */
  selected?: string;
  /** Called when a takeover is picked. */
  onSelect: (takeoverId: string) => void;
};

/**
 * Look up an attribute's display name.
 *
 * @param id the attribute id.
 * @returns the attribute name, or the id when unknown.
 */
function attrName(id: string): string {
  return ATTRIBUTES.find((a) => a.id === id)?.name ?? id;
}

/**
 * Step 3 — takeover selection. Only takeovers whose attribute requirements are
 * all satisfied can be chosen; locked ones show exactly how far away they are.
 *
 * @param props the ratings and selection handler.
 * @returns the rendered takeover step.
 */
export function StepTakeover({ ratings, selected, onSelect }: StepTakeoverProps) {
  const rows = takeoverBreakdown(ratings);
  const unlockedCount = rows.filter((r) => r.unlocked).length;

  return (
    <div className={shared.step}>
      <header className={shared.stepHeader}>
        <h2 className={shared.stepTitle}>Choose your takeover</h2>
        <p className={shared.stepSub}>
          Takeovers unlock from your attributes. Hit every requirement and the takeover becomes
          selectable — {unlockedCount} of {rows.length} are available on this build.
        </p>
      </header>

      {unlockedCount === 0 && (
        <p className={styles.emptyNote}>
          No takeovers unlocked yet. Head back to Attributes and push a few ratings higher — most
          takeovers open up around the 78-85 range in two or three linked attributes.
        </p>
      )}

      <div className={styles.grid}>
        {rows.map(({ takeover, unlocked }) => {
          const color = CATEGORIES.find((c) => c.id === takeover.category)?.color ?? '#ffd23f';
          const isSelected = selected === takeover.id;
          return (
            <button
              key={takeover.id}
              type="button"
              disabled={!unlocked}
              onClick={() => onSelect(takeover.id)}
              className={`${styles.card} ${unlocked ? '' : styles.cardLocked} ${
                isSelected ? styles.cardSelected : ''
              }`}
              style={isSelected ? { borderColor: color } : undefined}
            >
              <span className={styles.accentBar} style={{ background: color }} />
              <div className={styles.cardHead}>
                <span className={styles.name}>{takeover.name}</span>
                <span
                  className={`${styles.statusChip} ${
                    isSelected
                      ? styles.chipSelected
                      : unlocked
                        ? styles.chipUnlocked
                        : styles.chipLocked
                  }`}
                >
                  {isSelected ? 'Selected' : unlocked ? 'Available' : 'Locked'}
                </span>
              </div>
              <p className={styles.desc}>{takeover.description}</p>
              <div className={styles.reqTitle}>Requirements</div>
              <div className={styles.reqList}>
                {takeover.requirements.map((req) => {
                  const value = ratings[req.attr] ?? MIN_RATING;
                  const met = value >= req.min;
                  return (
                    <div key={req.attr}>
                      <div className={styles.req}>
                        <span
                          className={`${styles.reqIcon} ${met ? styles.reqMet : styles.reqUnmet}`}
                        >
                          {met ? '✓' : '✕'}
                        </span>
                        <span className={styles.reqName}>{attrName(req.attr)}</span>
                        <span
                          className={`${styles.reqValue} ${met ? styles.reqMet : styles.reqUnmet}`}
                        >
                          {value} / {req.min}
                        </span>
                      </div>
                      <div className={styles.reqTrack}>
                        <div
                          className={styles.reqFill}
                          style={{
                            width: `${Math.min(100, (value / req.min) * 100)}%`,
                            background: met ? '#2fe0a0' : '#3a4557',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
