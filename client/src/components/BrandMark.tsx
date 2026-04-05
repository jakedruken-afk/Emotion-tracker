type BrandMarkProps = {
  variant?: "hero" | "compact";
  align?: "left" | "center";
  context?: string;
  subtitle?: string;
  showTagline?: boolean;
  showWordmark?: boolean;
  className?: string;
};

export default function BrandMark({
  variant = "compact",
  align = "left",
  context,
  subtitle,
  showTagline = true,
  showWordmark = true,
  className = "",
}: BrandMarkProps) {
  if (variant === "hero") {
    return (
      <div
        className={`brand-lockup brand-lockup-hero ${
          align === "center" ? "brand-lockup-center" : ""
        } ${className}`.trim()}
      >
        <div className="brand-hero-frame">
          <img src="/lamb-logo.jpeg" alt="L.A.M.B logo" className="brand-hero-image-full" />
        </div>
        {(context || subtitle) ? (
          <div className="brand-hero-copy">
            {context ? <p className="brand-context">{context}</p> : null}
            {subtitle ? <p className="brand-subcopy">{subtitle}</p> : null}
          </div>
        ) : null}
      </div>
    );
  }

  const showCopy = showWordmark || showTagline || context || subtitle;
  const useAnimalOnlyImage = variant === "compact";

  return (
    <div
      className={`brand-lockup brand-lockup-compact ${
        align === "center" ? "brand-lockup-center" : ""
      } ${align === "center" && !showCopy ? "brand-lockup-icon-only" : ""} ${className}`.trim()}
    >
      <div
        className={`brand-icon-shell ${
          align === "center" && !showCopy ? "brand-icon-shell-showcase" : ""
        }`}
        aria-hidden="true"
      >
        <img
          src={useAnimalOnlyImage ? "/lamb-animal.jpeg" : "/lamb-logo.jpeg"}
          alt=""
          className={`brand-icon-image ${
            useAnimalOnlyImage ? "brand-icon-image-animal" : ""
          }`}
        />
      </div>
      {showCopy ? (
        <div className={`brand-copy ${align === "center" ? "brand-copy-center" : ""}`}>
          {showWordmark ? <p className="brand-wordmark">L.A.M.B</p> : null}
          {showTagline ? (
            <p className="brand-tagline">Listen | Aid | Manage | Balance</p>
          ) : null}
          {context ? <p className="brand-context">{context}</p> : null}
          {subtitle ? <p className="brand-subcopy">{subtitle}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
