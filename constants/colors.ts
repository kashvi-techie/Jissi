/**
 * JISSI design tokens — COLORS.
 *
 * Light "pink / blue glassmorphism" theme. Every colour used anywhere in the app
 * is defined here. Components must never hard-code a colour value — import
 * `Colors` and reference a token. This is the single source of truth for colour.
 */
export const Colors = {
  // ── Brand / primary palette ───────────────────────────────────────────────
  brand: {
    pink: '#E879F9',
    lavender: '#C084FC',
    blue: '#67E8F9',
    violet: '#A88BFF',
    sky: '#7CB8FF',
    aqua: '#8FD3FF',
    rose: '#FF9EC4',
  },

  // ── Accent (interactive icons / headings) ─────────────────────────────────
  accent: {
    indigo: '#6D5BD0',
    deepViolet: '#5B4B9E',
    softViolet: '#A78BFA',
  },

  // ── Background layers ──────────────────────────────────────────────────────
  background: {
    base: '#F3E8FF',
    soft: '#FAF7FF',
    gradient: ['#FFE3EF', '#F3E8FF', '#E2F0FF'] as const,
    blobPink: 'rgba(255,158,196,0.45)',
    blobBlue: 'rgba(124,184,255,0.40)',
  },

  // ── Multi-stop gradients ───────────────────────────────────────────────────
  gradient: {
    orb: ['#8FD3FF', '#A88BFF', '#FF9EC4'] as const,
    micIdle: ['#A88BFF', '#7CB8FF'] as const,
    micActive: ['#FF9EC4', '#A88BFF'] as const,
    bubbleUser: ['#C084FC', '#E879F9'] as const,
  },

  // ── Glass surfaces ─────────────────────────────────────────────────────────
  glass: {
    fill: 'rgba(255,255,255,0.6)',
    highlight: 'rgba(255,255,255,0.45)',
    sparkle: 'rgba(255,255,255,0.9)',
    ring: 'rgba(168,139,255,0.45)',
    glow: 'rgba(168,139,255,0.35)',
  },

  // ── Borders ────────────────────────────────────────────────────────────────
  border: {
    glass: 'rgba(255,255,255,0.6)',
    glassStrong: 'rgba(255,255,255,0.7)',
    subtle: 'rgba(255,255,255,0.08)',
  },

  // ── Typography colours ─────────────────────────────────────────────────────
  text: {
    heading: '#5B4B9E',
    primary: '#4A4458',
    secondary: '#5C5680',
    muted: '#8B83AE',
    tagline: '#7B7399',
    onColor: '#FFFFFF',
    onColorMuted: 'rgba(255,255,255,0.8)',
  },

  // ── Status / phase ─────────────────────────────────────────────────────────
  status: {
    success: '#34D399',
    error: '#FB7185',
    errorStrong: '#E11D7A',
    listening: '#34D399',
    thinking: '#C084FC',
    speaking: '#67E8F9',
    idle: '#A88BFF',
  },

  // ── Tab bar ────────────────────────────────────────────────────────────────
  tab: {
    active: '#A78BFA',
    inactive: '#64748B',
    background: '#0B0B1A',
    border: 'rgba(255,255,255,0.08)',
    activeChip: 'rgba(139,92,246,0.15)',
  },

  // ── Shadow colours ─────────────────────────────────────────────────────────
  shadow: {
    violet: '#A88BFF',
    sky: '#7CB8FF',
    title: 'rgba(168,139,255,0.4)',
    black: '#000000',
    glow: '#8E86D6',
    mic: '#9E95EC',
  },

  // ── Intent accents (IntentCard) ───────────────────────────────────────────
  intent: {
    youtube: '#FB7185',
    chrome: '#67E8F9',
    whatsapp: '#34D399',
    search: '#C084FC',
    ask: '#E879F9',
    unknown: '#8B83AE',
  },

  // ── Premium Home — dark "AI OS" surface ───────────────────────────────────
  // Additive. Only the Home screen consumes these; History / Profile keep the
  // light tokens above and are visually unchanged.
  surface: {
    void: '#07070B',
    base: '#0B0B12',
    raised: '#12121C',
    gradient: ['#0C0C15', '#0A0A11', '#070709'] as const,
  },
  ambient: {
    violet: 'rgba(126,98,201,0.20)',
    blue: 'rgba(72,104,168,0.16)',
    blush: 'rgba(196,132,170,0.10)',
    halo: 'rgba(150,138,224,0.38)',
    micGlow: 'rgba(158,149,236,0.5)',
  },
  frost: {
    fill: 'rgba(255,255,255,0.05)',
    fillStrong: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.18)',
    highlight: 'rgba(255,255,255,0.14)',
    specular: 'rgba(255,255,255,0.45)',
  },
  onDark: {
    primary: '#ECECF2',
    secondary: '#B6B6C8',
    muted: '#80808F',
    faint: '#56565F',
  },
  premiumGradient: {
    orb: ['#DCE3FF', '#9C92E2', '#4B4576'] as const,
    bubbleUser: ['#7E74C8', '#564F8C'] as const,
    micIdle: ['#33334A', '#20202E'] as const,
    micActive: ['#9E95EC', '#5F57A0'] as const,
  },
};
