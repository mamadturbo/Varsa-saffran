export type ArticleBlock = { type: 'paragraph'; text: string } | { type: 'heading'; level: 2 | 3 | 4 | 5 | 6; text: string };

export function articleBlocks(content: string): ArticleBlock[] {
  let previousLevel = 1;
  return content.split('\n').map(line => line.trim()).filter(Boolean).map((line): ArticleBlock => {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!heading) return { type: 'paragraph', text: line };
    // The article title is the sole H1. Repair imported Markdown that skips
    // levels instead of creating a second H1 or jumping straight to H4/H6.
    const level = Math.min(Math.max(2, heading[1].length), previousLevel + 1) as 2 | 3 | 4 | 5 | 6;
    previousLevel = level;
    return { type: 'heading', level, text: heading[2] };
  });
}
