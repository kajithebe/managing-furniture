import { describe, expect, it } from 'vitest';
import { itemQrUrl, qrDataUrl, roomQrUrl } from '../src/services/qrService.js';

// BASE_URL is http://localhost:5173 in vitest.config.js.

describe('itemQrUrl', () => {
  it('points to the item page on BASE_URL', () => {
    expect(itemQrUrl('MP-00123')).toBe('http://localhost:5173/i/MP-00123');
  });

  it('encodes characters that would break the link', () => {
    expect(itemQrUrl('KAR/CHR/00124')).toBe('http://localhost:5173/i/KAR%2FCHR%2F00124');
  });
});

describe('roomQrUrl', () => {
  it('points to the room page with the token, not the room name', () => {
    expect(roomQrUrl('Ab3_x-9QwErTy1Z2')).toBe('http://localhost:5173/r/Ab3_x-9QwErTy1Z2');
  });
});

describe('qrDataUrl', () => {
  it('returns an SVG image as a data: URL', async () => {
    const url = await qrDataUrl(itemQrUrl('MP-00123'));
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);

    const svg = Buffer.from(url.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('<svg');
    // Dark modules use the ink colour from 03-design-system.
    expect(svg.toLowerCase()).toContain('#243b3a');
  });

  it('gives the same image for the same text', async () => {
    const text = itemQrUrl('MP-00123');
    expect(await qrDataUrl(text)).toBe(await qrDataUrl(text));
  });
});
