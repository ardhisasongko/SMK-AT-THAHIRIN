import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mapsUrl, getCurrentLocation } from '../src/utils/geo';

describe('mapsUrl', () => {
  it('returns correct Google Maps URL', () => {
    expect(mapsUrl(-6.9, 107.6)).toBe('https://www.google.com/maps?q=-6.9,107.6');
  });

  it('handles zero coordinates', () => {
    expect(mapsUrl(0, 0)).toBe('https://www.google.com/maps?q=0,0');
  });

  it('handles negative coordinates', () => {
    expect(mapsUrl(-6.2, -106.8)).toBe('https://www.google.com/maps?q=-6.2,-106.8');
  });
});

describe('getCurrentLocation', () => {
  let mockGetCurrentPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves with coordinates on success', async () => {
    mockGetCurrentPosition.mockImplementation((_success: PositionCallback, _error: PositionErrorCallback, _options: PositionOptions) => {
      _success({
        coords: { latitude: -6.9, longitude: 107.6, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });

    const result = await getCurrentLocation();
    expect(result).toEqual({ lat: -6.9, lng: 107.6 });
  });

  it('rejects when geolocation is not supported', async () => {
    vi.stubGlobal('navigator', {});

    await expect(getCurrentLocation()).rejects.toThrow('Geolokasi tidak didukung');
  });

  it('rejects when permission denied (code 1)', async () => {
    mockGetCurrentPosition.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      }
    );

    await expect(getCurrentLocation()).rejects.toThrow('Izin lokasi ditolak');
  });

  it('rejects when position unavailable (code 2)', async () => {
    mockGetCurrentPosition.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 2, message: 'unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      }
    );

    await expect(getCurrentLocation()).rejects.toThrow('Tidak dapat menentukan posisi');
  });

  it('rejects when timeout (code 3)', async () => {
    mockGetCurrentPosition.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 3, message: 'timeout', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      }
    );

    await expect(getCurrentLocation()).rejects.toThrow('Waktu deteksi lokasi habis');
  });

  it('passes correct options to getCurrentPosition', async () => {
    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 0, longitude: 0, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });

    await getCurrentLocation(5000);

    expect(mockGetCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
});
