import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../src/utils/escape.js';

describe('escapeHtml', () => {
  it('leaves normal text unchanged', () => {
    expect(escapeHtml('Group work in D751')).toBe('Group work in D751');
  });

  it('escapes a script tag so it shows as plain text', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes ampersands and both kinds of quotes', () => {
    expect(escapeHtml(`Tom & "Anna's" team`)).toBe('Tom &amp; &quot;Anna&#39;s&quot; team');
  });

  it('does not escape twice in one call', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('returns an empty string for null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('turns numbers into text', () => {
    expect(escapeHtml(5)).toBe('5');
  });
});
