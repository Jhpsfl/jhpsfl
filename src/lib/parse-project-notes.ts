/**
 * Parse About Your Project text into structured blocks with optional bold subheadings.
 * A line is treated as a subheading if:
 *   - It's the first line of a block (after splitting on double newlines)
 *   - It's short (under 40 characters)
 *   - It doesn't end with a period
 *   - It's followed by more text
 *
 * Used by both the PDF generator and the public estimate page.
 */
export interface ProjectNoteBlock {
  heading?: string;
  body: string;
}

export function parseProjectNotes(text: string): ProjectNoteBlock[] {
  const blocks = text.split('\n\n').map(b => b.trim()).filter(Boolean);
  const result: ProjectNoteBlock[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const firstLine = lines[0].trim();
    if (lines.length > 1 && firstLine.length < 40 && !firstLine.endsWith('.')) {
      result.push({ heading: firstLine, body: lines.slice(1).join('\n').trim() });
    } else {
      result.push({ body: block });
    }
  }
  return result;
}
