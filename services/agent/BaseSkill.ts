import { ActionExecutor } from '@/services/android-actions';
import type { AndroidActionRequest, AndroidActionResult, AndroidActionType } from '@/services/android-actions';
import type {
  SkillDefinition,
  SkillExecutionContext,
  SkillId,
  SkillRollbackResult,
  SkillRunResult,
  SkillValidationResult,
  TaskStep,
} from './types';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Skill timed out after ${timeoutMs}ms.`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export abstract class BaseSkill implements SkillDefinition {
  abstract id: SkillId;
  abstract description: string;
  abstract required_permissions: string[];
  abstract supports_confirmation: boolean;
  protected abstract actionType: AndroidActionType;

  validate(step: TaskStep): SkillValidationResult {
    if (step.actionType !== this.actionType) {
      return {
        valid: false,
        reason: `Step action ${step.actionType} does not match skill action ${this.actionType}.`,
      };
    }

    const permission = ActionExecutor.checkPermissions(this.toActionRequest(step, false));
    return {
      valid: permission.allowed,
      reason: permission.reason,
      missing: permission.missing,
    };
  }

  async execute(step: TaskStep, context: SkillExecutionContext): Promise<SkillRunResult> {
    const validation = this.validate(step);
    if (!validation.valid) {
      return { state: 'failed', message: validation.reason };
    }

    try {
      const result = await withTimeout(
        ActionExecutor.execute(this.toActionRequest(step, context.confirmed)),
        context.timeoutMs ?? step.timeoutMs
      );
      return this.toRunResult(result);
    } catch (error) {
      return {
        state: 'failed',
        message: error instanceof Error ? error.message : 'Unknown skill execution error.',
      };
    }
  }

  async rollback(): Promise<SkillRollbackResult> {
    return {
      supported: false,
      reason: 'Rollback is recorded as metadata only for this skill.',
    };
  }

  protected toActionRequest(step: TaskStep, confirmed?: boolean): AndroidActionRequest {
    return {
      type: this.actionType,
      payload: step.payload,
      confirmed,
    };
  }

  private toRunResult(result: AndroidActionResult): SkillRunResult {
    if (result.status === 'success') {
      return { state: 'completed', result, message: result.message };
    }
    if (result.status === 'pending_confirmation') {
      return {
        state: 'waiting_confirmation',
        result,
        message: result.confirmationPrompt ?? result.message,
        requiresConfirmation: true,
      };
    }
    return {
      state: result.status === 'unsupported' ? 'waiting_external' : 'failed',
      result,
      message: result.message,
    };
  }
}
