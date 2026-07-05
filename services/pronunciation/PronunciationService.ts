export interface PronunciationEntry {
  display: string;
  speech: string;
  source: 'built-in' | 'runtime' | 'memory';
}

export interface PronunciationOverride {
  display: string;
  speech: string;
}

const BUILT_IN_PRONUNCIATIONS: PronunciationOverride[] = [
  { display: 'Pathak', speech: 'Paathak' },
  { display: 'Tiwari', speech: 'Teevaari' },
  { display: 'Shrivastava', speech: 'Shreevaastava' },
  { display: 'Ananya', speech: 'Ananyaa' },
  { display: 'Sourabh', speech: 'Saurabh' },
  { display: 'JISSI', speech: 'Jissi' },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class PronunciationServiceImpl {
  private runtimeOverrides = new Map<string, PronunciationEntry>();
  private memoryOverrides = new Map<string, PronunciationEntry>();

  private builtIns = new Map(
    BUILT_IN_PRONUNCIATIONS.map((entry) => [
      entry.display.toLowerCase(),
      { ...entry, source: 'built-in' as const },
    ])
  );

  setRuntimeOverride(display: string, speech: string): void {
    const key = display.trim().toLowerCase();
    if (!key || !speech.trim()) return;
    this.runtimeOverrides.set(key, {
      display: display.trim(),
      speech: speech.trim(),
      source: 'runtime',
    });
  }

  setRuntimeOverrides(overrides: PronunciationOverride[]): void {
    overrides.forEach((override) => this.setRuntimeOverride(override.display, override.speech));
  }

  clearRuntimeOverride(display: string): void {
    this.runtimeOverrides.delete(display.trim().toLowerCase());
  }

  loadMemoryOverrides(overrides: PronunciationOverride[]): void {
    this.memoryOverrides.clear();
    overrides.forEach((override) => {
      const key = override.display.trim().toLowerCase();
      if (!key || !override.speech.trim()) return;
      this.memoryOverrides.set(key, {
        display: override.display.trim(),
        speech: override.speech.trim(),
        source: 'memory',
      });
    });
  }

  getEntry(display: string): PronunciationEntry | undefined {
    const key = display.trim().toLowerCase();
    return this.runtimeOverrides.get(key) ?? this.memoryOverrides.get(key) ?? this.builtIns.get(key);
  }

  toSpeechText(displayText: string): string {
    let speechText = displayText;
    const entries = [...this.builtIns.values(), ...this.memoryOverrides.values(), ...this.runtimeOverrides.values()]
      .sort((a, b) => b.display.length - a.display.length);

    for (const entry of entries) {
      if (!entry.display || entry.display === entry.speech) continue;
      const pattern = new RegExp(`\\b${escapeRegExp(entry.display)}\\b`, 'gi');
      speechText = speechText.replace(pattern, entry.speech);
    }

    return speechText;
  }
}

export const PronunciationService = new PronunciationServiceImpl();
