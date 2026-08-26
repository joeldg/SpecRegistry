import { useSearchParams } from "react-router-dom";
import { PageTabs } from "../components";
import SearchPage from "./SearchPage";
import ImpactExplorerPage from "./ImpactExplorerPage";
import GenerationWorkbenchPage from "./GenerationWorkbenchPage";
import ReportsPage from "./ReportsPage";

type InsightsTab = "reports" | "search" | "impact" | "generate";

const TABS: Array<{ id: InsightsTab; label: string }> = [
  { id: "reports", label: "Reports" },
  { id: "search", label: "Search" },
  { id: "impact", label: "Impact" },
  { id: "generate", label: "Generate Specs" },
];

export default function InsightsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as InsightsTab | null;
  const active: InsightsTab = TABS.some((t) => t.id === raw) ? (raw as InsightsTab) : "reports";

  function setActive(id: InsightsTab) {
    const next = new URLSearchParams(params);
    if (id === "reports") next.delete("tab");
    else next.set("tab", id);
    setParams(next);
  }

  return (
    <>
      <div className="page-head">
        <h1>Insights</h1>
        <span className="sub">SDD health, spec search, change impact, and draft generation</span>
      </div>
      <PageTabs tabs={TABS} active={active} onChange={setActive} ariaLabel="Insights sections" />
      <div style={{ marginTop: 16 }}>
        {active === "reports" && <ReportsPage embedded />}
        {active === "search" && <SearchPage embedded />}
        {active === "impact" && <ImpactExplorerPage embedded />}
        {active === "generate" && <GenerationWorkbenchPage embedded />}
      </div>
    </>
  );
}
