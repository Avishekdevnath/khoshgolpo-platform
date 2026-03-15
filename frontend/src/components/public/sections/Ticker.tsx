import { tickerItems } from "@/components/public/homepageData";

function renderHeadline(item: string) {
  const parts = item.split(" ");
  const name = `${parts[0]} ${parts[1]}`;
  const rest = item.replace(/^[^ ]+ [^ ]+ /, "");
  return { name, rest };
}

export default function Ticker() {
  return (
    <section className="ticker-section">
      <div className="ticker-track">
        {[...tickerItems, ...tickerItems].map((item, index) => {
          const { name, rest } = renderHeadline(item);
          return (
            <div className="ticker-item" key={`${item}-${index}`}>
              <strong>{name}</strong> {rest}
              <span className="ticker-sep">-</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
