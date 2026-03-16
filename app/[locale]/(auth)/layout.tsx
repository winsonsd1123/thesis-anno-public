export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg-subtle)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface)",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border)",
          padding: 40,
        }}
      >
        {children}
      </div>
    </div>
  );
}
