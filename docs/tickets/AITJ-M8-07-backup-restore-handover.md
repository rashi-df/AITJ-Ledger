# AITJ-M8-07 — Backup runbook, rehearsed restore and handover documentation

| Field | Value |
|---|---|
| Milestone | M8 — Hardening |
| Depends on | AITJ-M8-06 |
| Blocks | none |
| PRD refs | §12.5 backup runbook, §15 D1, NFR-10, §13 Manual row |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The client has decided against automated backups (Q6, §3.4) and accepts the risk: data loss is bounded by the time since the last manual run, and the backup is only as reliable as the person executing the runbook. A NAMED OWNER must be assigned at handover (D1, §15), and the runbook itself must be documented and validated. The RED phase is a documented restore procedure that has never been executed; GREEN is a completed rehearsal with verification evidence (row counts and a decimal checksum) recorded in this ticket. This is not a code change — it is operational documentation and proof that restore works.

## Acceptance criteria

- [ ] AC1 — A documented backup runbook (markdown or shell script) exists, covering the weekly `docker compose exec db pg_dump` command with exact syntax, output location, and off-server copy destination
- [ ] AC2 — The runbook specifies WHO is responsible (by name or role, e.g. "Treasurer") and includes their contact information for escalation if backup fails
- [ ] AC3 — The runbook covers restore procedure: stopping the app, running `docker compose exec db psql < backup.sql`, and verification steps
- [ ] AC4 — Restore procedure includes verification: row count checks (`SELECT COUNT(*) FROM "Transaction"`) and a decimal checksum of all transaction amounts (`SELECT SUM(amount) FROM "Transaction"`) to confirm the restore matches the backup
- [ ] AC5 — Handover documentation covers rotating AUTH_SECRET and the admin password if a key compromise is suspected
- [ ] AC6 — Handover documentation covers applying a database migration in production (running `prisma migrate deploy` inside the app container)
- [ ] AC7 — Handover documentation covers troubleshooting: what to check if the app will not boot (env vars, database connectivity, disk space, migrations status)
- [ ] AC8 — The backup runbook is tested once during M8 against a real `pg_dump` file; restore is executed, verified, and the results are recorded in this ticket with:
  - [ ] Source database row count and checksum
  - [ ] Restored database row count and checksum
  - [ ] Verification that restored data matches source (checksums are identical)
  - [ ] Timestamp of the rehearsal and operator name
- [ ] AC9 — Handover documentation includes a checklist for the committee at go-live (e.g. confirm masjid name is set, test login as the admin user, add a test transaction, export a report, print a report)
- [ ] AC10 — A section explicitly states that manual backup is by client decision (Q6) and that data loss risk is bounded by backup frequency, not by system design

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Database with 10,000 transactions | Backup and restore complete without timeout; row count and checksum match exactly |
| E2 | Backup file is corrupted (first few bytes are lost) | Restore command fails with a clear error (e.g. "Invalid SQL"); procedure does not silently load partial data |
| E3 | Restore while app is running | Procedure explicitly warns to stop the app first; if attempted while running, restore may fail or data may be inconsistent |
| E4 | AUTH_SECRET needs rotation | Procedure documents that AUTH_SECRET is a Next.js Auth.js value, used to sign JWT sessions; rotating it invalidates all existing sessions (users must log in again); no persistent user state is stored in JWT |
| E5 | New migration is committed, but production has not run it | Procedure documents running `docker compose exec app npx prisma migrate deploy`; shows expected output (e.g. "Applied migration X") |
| E6 | Database is unavailable on boot | App startup logs will show `Error: getaddrinfo ENOTFOUND db` or similar; procedure documents checking `docker compose logs db` and `docker compose ps` |
| E7 | Disk space is exhausted | `docker compose logs` will show `ERROR: could not extend file ... (No space left on device)`; procedure documents checking disk with `df -h` |
| E8 | pg_dump backup is very large (>1GB) | Backup and restore take longer but complete; size is noted in runbook to inform scheduling and storage planning |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | manual | `handover > backup runbook documented` | File `docs/BACKUP_RUNBOOK.md` exists and contains sections: Backup procedure, Restore procedure, Verification, Owner assignment, Troubleshooting, Go-live checklist |
| T2 | manual | `handover > restore verification includes row count` | Runbook includes command `SELECT COUNT(*) FROM "Transaction"` as a verification step |
| T3 | manual | `handover > restore verification includes checksum` | Runbook includes command `SELECT SUM(amount) FROM "Transaction"` to verify amounts match after restore |
| T4 | manual | `handover > auth secret rotation documented` | Handover docs include section on rotating AUTH_SECRET; explain that it invalidates sessions; include command to generate new secret |
| T5 | manual | `handover > migration procedure documented` | Handover docs cover applying a pending migration: stop app (optional but recommended), run `docker compose exec app npx prisma migrate deploy`, restart app |
| T6 | manual | `handover > troubleshooting section` | Handover docs include troubleshooting: app will not boot (check env vars, logs), database will not start (check disk space, logs), migrations fail (check database state with `psql`) |
| T7 | manual | `handover > go-live checklist` | Handover docs include checklist: masjid name set in Settings, admin account login tested, test transaction added and visible in dashboard, report printed, CSV exported |
| T8 | manual | `handover > manual backup is by client decision` | Runbook or handover docs state plainly: "Manual backup was the client's decision. Automated backups are recommended for v1.1. Data loss is bounded by the time since the last successful backup." |
| T9 | manual | `rehearsal > backup and restore executed` | In a test environment, run the backup command from the runbook; capture output and file |
| T10 | manual | `rehearsal > source database state recorded` | Query source database: `SELECT COUNT(*) FROM "Transaction"` and `SELECT SUM(amount) FROM "Transaction"`; record both values |
| T11 | manual | `rehearsal > restore executed against dump` | Run the restore procedure on a fresh database; restore completes without errors |
| T12 | manual | `rehearsal > restored database state matches source` | Query restored database: `SELECT COUNT(*) FROM "Transaction"` and `SELECT SUM(amount) FROM "Transaction"`; both match source exactly |
| T13 | manual | `rehearsal > verification recorded in ticket` | This ticket is updated with: source row count, source checksum, restored row count, restored checksum, timestamp, and operator name |

**Red gate:** Runbook does not exist. Verification steps are not documented. Backup or restore has never been executed. Source and restored databases are not compared.

### 🟢 GREEN — implementation is done when

- [ ] Backup runbook is documented and includes exact command syntax, owner assignment, and off-server copy destination
- [ ] Restore procedure is documented with verification steps (row count and checksum)
- [ ] Handover documentation covers AUTH_SECRET rotation, migration deployment, and troubleshooting
- [ ] Rehearsal is executed against a real dump; source and restored databases are verified to match
- [ ] Go-live checklist is provided for the committee
- [ ] Plainly state that manual backup is by client decision; data loss risk is bounded by backup frequency

## Implementation notes

- **Backup runbook document:** Create `docs/BACKUP_RUNBOOK.md` with the following structure:
  ```markdown
  # AITJ Ledger — Backup & Restore Runbook
  
  ## Quick summary
  - **Backup:** Weekly, every Sunday at 23:00 IST
  - **Owner:** [Name to be assigned at handover]
  - **Destination:** [Off-server copy location to be decided with client]
  - **Risk:** Data loss is bounded by the time since the last backup (no automation in v1)
  
  ## Backup procedure
  
  ### Prerequisites
  - SSH access to the production VPS
  - `docker-compose` installed and the app is running
  - Enough disk space on the VPS and the backup destination
  
  ### Steps
  
  1. Connect to the VPS:
     ```bash
     ssh user@production-ip
     cd /path/to/aitj-ledger
     ```
  
  2. Create a backup:
     ```bash
     docker compose exec -T db pg_dump \
       -U aitj_user \
       -d aitj_ledger \
       -F c \
       --no-password > backup_$(date +%Y%m%d_%H%M%S).dump
     ```
     (The `-T` flag prevents interactive TTY allocation; useful for cron jobs.)
  
  3. Verify the backup file was created:
     ```bash
     ls -lh backup_*.dump
     ```
     Expected output: file size >1MB (depends on data volume).
  
  4. Copy the backup to an off-server location (e.g. cloud storage, external disk):
     ```bash
     # Example: upload to AWS S3
     aws s3 cp backup_*.dump s3://your-backup-bucket/aitj-ledger/ --region us-east-1
     
     # Or: copy to an external disk mounted at /mnt/backup
     cp backup_*.dump /mnt/backup/
     ```
  
  5. Verify the backup file exists in the destination:
     ```bash
     # For S3
     aws s3 ls s3://your-backup-bucket/aitj-ledger/
     
     # For local disk
     ls -lh /mnt/backup/backup_*.dump
     ```
  
  6. Clean up old backups (optional, to save disk space):
     ```bash
     # Keep only the last 4 weeks of backups
     find backup_*.dump -mtime +28 -delete
     ```
  
  7. Log the backup completion (e.g. in a shared spreadsheet or a Slack message):
     - Date and time: [timestamp]
     - File name: [backup_*.dump]
     - File size: [size in MB]
     - Status: [Success / Failed]
  
  ## Restore procedure
  
  **WARNING:** Restoring from a backup will overwrite all current data in the database. Do not restore unless you are certain you have the correct backup.
  
  ### Prerequisites
  - Backup file (`backup_*.dump`) in an accessible location
  - SSH access to the production VPS
  - The app is running (or can be stopped)
  
  ### Steps
  
  1. Connect to the VPS:
     ```bash
     ssh user@production-ip
     cd /path/to/aitj-ledger
     ```
  
  2. **STOP the app** (to prevent new transactions being added during the restore):
     ```bash
     docker compose stop app
     ```
  
  3. **RESTORE the database** from the backup file:
     ```bash
     docker compose exec -T db pg_restore \
       -U aitj_user \
       -d aitj_ledger \
       --clean \
       --if-exists \
       /path/to/backup_*.dump
     ```
     (The `--clean` and `--if-exists` flags drop existing tables before restoring; use with caution.)
  
  4. **VERIFY the restore:**
     ```bash
     # Check transaction count
     docker compose exec -T db psql -U aitj_user -d aitj_ledger \
       -c "SELECT COUNT(*) as transaction_count FROM \"Transaction\";"
     
     # Check the sum of all transaction amounts
     docker compose exec -T db psql -U aitj_user -d aitj_ledger \
       -c "SELECT SUM(amount) as total_amount FROM \"Transaction\";"
     ```
     Compare these values to the **source database state** (recorded when the backup was taken). They must match exactly.
  
  5. **RESTART the app:**
     ```bash
     docker compose up -d app
     ```
  
  6. **TEST the app:**
     - Log in as the admin user
     - Check the dashboard totals (should match the restored data)
     - Search for a few known transactions to confirm they are present
  
  ## Verification checklist
  
  After a restore, always verify:
  
  - [ ] Transaction count matches the source (from step 4 above)
  - [ ] Sum of amounts matches the source
  - [ ] Admin can log in
  - [ ] Dashboard shows correct totals
  - [ ] A few transactions are visible and have correct data
  - [ ] No error messages in `docker compose logs app`
  
  ## Troubleshooting
  
  | Issue | Cause | Solution |
  |---|---|---|
  | `pg_dump: error: connection to database "aitj_ledger" failed` | Database is not running or credentials are wrong | Check `docker compose ps db`; check DATABASE_URL in docker-compose.yml |
  | `Backup file is 0 bytes` | Command failed silently | Run the backup command manually (remove redirection) to see the error |
  | Restore hangs or times out | Large backup file or slow disk | Wait longer; check `docker compose logs db` for errors; check disk space |
  | `ERROR: role "aitj_user" does not exist` | Database container is misconfigured | Verify POSTGRES_USER in docker-compose.yml matches the dump file |
  
  ## Owner assignment
  
  **Responsible person:** [Name to be assigned at handover, e.g. "Treasurer A"]
  
  **Contact for escalation:** [Phone/email]
  
  **Backup schedule:** Weekly, every [day] at [time] IST
  
  **Off-server copy location:** [Decide with client: AWS S3 bucket, Google Drive, external disk, etc.]
  ```

- **Handover documentation:** Create `docs/HANDOVER.md` with sections:
  ```markdown
  # AITJ Ledger — Handover Documentation
  
  ## Overview
  This document covers operational procedures for running AITJ Ledger in production.
  
  ## Backup and restore
  See `BACKUP_RUNBOOK.md` for detailed procedures.
  
  ## Environment variables and secrets
  
  ### Required env vars
  - `DATABASE_URL` — PostgreSQL connection string
  - `AUTH_SECRET` — Secret used to sign JWT sessions (generated via `openssl rand -base64 32`)
  - `SEED_ADMIN_EMAIL` — Admin account email address
  - `SEED_ADMIN_PASSWORD` — Admin account password (changed on first login)
  - `NODE_ENV` — Set to `production`
  - `TZ` — Set to `Asia/Kolkata`
  
  ### Rotating secrets
  
  #### Rotating AUTH_SECRET
  1. Generate a new secret:
     ```bash
     openssl rand -base64 32
     ```
  2. Update the environment variable in `docker-compose.yml` or `.env.production`
  3. Restart the app:
     ```bash
     docker compose restart app
     ```
  **Effect:** All existing user sessions are invalidated; users will be logged out and must log in again.
  
  #### Resetting the admin password
  1. The admin user must log in and change their password via Settings
  2. **There is no "forgot password" flow in v1** — if the admin loses access, a database update is required (not recommended; contact the developer)
  
  ## Deployments and migrations
  
  ### Applying a new database migration
  1. Pull the latest code:
     ```bash
     cd /path/to/aitj-ledger
     git pull origin main
     ```
  2. Stop the app (optional but recommended):
     ```bash
     docker compose stop app
     ```
  3. Rebuild the app image (if code changed):
     ```bash
     docker compose build app
     ```
  4. Run the migration:
     ```bash
     docker compose exec app npx prisma migrate deploy
     ```
  5. Restart the app:
     ```bash
     docker compose up -d app
     ```
  6. Verify:
     ```bash
     docker compose logs app | tail -20
     # Should show "Ready to accept connections"
     ```
  
  ### Monitoring logs
  ```bash
  # View app logs (last 100 lines)
  docker compose logs app --tail 100
  
  # View database logs
  docker compose logs db
  
  # Follow logs in real time
  docker compose logs -f
  ```
  
  ## Troubleshooting
  
  ### App will not start
  1. Check logs:
     ```bash
     docker compose logs app
     ```
  2. Common issues:
     - Missing env var → Add it to docker-compose.yml
     - Database not running → `docker compose up -d db` and wait for healthcheck to pass
     - Migration error → `docker compose logs db` to see database issues
     - Disk space → `df -h /` and free up space if needed
  
  ### Database will not start
  1. Check logs:
     ```bash
     docker compose logs db
     ```
  2. If corrupted (disk error, etc.):
     - Backup the current volume: `docker volume inspect aitj-ledger_db_data`
     - Delete the volume: `docker volume rm aitj-ledger_db_data`
     - Restart: `docker compose up -d db` (database will be recreated from migrations)
     - **Note:** This will lose data; use backup/restore if data is needed
  
  ### User cannot log in
  1. Check the user is active:
     ```bash
     docker compose exec db psql -U aitj_user -d aitj_ledger \
       -c "SELECT id, email, isActive FROM \"User\" WHERE email = 'user@example.com';"
     ```
  2. If `isActive` is false, reactivate via Settings → Users
  3. If the user does not exist, invite them via Settings → Users
  
  ### Transaction totals are wrong
  1. Export the transaction list to CSV and manually verify a few rows
  2. Check for soft-deleted transactions (they should be excluded from totals):
     ```bash
     docker compose exec db psql -U aitj_user -d aitj_ledger \
       -c "SELECT COUNT(*) as soft_deleted FROM \"Transaction\" WHERE \"deletedAt\" IS NOT NULL;"
     ```
  3. If totals are still wrong, restore from backup and contact the developer
  
  ## Health checks
  
  The app includes a health check endpoint:
  ```bash
  curl https://yourdomain.com/api/health
  ```
  Expected response:
  ```json
  {"status":"ok"}
  ```
  
  If the response is not 200, the app or database is in a bad state. Check logs.
  
  ## Backup and disaster recovery
  
  - **Backups are manual, weekly.** See `BACKUP_RUNBOOK.md`.
  - **Data loss risk is bounded by the backup frequency.** If data is lost, restores from the most recent backup.
  - **Automate backups in v1.1** (top recommendation).
  
  ## Go-live checklist
  
  - [ ] Admin account is created and can log in
  - [ ] Masjid name is set in Settings (if not "AITJ Ledger")
  - [ ] A test transaction is added (income or expense)
  - [ ] Dashboard shows the test transaction in totals
  - [ ] Transaction list shows the test transaction
  - [ ] Backup runbook is reviewed and owner is assigned
  - [ ] Off-server backup destination is ready (AWS S3, disk, etc.)
  - [ ] HTTPS certificate is valid (test in browser)
  - [ ] Logs are being collected and can be reviewed
  ```

- **Rehearsal execution:** During M8, execute the backup and restore procedure:
  1. Seed a production-like database with 100+ transactions
  2. Note the row count and sum of amounts
  3. Run `docker compose exec db pg_dump ... > test_backup.dump`
  4. Delete the transactions from the database (or spin up a new container)
  5. Run restore: `docker compose exec db pg_restore ... test_backup.dump`
  6. Query the restored database and compare row count and sum
  7. Record results in this ticket under "Rehearsal Results" below

## Rehearsal Results

**[To be filled in during M8 execution]**

| Item | Value |
|---|---|
| Date of rehearsal | [YYYY-MM-DD] |
| Operator | [Name] |
| Source database row count | [number] |
| Source database amount sum | [₹X.XX] |
| Backup file size | [number MB] |
| Backup completion time | [seconds] |
| Restore completion time | [seconds] |
| Restored database row count | [number] |
| Restored database amount sum | [₹X.XX] |
| Row count matches | [✓ or ✗] |
| Amount sum matches | [✓ or ✗] |
| Restore verification passed | [✓ or ✗] |
| Notes | [Any issues encountered, how resolved] |

## Definition of done

- [ ] Backup runbook documented with exact commands, owner assignment, and off-server destination
- [ ] Restore procedure documented with verification steps (row count and checksum)
- [ ] Handover documentation covers AUTH_SECRET rotation, migration deployment, troubleshooting
- [ ] Go-live checklist provided
- [ ] Rehearsal executed: backup created, restored, and verified against source (row count and checksum match)
- [ ] Rehearsal results recorded in this ticket
- [ ] Runbook tested by a team member (not the original author) to ensure clarity
- [ ] Reviewed by review-agent → QA signed off
