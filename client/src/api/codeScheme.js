// Asset code format API for admins (A1 Settings › Asset codes, MF-21):
// GET and PUT /api/admin/code-scheme, POST /api/admin/code-scheme/preview.
import { api } from './client.js';

// → { scheme, format, defaultScheme, lastChanged }
export function getCodeScheme(options) {
  return api.get('/admin/code-scheme', options);
}

// scheme: { segments, separator, numberLength } → the same reply as getCodeScheme.
export function saveCodeScheme(scheme) {
  return api.put('/admin/code-scheme', scheme);
}

// scheme → { sample, examples, tooLong, overLimit }. Saves nothing and uses up no numbers.
export function previewCodeScheme(scheme, options) {
  return api.post('/admin/code-scheme/preview', scheme, options);
}
