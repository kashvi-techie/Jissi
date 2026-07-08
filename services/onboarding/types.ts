export type OnboardingRole = 'Student' | 'Developer' | 'Designer' | 'Founder' | 'Professional';
export type OnboardingPersonality = 'Calm' | 'Friendly' | 'Mentor' | 'Funny' | 'Professional';

export interface OnboardingProfile {
  completed: boolean;
  skipped?: boolean;
  name?: string;
  nickname?: string;
  roles: OnboardingRole[];
  interests: string[];
  goal?: string;
  personality?: OnboardingPersonality;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingDraft {
  name?: string;
  nickname?: string;
  roles?: OnboardingRole[];
  interests?: string[];
  goal?: string;
  personality?: OnboardingPersonality;
  skipped?: boolean;
}
