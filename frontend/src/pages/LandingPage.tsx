import { useNavigate } from "react-router-dom";
import "./LandingPage.css";
import {useEffect } from "react";
const howSteps = [
  {
    title: "Design your rubric",
    body: "Build criteria that match course outcomes and keep evaluation standards consistent.",
    marker: "01",
  },
  {
    title: "Assign and collect",
    body: "Students complete assigned peer reviews in a guided flow with clear expectations.",
    marker: "02",
  },
  {
    title: "Review outcomes",
    body: "Instructors and students can use structured feedback to improve collaboration and performance.",
    marker: "03",
  },
];

const featureItems = [
  {
    title: "Anonymous review support",
    body: "Promote candid, constructive feedback in team-based assignments.",
  },
  {
    title: "Role-based workflow",
    body: "Separate student, teacher, and admin responsibilities with clear boundaries.",
  },
  {
    title: "Rubric-driven evaluation",
    body: "Use criteria and comments to capture both scores and context.",
  },
  {
    title: "Course-ready operations",
    body: "Run peer evaluation from setup through reflection in one place.",
  },
];

export default function LandingPage() {

  const navigate = useNavigate();
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="LandingPage">
      <nav className="LandingNav">
        <div className="LandingNavInner">
          <button className="LandingBrand" onClick={() => scrollToSection("top")}>Toodle</button>
          <div className="LandingNavLinks">
            <button onClick={() => scrollToSection("how")}>How it works</button>
            <button onClick={() => scrollToSection("features")}>Features</button>
            <button className="LandingNavCta" onClick={() => navigate("/login")}>Sign in</button>
          </div>
        </div>
      </nav>

      <section className="LandingHero" id="top">
        <div className="LandingHeroContent">
          <div className="LandingEyebrow">Peer evaluation for academic teams</div>
          <h1>
            Peer learning,
            <br />
            done right.
          </h1>
          <p>
            Run fair, structured peer evaluations so students receive useful feedback and instructors get clearer signals on
            contribution and collaboration.
          </p>

          <div className="LandingActions">
            <button className="LandingPrimaryAction" onClick={() => navigate("/register")}>
              Start Free
            </button>
            <button className="LandingSecondaryAction" onClick={() => scrollToSection("how")}>
              See How It Works
            </button>
          </div>
        </div>

        <aside className="LandingHeroVisual" aria-label="Example review panel">
          <img className="LandingHeroImage" src="/heroImage.png" alt="Peer evaluation rubric interface" />
        </aside>
      </section>

      <section className="LandingSection" id="how">
        <div className="LandingSectionInner">
          <div className="LandingSectionIntro">
            <div className="SectionLabel">How it works</div>
            <h2>From assignment setup to actionable insight.</h2>
          </div>
          <div className="HowGrid">
            {howSteps.map((step) => (
              <article key={step.title} className="StepCard">
                <div className="StepNumber">{step.marker}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="LandingFeatures" id="features">
        <div className="LandingSectionIntro LandingSectionIntroDark">
          <div className="SectionLabel">Features</div>
          <h2>Built for the classroom.</h2>
        </div>
        <div className="FeaturesGrid">
          {featureItems.map((feature) => (
            <article key={feature.title} className="FeatureItem">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="LandingFinalCta">
        <h2>Ready to run your next peer evaluation cycle?</h2>
        <div className="LandingActions">
          <button className="LandingPrimaryAction" onClick={() => navigate("/register")}>
            Create Account
          </button>
          <button className="LandingSecondaryAction" onClick={() => navigate("/login")}>
            Sign In
          </button>
        </div>
      </section>
    </main>
  );
}
