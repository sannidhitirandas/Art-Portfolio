import type { CSSProperties } from "react";
import LivingPortrait from "../components/LivingPortrait";

const navigation = [
  { label: "MY ART", href: "#my-art" },
  { label: "ABOUT", href: "#about" },
  { label: "CONTACT", href: "#contact" },
];

export default function Home() {
  return (
    <main className="portfolio-page">
      <section className="lh-hero" id="sunny" aria-labelledby="hero-title">
        <nav
          className="lh-nav lh-fade"
          style={{ "--lh-y": "-20px" } as CSSProperties}
          aria-label="Main navigation"
        >
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
          <a
            className="lh-contact lh-fade"
            style={{ "--lh-d": ".5s" } as CSSProperties}
            href="mailto:hello@yourstudio.com"
          >
            Contact Me
          </a>
        </div>

        <LivingPortrait />
      </section>
    </main>
  );
}
