import type { ReactNode } from 'react';

export function Hero({ children }: { children: ReactNode }) {
  return (
    <section className="hx" aria-labelledby="hero-h">
      <div className="hx-inner">
        <h1 id="hero-h">Find the right scholarship.</h1>
        <p className="hx-sub">Explore the requirements, prepare your documents, and practise applying before you visit the official portal.</p>
        <div className="hx-search">{children}</div>
      </div>
    </section>
  );
}
