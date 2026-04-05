type SectionTab = {
  id: string;
  label: string;
  description?: string;
  badge?: string | number;
};

type SectionTabsProps = {
  tabs: SectionTab[];
  value: string;
  onChange: (nextValue: string) => void;
};

export default function SectionTabs({ tabs, value, onChange }: SectionTabsProps) {
  return (
    <div className="tab-row">
      {tabs.map((tab) => {
        const isActive = tab.id === value;

        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-pill ${isActive ? "tab-pill-active" : ""}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="tab-pill-label">{tab.label}</span>
            {tab.description ? <span className="tab-pill-copy">{tab.description}</span> : null}
            {tab.badge != null ? <span className="tab-pill-badge">{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
