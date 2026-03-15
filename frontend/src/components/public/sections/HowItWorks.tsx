export default function HowItWorks() {
  return (
    <section className="how-section">
      <div className="container">
        <div className="centered reveal">
          <div className="section-label">How it works</div>
          <h2 className="section-title">
            Designed for
            <br />
            real conversations
          </h2>
        </div>
        <div className="steps">
          <div className="step reveal reveal-delay-1">
            <div className="step-num">1</div>
            <div className="step-title">Start a thread</div>
            <div className="step-desc">
              Write your idea or question. AI checks tone before posting so you
              can land it the way you mean it.
            </div>
          </div>
          <div className="step reveal reveal-delay-2">
            <div className="step-num">2</div>
            <div className="step-title">Community replies</div>
            <div className="step-desc">
              Replies appear in realtime. Branch naturally. See who is typing.
            </div>
          </div>
          <div className="step reveal reveal-delay-3">
            <div className="step-num">3</div>
            <div className="step-title">AI keeps it warm</div>
            <div className="step-desc">
              Moderation runs in the background so good conversations flow and
              bad behavior is caught.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
