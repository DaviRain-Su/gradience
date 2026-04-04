# Security Policy

## Reporting Security Issues

If you discover a security vulnerability, please report it privately by emailing security@gradiences.xyz. Do not open a public issue.

We will respond within 48 hours and work with you to address the issue promptly.

## Security Best Practices

### Environment Variables

- **Never commit `.env` files to git**. All environment files are listed in `.gitignore`.
- Use `.env.example` files as templates and copy them to `.env` or `.env.local` with real values.
- Keep production secrets in a secure secrets manager (e.g., Doppler, HashiCorp Vault).

### Database Passwords

Generate strong passwords using:

```bash
openssl rand -hex 32
```

### Solana Program Keypairs

Program keypair files (`program-keypair.json`) contain private keys that control deployed programs.

- **Never commit these files to git** (they are listed in `.gitignore`).
- Store them in a secure location (e.g., 1Password, hardware security module).
- If a keypair is compromised, the program must be redeployed with a new keypair.

## Incident Response

### April 4, 2026 - Credential Cleanup

**Status**: Resolved

**Summary**: Production credentials were inadvertently committed to the repository and have been removed.

**Affected Credentials** (all have been rotated or removed):

- PostgreSQL password
- Privy App IDs (3 applications)
- Server IP address and email
- Solana program keypairs

**Actions Taken**:

1. Removed all `.env` files with real secrets from the repository
2. Deleted all `program-keypair.json` files
3. Updated `.gitignore` to prevent future commits of sensitive files
4. Removed CI `continue-on-error` flags that masked build failures
5. Removed default/fallback passwords from Docker Compose
6. Changed deployment user from `root` to `gradience`

**Required Actions for Deployers**:

If you were using the credentials that were in the repository:

1. **Rotate PostgreSQL password**:

    ```bash
    # Generate new password
    openssl rand -hex 32

    # Update in your production .env.prod file
    # Restart services
    docker compose -f deploy/docker-compose.prod.yml restart
    ```

2. **Rotate Privy App IDs**:
    - Go to https://dashboard.privy.io
    - Create new apps or regenerate keys for existing apps
    - Update `NEXT_PUBLIC_PRIVY_APP_ID` in your environment files

3. **Regenerate Solana program keypairs** (if needed):

    ```bash
    solana-keygen new -o program-keypair.json
    ```

4. **Review server access**:
    - Change server SSH keys
    - Review access logs for unauthorized access

## Dependencies

We monitor dependencies for security vulnerabilities using automated tooling. Critical vulnerabilities are patched within 24 hours of disclosure.

## Contact

- Security issues: security@gradiences.xyz
- General questions: hello@gradiences.xyz
