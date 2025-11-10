export default function FeedbackPage({ params }: { params: { client: string } }) {
  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Feedback</h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 600 }}>
        We&apos;re gathering feedback for client {params.client}. Let us know what you&apos;d
        like to see improved and we&apos;ll share it with the Dialogue team.
      </p>
    </main>
  );
}
