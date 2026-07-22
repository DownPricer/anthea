import fs from 'fs';
import path from 'path';

describe('AnnualHeatmap', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'AnnualHeatmap.jsx'),
    'utf8'
  );

  it('imports Loader2 from lucide-react (prevents runtime crash)', () => {
    expect(source).toMatch(/import\s*\{[^}]*Loader2[^}]*\}\s*from\s*['"]lucide-react['"]/);
  });

  it('imports Download from lucide-react', () => {
    expect(source).toMatch(/import\s*\{[^}]*Download[^}]*\}\s*from\s*['"]lucide-react['"]/);
  });

  it('renders a loading test id for the spinner state', () => {
    expect(source).toContain('annual-heatmap-loading');
    expect(source).toContain('<Loader2');
  });

  it('guards against null/undefined day data', () => {
    expect(source).toContain('safeDayMap');
    expect(source).toMatch(/!Array\.isArray\(initialDays\)|Array\.isArray\(initialDays\)/);
  });

  it('constrains root width to prevent horizontal overflow', () => {
    expect(source).toMatch(/data-testid="annual-heatmap"/);
    expect(source).toMatch(/w-full max-w-full min-w-0 overflow-hidden/);
  });

  it('wraps long selected-day titles in a constrained detail panel', () => {
    expect(source).toContain('annual-heatmap-day-detail');
    expect(source).toMatch(
      /annual-heatmap-day-detail[\s\S]*?w-full max-w-full min-w-0 overflow-hidden/
    );
    expect(source).toContain('break-words');
    expect(source).toContain('line-clamp-3');
    expect(source).toContain('annual-heatmap-session-title');
    expect(source).toContain('line-clamp-2');
    expect(source).toContain('[overflow-wrap:anywhere]');
  });

  it('does not render session names inside heatmap cells', () => {
    expect(source).not.toMatch(/agenda-day-title/);
    expect(source).toMatch(/sr-only[\s\S]*?séances/);
  });


  it('keeps year navigation arrows shrink-0 when enabled', () => {
    expect(source).toContain('annual-heatmap-prev-year');
    expect(source).toContain('annual-heatmap-next-year');
    expect(source).toMatch(/shrink-0/);
  });
});
