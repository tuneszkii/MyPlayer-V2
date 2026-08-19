import {
  ATTRIBUTES,
  CATEGORIES,
  MIN_RATING,
  POSITIONS,
  POSITION_BLURB,
  POSITION_HEIGHT,
} from './builder-data.js';
import {
  capFor,
  formatHeight,
  getWeightRange,
  clamp,
} from './builder-logic.js';
import type { Body, Handedness, Position } from './builder-types.js';
import shared from './step-shared.module.css';
import styles from './step-body.module.css';

export type StepBodyProps = {
  /** Selected position. */
  position: Position;
  /** Current physical profile. */
  body: Body;
  /** Called when the position changes. */
  onPosition: (position: Position) => void;
  /** Called when any body value changes. */
  onBody: (patch: Partial<Body>) => void;
};

const HANDS: Handedness[] = ['Left', 'Right'];

/**
 * Step 1 — the physical profile. Height, weight, wingspan and handedness are
 * chosen here, and the panel on the right shows read-only attribute minimums
 * and maximums so the consequences of the frame are visible before any points
 * are spent.
 *
 * @param props the body state and change handlers.
 * @returns the rendered body step.
 */
export function StepBody({
  position,
  body,
  onPosition,
  onBody,
}: StepBodyProps) {
  const [minHeight, maxHeight] = POSITION_HEIGHT[position];
  const [minWeight, maxWeight] = getWeightRange(position, body.height);
  const reach = body.wingspan - body.height;
  // Scale the silhouette across the full legal height band for this position.
  const heightRatio = (body.height - 69) / (89 - 69);
  const figureHeight = 70 + heightRatio * 56;
  const figureWidth = 16 + ((body.weight - 160) / 130) * 16;
  const armSpan = 20 + ((body.wingspan - body.height + 2) / 12) * 22;
  const handlePositionChange = (newPosition: Position) => {
    const [newMinWeight, newMaxWeight] = getWeightRange(
      newPosition,
      body.height
    );

    onPosition(newPosition);
    onBody({
      weight: clamp(body.weight, newMinWeight, newMaxWeight),
    });
  };

  return (
    <div className={`${shared.step} ${shared.stepTwoCol}`}>
      <div className={shared.column}>
        <header className={shared.stepHeader}>
          <h2 className={shared.stepTitle}>Build your frame</h2>
          <p className={shared.stepSub}>
            Your body decides what you can become. Height, weight and wingspan
            set the ceiling on every attribute before you spend a single point.
          </p>
        </header>

        <section className={shared.panel}>
          <div className={shared.panelHead}>
            <h3 className={shared.panelTitle}>Position</h3>
          </div>
          <div className={shared.segRow}>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => handlePositionChange(pos)}
                className={`${shared.segBtn} ${position === pos ? shared.segBtnActive : ''}`}
              >
                {pos}
              </button>
            ))}
          </div>
          <p className={shared.blurb}>{POSITION_BLURB[position]}</p>
        </section>

        <section className={shared.panel}>
          <div className={shared.panelHead}>
            <h3 className={shared.panelTitle}>Measurements</h3>
            <span className={shared.panelNote}>{position} range</span>
          </div>

          <div className={styles.frameViz}>
            <svg
              className={styles.silhouette}
              width="84"
              height="132"
              viewBox="0 0 84 132"
              role="img"
              aria-label="Player frame preview"
            >
              <line
                x1="6"
                y1="130"
                x2="78"
                y2="130"
                stroke="#1e2634"
                strokeWidth="2"
              />
              <g transform={`translate(42, ${128 - figureHeight})`}>
                <circle
                  cx="0"
                  cy={figureHeight * 0.09}
                  r={figureHeight * 0.09}
                  fill="#ffd23f"
                />
                <rect
                  x={-figureWidth / 2}
                  y={figureHeight * 0.2}
                  width={figureWidth}
                  height={figureHeight * 0.42}
                  rx={figureWidth / 3}
                  fill="#ffd23f"
                />
                <line
                  x1={-armSpan}
                  y1={figureHeight * 0.3}
                  x2={armSpan}
                  y2={figureHeight * 0.3}
                  stroke="#3ba9ff"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <rect
                  x={-figureWidth / 2.6}
                  y={figureHeight * 0.6}
                  width={figureWidth / 3.2}
                  height={figureHeight * 0.4}
                  rx="3"
                  fill="#ffd23f"
                />
                <rect
                  x={figureWidth / 8}
                  y={figureHeight * 0.6}
                  width={figureWidth / 3.2}
                  height={figureHeight * 0.4}
                  rx="3"
                  fill="#ffd23f"
                />
              </g>
            </svg>
            <div className={styles.frameStats}>
              <div className={styles.frameStat}>
                <span className={styles.frameKey}>Height</span>
                <span className={styles.frameVal}>
                  {formatHeight(body.height)}
                </span>
              </div>
              <div className={styles.frameStat}>
                <span className={styles.frameKey}>Weight</span>
                <span className={styles.frameVal}>{body.weight} lbs</span>
              </div>
              <div className={styles.frameStat}>
                <span className={styles.frameKey}>Wingspan</span>
                <span className={styles.frameVal}>
                  {formatHeight(body.wingspan)}
                </span>
              </div>
              <div className={styles.frameStat}>
                <span className={styles.frameKey}>Reach</span>
                <span className={styles.frameVal}>
                  {reach >= 0 ? '+' : ''}
                  {reach}&Prime;
                </span>
              </div>
            </div>
          </div>

          <div className={shared.sliderRow}>
            <div className={shared.sliderTop}>
              <span className={shared.sliderLabel}>Height</span>
              <span className={shared.sliderValue}>
                {formatHeight(body.height)}
              </span>
            </div>
            <input
              className={shared.range}
              type="range"
              min={minHeight}
              max={maxHeight}
              value={body.height}
              aria-label="Height"
              onChange={(e) => onBody({ height: Number(e.target.value) })}
            />
            <div className={shared.rangeEnds}>
              <span>{formatHeight(minHeight)}</span>
              <span>{formatHeight(maxHeight)}</span>
            </div>
          </div>

          <div className={shared.sliderRow}>
            <div className={shared.sliderTop}>
              <span className={shared.sliderLabel}>Weight</span>
              <span className={shared.sliderValue}>{body.weight} lbs</span>
            </div>
            <input
              className={shared.range}
              type="range"
              min={minWeight}
              max={maxWeight}
              value={body.weight}
              aria-label="Weight"
              onChange={(e) => onBody({ weight: Number(e.target.value) })}
            />
            <div className={shared.rangeEnds}>
              <span>{minWeight}</span>
              <span>{maxWeight}</span>
            </div>
          </div>

          <div className={shared.sliderRow}>
            <div className={shared.sliderTop}>
              <span className={shared.sliderLabel}>Wingspan</span>
              <span className={shared.sliderValue}>
                {formatHeight(body.wingspan)}
              </span>
            </div>
            <input
              className={shared.range}
              type="range"
              min={body.height - 2}
              max={body.height + 6}
              value={body.wingspan}
              aria-label="Wingspan"
              onChange={(e) => onBody({ wingspan: Number(e.target.value) })}
            />
            <div className={shared.rangeEnds}>
              <span>{formatHeight(body.height - 2)}</span>
              <span>{formatHeight(body.height + 6)}</span>
            </div>
          </div>

          <div className={shared.sliderRow}>
            <div className={shared.sliderTop}>
              <span className={shared.sliderLabel}>Handedness</span>
              <span className={shared.sliderValue}>{body.hand}</span>
            </div>
            <div className={styles.handRow}>
              {HANDS.map((hand) => (
                <button
                  key={hand}
                  type="button"
                  onClick={() => onBody({ hand })}
                  className={`${shared.segBtn} ${body.hand === hand ? shared.segBtnActive : ''}`}
                >
                  {hand} handed
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className={shared.column}>
        <section className={shared.panel}>
          <div className={shared.panelHead}>
            <h3 className={shared.panelTitle}>Attribute Ceilings</h3>
            <span className={shared.panelNote}>Display only</span>
          </div>

          <div className={styles.legend}>
            <span>Attribute</span>
            <span className={styles.legendNum}>Min</span>
            <span className={styles.legendNum}>Max</span>
          </div>

          {CATEGORIES.map((cat) => (
            <div key={cat.id} className={styles.capGroup}>
              <div className={styles.capGroupHead}>
                <span
                  className={styles.capDot}
                  style={{ background: cat.color }}
                />
                <span className={styles.capGroupName}>{cat.name}</span>
              </div>
              {ATTRIBUTES.filter((a) => a.category === cat.id).map((attr) => {
                const max = capFor(attr.id, position, body);
                return (
                  <div key={attr.id}>
                    <div className={styles.capRow}>
                      <span className={styles.capName}>{attr.name}</span>
                      <span className={styles.capMin}>{MIN_RATING}</span>
                      <span
                        className={`${styles.capMax} ${max < 90 ? styles.capMaxLimited : ''}`}
                      >
                        {max}
                      </span>
                    </div>
                    <div className={styles.capBar}>
                      <div
                        className={styles.capBarFill}
                        style={{
                          width: `${(max / 99) * 100}%`,
                          background: cat.color,
                          opacity: 0.65,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <p className={styles.capNote}>
            Ceilings shown in orange are being held back by your frame or by an
            attribute this one depends on. Go shorter and lighter for quickness,
            taller and heavier for interior work.
          </p>
        </section>
      </div>
    </div>
  );
}
