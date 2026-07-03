import { useEffect, useState } from "react";
import { api, getToken, type UpdateResult, type VersionStatus } from "./api";

export default function UpdateBanner() {
  const [version, setVersion] = useState<VersionStatus>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<UpdateResult>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.version().then(setVersion).catch(() => undefined);
    if (getToken()) {
      api
        .me()
        .then((user) => setIsAdmin(user.role === "admin"))
        .catch(() => setIsAdmin(false));
    }
  }, []);

  if (!version || version.github.status !== "behind") return null;

  async function runUpdate() {
    setError(undefined);
    setUpdating(true);
    try {
      const outcome = await api.triggerUpdate();
      setResult(outcome);
      if (outcome.updated) {
        api.version().then(setVersion).catch(() => undefined);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="update-banner">
      <div className="update-banner-text">
        <strong>SpecRegistry is out of date</strong> — running {version.git_sha_short ?? "unknown"}, {version.github.behind_by}{" "}
        commit{version.github.behind_by === 1 ? "" : "s"} behind {version.git_branch ?? "main"} on GitHub
        {version.github.latest_sha ? ` (latest ${version.github.latest_sha.slice(0, 7)})` : ""}.
      </div>
      {isAdmin && version.self_update_enabled && (
        <button className="primary" disabled={updating} onClick={runUpdate}>
          {updating ? "Updating…" : "Update now"}
        </button>
      )}
      {isAdmin && !version.self_update_enabled && (
        <div className="update-banner-result">
          In-app self-update is disabled on this server — deploy the update through your pipeline
          (or set <code>SPECREG_SELF_UPDATE=true</code> to enable the button).
        </div>
      )}
      {result && (
        <div className="update-banner-result">
          {result.message}
          {result.updated && " Restart the server process to run the updated code."}
        </div>
      )}
      {error && <div className="update-banner-result error">{error}</div>}
    </div>
  );
}
