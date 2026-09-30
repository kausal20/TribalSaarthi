import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useAnimationFrame, useMotionValue } from 'framer-motion';

interface Props<T> {
  items: T[];
  render: (item: T, hidden: boolean) => ReactNode;
  direction?: 'left' | 'right';
  /** Seconds per original item set, independent of viewport width. */
  speed?: number;
  label: string;
  className?: string;
}

/** Transform-only continuous loop. Autoplays by default; keyboard focus keeps items still. */
export function InfiniteMarquee<T>({ items, render, direction = 'left', speed = 36, label, className = '' }: Props<T>) {
  const viewport = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(2);
  const width = useRef(0);
  const focused = useRef(false);
  const hovered = useRef(false);
  const x = useMotionValue(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (!group.current || !viewport.current) return;
      const next = group.current.getBoundingClientRect().width;
      if (!next) return;
      const progress = width.current ? -x.get() / width.current : direction === 'right' ? 1 : 0;
      width.current = next;
      x.set(-progress * next);
      setCopies(Math.max(2, Math.ceil(viewport.current.clientWidth / next) + 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (group.current) observer.observe(group.current);
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [direction, items.length, x]);

  useAnimationFrame((_, delta) => {
    const w = width.current;
    if (focused.current || hovered.current || !w) return;
    const step = w / Math.max(1, speed) * Math.min(delta, 64) / 1000;
    const next = x.get() + (direction === 'left' ? -step : step);
    x.set(-(((-next % w) + w) % w));
  });

  return (
    <div className="mq-shell">
      <div ref={viewport} className={`mq ${className}`} role="group" aria-label={label}
        onFocusCapture={(event) => {
          focused.current = true;
          const target = event.target as HTMLElement;
          const item = target.closest<HTMLElement>('.mq-item');
          if (!item || !viewport.current) return;
          // Bring every original item into view when tabbing, including offscreen items.
          viewport.current.scrollLeft = 0;
          const bounds = viewport.current.getBoundingClientRect();
          const rect = item.getBoundingClientRect();
          const shift = rect.left < bounds.left + 20 ? bounds.left + 20 - rect.left
            : rect.right > bounds.right - 20 ? bounds.right - 20 - rect.right : 0;
          x.set(x.get() + shift);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) focused.current = false;
        }}
        onPointerEnter={() => { hovered.current = true; }}
        onPointerLeave={() => { hovered.current = false; }}>
        <motion.div className="mq-track" style={{ x }}>
          {Array.from({ length: copies }, (_, copy) => (
            <div className="mq-group" ref={copy === 0 ? group : undefined} key={copy} aria-hidden={copy > 0 || undefined}>
              {items.map((item, i) => <div className="mq-item" key={i}>{render(item, copy > 0)}</div>)}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
