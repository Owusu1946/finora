import Image from "next/image";

const COMPOSITION_WIDTH = 1215;
const COMPOSITION_HEIGHT = 870;

export function HeroVisual() {
  return (
    <div className="hero-visual relative z-0 -mt-1 flex min-h-0 w-full items-end justify-center overflow-hidden px-4 pb-0 sm:-mt-2 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[8%] top-[10%] bottom-[8%] -z-10 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.08)_0%,transparent_72%)] blur-3xl"
      />

      <div className="relative w-full max-w-[min(94vw,700px)] translate-y-[3%] sm:max-w-[min(88vw,760px)] sm:translate-y-[5%] md:max-w-[800px]">
        <Image
          src="/images/finora/hero-composition.png"
          alt="Finora mobile app with AI agent, MCP, and payment ecosystem around the phone"
          width={COMPOSITION_WIDTH}
          height={COMPOSITION_HEIGHT}
          priority
          sizes="(max-width: 640px) 94vw, (max-width: 1024px) 88vw, 820px"
          className="hero-composition mx-auto h-auto w-full select-none drop-shadow-[0_24px_48px_rgba(0,0,0,0.11)]"
        />
      </div>
    </div>
  );
}
