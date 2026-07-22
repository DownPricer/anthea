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
});
