/**
 * @file SetupStep — the first screen, as in the app ("Основные характеристики"):
 * pick the balcony type and the glazing, then continue to the finishes.
 */
import type { Dispatch } from 'react';
import { ArrowRight, Check } from '../../components/icons';
import { ShapePlan } from './ShapePlan';
import type { Extras } from './useConfigurator';
import type { Action, ConfigState } from './useConfigurator';
import { VAM_AVAILABLE_SHAPES, vamShapeGlazings, vamShapeType, vamUiUrl } from './vamCatalog';
import styles from './Wizard.module.css';

interface SetupStepProps {
  readonly state: ConfigState;
  readonly dispatch: Dispatch<Action>;
  readonly onNext: () => void;
}

const EXTRAS: readonly { key: keyof Extras; label: string; hint: string }[] = [
  { key: 'insulation', label: 'Утепление', hint: 'тёплый контур, пеноплэкс' },
  { key: 'ceilingFinish', label: 'Отделка потолка', hint: 'реечный / натяжной' },
  { key: 'dismantling', label: 'Демонтаж', hint: 'снос старого остекления' },
];

/**
 * Balcony type + glazing + extras.
 * @returns The screen element.
 */
export function SetupStep({ state, dispatch, onNext }: SetupStepProps): JSX.Element {
  const shape = VAM_AVAILABLE_SHAPES.find((candidate) => candidate.id === state.vam.shape) ?? VAM_AVAILABLE_SHAPES[0]!;
  const type = vamShapeType(shape);
  const glazings = vamShapeGlazings(shape);
  const isHanded = type.id === 'u';

  return (
    <div className={styles.setup}>
      <div className={styles.head}>
        <span className={styles.headChip}>Основные характеристики</span>
        <button type="button" className={styles.nextBtn} onClick={onNext}>
          Далее <ArrowRight size={18} />
        </button>
      </div>

      <h2 className={styles.title}>Выберите тип балкона</h2>
      <div className={styles.typeRow} role="radiogroup" aria-label="Тип балкона">
        {VAM_AVAILABLE_SHAPES.map((s) => {
          const on = s.id === shape.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${styles.typeCard} ${on ? styles.on : ''}`}
              onClick={() => dispatch({ type: 'vam', value: { shape: s.id } })}
            >
              <span className={styles.photo}>
                <img src={vamUiUrl(vamShapeType(s).photo)} alt="" loading="lazy" />
                <span className={styles.planBadge}>
                  <ShapePlan shape={s} className={styles.planSvg} />
                </span>
                {on ? (
                  <span className={styles.tick}>
                    <Check size={20} />
                  </span>
                ) : null}
              </span>
              <span className={styles.cardName}>{s.label}</span>
              <span className={styles.cardHint}>{s.hint}</span>
            </button>
          );
        })}
      </div>

      <h2 className={styles.title}>{isHanded ? 'Выберите сторону' : 'Выберите тип остекления'}</h2>
      <div className={styles.glazeRow} role="radiogroup" aria-label={isHanded ? 'Сторона' : 'Тип остекления'}>
        {glazings.map((g) => {
          const on = g.id === state.vam.glazing;
          return (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${styles.glazeCard} ${on ? styles.on : ''}`}
              onClick={() => dispatch({ type: 'vam', value: { glazing: g.id } })}
            >
              <span className={styles.photo}>
                <img src={vamUiUrl(g.photo)} alt="" loading="lazy" />
                {on ? (
                  <span className={styles.tick}>
                    <Check size={20} />
                  </span>
                ) : null}
              </span>
              <span className={styles.cardName}>{g.label}</span>
            </button>
          );
        })}
      </div>

      <h2 className={styles.title}>Дополнительно</h2>
      <div className={styles.extras}>
        {EXTRAS.map((ex) => {
          const on = state.extras[ex.key];
          return (
            <button
              key={ex.key}
              type="button"
              aria-pressed={on}
              className={`${styles.extra} ${on ? styles.on : ''}`}
              onClick={() => dispatch({ type: 'extra', key: ex.key })}
            >
              <span className={styles.extraBox}>{on ? <Check size={14} /> : null}</span>
              <span className={styles.extraText}>
                <span className={styles.extraName}>{ex.label}</span>
                <span className={styles.extraHint}>{ex.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
