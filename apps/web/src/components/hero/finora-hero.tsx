import { HeroContent } from "@/components/hero/hero-content";
import { HeroNavigation } from "@/components/hero/hero-navigation";
import { HeroVisual } from "@/components/hero/hero-visual";

export function FinoraHero() {
  return (
    <section className="relative isolate grid min-h-dvh grid-rows-[auto_auto_1fr] overflow-hidden bg-[#fafafa]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_70%_at_50%_0%,#ffffff_0%,#fafafa_55%,#f3f3f3_100%)]"
      />

      <HeroNavigation />
      <HeroContent />
      <HeroVisual />
    </section>
  );
}
