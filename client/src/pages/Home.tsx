import type { CSSProperties } from "react";
import LivingPortrait from "../components/LivingPortrait";
import AboutSection from "../components/AboutSection";
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
// four of Sunny's own pieces float in the corners of the About section
const aboutCorners = [2, 9, 17, 26].map(
  i => artwork[i].image as string
) as [string, string, string, string];
const navigation = [
  { label: "MY ART", href: "#my-art" },
  { label: "ABOUT", href: "#about" },
];

export default function Home() {
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


      <AboutSection
        text={portfolioCopy.biography}
        email={portfolioCopy.email}
        corners={aboutCorners}
      />
      <section
        className="art-section section-pad"
        id="my-art"
        aria-labelledby="art-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow section-heading__eyebrow">02 / MY ART</p>
            <h2 id="art-title">
              A little of what
              <br />
              <em>I make.</em>
            </h2>
          </div>
          <p className="section-heading__aside">
            A growing collection of small thoughts, soft colors, and things
            still taking shape.
          </p>
        </div>

        <div className="art-gallery-stack">
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
      </section>

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
          <p>For kind notes, creative thoughts, or simply to say hi.</p>
        </div>
        <a className="contact-link" href={`mailto:${portfolioCopy.email}`}>
          <span>{portfolioCopy.email}</span>
          <span aria-hidden="true">↗</span>
        </a>
        <span className="contact-section__replace-note">
          Replace this email with your own when you’re ready.
        </span>
      </section>

    </main>
  );
}
