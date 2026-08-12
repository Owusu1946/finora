type FinoraLogoProps = {
  className?: string;
  tone?: 'dark' | 'light';
};

export function FinoraLogo({ className = '', tone = 'dark' }: FinoraLogoProps) {
  return (
    <a
      href='/'
      className={`inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-[0.08em] ${tone === 'light' ? 'text-white' : 'text-zinc-950'} ${className}`}
      aria-label='Finora home'
    >
      <svg
        width='22'
        height='22'
        viewBox='0 0 34 34'
        fill='none'
        aria-hidden
        className='size-[22px] shrink-0'
      >
        <path
          d='M11.4 5.8C7.7 7.3 5.2 10.9 5.2 15s2.5 7.7 6.2 9.2l2.7-4.1c-2.2-.8-3.7-2.8-3.7-5.1s1.5-4.3 3.7-5.1z'
          fill='currentColor'
        />
        <path
          d='M22.6 28.2c3.7-1.5 6.2-5.1 6.2-9.2s-2.5-7.7-6.2-9.2l-2.7 4.1c2.2.8 3.7 2.8 3.7 5.1s-1.5 4.3-3.7 5.1z'
          fill='currentColor'
        />
        <circle
          cx='17'
          cy='17'
          r='2.8'
          fill='currentColor'
        />
      </svg>
      <span>FINORA</span>
    </a>
  );
}
