import type { CSSProperties } from "react";
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
  { label: "Sunny", href: "#sunny" },
  { label: "About", href: "#about" },
  { label: "My Art", href: "#my-art" },
  { label: "Contact", href: "#contact" },
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
        </div>
        <LivingPortrait />
      </section>

      {/* The reels and About copy are deliberately one shared section. */}
      <section className="about-gallery-section" id="about" aria-labelledby="about-title">
        <div className="about-gallery-section__reels" aria-hidden="true">
          <ReelGallery
            rows={reelRows}
            interactive={false}
            autoScroll={20}
            grayscale={0.2}
            dim={0.48}
            style={{ height: "100%" }}
          />
        </div>
        <div className="about-gallery-section__shade" aria-hidden="true" />
        <div className="about-gallery-section__nav eyebrow">01 / A LITTLE ABOUT ME</div>
        <div className="about-gallery-section__content">
          <p className="eyebrow">A NOTE FROM SUNNY</p>
          <h2 id="about-title">
            Made from the
            <br />
            <em>little things.</em>
          </h2>
          <p className="about-gallery-section__bio">{portfolioCopy.biography}</p>
          <div className="about-gallery-section__signature">
            <span aria-hidden="true" />
            Sunny
          </div>
        </div>
        <p className="about-gallery-section__footnote">
          {hasRealArtwork(artwork)
            ? "A little home for the art, ideas, and moments still taking shape."
            : "Your artwork will fill these reels as you add images to your portfolio."}
        </p>
      </section>

      <section className="showcase-section showcase-section--spin" id="my-art" aria-label="Spin shutter artwork gallery">
        <SpinShutter />
      </section>

      <section className="showcase-section showcase-section--carousel" aria-labelledby="carousel-title">
        <div className="showcase-section__heading">
          <p className="eyebrow">03 / IN COLOUR</p>
          <h2 id="carousel-title">A different <em>perspective.</em></h2>
        </div>
        <GradientCarousel images={gradientArtworks} />
      </section>

      <section className="showcase-section showcase-section--ribbon" aria-labelledby="ribbon-title">
        <div className="showcase-section__heading">
          <p className="eyebrow">04 / THE LITTLE DETAILS</p>
          <h2 id="ribbon-title">Take a closer <em>look.</em></h2>
        </div>
        <div className="depth-ribbon-frame">
          <DepthRibbon items={depthRibbonItems} />
        </div>
      </section>

      <section className="contact-section section-pad" id="contact">
        <div className="contact-section__copy">
          <p className="eyebrow">05 / CONTACT</p>
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

      <footer className="site-footer">
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
