import type { CSSProperties } from "react";
import LivingPortrait from "../components/LivingPortrait";
import ReelGallery from "../components/ReelGallery";
import SpinShutter from "../components/SpinShutter";
import { artwork, portfolioCopy } from "../data/portfolio";
import { spinShutterArtworks } from "../data/SpinShutter";
import {
  buildReelRows,
  hasRealArtwork,
} from "../data/reelGallery";

// Existing Reel Gallery data — unchanged.
const reelRows = buildReelRows(artwork, 5, 36);

const navigation = [
  { label: "MY ART", href: "#my-art" },
  { label: "ABOUT", href: "#about" },
  { label: "CONTACT", href: "#contact" },
];

function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 42 42"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="21"
        cy="21"
        r="9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />

      <path
        d="M21 2.7v5.1M21 34.2v5.1M2.7 21h5.1M34.2 21h5.1M7.95 7.95l3.6 3.6m18.9 18.9 3.6 3.6m0-26.1-3.6 3.6m-18.9 18.9-3.6 3.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.25"
      />

      <circle cx="21" cy="21" r="2.1" fill="currentColor" />
    </svg>
  );
}

export default function Home() {
  return (
    <main id="top" className="portfolio-page">
      {/* HERO SECTION — living portrait (client/src/components/LivingPortrait.tsx) */}

      <section
        className="lh-hero"
        id="sunny"
        aria-labelledby="hero-title"
      >
        <nav className="lh-nav lh-fade" style={{ "--lh-y": "-20px" } as CSSProperties} aria-label="Main navigation">
          <a href="#sunny">SUNNY</a>
          {navigation.map((item) => (
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
          <p className="lh-intro lh-fade" style={{ "--lh-d": ".35s" } as CSSProperties}>
            an artist turning little thoughts and feelings into art, one sketch at a time
          </p>
          <a className="lh-contact lh-fade" style={{ "--lh-d": ".5s" } as CSSProperties} href="#contact">
            Contact Me
          </a>
        </div>

        <LivingPortrait />
      </section>

      {/* MY ART SECTION */}

      <section
        className="art-section section-pad"
        id="my-art"
        aria-labelledby="art-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow section-heading__eyebrow">
              01 / MY ART
            </p>

            <h2 id="art-title">
              A little of what
              <br />
              <em>I make.</em>
            </h2>
          </div>

          <p className="section-heading__aside">
            A growing collection of small thoughts, soft colors,
            and things still taking shape.
          </p>
        </div>

        {/* EXISTING REEL GALLERY — UNCHANGED */}

        <ReelGallery rows={reelRows} />

        <p className="gallery-note">
          {hasRealArtwork(artwork)
            ? "Every piece in these reels is Sunny’s own work."
            : "Your artwork reels will fill as you add images to your portfolio."}
        </p>

        {/* NEW SPIN SHUTTER GALLERY — 60 SEPARATE ARTWORKS */}

        <SpinShutter />

      </section>

      {/* ABOUT SECTION */}

      <section
        className="about-section section-pad"
        id="about"
        aria-labelledby="about-title"
      >
        <div className="about-section__index eyebrow">
          02 / ABOUT
        </div>

        <div className="about-section__content">
          <p className="eyebrow about-section__overline">
            A NOTE FROM SUNNY
          </p>

          <h2 id="about-title">
            Made from the
            <br />
            <em>little things.</em>
          </h2>

          <p className="about-section__bio">
            {portfolioCopy.biography}
          </p>

          <div className="about-section__signature">
            <span
              className="about-section__signature-rule"
              aria-hidden="true"
            />
            <span>Sunny</span>
          </div>
        </div>

        <p className="about-section__footnote">
          The portrait above uses real moments from the supplied video.
          Directions without a matching pose use the nearest available
          glance.
        </p>
      </section>

      {/* CONTACT SECTION */}

      <section
        className="contact-section section-pad"
        id="contact"
        aria-labelledby="contact-title"
      >
        <div className="contact-section__copy">
          <p className="eyebrow">03 / CONTACT</p>

          <h2 id="contact-title">
            Have a little
            <br />
            <em>hello?</em>
          </h2>

          <p>
            For kind notes, creative thoughts, or simply to say hi.
          </p>
        </div>

        <a
          className="contact-link"
          href={`mailto:${portfolioCopy.email}`}
        >
          <span>{portfolioCopy.email}</span>
          <span aria-hidden="true">↗</span>
        </a>

        <span className="contact-section__replace-note">
          Replace this email with your own when you’re ready.
        </span>
      </section>

      {/* FOOTER */}

      <footer className="site-footer">
        <a
          className="brand-lockup brand-lockup--footer"
          href="#sunny"
        >
          <BrandMark />
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