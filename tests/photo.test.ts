import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/utils/auth', () => ({
  authHeaders: (extra: Record<string, string>) => extra,
}));

import { compressImage, uploadPhoto } from '../src/utils/photo';

class MockFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(_file: Blob) {
    this.result = 'data:image/jpeg;base64,fakedata';
    queueMicrotask(() => this.onload?.());
  }
}

class MockImage {
  width = 0;
  height = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_val: string) {
    queueMicrotask(() => this.onload?.());
  }
}

let origFileReader: typeof globalThis.FileReader;
let origImage: typeof globalThis.Image;

beforeEach(() => {
  origFileReader = globalThis.FileReader;
  origImage = globalThis.Image;
  (globalThis as any).FileReader = MockFileReader;
  (globalThis as any).Image = MockImage;
});

afterEach(() => {
  (globalThis as any).FileReader = origFileReader;
  (globalThis as any).Image = origImage;
  vi.restoreAllMocks();
});

function createMockFile(): File {
  const blob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

describe('compressImage', () => {
  it('returns a Blob when canvas works', async () => {
    const fakeBlob = new Blob(['fake'], { type: 'image/jpeg' });
    const fakeToBlob = vi.fn((cb: BlobCallback) => cb(fakeBlob));

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: vi.fn(),
          }),
          toBlob: fakeToBlob,
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement.bind(document)(tag);
    });

    const file = createMockFile();
    const result = await compressImage(file, 800, 0.6);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/jpeg');
  });

  it('rejects when canvas context is null', async () => {
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => null,
          toBlob: vi.fn(),
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement.bind(document)(tag);
    });

    const file = createMockFile();
    await expect(compressImage(file)).rejects.toThrow('Canvas tidak didukung');
  });

  it('scales down large images correctly', async () => {
    const fakeBlob = new Blob(['fake'], { type: 'image/jpeg' });
    let capturedWidth = 0;
    let capturedHeight = 0;

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          get width() { return capturedWidth; },
          set width(v: number) { capturedWidth = v; },
          get height() { return capturedHeight; },
          set height(v: number) { capturedHeight = v; },
          getContext: () => ({
            drawImage: vi.fn(),
          }),
          toBlob: vi.fn((cb: BlobCallback) => cb(fakeBlob)),
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement.bind(document)(tag);
    });

    // Mock Image to return 2000x1000
    const OrigImage = (globalThis as any).Image;
    (globalThis as any).Image = class {
      width = 2000;
      height = 1000;
      onload: (() => void) | null = null;
      set src(_v: string) { queueMicrotask(() => this.onload?.()); }
    };

    const file = createMockFile();
    await compressImage(file, 800, 0.6);

    expect(capturedWidth).toBe(800);
    expect(capturedHeight).toBe(400);

    (globalThis as any).Image = OrigImage;
  });

  it('does not upscale small images', async () => {
    const fakeBlob = new Blob(['fake'], { type: 'image/jpeg' });
    let capturedWidth = 0;
    let capturedHeight = 0;

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          get width() { return capturedWidth; },
          set width(v: number) { capturedWidth = v; },
          get height() { return capturedHeight; },
          set height(v: number) { capturedHeight = v; },
          getContext: () => ({
            drawImage: vi.fn(),
          }),
          toBlob: vi.fn((cb: BlobCallback) => cb(fakeBlob)),
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement.bind(document)(tag);
    });

    const OrigImage = (globalThis as any).Image;
    (globalThis as any).Image = class {
      width = 400;
      height = 300;
      onload: (() => void) | null = null;
      set src(_v: string) { queueMicrotask(() => this.onload?.()); }
    };

    const file = createMockFile();
    await compressImage(file, 800, 0.6);

    expect(capturedWidth).toBe(400);
    expect(capturedHeight).toBe(300);

    (globalThis as any).Image = OrigImage;
  });
});

describe('uploadPhoto', () => {
  let canvasSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const fakeBlob = new Blob(['fake'], { type: 'image/jpeg' });
    canvasSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: vi.fn(),
          }),
          toBlob: vi.fn((cb: BlobCallback) => cb(fakeBlob)),
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement.bind(document)(tag);
    });
  });

  afterEach(() => {
    canvasSpy.mockRestore();
  });

  it('returns url on successful upload', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, id: 'photo-1', url: '/api/photo/photo-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    vi.stubGlobal('fetch', mockFetch);

    const file = createMockFile();
    const result = await uploadPhoto(file);

    expect(result).toBe('/api/photo/photo-1');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('?id=photo-1');
  });

  it('returns null when full upload fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    }));

    const file = createMockFile();
    const result = await uploadPhoto(file);

    expect(result).toBeNull();
  });

  it('returns url even when thumb upload fails (best-effort)', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, id: 'photo-2', url: '/api/photo/photo-2' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false }),
      });

    vi.stubGlobal('fetch', mockFetch);

    const file = createMockFile();
    const result = await uploadPhoto(file);

    expect(result).toBe('/api/photo/photo-2');
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const file = createMockFile();
    const result = await uploadPhoto(file);

    expect(result).toBeNull();
  });
});
