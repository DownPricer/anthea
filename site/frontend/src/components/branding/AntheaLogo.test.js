import fs from 'fs';
import path from 'path';

describe('AntheaLogo branding', () => {
  const root = path.join(__dirname, '../..');
  const logoAsset = path.join(root, 'assets/branding/logo-v1.png');
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

  it('ships logo V1 PNG at the stable branding path', () => {
    expect(fs.existsSync(logoAsset)).toBe(true);
    const buf = fs.readFileSync(logoAsset);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it('exposes AntheaLogo with className, alt Anthea, and contain constraints', () => {
    expect(componentSrc).toContain("alt = 'Anthea'");
    expect(componentSrc).toContain('className');
    expect(componentSrc).toContain('object-contain');
    expect(componentSrc).toContain('shrink-0');
    expect(componentSrc).toContain('max-w-full');
    expect(componentSrc).toContain('logo-v1.png');
    expect(componentSrc).not.toContain('logo-v1.svg');
  });

  it('replaces legacy brand marks on login, register and desktop nav', () => {
    expect(loginSrc).toContain('AntheaLogo');
    expect(loginSrc).not.toMatch(/<Dumbbell/);
    expect(registerSrc).toContain('AntheaLogo');
    expect(registerSrc).not.toMatch(/<Dumbbell/);
    expect(desktopNavSrc).toContain('AntheaLogo');
  });

  it('links a PNG favicon without inventing low-quality PWA icons', () => {
    expect(indexHtml).toMatch(/favicon\.png/);
    expect(fs.existsSync(path.join(root, '../public/favicon.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, '../public/favicon.svg'))).toBe(false);
    const manifest = fs.readFileSync(
      path.join(root, '../public/manifest.json'),
      'utf8'
    );
    expect(manifest).toContain('/icons/icon-192.png');
    expect(manifest).toContain('/icons/icon-512.png');
  });
});
