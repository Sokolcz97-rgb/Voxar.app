import { Navbar } from "@/components/Navbar";
import { LiveStreamsSection } from "@/components/LiveStreamsSection";
import { SEO } from "@/components/SEO";

const LiveNow = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <SEO
        title="Live Now — StudioVoxario"
        description="Aktuálně živě vysílající streamy z Twitche a YouTube v naší komunitě."
      />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-40" />
      <Navbar />
      <main className="pt-8">
        <div className="container mb-6">
          <h1 className="font-display font-black text-4xl md:text-5xl">
            <span className="bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent text-glow">
              Live Now
            </span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Streamy, které právě probíhají.
          </p>
        </div>
        <LiveStreamsSection />
      </main>
    </div>
  );
};

export default LiveNow;
