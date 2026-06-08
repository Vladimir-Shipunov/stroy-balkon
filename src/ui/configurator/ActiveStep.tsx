/**
 * @file ActiveStep — renders the step component matching the wizard's current
 * index. Keeps the presentation flow (`WIZARD_STEPS`) the single place that
 * defines order; this only maps a step id to its component.
 */

import { useWizardStore } from '../../store/wizardStore';
import { WIZARD_STEPS } from '../../store/wizardSteps';
import { StepDimensions } from './steps/StepDimensions';
import { StepProfile } from './steps/StepProfile';
import { StepGlazing } from './steps/StepGlazing';
import { StepGlass } from './steps/StepGlass';
import { StepFinish } from './steps/StepFinish';
import { StepAccessories } from './steps/StepAccessories';

export function ActiveStep(): JSX.Element {
  const currentIndex = useWizardStore((s) => s.currentIndex);
  const step = WIZARD_STEPS[currentIndex];

  switch (step?.id) {
    case 'dimensions':
      return <StepDimensions />;
    case 'profile':
      return <StepProfile />;
    case 'glazing':
      return <StepGlazing />;
    case 'glass':
      return <StepGlass />;
    case 'finish':
      return <StepFinish />;
    case 'accessories':
      return <StepAccessories />;
    default:
      return <StepDimensions />;
  }
}
