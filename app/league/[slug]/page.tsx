import Link from "next/link";

export default async function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="universal-auth-page">
    <section className="universal-auth-card">
      <span className="universal-eyebrow">LEAGUE READY</span>
      <h1>{slug.replace(/-/g, " ")}</h1>
      <p>This is where the existing Pick&apos;em experience connects after the universal account and setup layer.</p>
      <Link className="universal-primary-link" href="/">Back to My Leagues</Link>
    </section>
  </main>;
}
