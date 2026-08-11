export function HeroContent() {
  return (
    <div className='relative z-10 mx-auto flex w-full max-w-[680px] shrink-0 flex-col items-center px-5 pt-5 text-center sm:px-8 sm:pt-6 md:max-w-[720px] md:pt-7'>
      <h1 className='hero-headline max-w-[17ch] text-[1.625rem] leading-[1.05] font-semibold tracking-[-0.045em] text-zinc-950 sm:text-[2.25rem] md:text-[2.625rem] lg:text-[2.875rem]'>
        <span className='block'>Your money.</span>
        <span className='block text-zinc-500'>Your agent.</span>
        <span className='block'>One intelligent system.</span>
      </h1>

      <p className='hero-description mt-3 max-w-[34rem] text-[13.5px] leading-[1.5] font-normal tracking-[-0.01em] text-zinc-500 sm:mt-[14px] sm:text-[15px] md:text-[15.5px]'>
        Manage money, move money, and give AI agents access to financial infrastructure — securely,
        conversationally, and in one place.
      </p>

      <div className='hero-cta mt-4 flex flex-col items-center gap-2.5 sm:mt-5 sm:flex-row sm:gap-4'>
        <a
          href='#get-started'
          className='inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-6 text-[14px] font-medium tracking-[-0.01em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_22px_rgba(0,0,0,0.09)] transition-opacity hover:opacity-90 sm:h-10 sm:px-7'
        >
          Start with Finora
        </a>
        <a
          href='#product'
          className='inline-flex items-center text-[13.5px] font-medium tracking-[-0.01em] text-zinc-600 transition-colors hover:text-zinc-950'
        >
          Explore the platform
          <span
            aria-hidden
            className='ml-1.5'
          >
            →
          </span>
        </a>
      </div>
    </div>
  );
}
