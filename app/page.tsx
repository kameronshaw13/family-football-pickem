import Image from "next/image";

export default function HomePage() {
  return <main className="universal-auth-page">
    <section className="universal-auth-card">
      <Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority />
      <span className="universal-eyebrow">UNIVERSAL APP</span>
      <h1>Build verification</h1>
      <p>The universal product shell is being verified.</p>
    </section>
  </main>;
}
