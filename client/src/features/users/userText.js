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
