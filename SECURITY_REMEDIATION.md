# Security Remediation (Audit Checklist)

## Completed steps

1. **Removed sensitive files from version control**
   - Deleted temporary/debug scripts (`.tmp-*`) that contained test credentials, emails, and passwords.
   - Updated `.gitignore` to ignore debug/QA artifacts (`.tmp-*`, `.qa-*`, `qa-password-toggle.mjs`), environment files, and local data stores.
   - Verified no sensitive data files are tracked by Git.

2. **Rotated AUTH_SECRET**
   - Generated a new 256-bit `AUTH_SECRET` and stored it in `.env` (gitignored).
   - Removed reliance on an ephemeral in-process secret for production by documenting the required variable.
   - Existing OTP challenges and recovery flows are invalidated by the rotation.

3. **Reset customer passwords**
   - Created `scripts/reset-customer-passwords.mjs` to clear stored password hashes/salts and mark all accounts as requiring a reset.
   - Executed the script against `data/shop.json` and the migrated `data/shop.sqlite`.
   - Cleared in-flight auth challenges and rate-limit records.
   - Customers must complete the existing phone-OTP password reset flow to regain access.

## Follow-up recommendations
- Configure Twilio Verify and SMTP credentials in `.env`/secret manager before production.
- Run `npm run admin:setup` with a strong `ADMIN_PASSWORD` to recreate the admin account.
- Keep `AUTH_SECRET` stable across restarts and rotate again only during a planned maintenance window.
