// Words shown for users on A2 and in the P15 / P16 pop-ups.
export const ROLES = [
  { value: 'USER', label: 'User' },
  { value: 'MODERATOR', label: 'Moderator' },
  { value: 'ADMIN', label: 'Admin' },
];

export const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DEACTIVATED', label: 'Deactivated' },
];

const ROLE_LABELS = Object.fromEntries(ROLES.map((role) => [role.value, role.label]));

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? role;
}

export function deactivateText(user) {
  const question = `Deactivate ${user.name}? They can't log in until reactivated.`;
  if (user.openLoans === 0) {
    return question;
  }
  const loans =
    user.openLoans === 1
      ? 'Their 1 open loan stays visible to moderators.'
      : `Their ${user.openLoans} open loans stay visible to moderators.`;
  return `${question} ${loans}`;
}

const MODERATOR_CAN = [
  'Borrow and return furniture',
  'Approve requests and follow up late items',
  'Manage items, labels and reports',
  'Add categories, brands, colours and locations',
];

export const ROLE_ABILITIES = {
  USER: { intro: 'A User can:', items: ['Borrow and return furniture', 'See their own loans'] },
  MODERATOR: { intro: 'A Moderator can:', items: MODERATOR_CAN },
  ADMIN: {
    intro: 'An Admin can:',
    items: [...MODERATOR_CAN, 'Change settings and asset codes', 'Add users and change roles'],
  },
};

// View history lines. No design for the history list (needs team agreement).
export function historyText(entry) {
  switch (entry.action) {
    case 'create':
      return `Added as ${roleLabel(entry.after?.role)}`;
    case 'role_change':
      return `Role changed from ${roleLabel(entry.before?.role)} to ${roleLabel(entry.after?.role)}`;
    case 'deactivate':
      return 'Deactivated';
    case 'reactivate':
      return 'Reactivated';
    default:
      return entry.action;
  }
}
