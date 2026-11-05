import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import LivingPortrait from "../components/LivingPortrait";
import ReelGallery from "../components/ReelGallery";
import SpinShutter from "../components/SpinShutter";
import GradientCarousel from "../components/GradientCarousel";
import DepthRibbon from "../components/DepthRibbon";
import { artwork, portfolioCopy } from "../data/portfolio";
import { buildReelRows, hasRealArtwork } from "../data/reelGallery";
import { gradientArtworks } from "../data/gradientCarousel";
import { depthRibbonItems } from "../data/depthRibbon";
import "./PortfolioSections.css";

const reelRows = buildReelRows(artwork, 5, 36);
const navigation = [
  { label: "MY ART", href: "#my-art" },
  { label: "ABOUT", href: "#about" },
  { label: "CONTACT", href: "#contact" },
];

function StickySection({ children, id, className, index }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Option 3: Zoom-Through / Scale effect
  // As the section reaches the center, it's full size.
  // As it leaves, it shrinks slightly (0.95) to create depth.
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1, 0.95]);
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

  return (
    <div ref={ref} className="sticky-section" style={{ zIndex: index }}>
      <motion.div
        style={{ scale, opacity }}
        className={`w-full h-full flex flex-col justify-center ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default function Home() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main id="top" className="portfolio-page">
      <section className="lh-hero" id="sunny" aria-labelledby="hero-title">
        <nav
          className="lh-nav lh-fade"
          style={{ "--lh-y": "-20px" } as CSSProperties}
          aria-label="Main navigation"
        >
          <a href="#sunny">SUNNY</a>
          {navigation.map(item => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="lh-title-wrap">
          <h1
            id="hero-title"
            className="lh-title lh-fade"
            style={{ "--lh-y": "40px", "--lh-d": ".15s" } as CSSProperties}
          >
            Hi, i&apos;m sunny
          </h1>
        </div>
        <div className="lh-bottom">
          <p
            className="lh-intro lh-fade"
            style={{ "--lh-d": ".35s" } as CSSProperties}
          >
            an artist turning little thoughts and feelings into art, one sketch
            at a time
          </p>
          <a
            className="lh-contact lh-fade"
            style={{ "--lh-d": ".5s" } as CSSProperties}
            href={`mailto:${portfolioCopy.email}`}
          >
            Contact Me
          </a>
        </div>
        <LivingPortrait />
      </section>

      <StickySection
        index={1}
        id="my-art"
        className="art-section section-pad reveal"
      >
        <div className="reveal-child section-heading">
          <div className="reveal-child">
            <p className="eyebrow section-heading__eyebrow">01 / MY ART</p>
            <h2 id="art-title">
              A little of what
              <br />
              <em>I make.</em>
            </h2>
          </div>
          <p className="reveal-child section-heading__aside">
            A growing collection of small thoughts, soft colors, and things
            still taking shape.
          </p>
        </div>

        <div className="reveal-child art-gallery-stack">
          <div className="art-gallery-group">
            <ReelGallery rows={reelRows} />
            <p className="gallery-note">
              {hasRealArtwork(artwork)
                ? "Every piece in these reels is Sunny’s own work."
                : "Your artwork reels will fill as you add images to your portfolio."}
            </p>
          </div>

          <div className="art-gallery-group">
            <SpinShutter />
          </div>

          <div className="art-gallery-group">
            <GradientCarousel images={gradientArtworks} />
          </div>

          <div className="art-gallery-group">
            <DepthRibbon items={depthRibbonItems} />
          </div>
        </div>
      </StickySection>

      <StickySection
        index={2}
        id="about"
        className="about-section section-pad reveal"
        style={{ pointerEvents: "none" }}
      >
        <div className="reveal-child about-section__index eyebrow">
          02 / ABOUT
        </div>
        <div className="reveal-child about-section__content">
          <p className="eyebrow about-section__overline">A NOTE FROM SUNNY</p>
          <h2 id="about-title">
            Made from the
            <br />
            <em>little things.</em>
          </h2>
          <p className="about-section__bio">{portfolioCopy.biography}</p>
          <div className="about-section__signature">
            <span
              className="about-section__signature-rule"
              aria-hidden="true"
            />
            <span>Sunny</span>
          </div>
        </div>
        <p className="reveal-child about-section__footnote">
          A little home for the art, ideas, and moments still taking shape.
        </p>
      </StickySection>

      <StickySection
        index={3}
        id="contact"
        className="contact-section section-pad reveal"
      >
        <div className="reveal-child contact-section__copy">
          <p className="eyebrow">03 / CONTACT</p>
          <h2 id="contact-title">
            Have a little
            <br />
            <em>hello?</em>
          </h2>
          <p>For kind notes, creative thoughts, or simply to say hi.</p>
        </div>
        <a
          className="reveal-child contact-link"
          href={`mailto:${portfolioCopy.email}`}
        >
          <span>{portfolioCopy.email}</span>
          <span aria-hidden="true">↗</span>
        </a>
        <span className="reveal-child contact-section__replace-note">
          Replace this email with your own when you’re ready.
        </span>
      </StickySection>

      <footer className="site-footer reveal">
        <a className="brand-lockup brand-lockup--footer" href="#sunny">
          <span>SUNNY</span>
        </a>
        <p>Made with a little imagination.</p>
        <a href="#top" className="back-to-top">
          BACK TO TOP ↑
        </a>
      </footer>
    </main>
  );
}
