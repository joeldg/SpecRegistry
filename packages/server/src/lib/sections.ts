export interface MarkdownSection {
  section: string;
  anchor: string;
  text: string;
}

export function sectionAnchor(section: string): string {
  const base = section
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "intro";
}

/** Split markdown into sections at h1-h3 boundaries for indexing and citations. */
export function splitSections(content: string): MarkdownSection[] {
  const chunks: MarkdownSection[] = [];
  let current = { section: "(intro)", text: "" };
  let inFence = false;
  for (const line of content.split("\n")) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    const match = !inFence && /^#{1,3}\s+(.+?)\s*$/.exec(line);
    if (match) {
      if (current.text.trim()) {
        chunks.push({ ...current, anchor: sectionAnchor(current.section), text: current.text.trim() });
      }
      current = { section: match[1], text: "" };
    } else {
      current.text += line + "\n";
    }
  }
  if (current.text.trim()) {
    chunks.push({ ...current, anchor: sectionAnchor(current.section), text: current.text.trim() });
  }
  return chunks;
}
