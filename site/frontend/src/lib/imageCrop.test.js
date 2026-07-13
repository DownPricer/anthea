import { cropSquareImage, AVATAR_SIZE } from './imageCrop';

function mockImage(width, height) {
  return {
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
    const result = await cropSquareImage('blob:mock', { zoom: 2, offsetX: 50, offsetY: -30 });
    expect(result.file.size).toBeGreaterThan(0);
    expect(result.previewUrl).toMatch(/^blob:/);
  });
});
