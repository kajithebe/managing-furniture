import { useSyncExternalStore } from 'react';

// The borrow request being put together (S3 → S4 → S5), before it is sent.
// Kept in localStorage so it survives a reload, the login redirect and the phone opening a
// scanned QR link in a new tab. Only item codes and display texts are stored; the server checks
// every item again when the request is sent (POST /api/loans).
const KEY = 'mf.borrowDraft';
const listeners = new Set();

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

let items = read();

function write(next) {
  items = next;
  try {
    if (next.length > 0) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked (e.g. private mode); the draft then lives in memory only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// What the form needs from GET /api/items/:code.
export function toDraftItem(item) {
  return {
    code: item.code,
    name: item.name || item.category.name,
    category: item.category.name,
    autoApprove: item.category.autoApprove,
    condition: item.condition,
  };
}

export function isInDraft(code) {
  return items.some((item) => item.code === code);
}

// Returns false when the item is already in the request.
export function addDraftItem(item) {
  if (isInDraft(item.code)) return false;
  write([...items, toDraftItem(item)]);
  return true;
}

export function removeDraftItem(code) {
  write(items.filter((item) => item.code !== code));
}

export function clearDraft() {
  write([]);
}

export function useBorrowDraft() {
  return useSyncExternalStore(subscribe, () => items);
}
