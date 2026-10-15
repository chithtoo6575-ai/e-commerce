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
  continueAsGuest,
  busy,
  language,
  authPhone,
  setAuthPhone
}) {
  const tr = (text) => t(text, language)
  const verifying = authFlow === 'otp'
  const resettingPassword = authFlow === 'reset-password'
  const forgotPassword = authFlow === 'forgot'

  return (
    <main className="buyer-auth-screen">
      <section className="buyer-auth-card" aria-labelledby="buyer-auth-title">
        <header className="buyer-auth-banner">
          <img src="/auth-banner.svg" alt="" aria-hidden="true" />
          <div className="buyer-auth-banner-copy">
            <span>HTOO ONLINE</span>
            <strong>{tr('A little joy in every order')}</strong>
          </div>
        </header>

        <div className="buyer-auth-heading">
          <p className="buyer-auth-eyebrow">{verifying ? tr('PHONE VERIFICATION') : tr('WELCOME TO HTOO')}</p>
          <h1 id="buyer-auth-title">{verifying ? tr('Verify your phone') : resettingPassword ? tr('Create a new password') : forgotPassword ? tr('Forgot password?') : authMode === 'signup' ? tr('Create your account') : tr('Welcome back')}</h1>
          <p className="buyer-auth-subtitle">
            {verifying
              ? <>{tr('Enter the 6-digit code sent to')} <strong>{authPhone}</strong></>
              : resettingPassword
                ? tr('Enter a new password for your account.')
                : forgotPassword
                  ? tr('We’ll text you a code to reset your password.')
              : authMode === 'signup'
                ? tr('Create an account with your phone number.')
                : tr('Log in with your phone number and password.')}
          </p>
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
            <label className="buyer-auth-label" htmlFor="buyer-phone">{tr('Phone number')}</label>
            <input
              id="buyer-phone"
              className="buyer-auth-input"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={authPhone}
              onChange={(event) => setAuthPhone(event.target.value)}
              placeholder="09xxxxxxxxx"
              maxLength={18}
              aria-describedby={authMode === 'signup' && !forgotPassword ? 'buyer-phone-hint' : undefined}
              required
            />
            {!forgotPassword && <>
              <label className="buyer-auth-label" htmlFor="buyer-password">{tr('Password')}</label>
              <input id="buyer-password" className="buyer-auth-input" name="password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={8} maxLength={256} placeholder={tr('Enter your password')} required />
              {authMode === 'signup' && <p id="buyer-phone-hint" className="buyer-auth-hint">{tr('We’ll text you a one-time verification code.')}</p>}
            </>}
            {error && <p className="buyer-auth-error" role="alert">{tr(error)}</p>}
            {notice && <p className="buyer-auth-notice" role="status">{tr(notice)}</p>}
            <button className="buyer-auth-primary" type="submit" disabled={busy}>{busy ? tr('Please wait…') : forgotPassword ? tr('Send OTP code') : authMode === 'signup' ? tr('Send OTP code') : tr('Log in')}</button>
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
            {forgotPassword ? tr('Back to login') : authMode === 'signin' ? tr('New to Htoo? Create an account') : tr('Already have an account? Sign in')}
          </button>
          {!forgotPassword && <button className="buyer-auth-guest" type="button" onClick={continueAsGuest}>{tr('Continue as Guest')}</button>}
        </div>}
      </section>
    </main>
  )
}
