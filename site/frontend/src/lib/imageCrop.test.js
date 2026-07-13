import { computeCropSourceRect, cropSquareImage, AVATAR_SIZE } from './imageCrop';

function mockImage(width, height) {
  return {
    naturalWidth: width,
    naturalHeight: height,
    width,
    height,
    onload: null,
    onerror: null,
    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    },
    get src() {
      return this._src;
    },
  };
}

beforeEach(() => {
  global.URL.createObjectURL = jest.fn(() => 'blob:preview-mock');
  global.URL.revokeObjectURL = jest.fn();

  global.Image = class {
    constructor() {
      return mockImage(800, 600);
    }
  };

  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    drawImage: jest.fn(),
  }));

  HTMLCanvasElement.prototype.toBlob = jest.fn(function (cb, type) {
    cb(new Blob(['webp-bytes'], { type: type || 'image/webp' }));
  });
});

describe('computeCropSourceRect', () => {
  it('déplace la zone source horizontalement', () => {
    const center = computeCropSourceRect(800, 600, 280, 1, 0, 0);
    const shifted = computeCropSourceRect(800, 600, 280, 1, 50, 0);
    expect(shifted.sx).not.toBe(center.sx);
  });

  it('déplace la zone source verticalement', () => {
    const center = computeCropSourceRect(800, 600, 280, 1, 0, 0);
    const shifted = computeCropSourceRect(800, 600, 280, 1, 0, 40);
    expect(shifted.sy).not.toBe(center.sy);
  });

  it('réduit la zone source avec le zoom', () => {
    const z1 = computeCropSourceRect(800, 600, 280, 1, 0, 0);
    const z2 = computeCropSourceRect(800, 600, 280, 2, 0, 0);
    expect(z2.sw).toBeLessThan(z1.sw);
    expect(z2.sh).toBeLessThan(z1.sh);
  });

  it('garde le rectangle dans les limites de l\'image', () => {
    const rect = computeCropSourceRect(800, 600, 280, 2.5, 120, -80);
    expect(rect.sx).toBeGreaterThanOrEqual(0);
    expect(rect.sy).toBeGreaterThanOrEqual(0);
    expect(rect.sx + rect.sw).toBeLessThanOrEqual(800);
    expect(rect.sy + rect.sh).toBeLessThanOrEqual(600);
  });
});

describe('cropSquareImage', () => {
  it('produit un fichier 512×512 en webp', async () => {
    const result = await cropSquareImage('blob:mock', { zoom: 1, offsetX: 0, offsetY: 0 });

    expect(result.width).toBe(AVATAR_SIZE);
    expect(result.height).toBe(AVATAR_SIZE);
    expect(result.mimeType).toBe('image/webp');
    expect(result.file).toBeInstanceOf(File);
    expect(result.file.type).toBe('image/webp');
    expect(result.file.name).toMatch(/^avatar-\d+\.webp$/);
    expect(result.blob.type).toBe('image/webp');
  });

  it('utilise le blob recadré, pas le fichier original', async () => {
    const original = new File(['orig'], 'orig.jpg', { type: 'image/jpeg' });
    const result = await cropSquareImage('blob:mock', { zoom: 2, offsetX: 50, offsetY: -30 });
    expect(result.file).not.toBe(original);
    expect(result.file.size).toBeGreaterThan(0);
    expect(result.previewUrl).toMatch(/^blob:/);
  });

  it('test quatre couleurs — déplacement modifie la zone source recadrée', async () => {
    global.Image = class {
      constructor() {
        return mockImage(400, 400);
      }
    };

    const center = await cropSquareImage('blob:quad', { zoom: 1, offsetX: 0, offsetY: 0 });
    const topLeft = await cropSquareImage('blob:quad', { zoom: 2, offsetX: -80, offsetY: -80 });

    expect(center.cropRect.sx).not.toBe(topLeft.cropRect.sx);
    expect(center.cropRect.sy).not.toBe(topLeft.cropRect.sy);
    expect(Math.abs(topLeft.cropRect.sx - center.cropRect.sx)).toBeGreaterThan(0);
    expect(Math.abs(topLeft.cropRect.sy - center.cropRect.sy)).toBeGreaterThan(0);
  });
});
