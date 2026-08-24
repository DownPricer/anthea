import fs from 'fs';
import path from 'path';

describe('PostCard comment multiline rendering', () => {
  const source = fs.readFileSync(path.join(__dirname, 'PostCard.jsx'), 'utf8');

  it('preserves newline formatting on root comments and replies', () => {
    expect(source).toContain("data-testid={isReply ? 'comment-reply' : 'comment-root'}");
    expect(source).toMatch(
      /whitespace-pre-wrap break-words">\{comment\.text\}<\/span>/
    );
    expect(source).not.toContain('dangerouslySetInnerHTML');
  });

  it('keeps comment text as plain content without HTML conversion', () => {
    expect(source).not.toMatch(/comment\.text[\s\S]*dangerouslySetInnerHTML/);
    expect(source).not.toMatch(/replace\([^)]*\\n/);
  });
});
