import { voices } from "@/components/public/homepageData";
import { inlineStyle } from "@/components/public/style";

export default function Voices() {
  return (
    <section className="voices-section" id="community">
      <div className="container">
        <div className="reveal">
          <div className="section-label">Community voices</div>
          <h2 className="section-title">What members say</h2>
        </div>
        <div className="voices-grid">
          {voices.map((voice, index) => (
            <div
              className={`voice-card reveal reveal-delay-${index + 1}`}
              key={voice.author}
            >
              <div className="star-row">*****</div>
              <div className="voice-quote">{voice.quote}</div>
              <div className="voice-author">
                <div className="avatar voice-avatar" style={inlineStyle(voice.avatarStyle)}>
                  {voice.initials}
                </div>
                <div className="voice-info">
                  <div className="voice-name">{voice.author}</div>
                  <div className="voice-role">{voice.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
