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
