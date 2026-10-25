import { useState } from 'react'
import { t } from './lib/i18n'

export default function BuyerAuth({
  authMode,
  setAuthMode,
  authFlow,
  setAuthFlow,
  otpPurpose,
  error,
  notice,
  setError,
  onSubmit,
  onOtpSubmit,
  onResetPassword,
  onResendOtp,
  busy,
  language,
  authPhone,
  setAuthPhone
}) {
  const tr = (text) => t(text, language)
  const verifying = authFlow === 'otp'
  const resettingPassword = authFlow === 'reset-password'
  const forgotPassword = authFlow === 'forgot'
  const credentialsScreen = !verifying && !resettingPassword && !forgotPassword
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showSigninPassword, setShowSigninPassword] = useState(false)
  const [showSignupPasswordConfirmation, setShowSignupPasswordConfirmation] = useState(false)

  const passwordToggle = (visible, setVisible) => (
    <button
      className="buyer-auth-password-toggle"
      type="button"
      onClick={() => setVisible(!visible)}
      aria-label={tr(visible ? 'Hide password' : 'Show password')}
      aria-pressed={visible}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {visible ? (
          <>
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </>
        ) : (
          <>
            <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3.2 3.9M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4-.8" />
          </>
        )}
      </svg>
    </button>
  )

  return (
    <main className="buyer-auth-screen">
      <section className="buyer-auth-card" aria-labelledby="buyer-auth-title">
        <div className="buyer-auth-heading">
          {!credentialsScreen && <p className="buyer-auth-eyebrow">{verifying ? tr('PHONE VERIFICATION') : resettingPassword ? tr('PASSWORD RESET') : tr('ACCOUNT RECOVERY')}</p>}
          <h1 id="buyer-auth-title">{verifying ? tr('Verify your phone') : resettingPassword ? tr('Create a new password') : forgotPassword ? tr('Forgot password?') : authMode === 'signup' ? tr('Create account') : tr('Log in')}</h1>
          {verifying && <p className="buyer-auth-subtitle">{tr('Enter the 6-digit code sent to')} <strong>{authPhone}</strong></p>}
        </div>

        {verifying ? (
          <form className="buyer-auth-form" onSubmit={onOtpSubmit}>
            <label className="buyer-auth-label" htmlFor="buyer-otp">{tr('6-digit verification code')}</label>
            <input
              id="buyer-otp"
              className="buyer-auth-input buyer-otp-input"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              aria-label={tr('6-digit verification code')}
              required
            />
            {error && <p className="buyer-auth-error" role="alert">{tr(error)}</p>}
            {notice && <p className="buyer-auth-notice" role="status">{tr(notice)}</p>}
            <button className="buyer-auth-primary" type="submit" disabled={busy}>{busy ? tr('Please wait…') : otpPurpose === 'signup' ? tr('Create account') : tr('Verify code')}</button>
            <div className="buyer-auth-footer">
              <button className="buyer-auth-link" type="button" onClick={onResendOtp} disabled={busy}>{tr('Resend code')}</button>
              <button className="buyer-auth-link" type="button" onClick={() => { setError(''); setAuthFlow('login') }}>{tr('Change phone number')}</button>
            </div>
          </form>
        ) : resettingPassword ? (
          <form className="buyer-auth-form" onSubmit={onResetPassword}>
            <label className="buyer-auth-label" htmlFor="buyer-new-password">{tr('New password')}</label>
            <input id="buyer-new-password" className="buyer-auth-input" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} placeholder={tr('At least 8 characters')} required />
            {error && <p className="buyer-auth-error" role="alert">{tr(error)}</p>}
            {notice && <p className="buyer-auth-notice" role="status">{tr(notice)}</p>}
            <button className="buyer-auth-primary" type="submit" disabled={busy}>{busy ? tr('Please wait…') : tr('Update password')}</button>
            <button className="buyer-auth-link" type="button" onClick={() => { setError(''); setAuthFlow('login') }}>{tr('Back to login')}</button>
          </form>
        ) : (
          <form className="buyer-auth-form" onSubmit={onSubmit}>
            {!forgotPassword && authMode === 'signup' && <>
              <label className="buyer-auth-label" htmlFor="buyer-name">{tr('Name')}</label>
              <input id="buyer-name" className="buyer-auth-input" name="name" autoComplete="name" placeholder={tr('Enter your name')} maxLength={120} required />
            </>}
            <label className="buyer-auth-label" htmlFor="buyer-phone">{forgotPassword ? tr('Phone number') : authMode === 'signup' ? tr('Phone number') : tr('Phone number or Email')}</label>
            <input
              id="buyer-phone"
              className="buyer-auth-input"
              name={authMode === 'signin' && !forgotPassword ? 'identifier' : 'phone'}
              type={authMode === 'signin' && !forgotPassword ? 'text' : 'tel'}
              inputMode={authMode === 'signin' && !forgotPassword ? 'text' : 'tel'}
              autoComplete={authMode === 'signin' && !forgotPassword ? 'username' : 'tel'}
              {...(authMode === 'signin' && !forgotPassword ? {
                placeholder: tr('09xxxxxxxxx or you@email.com'),
                maxLength: 254
              } : {
                value: authPhone,
                onChange: (event) => setAuthPhone(event.target.value),
                placeholder: '09xxxxxxxxx',
                maxLength: 18
              })}
              required
            />
            {!forgotPassword && authMode === 'signup' && <>
              <label className="buyer-auth-label" htmlFor="buyer-email">{tr('Gmail')}</label>
              <input
                id="buyer-email"
                className="buyer-auth-input"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={tr('Enter your Gmail address')}
                maxLength={254}
                required
              />
            </>}
            {!forgotPassword && <>
              <label className="buyer-auth-label" htmlFor="buyer-password">{tr('Password')}</label>
              <div className="buyer-auth-password-field">
                <input id="buyer-password" className="buyer-auth-input" name="password" type={(authMode === 'signup' ? showSignupPassword : showSigninPassword) ? 'text' : 'password'} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={8} maxLength={256} placeholder={tr('Enter your password')} required />
                {authMode === 'signup' ? passwordToggle(showSignupPassword, setShowSignupPassword) : passwordToggle(showSigninPassword, setShowSigninPassword)}
              </div>
              {authMode === 'signup' && <>
                <label className="buyer-auth-label" htmlFor="buyer-confirm-password">{tr('Confirm password')}</label>
                <div className="buyer-auth-password-field">
                  <input id="buyer-confirm-password" className="buyer-auth-input" name="confirmPassword" type={showSignupPasswordConfirmation ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={256} placeholder={tr('Confirm your password')} required />
                  {passwordToggle(showSignupPasswordConfirmation, setShowSignupPasswordConfirmation)}
                </div>
              </>}
            </>}
            {error && <p className="buyer-auth-error" role="alert">{tr(error)}</p>}
            {notice && <p className="buyer-auth-notice" role="status">{tr(notice)}</p>}
            <button className="buyer-auth-primary" type="submit" disabled={busy}>{busy ? tr('Please wait…') : forgotPassword ? tr('Send OTP code') : authMode === 'signup' ? tr('Create account') : tr('Log in')}</button>
          </form>
        )}

        {!verifying && !resettingPassword && <div className="buyer-auth-footer">
          {authMode === 'signin' && !forgotPassword && <button className="buyer-auth-link" type="button" onClick={() => { setError(''); setAuthFlow('forgot') }}>{tr('Forgot password?')}</button>}
          <button
            className="buyer-auth-link"
            type="button"
            onClick={() => {
              setError('')
              setAuthFlow('login')
              if (!forgotPassword) setAuthMode(authMode === 'signin' ? 'signup' : 'signin')
            }}
          >
            {forgotPassword ? tr('Back to login') : authMode === 'signin' ? tr('Create an account') : tr('Log in')}
          </button>
        </div>}
      </section>
    </main>
  )
}
