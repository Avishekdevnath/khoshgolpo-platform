export default function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          2,847 people talking right now
        </div>
        <p className="hero-eyebrow">Human-first - AI-assisted - Open</p>
        <h1 className="hero-title">
          Where conversations
          <br />
          <em>stay human</em>
        </h1>
        <p className="hero-subtitle">
          A discussion platform that blends real community warmth with AI
          moderation so every thread stays thoughtful, safe, and worth reading.
        </p>
        <div className="hero-ctas">
          <a href="#" className="btn btn-primary btn-lg">
            Start a thread
          </a>
          <a href="#threads" className="btn btn-ghost btn-lg">
            Browse discussions -&gt;
          </a>
        </div>
        <div className="online-strip">
          <div className="online-avatars">
            <div className="avatar" style={{ background: "#3B4A6B" }}>
              RK
            </div>
            <div className="avatar" style={{ background: "#4A3B6B" }}>
              SL
            </div>
            <div className="avatar" style={{ background: "#6B3B4A" }}>
              MM
            </div>
            <div className="avatar" style={{ background: "#3B6B4A" }}>
              ZA
            </div>
            <div className="avatar" style={{ background: "#6B5A3B" }}>
              TH
            </div>
          </div>
          <span className="online-count">
            <strong>2,847</strong> members online now
          </span>
        </div>
        <div className="hero-stats">
          <div>
            <div className="stat-val">48k</div>
            <div className="stat-lbl">Community members</div>
          </div>
          <div>
            <div className="stat-val">127k</div>
            <div className="stat-lbl">Threads started</div>
          </div>
          <div>
            <div className="stat-val">1.2M</div>
            <div className="stat-lbl">Replies posted</div>
          </div>
          <div>
            <div className="stat-val">98.4%</div>
            <div className="stat-lbl">Positive interactions</div>
          </div>
        </div>
      </div>
    </section>
  );
}
