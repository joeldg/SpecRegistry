import { useSearchParams } from "react-router-dom";
import { PageTabs } from "../components";
import SpecsPage from "./SpecsPage";
import ProjectTypesPage from "./ProjectTypesPage";
import TemplatesPage from "./TemplatesPage";

type SpecsTab = "specs" | "baselines" | "templates";

const TABS: Array<{ id: SpecsTab; label: string }> = [
  { id: "specs", label: "Specifications" },
  { id: "baselines", label: "Baselines" },
  { id: "templates", label: "Templates" },
];

export default function SpecsLibraryPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as SpecsTab | null;
  const active: SpecsTab = TABS.some((t) => t.id === raw) ? (raw as SpecsTab) : "specs";

  function setActive(id: SpecsTab) {
    const next = new URLSearchParams(params);
    if (id === "specs") next.delete("tab");
    else next.set("tab", id);
    setParams(next);
  }

  return (
    <>
      <div className="page-head">
        <h1>Specs</h1>
        <span className="sub">The governed specification library, baselines, and templates</span>
      </div>
      <PageTabs tabs={TABS} active={active} onChange={setActive} ariaLabel="Specs sections" />
      <div style={{ marginTop: 16 }}>
        {active === "specs" && <SpecsPage embedded />}
        {active === "baselines" && <ProjectTypesPage embedded />}
        {active === "templates" && <TemplatesPage embedded />}
      </div>
    </>
  );
}
