/**
 * sanitizeForSpeech — strip Markdown / formatting so a text-to-speech engine
 * never vocalizes raw symbols (e.g. "star star hello", "hash heading",
 * "dash item", "backtick code").
 *
 * This is a PURE text transform used ONLY on the copy handed to the speech
 * engine. It must never be applied to the LLM response or the chat history —
 * the on-screen text keeps its original Markdown.
 *
 * Reusable and dependency-free, so it can be called from any TTS path.
 */
export function sanitizeForSpeech(input: string): string {
  if (!input) return '';

  let t = input;

  // ── Code ────────────────────────────────────────────────────────────────
  // Fenced blocks ```lang\n…``` → keep the inner text, drop the fences.
  t = t.replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, '$1');
  // Inline code `code` → code
  t = t.replace(/`([^`]+)`/g, '$1');

  // ── Links / images / HTML ─────────────────────────────────────────────────
  // Images ![alt](url) and links [label](url) → keep the human-readable part.
  t = t.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Autolinks <https://…> → the bare URL text (rarely spoken, but no brackets).
  t = t.replace(/<(https?:\/\/[^>]+)>/g, '$1');
  // Any HTML tags <b>, </div>, <br/> → a space.
  t = t.replace(/<\/?[a-zA-Z][^>]*>/g, ' ');

  // ── Block-level markers (line starts) ──────────────────────────────────────
  // Headings:  #, ##, ###…
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  // Blockquotes:  "> "
  t = t.replace(/^\s{0,3}>\s?/gm, '');
  // Horizontal rules:  ---  ***  ___
  t = t.replace(/^\s*([-*_])\1{2,}\s*$/gm, '');
  // Bullet prefixes:  -, *, +  →  drop the marker, keep the item text.
  t = t.replace(/^\s*[-*+]\s+/gm, '');
  // Numbered list prefixes:  "1. "  →  keep the text, drop the number.
  t = t.replace(/^\s*\d+[.)]\s+/gm, '');

  // ── Inline emphasis ────────────────────────────────────────────────────────
  t = t.replace(/(\*\*|__)(.*?)\1/g, '$2'); // **bold** / __bold__
  t = t.replace(/(\*|_)(.*?)\1/g, '$2');    // *italic* / _italic_
  t = t.replace(/~~(.*?)~~/g, '$1');        // ~~strikethrough~~

  // ── Table pipes → space ─────────────────────────────────────────────────────
  t = t.replace(/\|/g, ' ');

  // ── Leftover stray formatting symbols ───────────────────────────────────────
  t = t.replace(/[*_`~#>]/g, '');

  // ── Emoji / pictographs (would be read aloud as "waving hand" etc.) ─────────
  t = t.replace(
    /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
    ''
  );

  // ── Whitespace normalization ────────────────────────────────────────────────
  t = t.replace(/[ \t]*\n[ \t]*/g, '\n'); // trim each line edge
  t = t.replace(/\n{2,}/g, '\n');         // collapse blank lines
  t = t.replace(/[ \t]{2,}/g, ' ');       // collapse runs of spaces/tabs
  t = t.trim();

  return t;
}
