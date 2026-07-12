import type { DecisionResult } from '@/services/decision';
import type { TaskExecutionPlan } from '@/services/agent';
import { createSingleStepPlan, executePlanForSkill, normalizeCommand, rollbackPlaceholder, unsupported, validateAction } from './SkillPlanFactory';
import type { RealWorldSkill, RealWorldSkillExecution, RealWorldSkillValidation } from './types';

const PACKAGE = { packageName: 'com.whatsapp', appName: 'WhatsApp' };

function phoneFrom(command: string): string | undefined {
  return command.match(/(?:\+?\d[\d\s-]{7,}\d)/)?.[0].replace(/[\s-]/g, '');
}

export class WhatsAppSkill implements RealWorldSkill {
  id = 'whatsapp' as const;
  name = 'WhatsApp';
  description = 'Open WhatsApp or start a deterministic WhatsApp chat link when a phone number is supplied.';
  requiredPermissions = ['installed app or browser link'];
  supportsConfirmation = true;

  match(command: string): boolean {
    const text = normalizeCommand(command);
    return /\bwhatsapp\b/.test(text) || /\bmessage\s+[a-z0-9 +'-]+\b/.test(text);
  }

  availability(): RealWorldSkillValidation {
    return validateAction('open_app', PACKAGE, this.requiredPermissions);
  }

  validate(command: string): RealWorldSkillValidation {
    const text = normalizeCommand(command);
    const phoneNumber = phoneFrom(command);
    if (/\b(message|send|text)\b/.test(text) && !phoneNumber && !/\bwhatsapp\b/.test(text)) {
      return unsupported('Contact lookup is not available yet. Provide a phone number or say "Open WhatsApp".', this.requiredPermissions);
    }
    if (phoneNumber) {
      return validateAction('launch_url', { url: `https://wa.me/${phoneNumber}` }, this.requiredPermissions, true);
    }
    return this.availability();
  }

  createPlan(command: string, decision: DecisionResult): TaskExecutionPlan | null {
    const validation = this.validate(command);
    if (!validation.valid || !validation.actionType || !validation.payload) return null;
    return createSingleStepPlan(command, 'whatsapp_skill', decision, validation.payload.url ? 'Open WhatsApp chat link' : 'Open WhatsApp', validation.actionType, validation.payload);
  }

  async execute(command: string, decision: DecisionResult, confirmed = false): Promise<RealWorldSkillExecution> {
    const validation = this.validate(command);
    return executePlanForSkill(this.id, command, validation, this.createPlan(command, decision), confirmed);
  }

  rollback() {
    return rollbackPlaceholder();
  }
}

export const whatsAppSkill = new WhatsAppSkill();
