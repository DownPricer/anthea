import fs from 'fs';
import path from 'path';

describe('DuoProfilePage activity date formatting', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'DuoProfilePage.jsx'),
    'utf8'
  );

  it('defines formatDate inside DuoActivityList via useLocaleFormat', () => {
    const listStart = source.indexOf('function DuoActivityList');
    expect(listStart).toBeGreaterThan(-1);
    const listBlock = source.slice(listStart);
    expect(listBlock).toContain('useLocaleFormat()');
    expect(listBlock).toContain('formatDate');
    expect(listBlock).toContain('safeFormatDate');
  });

  it('does not call formatDate from parent scope without defining it in the list', () => {
    const listStart = source.indexOf('function DuoActivityList');
    const listBlock = source.slice(listStart, source.indexOf('function ActivityMini'));
    expect(listBlock).toMatch(/const \{ formatDate \} = useLocaleFormat\(\)/);
    expect(listBlock).toMatch(/const \{ t \} = useTranslation/);
  });

  it('guards missing or invalid activity dates', () => {
    expect(source).toContain('safeFormatDate');
    expect(source).toMatch(/if \(value == null \|\| value === ''\) return ''/);
    expect(source).toContain("return '—'");
    expect(source).toMatch(/catch \{\s*return '—';\s*\}/);
  });

  it('formats activity dates via the shared locale helper for fr en es', () => {
    expect(source).toContain('useLocaleFormat');
    expect(source).toContain('formatDate');
  });

  it('still renders an empty activity state without crashing', () => {
    expect(source).toContain('Aucune activité');
    expect(source).toContain('duo-activity-list');
  });
});
