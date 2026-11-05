import { useRef, type CSSProperties, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import "./AboutSection.css";

type AboutSectionProps = {
  text: string;
  email: string;
  /** Four of Sunny's own pieces, shown floating in the corners. */
  corners: [string, string, string, string];
};

const EASE = [0.25, 0.1, 0.25, 1] as const;

/** Fades and slides its children in once, the first time they scroll into view. */
function FadeIn({
  children,
  delay = 0,
  duration = 0.7,
  x = 0,
  y = 30,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduced ? false : { opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "50px", amount: 0 }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function Char({
  char,
  progress,
  range,
}: {
  char: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.2, 1]);
  return <motion.span style={{ opacity }}>{char}</motion.span>;
}

/** Each character brightens from 20% to 100% as the paragraph scrolls through the viewport. */
function AnimatedText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.2"],
  });

  const words = text.split(" ");
  const total = text.length;
  let cursor = 0;

  return (
    <p ref={ref} className="about-me__text" aria-label={text}>
      {words.map((word, w) => {
        const start = cursor;
        cursor += word.length + 1;
        return (
          <span key={w} className="about-me__word" aria-hidden="true">
            {word.split("").map((char, c) => {
              const i = start + c;
              return reduced ? (
                <span key={c}>{char}</span>
              ) : (
                <Char
                  key={c}
                  char={char}
                  progress={scrollYProgress}
                  range={[i / total, (i + 1) / total]}
                />
              );
            })}
            {w < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}

const CORNERS = [
  { cls: "about-me__art--tl", x: -80, delay: 0.1 },
  { cls: "about-me__art--bl", x: -80, delay: 0.25 },
  { cls: "about-me__art--tr", x: 80, delay: 0.15 },
  { cls: "about-me__art--br", x: 80, delay: 0.3 },
] as const;

export default function AboutSection({ text, email, corners }: AboutSectionProps) {
  return (
    <section className="about-me" id="about" aria-labelledby="about-title">
      {CORNERS.map((c, i) => (
        <FadeIn
          key={c.cls}
          className={`about-me__art ${c.cls}`}
          x={c.x}
          y={0}
          delay={c.delay}
          duration={0.9}
        >
          <img src={corners[i]} alt="" loading="lazy" draggable={false} />
        </FadeIn>
      ))}

      <div className="about-me__content">
        <FadeIn y={40}>
          <h2 id="about-title" className="about-me__heading">
            About me
          </h2>
        </FadeIn>
        <AnimatedText text={text} />
        <a className="about-me__contact" href={`mailto:${email}`}>
          Contact Me
        </a>
      </div>
    </section>
  );
}
