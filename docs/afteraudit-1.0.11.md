# Afteraudit 1.0.11

Date: 2026-02-07

## Scope
Release 1.0.11 changes: Verified CRX Uploads packaging guidance and RSA key generation in packaging script.

## Checks Performed
1. Reviewed README package guidance and private key safety warnings.
2. Verified `package.sh` generates a 2048-bit RSA key if missing.
3. Confirmed `keys/` is ignored by git.
4. Reviewed manifest version bump and release notes entry.

## Findings
1. No new high-risk issues found in the changed areas.
2. Packaging now creates the required key material consistently when absent.

## Residual Risks
1. Users may overwrite keys if they delete `keys/` unintentionally.

## Recommendations
1. Backup `keys/privatekey.pem` securely and restrict access.
