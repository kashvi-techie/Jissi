import type { DecisionResult } from '@/services/decision';
import type { TaskExecutionPlan } from '@/services/agent';
import { createSingleStepPlan, encodeSearch, executePlanForSkill, normalizeCommand, rollbackPlaceholder, validateAction } from './SkillPlanFactory';
import type { RealWorldSkill, RealWorldSkillExecution, RealWorldSkillValidation } from './types';

const PACKAGE = { packageName: 'com.google.android.youtube', appName: 'YouTube' };

function queryFrom(command: string): string | undefined {
  const play = command.match(/\bplay\s+(.+)$/i)?.[1]?.trim();
  const search = command.match(/\b(?:search|find)\s+(.+?)(?:\s+on\s+youtube)?$/i)?.[1]?.trim();
  return play || search;
}

export class YouTubeSkill implements RealWorldSkill {
  id = 'youtube' as const;
  name = 'YouTube';
  description = 'Open YouTube or launch a YouTube search for videos and music.';
  requiredPermissions = ['browser or YouTube app'];
  supportsConfirmation = false;

  match(command: string): boolean {
    const text = normalizeCommand(command);
    return /\byoutube\b/.test(text) || /\bplay\s+.+/.test(text);
  }

  availability(): RealWorldSkillValidation {
    return validateAction('open_app', PACKAGE, this.requiredPermissions);
  }

  validate(command: string): RealWorldSkillValidation {
    const query = queryFrom(command);
    if (query && !/\bspotify\b/i.test(command)) {
      return validateAction('launch_url', { url: `https://www.youtube.com/results?search_query=${encodeSearch(query)}` }, this.requiredPermissions);
    }
    return this.availability();
  }

  createPlan(command: string, decision: DecisionResult): TaskExecutionPlan | null {
    const validation = this.validate(command);
    if (!validation.valid || !validation.actionType || !validation.payload) return null;
    const query = queryFrom(command);
    const label = query ? `Search YouTube for ${query}` : 'Open YouTube';
    return createSingleStepPlan(command, 'youtube_skill', decision, label, validation.actionType, validation.payload);
  }

  async execute(command: string, decision: DecisionResult, confirmed = false): Promise<RealWorldSkillExecution> {
    const validation = this.validate(command);
    return executePlanForSkill(this.id, command, validation, this.createPlan(command, decision), confirmed);
  }

  rollback() {
    return rollbackPlaceholder();
  }
}

export const youTubeSkill = new YouTubeSkill();
