import type { AndroidActionType } from '@/services/android-actions';
import { BaseSkill } from './BaseSkill';
import type { SkillId } from './types';

class OpenAppSkill extends BaseSkill {
  id: SkillId = 'open_app';
  description = 'Open an installed Android app through the Android action layer.';
  required_permissions = [];
  supports_confirmation = false;
  protected actionType: AndroidActionType = 'open_app';
}

class OpenUrlSkill extends BaseSkill {
  id: SkillId = 'open_url';
  description = 'Open a website or deep link.';
  required_permissions = [];
  supports_confirmation = false;
  protected actionType: AndroidActionType = 'launch_url';
}

class ShareTextSkill extends BaseSkill {
  id: SkillId = 'share_text';
  description = 'Open the native share sheet with text.';
  required_permissions = [];
  supports_confirmation = false;
  protected actionType: AndroidActionType = 'share_text';
}

class CallSkill extends BaseSkill {
  id: SkillId = 'call';
  description = 'Open the phone dialer for a number after confirmation.';
  required_permissions = ['dialer'];
  supports_confirmation = true;
  protected actionType: AndroidActionType = 'call_contact';
}

class SmsSkill extends BaseSkill {
  id: SkillId = 'sms';
  description = 'Open the SMS composer after confirmation.';
  required_permissions = ['sms composer'];
  supports_confirmation = true;
  protected actionType: AndroidActionType = 'send_sms';
}

class SettingsSkill extends BaseSkill {
  id: SkillId = 'settings';
  description = 'Open Android settings.';
  required_permissions = [];
  supports_confirmation = false;
  protected actionType: AndroidActionType = 'open_settings';
}

const SKILLS: BaseSkill[] = [
  new OpenAppSkill(),
  new OpenUrlSkill(),
  new ShareTextSkill(),
  new CallSkill(),
  new SmsSkill(),
  new SettingsSkill(),
];

const ACTION_TO_SKILL: Partial<Record<AndroidActionType, SkillId>> = {
  open_app: 'open_app',
  launch_url: 'open_url',
  share_text: 'share_text',
  call_contact: 'call',
  send_sms: 'sms',
  open_settings: 'settings',
};

class SkillRegistryImpl {
  list(): BaseSkill[] {
    return SKILLS;
  }

  get(id: SkillId): BaseSkill | undefined {
    return SKILLS.find((skill) => skill.id === id);
  }

  getByAction(type: AndroidActionType): BaseSkill | undefined {
    const skillId = ACTION_TO_SKILL[type];
    return skillId ? this.get(skillId) : undefined;
  }

  skillIdForAction(type: AndroidActionType): SkillId | undefined {
    return ACTION_TO_SKILL[type];
  }
}

export const SkillRegistry = new SkillRegistryImpl();
