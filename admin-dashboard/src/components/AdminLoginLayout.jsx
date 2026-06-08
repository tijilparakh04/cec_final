import React from 'react';

export default function AdminLoginLayout({ title, subtitle, children }) {
  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-title">{title}</div>
        <div className="admin-login-sub">{subtitle}</div>
        {children}
      </div>
    </div>
  );
}

