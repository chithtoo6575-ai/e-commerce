import { useState } from 'react'
import { AdminLanguageSelector, adminT } from './adminI18n'

export default function AdminLoginPage({
  role,
  language,
  onLanguageChange,
  login,
  onLoginChange,
  onSubmit,
  error
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isStaff = role === 'staff'
  const isUnified = role === 'unified'

  return (
    <main className="admin-login">
      <div className="admin-login-language">
        <AdminLanguageSelector language={language} onChange={onLanguageChange} />
      </div>
      <section className="login-panel" aria-labelledby="admin-login-title">
        <div className="admin-mark" aria-hidden="true">H</div>
        <p className="admin-kicker">{adminT(isUnified ? 'ADMIN DASHBOARD ACCESS' : isStaff ? 'STAFF DASHBOARD ACCESS' : 'OWNER DASHBOARD ACCESS', language)}</p>
        <h1 id="admin-login-title">{adminT('HTOO ATELIER', language)}</h1>
        <p className="admin-tagline">
          {adminT(isUnified ? 'Sign in with your Owner or Staff Gmail and password.' : isStaff ? 'Sign in with your Staff Gmail and password.' : 'Sign in with the Owner account to access all dashboard features.', language)}
        </p>

        <form onSubmit={onSubmit}>
          <label htmlFor={isStaff ? 'staff-email' : 'owner-email'}>
            {adminT(isUnified || isStaff ? 'Gmail' : 'Owner Email', language)}
            <input
              id={isStaff ? 'staff-email' : 'owner-email'}
              type="email"
              name="email"
              autoComplete="username"
              required
              value={login.email}
              onChange={(event) => onLoginChange({ ...login, email: event.target.value })}
            />
          </label>
          <label htmlFor="account-password">
            {adminT(isUnified ? 'Password' : isStaff ? 'Staff Password' : 'Owner Password', language)}
            <span className="admin-password-field">
              <input
                id="account-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder={adminT('Enter password', language)}
                required
                value={login.password}
                onChange={(event) => onLoginChange({ ...login, password: event.target.value })}
              />
              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={adminT(showPassword ? 'Hide password' : 'Show password', language)}
                aria-controls="account-password"
                aria-pressed={showPassword}
                title={adminT(showPassword ? 'Hide password' : 'Show password', language)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  {showPassword ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                      <path d="M9.9 5.1A10.9 10.9 0 0112 5c5 0 9 4.5 9 7 0 1-.5 2.1-1.3 3.1" />
                      <path d="M6.2 6.2C4.2 7.7 3 9.6 3 12c0 2.5 4 7 9 7 1.5 0 2.9-.4 4.1-1" />
                    </>
                  ) : (
                    <>
                      <path d="M3 12c0-2.5 4-7 9-7s9 4.5 9 7-4 7-9 7-9-4.5-9-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </span>
          </label>
          {error && <div className="admin-error" role="alert">{adminT(error, language)}</div>}
          <button className="admin-primary" type="submit">
            {adminT('Sign In to Dashboard →', language)}
          </button>
        </form>
      </section>
    </main>
  )
}
