/** Screens outside the app shell (only /sign-in for now): centered on the page canvas. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">{children}</main>
  );
}
