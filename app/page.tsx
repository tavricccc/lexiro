import type { Metadata } from "next";
import Link from "next/link";

import { LandingPractice } from "@/components/marketing/landing-practice";
import { BrandLockup } from "@/components/ui/brand";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("about.metaTitle"),
  description: t("about.metaDescription"),
};

const process = [
  {
    number: "01",
    title: t("about.stepOneTitle"),
    body: t("about.stepOneBody"),
    icon: Icons.create,
  },
  {
    number: "02",
    title: t("about.stepTwoTitle"),
    body: t("about.stepTwoBody"),
    icon: Icons.practice,
  },
  {
    number: "03",
    title: t("about.stepThreeTitle"),
    body: t("about.stepThreeBody"),
    icon: Icons.review,
  },
] as const;

export default function AboutPage() {
  return (
    <div className="about-page">
      <header className="about-header">
        <div className="about-wrap about-header-inner">
          <BrandLockup
            href="/"
            className="about-brand"
            markClassName="about-brand-mark"
          />
          <nav aria-label={t("about.navigationLabel")} className="about-nav">
            <a href="#how-it-works">{t("about.howItWorks")}</a>
            <a href="#practice">{t("about.practiceNav")}</a>
            <Link href="/app" className="about-nav-cta">
              {t("about.openApp")}
              <Icons.next aria-hidden="true" className="size-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section
          className="about-hero about-wrap"
          aria-labelledby="about-title"
        >
          <div className="about-hero-copy">
            <h1 id="about-title">
              {t("about.heroTitleFirst")}
              <em>{t("about.heroTitleEmphasis")}</em>
              {t("about.heroTitleLast")}
            </h1>
            <p className="about-hero-description">
              {t("about.heroDescription")}
            </p>
            <div className="about-actions">
              <Link href="/app" className="about-button about-button-primary">
                {t("about.startNow")}
                <Icons.next aria-hidden="true" className="size-5" />
              </Link>
              <a href="#how-it-works" className="about-text-link">
                {t("about.seeHow")}
              </a>
            </div>
          </div>
          <div className="about-hero-demo">
            <LandingPractice />
          </div>
        </section>

        <section
          className="about-promise"
          aria-labelledby="about-promise-title"
        >
          <div className="about-wrap about-promise-inner">
            <div className="about-promise-title">
              <h2 id="about-promise-title">{t("about.promiseTitle")}</h2>
            </div>
            <p>{t("about.promiseBody")}</p>
          </div>
        </section>

        <section
          id="how-it-works"
          className="about-process about-wrap"
          aria-labelledby="about-process-title"
        >
          <div className="about-section-heading">
            <h2 id="about-process-title">{t("about.processTitle")}</h2>
            <p>{t("about.processBody")}</p>
          </div>
          <div className="about-process-list">
            {process.map(({ number, title, body, icon: Icon }) => (
              <div className="about-process-row" key={number}>
                <span className="about-process-number">{number}</span>
                <div className="about-process-icon">
                  <Icon aria-hidden="true" className="size-6" />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="practice"
          className="about-practice-section"
          aria-labelledby="about-practice-title"
        >
          <div className="about-wrap about-practice-inner">
            <div className="about-practice-art" aria-hidden="true">
              <span className="about-reading-illustration" />
            </div>
            <div className="about-practice-copy">
              <h2 id="about-practice-title">{t("about.practiceTitle")}</h2>
              <p>{t("about.practiceBody")}</p>
              <ul>
                <li>
                  <Icons.success aria-hidden="true" className="size-5" />
                  {t("about.practicePointOne")}
                </li>
                <li>
                  <Icons.success aria-hidden="true" className="size-5" />
                  {t("about.practicePointTwo")}
                </li>
                <li>
                  <Icons.success aria-hidden="true" className="size-5" />
                  {t("about.practicePointThree")}
                </li>
              </ul>
              <Link href="/app" className="about-inline-link">
                {t("about.tryApp")}
                <Icons.next aria-hidden="true" className="size-5" />
              </Link>
            </div>
          </div>
        </section>

        <section
          className="about-finish about-wrap"
          aria-labelledby="about-finish-title"
        >
          <div>
            <h2 id="about-finish-title">{t("about.finishTitle")}</h2>
            <p>{t("about.finishBody")}</p>
          </div>
          <Link href="/app" className="about-button about-button-light">
            {t("about.startNow")}
            <Icons.next aria-hidden="true" className="size-5" />
          </Link>
        </section>
      </main>

      <footer className="about-footer about-wrap">
        <BrandLockup
          href="/"
          className="about-brand"
          markClassName="about-brand-mark"
        />
        <span>{t("about.footerTagline")}</span>
        <Link href="/app">{t("about.openApp")}</Link>
      </footer>
    </div>
  );
}
