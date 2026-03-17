/**
 * Parse About Your Project text into structured blocks with optional bold subheadings.
 * A line is treated as a subheading if:
 *   - It's short (under 40 characters)
 *   - It doesn't end with a period
 *   - It's followed by longer text (a paragraph)
 *
 * Handles both single \n and double \n\n separators.
 * Used by both the PDF generator and the public estimate page.
 */
export interface ProjectNoteBlock {
  heading?: string;
  body: string;
}

export function parseProjectNotes(text: string): ProjectNoteBlock[] {
  // Split into individual lines first
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: ProjectNoteBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Check if this line is a subheading: short, no period, followed by longer text
    if (
      line.length < 40 &&
      !line.endsWith('.') &&
      i + 1 < lines.length &&
      lines[i + 1].length >= 40
    ) {
      // Collect all following paragraph lines until the next subheading or end
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        // If this looks like another subheading, stop collecting body
        if (
          nextLine.length < 40 &&
          !nextLine.endsWith('.') &&
          i + 1 < lines.length &&
          lines[i + 1].length >= 40
        ) {
          break;
        }
        bodyLines.push(nextLine);
        i++;
      }
      result.push({ heading: line, body: bodyLines.join(' ') });
    } else {
      // Regular paragraph (no subheading)
      result.push({ body: line });
      i++;
    }
  }
  return result;
}
