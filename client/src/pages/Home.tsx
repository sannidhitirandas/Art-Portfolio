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
import { FadeIn, ScrollText, usePinnedSheets } from "../components/transitions";
import "./PortfolioSections.css";

const reelRows = buildReelRows(artwork, 5, 36);
const navigation = [
  { label: "Sunny", href: "#sunny" },
  { label: "About", href: "#about" },
  { label: "My Art", href: "#my-art" },
  { label: "Collaborate", href: "#collaborate" },
];

export default function Home() {
  usePinnedSheets();
  return (
    <main id="top" className="portfolio-page">
      <section className="lh-hero pin-sheet" id="sunny" aria-labelledby="hero-title">
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
            an artist turning little thoughts and feelings into art
          </p>
        </div>
        <LivingPortrait />
      </section>

      {/* The reels and About copy are deliberately one shared section. */}
      <section className="about-gallery-section sheet-over pin-sheet" id="about" aria-labelledby="about-title">
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
        <div className="about-gallery-section__content">
          <p className="eyebrow">A NOTE FROM SUNNY</p>
          <h2 id="about-title">
            A Glimpse Into
            <br />
            <em>My World.</em>
          </h2>
          <ScrollText className="about-gallery-section__bio" text={portfolioCopy.biography} offset={["start 0.9", "end 0.85"]} />
          <div className="about-gallery-section__signature">
            <span aria-hidden="true" />
            Sunny
          </div>
        </div>
        <p className="about-gallery-section__footnote">
          {hasRealArtwork(artwork)
            ? "A little home for the art"
            : "Your artwork will fill these reels as you add images to your portfolio."}
        </p>
      </section>

      <section className="showcase-section showcase-section--spin sheet-over pin-sheet" id="my-art" aria-label="Spin shutter artwork gallery">
        <SpinShutter />
      </section>

      <section className="showcase-section showcase-section--carousel sheet-over pin-sheet" aria-labelledby="carousel-title">
        <FadeIn className="showcase-section__heading">
          <h2 id="carousel-title">A World in <em>Colour.</em></h2>
          <p className="showcase-section__description">A collection of my colourful artworks.</p>
        </FadeIn>
        <GradientCarousel images={gradientArtworks} />
      </section>

      <section className="showcase-section showcase-section--ribbon sheet-over pin-sheet" aria-labelledby="ribbon-title">
        <FadeIn className="showcase-section__heading">
          <h2 id="ribbon-title">Words Into <em>Art.</em></h2>
          <p className="showcase-section__description">Lyrics art inspired by words and music.</p>
        </FadeIn>
        <div className="depth-ribbon-frame">
          <DepthRibbon items={depthRibbonItems} aspect={3 / 4} />
        </div>
      </section>

      <section className="collab-section section-pad sheet-over sheet-over--collab" id="collaborate" aria-labelledby="collab-title">
        <FadeIn className="collab-section__intro">
          <p className="eyebrow">LET’S MAKE SOMETHING MEANINGFUL</p>
          <h2 id="collab-title">Let’s create<br /><em>something together.</em></h2>
          <p className="collab-section__description">
            I create art inspired by lyrics, characters, colours, and the little details
            that make a story feel special. I’d love to bring that creative energy to
            brands and projects that feel like a natural fit.
          </p>
          <a className="collab-section__cta" href={"mailto:" + portfolioCopy.email + "?subject=" + encodeURIComponent("A creative collaboration with Sunny")}>
            LET’S WORK TOGETHER <span aria-hidden="true">↗</span>
          </a>
        </FadeIn>
        <FadeIn className="collab-section__details" delay={0.15}>
          <div className="collab-stat"><strong>29K+</strong><span>Instagram community</span></div>
          <div className="collab-stat"><strong>14.6M+</strong><span>Most-viewed Post</span></div>
          <div className="collab-section__formats">
            <p className="eyebrow">CREATIVE PARTNERSHIPS</p>
            <ul>
              <li>Sponsored art &amp; illustration content</li>
              <li>Product features and creative demonstrations</li>
              <li>Brand collaborations and UGC</li>
            </ul>
          </div>
          <p className="collab-section__note">Art supplies, stationery, and creative brands are especially close to my heart.</p>
          <div className="collab-section__contact">
            <img src="/instagram-pfp.jpg" alt="Sunny's illustrated Instagram profile picture" />
            <div>
              <a href="https://www.instagram.com/artistic._.sunny/" target="_blank" rel="noreferrer">@artistic._.sunny <span aria-hidden="true">↗</span></a>
              <a href={"mailto:" + portfolioCopy.email}>{portfolioCopy.email} <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </FadeIn>
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