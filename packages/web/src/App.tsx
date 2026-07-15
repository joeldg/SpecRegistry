import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { clearSession, getAuthor, getLoginUsername, setAuthor } from "./api";
import UpdateBanner from "./UpdateBanner";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import SpecsPage from "./pages/SpecsPage";
import SpecDetailPage from "./pages/SpecDetailPage";
import ReviewsPage from "./pages/ReviewsPage";
import ReviewDetailPage from "./pages/ReviewDetailPage";
import FeedbackPage from "./pages/FeedbackPage";
import ReportsPage from "./pages/ReportsPage";
import ProjectTypesPage from "./pages/ProjectTypesPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import SearchPage from "./pages/SearchPage";
import TemplatesPage from "./pages/TemplatesPage";
import SkillsMarketplacePage from "./pages/SkillsMarketplacePage";
import SettingsPage from "./pages/SettingsPage";
import GenerationWorkbenchPage from "./pages/GenerationWorkbenchPage";
import ImpactExplorerPage from "./pages/ImpactExplorerPage";

const NAV_GROUPS = [
  {
    label: "Work",
    items: [
      { to: "/", label: "Dashboard", end: true },
      { to: "/projects", label: "Projects" },
      { to: "/reviews", label: "Reviews" },
      { to: "/feedback", label: "AI Feedback" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/reports", label: "Reports" },
      { to: "/impact", label: "Impact" },
      { to: "/search", label: "Search" },
      { to: "/generate", label: "Generate Specs" },
    ],
  },
  {
    label: "Library",
    items: [
      { to: "/specs", label: "Specifications" },
      { to: "/project-types", label: "Baselines" },
      { to: "/templates", label: "Templates" },
      { to: "/skills", label: "Skills" },
    ],
  },
  {
    label: "Admin",
    items: [{ to: "/settings", label: "Settings" }],
  },
];

export default function App() {
  const [author, setAuthorState] = useState(getAuthor());

  useEffect(() => {
    setAuthor(author);
  }, [author]);

  return (
    <>
      <UpdateBanner />
      <div className="layout">
      <nav className="sidebar">
        <div className="brand">
          <span className="dot" /> SpecRegistry
        </div>
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="spacer" />
        <div className="author-box">
          {getLoginUsername() ? (
            <>
              <label>Signed in</label>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="mono">{getLoginUsername()}</span>
                <button
                  onClick={() => {
                    clearSession();
                    window.location.href = "/";
                  }}
                >
                  Out
                </button>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="author">Acting as</label>
              <input
                id="author"
                type="text"
                value={author}
                style={{ width: "100%" }}
                onChange={(e) => setAuthorState(e.target.value || "anonymous")}
              />
              <Link to="/login" className="faint" style={{ fontSize: 11 }}>
                Sign in →
              </Link>
            </>
          )}
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/specs" element={<SpecsPage />} />
          <Route path="/specs/:id" element={<SpecDetailPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/reviews/:id" element={<ReviewDetailPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/impact" element={<ImpactExplorerPage />} />
          <Route path="/generate" element={<GenerationWorkbenchPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/project-types" element={<ProjectTypesPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/skills" element={<SkillsMarketplacePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
      </div>
    </>
  );
}
