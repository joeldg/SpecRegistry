import { useCallback, useEffect, useState } from "react";
import type { Webhook } from "@specregistry/shared";
import { api, type ApiKeyRow, type ProjectTypeWithCount, type SubscriptionRow, type SyncJobRow, type UserRow } from "../api";
import { StatusBadge, timeAgo } from "../components";

const WEBHOOK_EVENTS = ["spec.published", "review.submitted", "review.approved", "review.rejected", "feedback.created"];

export default function SettingsPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [jobs, setJobs] = useState<SyncJobRow[]>([]);
  const [types, setTypes] = useState<ProjectTypeWithCount[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [error, setError] = useState<string>();
  const [issuedToken, setIssuedToken] = useState<string>();

  const [hookUrl, setHookUrl] = useState("");
  const [hookFormat, setHookFormat] = useState("json");
  const [subTypeId, setSubTypeId] = useState("");
  const [subRepo, setSubRepo] = useState("");
  const [subBranch, setSubBranch] = useState("main");
  const [subPath, setSubPath] = useState("specs");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState("author");
  const [newPassword, setNewPassword] = useState("");
  const [keyUsername, setKeyUsername] = useState("");
  const [keyName, setKeyName] = useState("api key");

  const reload = useCallback(() => {
    Promise.all([api.webhooks(), api.subscriptions(), api.syncJobs(), api.projectTypes(), api.users(), api.apiKeys()])
      .then(([w, s, j, t, u, k]) => {
        setWebhooks(w);
        setSubs(s);
        setJobs(j);
        setTypes(t);
        setUsers(u);
        setKeys(k);
        setSubTypeId((current) => current || t[0]?.id || "");
        setKeyUsername((current) => current || u[0]?.username || "");
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(reload, [reload]);

  async function act(fn: () => Promise<unknown>) {
    setError(undefined);
    try {
      await fn();
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <span className="sub">Notifications and git distribution</span>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="section">
        <h2>Users and API keys</h2>
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="form-row">
            <input type="text" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            <input
              type="text"
              placeholder="Display name"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
            />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="admin">admin</option>
              <option value="reviewer">reviewer</option>
              <option value="author">author</option>
              <option value="agent">agent</option>
            </select>
            <input
              type="password"
              placeholder="Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              className="primary"
              onClick={() =>
                act(async () => {
                  await api.createUser({
                    username: newUsername.trim(),
                    display_name: newDisplayName.trim() || undefined,
                    role: newRole,
                    password: newPassword || undefined,
                  });
                  setNewUsername("");
                  setNewDisplayName("");
                  setNewPassword("");
                })
              }
            >
              Add user
            </button>
          </div>
        </div>
        {users.length > 0 && (
          <table className="grid" style={{ marginBottom: 12 }}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Source</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="mono">{u.username}</td>
                  <td>{u.display_name ?? "—"}</td>
                  <td>
                    <StatusBadge status={u.role} />
                  </td>
                  <td>{u.source}</td>
                  <td className="faint">{timeAgo(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="form-row">
            <select value={keyUsername} onChange={(e) => setKeyUsername(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.username}>
                  {u.username} ({u.role})
                </option>
              ))}
            </select>
            <input type="text" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            <button
              className="primary"
              onClick={() =>
                act(async () => {
                  const created = await api.createApiKey({ username: keyUsername, name: keyName.trim() || undefined });
                  setIssuedToken(created.token);
                })
              }
            >
              Issue API key
            </button>
          </div>
          {issuedToken && (
            <pre className="mono" style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
              {issuedToken}
            </pre>
          )}
        </div>
        {keys.length === 0 ? (
          <div className="empty">No API keys issued.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>User</th>
                <th>Name</th>
                <th>Created</th>
                <th>Last used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="mono">{k.username}</td>
                  <td>{k.name ?? "api key"}</td>
                  <td className="faint">{timeAgo(k.created_at)}</td>
                  <td className="faint">{k.last_used_at ? timeAgo(k.last_used_at) : "never"}</td>
                  <td>
                    <button className="danger" onClick={() => act(() => api.deleteApiKey(k.id))}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Webhooks</h2>
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="form-row">
            <input
              type="text"
              placeholder="https://hooks.slack.com/services/… or any HTTPS endpoint"
              value={hookUrl}
              style={{ flex: 1, minWidth: 320 }}
              onChange={(e) => setHookUrl(e.target.value)}
            />
            <select value={hookFormat} onChange={(e) => setHookFormat(e.target.value)}>
              <option value="json">JSON payload</option>
              <option value="slack">Slack message (interactive)</option>
              <option value="gchat">Google Chat message</option>
            </select>
            <button
              className="primary"
              onClick={() => act(() => api.createWebhook({ url: hookUrl, events: [], format: hookFormat }))}
            >
              Add webhook
            </button>
          </div>
          <span className="faint">Fires on: {WEBHOOK_EVENTS.join(", ")}</span>
        </div>
        {webhooks.length === 0 ? (
          <div className="empty">No webhooks configured.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>URL</th>
                <th>Format</th>
                <th>Events</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id}>
                  <td className="mono">{w.url}</td>
                  <td>{w.format}</td>
                  <td className="dim">{(JSON.parse(w.events) as string[]).join(", ") || "all"}</td>
                  <td>
                    <button className="danger" onClick={() => act(() => api.deleteWebhook(w.id))}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Repo subscriptions (git push-back)</h2>
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="form-row">
            <select value={subTypeId} onChange={(e) => setSubTypeId(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.scope === "global" ? `${t.name} (global)` : t.name}
                </option>
              ))}
            </select>
            <input type="text" placeholder="owner/repo" value={subRepo} onChange={(e) => setSubRepo(e.target.value)} />
            <input type="text" value={subBranch} style={{ width: 90 }} onChange={(e) => setSubBranch(e.target.value)} />
            <input type="text" value={subPath} style={{ width: 90 }} onChange={(e) => setSubPath(e.target.value)} />
            <button
              className="primary"
              onClick={() =>
                act(() =>
                  api.createSubscription({ project_type_id: subTypeId, repo: subRepo, branch: subBranch, base_path: subPath })
                )
              }
            >
              Subscribe repo
            </button>
          </div>
          <span className="faint">
            Approved spec versions open PRs against subscribed repos. Requires GITHUB_TOKEN on the server.
          </span>
        </div>
        {subs.length === 0 ? (
          <div className="empty">No repos subscribed.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Project type</th>
                <th>Repo</th>
                <th>Branch</th>
                <th>Path</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>{s.project_type_name}</td>
                  <td className="mono">{s.repo}</td>
                  <td className="mono">{s.branch}</td>
                  <td className="mono">{s.base_path}/</td>
                  <td>
                    <button className="danger" onClick={() => act(() => api.deleteSubscription(s.id))}>
                      Unsubscribe
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>
          Sync jobs{" "}
          <button style={{ marginLeft: 8 }} onClick={() => act(() => api.runSyncJobs())}>
            Run pending
          </button>
        </h2>
        {jobs.length === 0 ? (
          <div className="empty">No sync jobs yet — approve a spec change for a subscribed project type.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Status</th>
                <th>Spec</th>
                <th>Version</th>
                <th>Repo</th>
                <th>Detail</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <StatusBadge status={j.status === "done" ? "approved" : j.status === "error" ? "rejected" : "pending"} />
                  </td>
                  <td className="mono">{j.filename}</td>
                  <td className="mono">{j.version}</td>
                  <td className="mono">{j.repo}</td>
                  <td className="dim">{j.detail ?? "—"}</td>
                  <td className="faint">{timeAgo(j.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
