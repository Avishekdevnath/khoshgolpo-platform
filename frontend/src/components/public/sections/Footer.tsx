export default function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-inner">
          <div>
            <a href="#" className="logo footer-logo">
              <span className="logo-dot" />
              KhoshGolpo
            </a>
            <p className="footer-copy">Human-first discussion platform. Open source.</p>
          </div>
          <div className="footer-links">
            <a href="#">GitHub</a>
            <a href="#">Docs</a>
            <a href="#">API</a>
            <a href="#">Privacy</a>
          </div>
          <div>
            <div className="footer-tech-title">Built with</div>
            <div className="footer-tech">
              <span className="tech-pill">FastAPI</span>
              <span className="tech-pill">Next.js 16</span>
              <span className="tech-pill">MongoDB</span>
              <span className="tech-pill">SWR Polling</span>
              <span className="tech-pill">Async Queue (Planned)</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
