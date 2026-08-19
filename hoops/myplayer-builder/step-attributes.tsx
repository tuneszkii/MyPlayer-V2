import { useMemo, useState } from 'react';
import {
  ATTRIBUTES,
  CATEGORIES,
  MIN_RATING,
  PRESETS,
  TIER_COLORS,
  TIER_NAMES,
} from './builder-data.js';
import {
  affordableMax,
  badgeBreakdown,
  badgesForAttribute,
  capFor,
  categoryAverage,
  changeCost,
  dependentsOf,
  parentsOf,
} from './builder-logic.js';
import type { Body, CategoryId, Position, Ratings } from './builder-types.js';
import shared from './step-shared.module.css';
import styles from './step-attributes.module.css';

export type StepAttributesProps = {
  /** Current ratings map. */
  ratings: Ratings;
  /** Selected position, used for caps. */
  position: Position;
  /** Physical profile, used for caps. */
  body: Body;
  /** Points still available to spend. */
  remaining: number;
  /** Called when an attribute value changes. */
  onChange: (attributeId: string, value: number) => void;
  /** Called when an archetype preset is loaded. */
  onPreset: (presetId: string) => void;
};

type Filter = CategoryId | 'all';

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
 * Step 2 — attribute allocation. Sliders are wired to the dependency graph, so
 * raising one attribute pulls its prerequisites up and lowering one drops what
 * leans on it. The right panel previews the badges the focused attribute drives.
 *
 * @param props the allocation state and handlers.
 * @returns the rendered attributes step.
 */
export function StepAttributes({
  ratings,
  position,
  body,
  remaining,
  onChange,
  onPreset,
}: StepAttributesProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [focus, setFocus] = useState<string>('threePoint');

  const visible = CATEGORIES.filter((cat) => filter === 'all' || cat.id === filter);
  const focusParents = parentsOf(focus);
  const focusDependents = dependentsOf(focus);
  const related = useMemo(
    () => new Set([...focusParents.map((p) => p.attr), ...focusDependents.map((d) => d.attr)]),
    [focusParents, focusDependents],
  );

  const focusBadges = badgesForAttribute(focus, ratings);
  const allBadges = badgeBreakdown(ratings);
  const focusCategory = ATTRIBUTES.find((a) => a.id === focus)?.category ?? 'shooting';
  const focusColor = CATEGORIES.find((c) => c.id === focusCategory)?.color ?? '#ffd23f';

  return (
    <div className={`${shared.step} ${shared.stepSidebar}`}>
      <div className={shared.column}>
        <header className={shared.stepHeader}>
          <h2 className={shared.stepTitle}>Spend your points</h2>
          <p className={shared.stepSub}>
            Attributes are linked. Raising one pulls up everything it depends on — and its cost with
            it. Tap an attribute to see its chain and the badges it drives.
          </p>
        </header>

        <section className={shared.panel}>
          <div className={shared.panelHead}>
            <h3 className={shared.panelTitle}>Quick Start</h3>
            <span className={shared.panelNote}>Loads a full archetype</span>
          </div>
          <div className={styles.presetRow}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={styles.presetBtn}
                onClick={() => onPreset(preset.id)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </section>

        <section className={shared.panel}>
          <div className={shared.panelHead}>
            <h3 className={shared.panelTitle}>Attributes</h3>
            <div className={styles.tabs}>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`${styles.tab} ${filter === 'all' ? styles.tabActive : ''}`}
                style={filter === 'all' ? { background: '#ffd23f' } : undefined}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilter(cat.id)}
                  className={`${styles.tab} ${filter === cat.id ? styles.tabActive : ''}`}
                  style={filter === cat.id ? { background: cat.color } : undefined}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {visible.map((cat) => (
            <div key={cat.id} className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.groupDot} style={{ background: cat.color }} />
                <span className={styles.groupName}>{cat.name}</span>
                <span className={styles.groupAvg}>AVG {categoryAverage(cat.id, ratings)}</span>
              </div>
              <div className={styles.attrGrid}>
                {ATTRIBUTES.filter((a) => a.category === cat.id).map((attr) => {
                  const value = ratings[attr.id] ?? MIN_RATING;
                  const cap = capFor(attr.id, position, body);
                  const maxAfford = affordableMax(ratings, attr.id, position, body);
                  const upCost = changeCost(ratings, attr.id, value + 1, position, body);
                  const canIncrease = value < cap && upCost <= remaining;
                  const chain = parentsOf(attr.id);
                  const isFocus = focus === attr.id;
                  return (
                    <div
                      key={attr.id}
                      role="button"
                      tabIndex={0}
                      onFocus={() => setFocus(attr.id)}
                      onMouseEnter={() => setFocus(attr.id)}
                      onClick={() => setFocus(attr.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setFocus(attr.id);
                      }}
                      className={`${styles.attr} ${isFocus ? styles.attrActive : ''} ${
                        related.has(attr.id) ? styles.attrLinked : ''
                      }`}
                    >
                      <div className={styles.attrTop}>
                        <span className={styles.attrName}>
                          {chain.length > 0 && <span className={styles.linkIcon}>⛓</span>}
                          {attr.name}
                        </span>
                        <span className={styles.attrRight}>
                          <span className={styles.attrCap}>MAX {cap}</span>
                          <span className={styles.attrValue} style={{ color: cat.color }}>
                            {value}
                          </span>
                        </span>
                      </div>
                      <div className={styles.trackWrap}>
                        <button
                          type="button"
                          className={styles.stepBtn}
                          aria-label={`Decrease ${attr.name}`}
                          disabled={value <= MIN_RATING}
                          onClick={(e) => {
                            e.stopPropagation();
                            onChange(attr.id, value - 1);
                          }}
                        >
                          &minus;
                        </button>
                        <span className={styles.rangeWrap}>
                          <span className={styles.rangeBg}>
                            <span
                              className={styles.rangeFill}
                              style={{ width: `${(value / 99) * 100}%`, background: cat.color }}
                            />
                            <span
                              className={styles.rangeAfford}
                              style={{
                                left: `${(maxAfford / 99) * 100}%`,
                                width: `${((cap - maxAfford) / 99) * 100}%`,
                              }}
                            />
                            <span
                              className={styles.rangeCapZone}
                              style={{ width: `${((99 - cap) / 99) * 100}%` }}
                            />
                          </span>
                          <input
                            className={styles.range}
                            type="range"
                            min={MIN_RATING}
                            max={99}
                            value={value}
                            aria-label={attr.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onChange(attr.id, Number(e.target.value))}
                          />
                        </span>
                        <button
                          type="button"
                          className={styles.stepBtn}
                          aria-label={`Increase ${attr.name}`}
                          disabled={!canIncrease}
                          onClick={(e) => {
                            e.stopPropagation();
                            onChange(attr.id, value + 1);
                          }}
                        >
                          +
                        </button>
                      </div>
                      {isFocus && chain.length > 0 && (
                        <div className={styles.chainNote}>
                          Needs{' '}
                          {chain.map((link, i) => (
                            <span key={link.attr}>
                              {i > 0 && ' + '}
                              <span className={styles.chainHi}>{attrName(link.attr)}</span> ≥{' '}
                              {Math.max(MIN_RATING, value - link.gap)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className={shared.column}>
        <section className={shared.panel}>
          <div className={shared.panelHead}>
            <h3 className={shared.panelTitle}>Badges Available</h3>
            <span className={shared.panelNote}>
              {allBadges.filter((b) => b.tier > 0).length} unlocked
            </span>
          </div>

          <div className={styles.focusHead}>
            <div className={styles.focusName} style={{ color: focusColor }}>
              {attrName(focus)} · {ratings[focus] ?? MIN_RATING}
            </div>
            <div className={styles.focusMeta}>
              {focusParents.length > 0 && (
                <>
                  Leans on {focusParents.map((p) => attrName(p.attr)).join(', ')}.{' '}
                </>
              )}
              {focusDependents.length > 0 && (
                <>Lifts {focusDependents.map((d) => attrName(d.attr)).join(', ')}.</>
              )}
              {focusParents.length === 0 && focusDependents.length === 0 && 'Standalone attribute.'}
            </div>
          </div>

          <div className={styles.legendRow}>
            {TIER_NAMES.slice(1).map((name, i) => (
              <span key={name} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: TIER_COLORS[i + 1] }} />
                {name}
              </span>
            ))}
          </div>

          <div className={styles.badgePanelList}>
            {(focusBadges.length > 0 ? focusBadges : allBadges).map(({ badge, tier }) => {
              const value = ratings[badge.driver] ?? MIN_RATING;
              // A Hall of Fame badge has no next tier, so this is undefined at tier 4.
              const next: number | undefined = (badge.tiers as readonly number[])[tier];
              return (
                <div
                  key={badge.id}
                  className={`${styles.badgeRow} ${tier === 0 ? styles.badgeLocked : ''}`}
                  style={tier > 0 ? { borderColor: `${TIER_COLORS[tier]}55` } : undefined}
                >
                  <span className={styles.medal} style={{ background: TIER_COLORS[tier] }}>
                    {tier === 0 ? '—' : TIER_NAMES[tier].slice(0, 2).toUpperCase()}
                  </span>
                  <span className={styles.badgeBody}>
                    <div className={styles.badgeName}>{badge.name}</div>
                    <div className={styles.badgeMeta}>
                      {next
                        ? `${attrName(badge.driver)} ${value} → ${next} for ${TIER_NAMES[tier + 1]}`
                        : `${TIER_NAMES[tier]} · maxed`}
                    </div>
                  </span>
                  <span className={styles.pips}>
                    {[1, 2, 3, 4].map((p) => (
                      <span
                        key={p}
                        className={styles.pip}
                        style={p <= tier ? { background: TIER_COLORS[tier] } : undefined}
                      />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
