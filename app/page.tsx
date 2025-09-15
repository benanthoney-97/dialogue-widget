// app/page.tsx

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        background: "#f8f7f3",
        padding: 16,
      }}
    >
      <p
        style={{
          fontSize: 16,
          color: "#444",
          textAlign: "center",
          lineHeight: 1.5,
          width: "100vh",
        }}
      >
        If you'd like to work with <strong>Dialogue</strong>, visit our website at{" "}
        <a
          href="https://dialogue-ai.co"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#2563eb", fontWeight: 600 }}
        >
          dialogue-ai.co
        </a>{" "}
        :)
      </p>
    </main>
  );
}
