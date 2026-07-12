import type { DecisionResult } from '@/services/decision';
import type { TaskExecutionPlan } from '@/services/agent';
import { createSingleStepPlan, encodeSearch, executePlanForSkill, normalizeCommand, rollbackPlaceholder, validateAction } from './SkillPlanFactory';
import type { RealWorldSkill, RealWorldSkillExecution, RealWorldSkillValidation } from './types';

const PACKAGE = { packageName: 'com.spotify.music', appName: 'Spotify' };

function queryFrom(command: string): string | undefined {
  return command.match(/\bplay\s+(.+?)(?:\s+on\s+spotify)?$/i)?.[1]?.trim()
    ?? command.match(/\bspotify\s+(.+)$/i)?.[1]?.trim();
}

export class SpotifySkill implements RealWorldSkill {
  id = 'spotify' as const;
  name = 'Spotify';
  description = 'Open Spotify or launch a deterministic Spotify search.';
  requiredPermissions = ['installed app or browser link'];
  supportsConfirmation = false;

  match(command: string): boolean {
    const text = normalizeCommand(command);
    return /\bspotify\b/.test(text) || /\bplay\s+.+music\b/.test(text) || /\blo-?fi\b/.test(text);
  }

  availability(): RealWorldSkillValidation {
    return validateAction('open_app', PACKAGE, this.requiredPermissions);
  }

  validate(command: string): RealWorldSkillValidation {
    const query = queryFrom(command);
    if (query) {
      return validateAction('launch_url', { url: `https://open.spotify.com/search/${encodeSearch(query)}` }, this.requiredPermissions);
    }
    return this.availability();
  }

  createPlan(command: string, decision: DecisionResult): TaskExecutionPlan | null {
    const validation = this.validate(command);
    if (!validation.valid || !validation.actionType || !validation.payload) return null;
    const query = queryFrom(command);
    const label = query ? `Search Spotify for ${query}` : 'Open Spotify';
    return createSingleStepPlan(command, 'spotify_skill', decision, label, validation.actionType, validation.payload);
  }

  async execute(command: string, decision: DecisionResult, confirmed = false): Promise<RealWorldSkillExecution> {
    const validation = this.validate(command);
    return executePlanForSkill(this.id, command, validation, this.createPlan(command, decision), confirmed);
  }

  rollback() {
    return rollbackPlaceholder();
  }
}

export const spotifySkill = new SpotifySkill();
