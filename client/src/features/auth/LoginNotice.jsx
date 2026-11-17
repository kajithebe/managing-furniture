// Red "! …" box under a login form (S2 "Wrong code. 3 tries left.", "Too many codes requested…").
// role="alert" makes screen readers read the message as soon as it appears.
export default function LoginNotice({ children }) {
  return (
    <p role="alert" className="rounded-card bg-danger-bg px-3 py-2 text-sm text-danger">
      ! {children}
    </p>
  );
}
