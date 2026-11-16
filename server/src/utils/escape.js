// Makes user text safe to put into HTML emails (02 › Security, XSS).
// Names, reasons and notes are typed by people, so they can contain < > & or quotes.
// Every template in src/mail/ passes user text through escapeHtml before adding it to HTML.
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Returns the text with the five special HTML characters replaced.
// null and undefined become an empty string, numbers become text.
export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}
