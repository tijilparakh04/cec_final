import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../state/adminAuth.js';

export default function AdminShell() {
  const navigate = useNavigate();
  const { me, logout } = useAdminAuth();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--tx)', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          height: 50,
          background: 'var(--sf)',
          borderBottom: '1px solid var(--bd)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>CEC Admin</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--tx2)' }}>
            {me?.role === 'overall' ? 'Overall admin' : `Country admin (${me?.country_iso3})`}
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            style={{
              border: '1px solid var(--bd)',
              background: 'var(--sf2)',
              color: 'var(--tx2)',
              padding: '8px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside
          style={{
            width: 260,
            background: 'var(--sf)',
            borderRight: '1px solid var(--bd)',
            padding: 12,
            overflow: 'auto',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--tx3)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            Admin tools
          </div>
          <button
            onClick={() => navigate('/countries')}
            style={{
              width: '100%',
              padding: '10px 10px',
              borderRadius: 6,
              border: '1px solid var(--bd)',
              background: 'var(--sf2)',
              color: 'var(--tx2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: 8,
            }}
          >
            Countries
          </button>

          <button
            onClick={() => navigate('/change-password')}
            style={{
              width: '100%',
              padding: '10px 10px',
              borderRadius: 6,
              border: '1px solid var(--bd)',
              background: 'var(--sf2)',
              color: 'var(--tx2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: 8,
            }}
          >
            Change password
          </button>

          <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 14, lineHeight: 1.6 }}>
            Edit countries and their related facts.
          </div>
        </aside>

        <main style={{ flex: 1, padding: 16, minWidth: 0, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

