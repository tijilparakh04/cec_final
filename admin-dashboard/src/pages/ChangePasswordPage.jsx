import React from 'react';
import { useAdminApi } from '../state/adminApi.js';
import { useAdminAuth } from '../state/adminAuth.js';

export default function ChangePasswordPage() {
  const api = useAdminApi();
  const { me } = useAdminAuth();

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [err, setErr] = React.useState(null);
  const [msg, setMsg] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  function validatePassword(p) {
    // Requirement: at least 8 letters, one number and one caps
    // Example: "Abcdefg1"
    if (typeof p !== 'string') return 'Password must be a string';
    if (p.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(p)) return 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(p)) return 'Password must contain at least one number';
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const pwErr = validatePassword(newPassword);
    if (pwErr) {
      setErr(pwErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('New password and confirm password do not match');
      return;
    }

    // Backend only updates password hash when authorized.
    // It doesn't verify current password (since we only have JWT scope).
    // If you want strict current-password verification, backend must check it.
    // We still send currentPassword so backend can optionally validate later.

    setSaving(true);
    try {
      await api.put('/api/admin/me', {
        // Keep current password in payload for future backend enforcement
        // (backend may ignore it).
        currentPassword,
        password: newPassword,
      });
      setMsg('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e2) {
      setErr(e2.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 700 }}>
        Change password {me?.username ? `(${me.username})` : ''}
      </div>

      <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--tx3)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          Admin password
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--tx2)' }}>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{ background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '10px 10px', color: 'var(--tx)' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--tx2)' }}>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '10px 10px', color: 'var(--tx)' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
            <span style={{ fontSize: 10, color: 'var(--tx2)' }}>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '10px 10px', color: 'var(--tx)' }}
            />
          </label>

          {err ? (
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#e8453c' }}>{err}</div>
          ) : null}
          {msg ? (
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--ln)' }}>{msg}</div>
          ) : null}

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                border: '1px solid var(--ac)',
                background: 'rgba(210,166,121,.12)',
                color: 'var(--ac)',
                padding: '10px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 800,
              }}
            >
              {saving ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--tx3)', lineHeight: 1.6 }}>
          Password rules: minimum 8 characters, at least one uppercase letter, and at least one number.
        </div>
      </div>
    </div>
  );
}

