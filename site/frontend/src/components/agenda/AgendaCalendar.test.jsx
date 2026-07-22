import fs from 'fs';
import path from 'path';

describe('AgendaCalendar overflow guards', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'AgendaCalendar.jsx'),
    'utf8'
  );
  const css = fs.readFileSync(
    path.join(__dirname, '../../index.css'),
    'utf8'
  );

  it('constrains the root container width', () => {
    expect(source).toMatch(/agenda-calendar-root[^"]*w-full/);
    expect(source).toContain('max-w-full');
    expect(source).toContain('min-w-0');
    expect(source).toContain('overflow-hidden');
  });

  it('uses a 7-column fluid day grid', () => {
    expect(source).toContain('agenda-day-grid');
    expect(css).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))');
  });

  it('keeps day cells shrinkable', () => {
    expect(source).toMatch(/cell:[\s\S]*min-w-0/);
    expect(source).toMatch(/day:[\s\S]*min-w-0/);
    expect(source).toMatch(/day:[\s\S]*max-w-full/);
  });

  it('does not render session names inside calendar cells', () => {
    expect(source).not.toContain('agenda-day-title');
    expect(source).not.toMatch(/sessionTitles\[0\]/);
    expect(source).toContain('agenda-day-count');
    expect(source).toMatch(/sessionCount > 1/);
  });

  it('keeps month navigation arrows accessible', () => {
    expect(source).toMatch(/caption:[\s\S]*justify-between/);
    expect(source).toMatch(/nav_button:[\s\S]*shrink-0/);
    expect(source).toMatch(/caption_label:[\s\S]*truncate/);
  });

  it('does not use fixed day cell widths that overflow mobile', () => {
    expect(source).not.toMatch(/day:[\s\S]*\bw-11\b/);
    expect(source).not.toMatch(/head_cell:[\s\S]*\bw-11\b/);
  });
});
