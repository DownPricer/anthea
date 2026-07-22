/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: false }),
}));

function Probe({ onReady }) {
  const ctx = useTheme();
  React.useEffect(() => {
    onReady(ctx);
  }, [ctx, onReady]);
  return (
    <div>
      <span data-testid="mode">{ctx.colorMode}</span>
      <button type="button" data-testid="to-light" onClick={() => ctx.setColorMode('light')}>
        light
      </button>
      <button type="button" data-testid="to-dark" onClick={() => ctx.setColorMode('dark')}>
        dark
      </button>
    </div>
  );
}

describe('ThemeProvider colorMode', () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  test('defaults to dark and switches to light without reload', () => {
    let latest;
    act(() => {
      root.render(
        <ThemeProvider>
          <Probe onReady={(ctx) => { latest = ctx; }} />
        </ThemeProvider>
      );
    });

    expect(latest.colorMode).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      container.querySelector('[data-testid="to-light"]').click();
    });

    expect(latest.colorMode).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('anthea-color-mode')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');

    act(() => {
      container.querySelector('[data-testid="to-dark"]').click();
    });

    expect(latest.colorMode).toBe('dark');
    expect(localStorage.getItem('anthea-color-mode')).toBe('dark');
  });

  test('restores stored light mode on mount', () => {
    localStorage.setItem('anthea-color-mode', 'light');
    let latest;
    act(() => {
      root.render(
        <ThemeProvider>
          <Probe onReady={(ctx) => { latest = ctx; }} />
        </ThemeProvider>
      );
    });
    expect(latest.colorMode).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
