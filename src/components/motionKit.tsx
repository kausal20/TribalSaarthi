import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** Fades and lifts children in once when they scroll into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Reveals text character by character. Shows the full text immediately for reduced-motion users. */
export function Typewriter({ text, speed = 12, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) {
      onDone?.();
      return;
    }
    setN(0);
    const step = Math.max(1, Math.ceil(text.length / 160));
    const t = setInterval(() => {
      setN((c) => {
        const next = Math.min(text.length, c + step);
        if (next >= text.length) clearInterval(t);
        return next;
      });
    }, speed);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduce, speed]);
  useEffect(() => {
    if (n >= text.length) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, text.length]);
  return (
    <>
      <span aria-hidden={n < text.length}>{text.slice(0, n)}</span>
      {n < text.length && <span className="caret" aria-hidden="true" />}
      {n < text.length && <span className="sr-only">{text}</span>}
    </>
  );
}

export const ease = [0.22, 1, 0.36, 1] as const;
