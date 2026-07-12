import type { DecisionResult } from '@/services/decision';
import type { TaskExecutionPlan } from '@/services/agent';
import { createSingleStepPlan, encodeSearch, executePlanForSkill, normalizeCommand, rollbackPlaceholder, validateAction } from './SkillPlanFactory';
import type { RealWorldSkill, RealWorldSkillExecution, RealWorldSkillValidation } from './types';

const PACKAGE = { packageName: 'com.android.chrome', appName: 'Chrome' };

function searchQuery(command: string): string | undefined {
  return command.match(/\bsearch\s+(.+)$/i)?.[1]?.trim();
}

export class ChromeSkill implements RealWorldSkill {
  id = 'chrome' as const;
  name = 'Chrome';
  description = 'Open Chrome or launch a deterministic Google search URL.';
  requiredPermissions = ['browser'];
  supportsConfirmation = false;

  match(command: string): boolean {
    const text = normalizeCommand(command);
    return /\bchrome\b/.test(text) || /\bsearch\s+.+/.test(text);
  }

  availability(): RealWorldSkillValidation {
    return validateAction('open_app', PACKAGE, this.requiredPermissions);
  }

  validate(command: string): RealWorldSkillValidation {
    const query = searchQuery(command);
    if (query) {
      return validateAction('launch_url', { url: `https://www.google.com/search?q=${encodeSearch(query)}` }, this.requiredPermissions);
    }
    return this.availability();
  }

  createPlan(command: string, decision: DecisionResult): TaskExecutionPlan | null {
    const validation = this.validate(command);
    if (!validation.valid || !validation.actionType || !validation.payload) return null;
    const label = validation.actionType === 'launch_url' ? `Search ${searchQuery(command)}` : 'Open Chrome';
    return createSingleStepPlan(command, 'chrome_skill', decision, label, validation.actionType, validation.payload);
  }

  async execute(command: string, decision: DecisionResult, confirmed = false): Promise<RealWorldSkillExecution> {
    const validation = this.validate(command);
    return executePlanForSkill(this.id, command, validation, this.createPlan(command, decision), confirmed);
  }

  rollback() {
    return rollbackPlaceholder();
  }
}

export const chromeSkill = new ChromeSkill();
