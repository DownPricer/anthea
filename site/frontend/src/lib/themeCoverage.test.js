import fs from 'fs';
import path from 'path';
import { getHeatmapDayStyle } from './heatmapDayStyle';

describe('theme semantic coverage (source)', () => {
  const root = path.join(__dirname, '..');

  function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  }

  test('index.html anti-flash script sets data-theme before paint', () => {
    const html = fs.readFileSync(
      path.join(__dirname, '../../public/index.html'),
      'utf8'
    );
    expect(html).toContain("localStorage.getItem('anthea-color-mode')");
    expect(html).toContain("setAttribute('data-theme'");
    expect(html).toContain('colorScheme');
    expect(html).toContain('theme-color');
  });

  test('index.css defines light and dark semantic tokens', () => {
    const css = read('index.css');
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain('--background:');
    expect(css).toContain('--surface-elevated:');
    expect(css).toContain('--foreground:');
    expect(css).toContain('--chart-grid');
    expect(css).toContain('--chart-axis');
    expect(css).toContain('--chart-tooltip-bg');
    expect(css).toContain('--theme-primary');
  });

  test('layouts and shared chrome use semantic surfaces', () => {
    expect(read('components/layout/AppLayout.jsx')).toContain('bg-background');
    expect(read('components/layout/BottomNav.jsx')).toMatch(/bg-background|bg-nav/);
    expect(read('components/layout/DesktopNav.jsx')).toContain('bg-background');
    expect(read('components/ui/dialog.jsx')).toContain('bg-surface-elevated');
    expect(read('components/ui/drawer.jsx')).toContain('bg-surface-elevated');
    expect(read('components/ui/sonner.jsx')).toContain('colorMode');
    expect(read('components/ui/switch.jsx')).toContain('ring-offset-background');
  });

  test('settings exposes dark/light theme controls', () => {
    const settings = read('pages/SettingsPage.jsx');
    expect(settings).toContain('theme-dark');
    expect(settings).toContain('theme-light');
    expect(settings).toContain('setColorMode');
    expect(settings).toContain('appearance: colorMode');
  });

  test('player and nav do not force hard-coded black page fills', () => {
    expect(read('pages/WorkoutPlayerPage.jsx')).not.toMatch(/bg-\[#0A0A0A\]/);
    expect(read('pages/LoginPage.jsx')).not.toMatch(/bg-\[#0A0A0A\]/);
    expect(read('components/layout/AppLayout.jsx')).not.toMatch(/bg-\[#0A0A0A\]/);
  });

  test('user images are not globally inverted', () => {
    const css = read('index.css');
    expect(css).not.toMatch(/img\s*\{[^}]*filter:\s*invert/s);
  });
});

describe('heatmap theme adaptation', () => {
  test('empty cells use surface token rather than pure black', () => {
    document.documentElement.style.setProperty('--surface-subtle', '#ECEEF2');
    const style = getHeatmapDayStyle({ is_future: false }, {});
    expect(style.kind).toBe('empty');
    expect(style.fill).toBe('#ECEEF2');
    expect(style.fill).not.toBe('#000000');
    expect(style.fill).not.toBe('#ffffff');
  });

  test('completed cells keep accent/partner data colors', () => {
    const style = getHeatmapDayStyle(
      { my_completed: true, partner_completed: false },
      { accentColor: '#06B6D4' }
    );
    expect(style.kind).toBe('solo');
    expect(style.fill).toBe('#06B6D4');
  });
});
