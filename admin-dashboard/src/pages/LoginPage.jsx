import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../state/adminAuth.js';
import styles from './login.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading } = useAdminAuth();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [err, setErr] = React.useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    try {
      await login({ username, password });
      navigate('/countries');
    } catch (e2) {
      setErr(e2.message || 'Login failed');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.title}>CEC Admin Dashboard</div>
        <div className={styles.sub}>Login to update database values</div>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label}>
            Username
            <input
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {err ? <div className={styles.err}>{err}</div> : null}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

