/**
 * Bulk-migrate hardcoded dark-theme Tailwind classes to semantic tokens.
 * Run: node scripts/migrate-theme-tokens.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

const SKIP = /\.(test|spec)\.(jsx?|tsx?)$/;

/** Order matters: longer / more specific first */
const REPLACEMENTS = [
  // Exact hex backgrounds
  [/bg-\[#0A0A0A\]/g, 'bg-background'],
  [/bg-\[#09090B\]/g, 'bg-background'],
  [/bg-\[#141414\]/g, 'bg-surface-elevated'],
  [/bg-\[#18181C\]/g, 'bg-surface-elevated'],
  [/bg-\[#1C1C1C\]/g, 'bg-surface-subtle'],
  [/bg-\[#111114\]/g, 'bg-surface'],
  [/bg-\[#202025\]/g, 'bg-surface-subtle'],

  // Ring offsets
  [/ring-offset-\[#0A0A0A\]/g, 'ring-offset-background'],
  [/ring-offset-\[#141414\]/g, 'ring-offset-surface'],
  [/ring-offset-\[#09090B\]/g, 'ring-offset-background'],

  // Borders
  [/border-white\/10/g, 'border-border'],
  [/border-white\/5/g, 'border-border'],
  [/border-white\/15/g, 'border-border'],
  [/border-white\/20/g, 'border-border-strong'],
  [/border-white\/25/g, 'border-border-strong'],
  [/border-white\/30/g, 'border-border-strong'],
  [/divide-white\/10/g, 'divide-border'],
  [/divide-white\/5/g, 'divide-border'],

  // Overlays / black surfaces (not status colors)
  [/bg-black\/80/g, 'bg-overlay'],
  [/bg-black\/70/g, 'bg-overlay'],
  [/bg-black\/60/g, 'bg-overlay'],
  [/bg-black\/50/g, 'bg-overlay'],
  [/bg-black\/40/g, 'bg-overlay'],
  [/bg-black\/30/g, 'bg-overlay'],
  // bare bg-black only as page/surface (leave bg-black/90 sparingly → overlay)
  [/bg-black\/90/g, 'bg-overlay'],
  [/hover:bg-black\/80/g, 'hover:bg-overlay'],

  // White translucency → semantic hover/active/subtle
  [/hover:bg-white\/10/g, 'hover:bg-active'],
  [/hover:bg-white\/5/g, 'hover:bg-hover'],
  [/hover:bg-white\/15/g, 'hover:bg-active'],
  [/hover:bg-white\/20/g, 'hover:bg-active'],
  [/bg-white\/10/g, 'bg-active'],
  [/bg-white\/5/g, 'bg-hover'],
  [/bg-white\/\[0\.04\]/g, 'bg-hover'],
  [/bg-white\/\[0\.06\]/g, 'bg-hover'],
  [/bg-white\/\[0\.08\]/g, 'bg-hover'],
  [/bg-white\/15/g, 'bg-active'],
  [/bg-white\/20/g, 'bg-active'],
  [/bg-white\/30/g, 'bg-active'],

  // Text zinc / gray
  [/text-zinc-200/g, 'text-foreground'],
  [/text-zinc-300/g, 'text-muted'],
  [/text-zinc-400/g, 'text-muted'],
  [/text-zinc-500/g, 'text-subtle'],
  [/text-zinc-600/g, 'text-subtle'],
  [/text-zinc-700/g, 'text-subtle'],
  [/text-gray-200/g, 'text-foreground'],
  [/text-gray-300/g, 'text-muted'],
  [/text-gray-400/g, 'text-muted'],
  [/text-gray-500/g, 'text-subtle'],
  [/placeholder:text-zinc-500/g, 'placeholder:text-subtle'],
  [/placeholder:text-zinc-400/g, 'placeholder:text-subtle'],
  [/placeholder-zinc-500/g, 'placeholder-subtle'],
  [/placeholder-zinc-400/g, 'placeholder-subtle'],

  // bg zinc
  [/bg-zinc-900\/80/g, 'bg-surface-elevated'],
  [/bg-zinc-900\/50/g, 'bg-surface'],
  [/bg-zinc-900/g, 'bg-surface-elevated'],
  [/bg-zinc-800/g, 'bg-surface-subtle'],
  [/bg-zinc-700/g, 'bg-surface-subtle'],
  [/border-zinc-800/g, 'border-border'],
  [/border-zinc-700/g, 'border-border'],
  [/border-zinc-600/g, 'border-border-strong'],

  // Common text-white → foreground (btn-primary keeps its own color via CSS)
  // Do NOT replace text-white inside strings that are for badge rarity etc.
];

// Safer text-white: only replace when not on colored status / amber live bars
function replaceTextWhite(content) {
  // Skip lines that are clearly on brand/colored backgrounds if heavily contextual —
  // for bulk pass, convert most text-white to text-foreground; btn-primary CSS sets color.
  return content.replace(/(?<![\w-])text-white(?!\/)/g, 'text-foreground');
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full, files);
    } else if (/\.(jsx?|tsx?)$/.test(entry.name) && !SKIP.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

let changedFiles = 0;
let totalReplacements = 0;

for (const file of walk(SRC)) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  for (const [pattern, replacement] of REPLACEMENTS) {
    const before = content;
    content = content.replace(pattern, replacement);
    if (content !== before) {
      const matches = before.match(pattern);
      totalReplacements += matches ? matches.length : 1;
    }
  }

  const beforeWhite = content;
  content = replaceTextWhite(content);
  if (content !== beforeWhite) {
    const m = beforeWhite.match(/(?<![\w-])text-white(?!\/)/g);
    totalReplacements += m ? m.length : 0;
  }

  // Bare bg-black / bg-white as page fills
  content = content.replace(/(?<![\w/-])bg-black(?![\/\w-])/g, 'bg-background');
  // bg-white alone (cards) — careful with icons; convert to surface
  content = content.replace(/(?<![\w/-])bg-white(?![\/\w-\[\]])/g, 'bg-surface');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles += 1;
    console.log('updated', path.relative(SRC, file));
  }
}

console.log(`Done. ${changedFiles} files, ~${totalReplacements} pattern hits.`);
