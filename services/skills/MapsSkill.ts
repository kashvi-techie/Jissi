import type { DecisionResult } from '@/services/decision';
import type { TaskExecutionPlan } from '@/services/agent';
import { createSingleStepPlan, encodeSearch, executePlanForSkill, normalizeCommand, rollbackPlaceholder, unsupported, validateAction } from './SkillPlanFactory';
import type { RealWorldSkill, RealWorldSkillExecution, RealWorldSkillValidation } from './types';

function destinationFrom(command: string): string | undefined {
  return command.match(/\b(?:navigate to|directions to|map to|route to)\s+(.+)$/i)?.[1]?.trim();
}

export class MapsSkill implements RealWorldSkill {
  id = 'maps' as const;
  name = 'Maps';
  description = 'Open Google Maps directions for a supplied destination.';
  requiredPermissions = ['browser or maps handler'];
  supportsConfirmation = false;

  match(command: string): boolean {
    const text = normalizeCommand(command);
    return /\b(map|maps|navigate|directions|route)\b/.test(text);
  }

  availability(): RealWorldSkillValidation {
    return validateAction('launch_url', { url: 'https://www.google.com/maps' }, this.requiredPermissions);
  }

  validate(command: string): RealWorldSkillValidation {
    const destination = destinationFrom(command);
    if (!destination) {
      return unsupported('A destination is required. Example: "Navigate to GLA University".', this.requiredPermissions);
    }
    return validateAction('launch_url', { url: `https://www.google.com/maps/search/?api=1&query=${encodeSearch(destination)}` }, this.requiredPermissions);
  }

  createPlan(command: string, decision: DecisionResult): TaskExecutionPlan | null {
    const validation = this.validate(command);
    if (!validation.valid || !validation.actionType || !validation.payload) return null;
    return createSingleStepPlan(command, 'maps_skill', decision, `Navigate to ${destinationFrom(command)}`, validation.actionType, validation.payload);
  }

  async execute(command: string, decision: DecisionResult, confirmed = false): Promise<RealWorldSkillExecution> {
    const validation = this.validate(command);
    return executePlanForSkill(this.id, command, validation, this.createPlan(command, decision), confirmed);
  }

  rollback() {
    return rollbackPlaceholder();
  }
}

export const mapsSkill = new MapsSkill();
