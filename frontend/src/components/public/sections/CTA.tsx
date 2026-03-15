export default function CTA() {
  return (
    <section className="cta-section">
      <div className="container">
        <div className="cta-inner reveal">
          <p className="section-label cta-label">Ready to join?</p>
          <h2 className="cta-title">
            Your next great conversation
            <br />
            <em>is already happening</em>
          </h2>
          <p className="cta-sub">
            Join 48,000 developers, designers, and makers who chose warmth over
            chaos.
          </p>
          <div className="cta-btns">
            <a href="#" className="btn btn-primary btn-lg">
              Create free account
            </a>
            <a href="#" className="btn btn-ghost btn-lg">
              Explore without signing up -&gt;
            </a>
          </div>
          <p className="demo-note">
            Demo credentials: <span>user@demo.com</span> / <span>demo1234</span>
          </p>
        </div>
      </div>
    </section>
  );
}
