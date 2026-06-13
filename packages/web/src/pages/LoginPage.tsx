import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setSession } from "../api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const navigate = useNavigate();

  async function submit() {
    setError(undefined);
    try {
      const { token, user } = await api.login(username, password);
      setSession(token, user.username);
      navigate("/");
      window.location.reload(); // refresh sidebar identity
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Sign in</h1>
        <span className="sub">Local account or LDAP, depending on server configuration</span>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="card" style={{ maxWidth: 380 }}>
        <div className="form-row">
          <input
            type="text"
            placeholder="Username"
            value={username}
            style={{ width: "100%" }}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-row">
          <input
            type="password"
            placeholder="Password"
            value={password}
            style={{ width: "100%" }}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <button className="primary" onClick={submit}>
          Sign in
        </button>
        <p className="faint" style={{ marginBottom: 0 }}>
          Tokens authorize role-gated actions (approvals, settings). The default local admin is
          <span className="mono"> admin</span> / <span className="mono">$SPECREG_ADMIN_PASSWORD</span>.
        </p>
      </div>
    </>
  );
}
