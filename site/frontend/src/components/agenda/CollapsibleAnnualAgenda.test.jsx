import fs from 'fs';
import path from 'path';

describe('CollapsibleAnnualAgenda', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'CollapsibleAnnualAgenda.jsx'),
    'utf8'
  );
  const duoPage = fs.readFileSync(
    path.join(__dirname, '../../pages/DuoPage.jsx'),
    'utf8'
  );
  const solo = fs.readFileSync(
    path.join(__dirname, '../duo/SoloDashboard.jsx'),
    'utf8'
  );

  it('starts closed by default', () => {
    expect(source).toContain('defaultOpen = false');
    expect(source).toContain('useState(defaultOpen)');
  });

  it('exposes a compact yearly agenda toggle with Calendar icon', () => {
    expect(source).toContain('annual-agenda-toggle');
    expect(source).toMatch(/Calendar/);
  });

  it('reuses AnnualHeatmap instead of duplicating the calendar', () => {
    expect(source).toContain('AnnualHeatmap');
    expect(source).toContain('annual-agenda-panel');
  });

  it('is used in Duo history after the session list', () => {
    expect(duoPage).toContain('CollapsibleAnnualAgenda');
    expect(duoPage).toContain('duo-history-list');
    const historyIdx = duoPage.indexOf('duo-history-list');
    const agendaIdx = duoPage.indexOf('CollapsibleAnnualAgenda', historyIdx);
    expect(agendaIdx).toBeGreaterThan(historyIdx);
    expect(duoPage).toContain('defaultOpen={false}');
  });

  it('is collapsed by default in Solo history and overview', () => {
    expect(solo).toContain('CollapsibleAnnualAgenda');
    expect(solo).toContain('defaultOpen={false}');
    expect(solo).not.toMatch(/<AnnualHeatmap[\s\S]*defaultOpen=\{true\}/);
  });
});
