import { FinoraLogo } from "@/components/brand/finora-logo";

const links = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#for-business", label: "For Business" },
  { href: "#developers", label: "Developers" },
] as const;

export function HeroNavigation() {
  return (
    <header className="hero-nav relative z-20 mx-auto flex w-full max-w-[1120px] shrink-0 items-center justify-between px-5 pt-5 sm:px-8 sm:pt-6">
      <FinoraLogo />

      <nav
        className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 lg:flex lg:gap-7"
        aria-label="Primary"
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-[13px] font-medium tracking-[-0.01em] text-zinc-500 transition-colors hover:text-zinc-900 lg:text-[13.5px]"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <a
          href="#login"
          className="inline-flex h-8 items-center justify-center rounded-full border border-zinc-300/90 bg-white px-3.5 text-[12.5px] font-medium tracking-[-0.01em] text-zinc-900 transition-colors hover:border-zinc-400 hover:bg-zinc-50 sm:h-9 sm:px-4 sm:text-[13px]"
        >
          Log in
        </a>
        <a
          href="#get-started"
          className="inline-flex h-8 items-center justify-center rounded-full bg-zinc-950 px-3.5 text-[12.5px] font-medium tracking-[-0.01em] text-white transition-opacity hover:opacity-90 sm:h-9 sm:px-4 sm:text-[13px]"
        >
          Get started
        </a>
      </div>
    </header>
  );
}
