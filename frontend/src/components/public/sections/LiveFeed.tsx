import { threads } from "@/components/public/homepageData";
import { inlineStyle } from "@/components/public/style";

function ThreadCard({ thread }: { thread: (typeof threads)[number] }) {
  return (
    <article className={`thread-card ${thread.featured ? "featured" : ""}`}>
      <div className="thread-meta">
        <div className="thread-author">
          <div className="avatar" style={inlineStyle(thread.avatarStyle)}>
            {thread.initials}
          </div>
          <div>
            <div className="author-name">{thread.author}</div>
            <div className="author-time">{thread.time}</div>
          </div>
        </div>
        <span className={`thread-tag ${thread.tagClass}`}>{thread.tag}</span>
      </div>
      <h3 className="thread-title">{thread.title}</h3>
      <p className="thread-preview">{thread.preview}</p>
      <div className="thread-footer">
        <div className="thread-stat">{thread.replies}</div>
        <div className="thread-stat">{thread.views}</div>
        <div className="thread-stat">{thread.upvotes}</div>
        {thread.aiWarm ? <div className="ai-badge">AI verified warm</div> : null}
      </div>
    </article>
  );
}

export default function LiveFeed() {
  return (
    <section className="feed-section" id="threads">
      <div className="container">
        <div className="feed-header">
          <div>
            <div className="section-label">Live discussions</div>
            <h2 className="section-title">
              What people are
              <br />
              talking about
            </h2>
          </div>
          <div className="feed-actions">
            <div className="live-badge">LIVE</div>
            <a href="#" className="btn btn-ghost">
              View all threads -&gt;
            </a>
          </div>
        </div>

        <div className="threads-grid reveal">
          {threads.map((thread) => (
            <ThreadCard thread={thread} key={thread.title} />
          ))}
        </div>
      </div>
    </section>
  );
}
