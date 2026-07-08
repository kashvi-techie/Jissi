import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlannerEngine } from '@/services/planner';
import { OnboardingDraft, OnboardingProfile } from './types';

const PROFILE_KEY = '@jissi/onboarding/profile';

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

class OnboardingServiceImpl {
  async getProfile(): Promise<OnboardingProfile | null> {
    try {
      const raw = await getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) as OnboardingProfile : null;
    } catch {
      return null;
    }
  }

  async isComplete(): Promise<boolean> {
    const profile = await this.getProfile();
    return !!profile?.completed;
  }

  async complete(draft: OnboardingDraft): Promise<OnboardingProfile> {
    const now = new Date().toISOString();
    const profile: OnboardingProfile = {
      completed: true,
      skipped: draft.skipped,
      name: draft.name?.trim() || undefined,
      nickname: draft.nickname?.trim() || undefined,
      roles: draft.roles ?? [],
      interests: draft.interests ?? [],
      goal: draft.goal?.trim() || undefined,
      personality: draft.personality,
      createdAt: now,
      updatedAt: now,
    };

    await setItem(PROFILE_KEY, JSON.stringify(profile));

    if (profile.goal && !profile.skipped) {
      await PlannerEngine.handleConversationInput(`I want to ${profile.goal}`);
    }

    return profile;
  }
}

export const OnboardingService = new OnboardingServiceImpl();
