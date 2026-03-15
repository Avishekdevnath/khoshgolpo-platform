import { features } from "@/components/public/homepageData";
import { inlineStyle } from "@/components/public/style";

export default function Features() {
  return (
    <section className="features-section" id="features">
      <div className="container">
        <div className="reveal">
          <div className="section-label">Why KhoshGolpo</div>
          <h2 className="section-title">
            Built different,
            <br />
            on purpose
          </h2>
          <p className="section-sub">
            Every feature exists to protect conversation quality, not vanity
            engagement.
          </p>
        </div>
        <div className="features-grid reveal">
          {features.map((feature) => (
            <div className="feature-tile" key={feature.name}>
              <div className="feature-icon" style={inlineStyle(feature.iconStyle)}>
                {feature.icon}
              </div>
              <div className="feature-name">{feature.name}</div>
              <div className="feature-desc">{feature.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
