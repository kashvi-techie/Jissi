import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActionExecutor } from '@/services/android-actions';
import type { CapabilityDefinition, CapabilityExecutionInput, CapabilityPermissionState, CapabilityValidation } from './CapabilityTypes';

const CACHE_KEY = '@jissi/capability-permissions';

let ExpoCamera: any = null;
try {
  ExpoCamera = require('expo-camera');
} catch {
  ExpoCamera = null;
}

function missingPayload(definition: CapabilityDefinition, input?: CapabilityExecutionInput): string[] {
  return (definition.requiredPayload ?? []).filter((key) => {
    const value = input?.payload?.[key];
    return value === undefined || value === null || value === '';
  });
}

function currentPlatform() {
  return Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : 'web';
}

async function readCache(): Promise<Record<string, CapabilityPermissionState>> {
  try {
    const raw = Platform.OS === 'web' && typeof localStorage !== 'undefined'
      ? localStorage.getItem(CACHE_KEY)
      : await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as Record<string, CapabilityPermissionState> : {};
  } catch {
    return {};
  }
}

async function writeCache(cache: Record<string, CapabilityPermissionState>): Promise<void> {
  const raw = JSON.stringify(cache);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(CACHE_KEY, raw);
    return;
  }
  await AsyncStorage.setItem(CACHE_KEY, raw);
}

class CapabilityPermissionManagerImpl {
  getPermissionState(definition: CapabilityDefinition): CapabilityPermissionState {
    if (definition.nativeModuleRequired) return 'unsupported';
    if (!definition.supportedPlatforms.includes(currentPlatform())) return 'unsupported';
    return definition.requiredPermissions.length ? 'unknown' : 'granted';
  }

  async getCachedPermissionState(definition: CapabilityDefinition): Promise<CapabilityPermissionState> {
    const cache = await readCache();
    return cache[definition.id] ?? this.getPermissionState(definition);
  }

  async requestPermissions(definition: CapabilityDefinition): Promise<CapabilityPermissionState> {
    if (!definition.requiredPermissions.length) return 'granted';
    if (definition.id !== 'camera') return this.getPermissionState(definition);
    if (!ExpoCamera?.Camera?.requestCameraPermissionsAsync && !ExpoCamera?.requestCameraPermissionsAsync) return 'unsupported';

    const request = ExpoCamera.Camera?.requestCameraPermissionsAsync ?? ExpoCamera.requestCameraPermissionsAsync;
    const response = await request();
    const next: CapabilityPermissionState = response?.granted || response?.status === 'granted' ? 'granted' : 'required';
    const cache = await readCache();
    await writeCache({ ...cache, [definition.id]: next });
    return next;
  }

  validate(definition: CapabilityDefinition, input?: CapabilityExecutionInput): CapabilityValidation {
    const platform = currentPlatform();
    if (!definition.supportedPlatforms.includes(platform)) {
      return {
        status: 'unsupported',
        reason: `${definition.displayName} is not supported on ${platform}.`,
        permissionState: 'unsupported',
      };
    }

    if (definition.nativeModuleRequired) {
      return {
        status: 'unsupported',
        reason: `${definition.displayName} needs ${definition.nativeModuleRequired}.`,
        permissionState: 'unsupported',
        nativeModuleRequired: definition.nativeModuleRequired,
      };
    }

    const missing = missingPayload(definition, input);
    if (missing.length) {
      return {
        status: 'permission_required',
        reason: `Missing required payload: ${missing.join(', ')}.`,
        missingPayload: missing,
        permissionState: definition.requiredPermissions.length ? 'required' : 'granted',
      };
    }

    if (definition.action) {
      const payload = { ...definition.action.payload, ...input?.payload };
      const actionCheck = ActionExecutor.checkPermissions({ type: definition.action.type, payload, confirmed: input?.confirmed });
      if (!actionCheck.allowed) {
        return {
          status: actionCheck.missing?.length ? 'permission_required' : 'temporarily_unavailable',
          reason: actionCheck.reason,
          missingPayload: actionCheck.missing,
          permissionState: actionCheck.missing?.length ? 'required' : 'unknown',
        };
      }
    }

    return {
      status: 'supported',
      reason: 'Capability can be attempted.',
      permissionState: this.getPermissionState(definition),
    };
  }
}

export const CapabilityPermissionManager = new CapabilityPermissionManagerImpl();
