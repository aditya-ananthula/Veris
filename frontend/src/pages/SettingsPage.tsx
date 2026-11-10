import { useCallback, useEffect, useState } from 'react';
import { Server, Shield, Database, Palette } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { Capabilities,Health } from '../types';
export function SettingsPage(){
  const [data, setData] = useState<{ health: Health; caps: Capabilities }>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([api.health(), api.capabilities()])
      .then(([health, caps]) => { if (active) setData({ health, caps }); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const load = useCallback(() => setRevision(r => r + 1), []);

  return (
    <section className="page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Workspace configuration</span>
          <h1>Settings & system status</h1>
          <p>Live service information and the settings that shape your workspace.</p>
        </div>
        <button onClick={load}>Refresh</button>
      </header>

      {error && (
        <div className="status error" role="alert">
          {error}
          <button onClick={load}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="loading-state" role="status">
          Checking services…
          <div className="skeleton" />
        </div>
      ) : data && (
        <div className="settings-grid">
          <section className="panel">
            <h2><Server size={20} /> Connection</h2>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{data.health.status}</dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>{data.health.app}</dd>
              </div>
              <div>
                <dt>Answer model</dt>
                <dd>{data.caps.llm_model}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <h2><Shield size={20} /> Provider access</h2>
            <span className={'badge badge-' + (data.caps.nvidia_configured ? 'success' : 'warn')}>
              {data.caps.nvidia_configured ? 'Configured' : 'Not configured'}
            </span>
            <p className="muted">
              {data.caps.nvidia_configured
                ? 'Document analysis and answers can use the configured provider.'
                : 'Ask your workspace administrator to configure the answer provider.'}
            </p>
            <p className="muted">Provider keys stay on the server.</p>
          </section>

          <section className="panel">
            <h2><Database size={20} /> Documents & storage</h2>
            <dl>
              <div>
                <dt>Maximum file size</dt>
                <dd>{data.caps.max_upload_mb} MB</dd>
              </div>
              <div>
                <dt>Supported formats</dt>
                <dd>{data.caps.supported_extensions.join(', ')}</dd>
              </div>
              <div>
                <dt>Automatic expiry</dt>
                <dd>Disabled</dd>
              </div>
              <div>
                <dt>Vector storage</dt>
                <dd>{data.caps.persistence}</dd>
              </div>
            </dl>
            <Link to="/documents">Manage individual documents →</Link>
          </section>

          <section className="panel">
            <h2><Palette size={20} /> Appearance</h2>
            <p className="muted">The cosmic glass theme is always active. The workspace respects your system's reduced-motion preference. Use browser zoom to adjust reading size.</p>
          </section>
        </div>
      )}
    </section>
  );
}
