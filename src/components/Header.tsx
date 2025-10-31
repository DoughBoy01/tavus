import { memo } from "react";

export const Header = memo(() => {
  return (
    <header className="flex w-full items-start justify-between" style={{ fontFamily: 'Inter, sans-serif' }}>
      <img
        src="/images/logo.svg"
        alt="Tavus"
        className="relative h-6 sm:h-10"
      />
      {/* Settings button removed */}
    </header>
  );
});