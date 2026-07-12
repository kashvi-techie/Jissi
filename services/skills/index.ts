import { chromeSkill } from './ChromeSkill';
import { mapsSkill } from './MapsSkill';
import { spotifySkill } from './SpotifySkill';
import { whatsAppSkill } from './WhatsAppSkill';
import { youTubeSkill } from './YouTubeSkill';
import type { RealWorldSkill, RealWorldSkillExecution } from './types';

const SKILLS: RealWorldSkill[] = [
  whatsAppSkill,
  chromeSkill,
  youTubeSkill,
  mapsSkill,
  spotifySkill,
];

class RealWorldSkillRegistryImpl {
  list(): RealWorldSkill[] {
    return SKILLS;
  }

  available(): RealWorldSkill[] {
    return SKILLS.filter((skill) => skill.availability().valid);
  }

  unsupported(): RealWorldSkill[] {
    return SKILLS.filter((skill) => !skill.availability().valid);
  }

  match(command: string): RealWorldSkill | undefined {
    return SKILLS.find((skill) => skill.match(command));
  }

  async execute(command: string, decision: Parameters<RealWorldSkill['execute']>[1], confirmed = false): Promise<RealWorldSkillExecution | null> {
    const skill = this.match(command);
    if (!skill) return null;
    return skill.execute(command, decision, confirmed);
  }
}

export const RealWorldSkillRegistry = new RealWorldSkillRegistryImpl();
export * from './types';
export { chromeSkill, mapsSkill, spotifySkill, whatsAppSkill, youTubeSkill };
