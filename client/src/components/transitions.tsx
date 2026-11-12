// client/src/components/transitions.tsx
// Section transitions modelled on the MotionSites "living portrait" reference.
// Uses framer-motion (already in package.json)
import { useEffect, useRef, type ReactNode } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";

/* 1. FadeIn: whileInView reveal (reference: FadeIn, once, 50px margin) */
export function FadeIn({
  children, delay = 0, duration = 0.7, x = 0, y = 30, className,
}: { children: ReactNode; delay?: number; duration?: number; x?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "50px", amount: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* 2. Sheet: a section with rounded top corners that slides up OVER the previous
      one (reference: Services, Projects use rounded-t-[60px] and a negative top margin) */
export function Sheet({
  children, bg = "#0C0C0C", overlap = false, className = "",
}: { children: ReactNode; bg?: string; overlap?: boolean; className?: string }) {
  return (
    <section
      style={{ background: bg }}
      className={`relative z-10 rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] ${
        overlap ? "-mt-10 sm:-mt-12 md:-mt-14" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

/* 3. StackCard: sticky cards that scale down as the next one covers them */
export function StackCard({
  index, total, progress, children,
}: { index: number; total: number; progress: MotionValue<number>; children: ReactNode }) {
  const targetScale = 1 - (total - 1 - index) * 0.03;
  const scale = useTransform(progress, [index / total, 1], [1, targetScale]);
  return (
    <div className="h-[85vh]">
      <motion.div
        style={{ scale, top: `calc(6rem + ${index * 28}px)` }}
        className="sticky origin-top rounded-[40px] sm:rounded-[50px] md:rounded-[60px] border-2 border-[#D7E2EA] bg-[#0C0C0C] p-4 sm:p-6 md:p-8"
      >
        {children}
      </motion.div>
    </div>
  );
}

export function CardStack({ cards }: { cards: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return (
    <div ref={ref}>
      {cards.map((c, i) => (
        <StackCard key={i} index={i} total={cards.length} progress={scrollYProgress}>{c}</StackCard>
      ))}
    </div>
  );
}

/* 4. ScrollMarquee: rows slide sideways as you scroll, opposite directions */
export function ScrollMarquee({ rows }: { rows: ReactNode[][] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const right = useTransform(scrollYProgress, [0, 1], [-200, 400]);
  const left = useTransform(scrollYProgress, [0, 1], [200, -400]);
  return (
    <div ref={ref} className="overflow-hidden py-10">
      {rows.map((items, r) => (
        <motion.div key={r} style={{ x: r % 2 ? left : right, willChange: "transform" }} className="mb-3 flex w-max gap-3">
          {[...items, ...items, ...items]}
        </motion.div>
      ))}
    </div>
  );
}

/* 5. ScrollText: characters go from 20% to 100% opacity as you scroll past */
export function ScrollText({
  text, className, offset = ["start 0.8", "end 0.2"],
}: { text: string; className?: string; offset?: any }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset });
  const chars = text.split("");
  return (
    <p ref={ref} className={className} aria-label={text}>
      {chars.map((ch, i) => (
        <Char key={i} ch={ch} i={i} n={chars.length} p={scrollYProgress} still={!!reduce} />
      ))}
    </p>
  );
}

function Char({ ch, i, n, p, still }: { ch: string; i: number; n: number; p: MotionValue<number>; still: boolean }) {
  const o = useTransform(p, [i / n, (i + 1) / n], [0.2, 1]);
  return (
    <motion.span aria-hidden style={{ opacity: still ? 1 : o }}>
      {ch}
    </motion.span>
  );
}

/* 6. usePinnedSheets: every ".pin-sheet" section sticks while the next one slides over it.
      Tall sections stick when their bottom reaches the bottom of the screen, so you see
      all of them first. A section that is fully covered is switched off (data-covered)
      so its canvases stop drawing. */
export function usePinnedSheets(selector = ".pin-sheet") {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of els) {
        el.style.top = `${Math.min(0, vh - el.offsetHeight)}px`;
        const next = el.nextElementSibling as HTMLElement | null;
        const covered = !!next && next.getBoundingClientRect().top <= 0;
        if (el.dataset.covered !== String(covered)) el.dataset.covered = String(covered);
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    const ro = new ResizeObserver(schedule);
    els.forEach(el => ro.observe(el));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
      els.forEach(el => { el.style.top = ""; delete el.dataset.covered; });
    };
  }, [selector]);
}