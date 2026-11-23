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

// P16: "Deactivate Aino Virtanen? She can't log in until reactivated. Her 1 open loan stays
// visible to moderators." We don't know a user's pronoun, so "They" / "Their" is used, the
// count gets a plural, and the loan sentence is left out with no open loans (03 › wording
// that can go wrong with real data; needs team agreement).
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

// P15: "A Moderator can:" and the list under it. The Moderator list is the P15 design; the User
// and Admin lists follow 01 › Roles and permissions (no design; needs team agreement).
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
