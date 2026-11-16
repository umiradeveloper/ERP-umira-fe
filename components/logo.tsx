/** Tanda merek Umira (bintang tembaga) */
export function Logo({ className = 'size-8' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/umira-mark.png" alt="" aria-hidden="true" className={`${className} shrink-0 object-contain`} />;
}
