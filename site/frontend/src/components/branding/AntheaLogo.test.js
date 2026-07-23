import fs from 'fs';
import path from 'path';

describe('AntheaLogo branding', () => {
  const root = path.join(__dirname, '../..');
  const logoAsset = path.join(root, 'assets/branding/logo-v1.svg');
  const componentSrc = fs.readFileSync(
    path.join(__dirname, 'AntheaLogo.jsx'),
    'utf8'
  );
  const loginSrc = fs.readFileSync(
    path.join(root, 'pages/LoginPage.jsx'),
    'utf8'
  );
  const registerSrc = fs.readFileSync(
    path.join(root, 'pages/RegisterPage.jsx'),
    'utf8'
  );
  const desktopNavSrc = fs.readFileSync(
    path.join(root, 'components/layout/DesktopNav.jsx'),
    'utf8'
  );
  const indexHtml = fs.readFileSync(
    path.join(root, '../public/index.html'),
    'utf8'
  );

  it('ships logo V1 at the stable branding path', () => {
    expect(fs.existsSync(logoAsset)).toBe(true);
    const svg = fs.readFileSync(logoAsset, 'utf8');
    expect(svg).toMatch(/<svg[\s\S]*viewBox=/i);
    expect(svg).toMatch(/path/i);
  });

  it('exposes AntheaLogo with className, alt Anthea, and contain constraints', () => {
    expect(componentSrc).toContain("alt = 'Anthea'");
    expect(componentSrc).toContain('className');
    expect(componentSrc).toContain('object-contain');
    expect(componentSrc).toContain('shrink-0');
    expect(componentSrc).toContain('max-w-full');
    expect(componentSrc).toContain('logo-v1.svg');
    expect(componentSrc).toContain('invert');
  });

  it('replaces legacy brand marks on login, register and desktop nav', () => {
    expect(loginSrc).toContain('AntheaLogo');
    expect(loginSrc).not.toMatch(/<Dumbbell/);
    expect(registerSrc).toContain('AntheaLogo');
    expect(registerSrc).not.toMatch(/<Dumbbell/);
    expect(desktopNavSrc).toContain('AntheaLogo');
  });

  it('links an SVG favicon without inventing low-quality PWA PNGs', () => {
    expect(indexHtml).toMatch(/rel="icon"[^>]*favicon\.svg|favicon\.svg[^>]*rel="icon"/);
    expect(fs.existsSync(path.join(root, '../public/favicon.svg'))).toBe(true);
    const manifest = fs.readFileSync(
      path.join(root, '../public/manifest.json'),
      'utf8'
    );
    expect(manifest).toContain('/icons/icon-192.png');
    expect(manifest).toContain('/icons/icon-512.png');
  });
});
