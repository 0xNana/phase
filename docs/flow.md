# Phase Distribution Flow

This document explains how an individual admin uses Phase to run the three supported private token distribution flows:

- `Claim`
- `Batch`
- `Vesting`

The intent is operational clarity, not contract internals. Each mode is described as the admin experiences it in the app.

## Shared Pattern

`/admin` opens on the Claim flow by default. Batch and Vesting are available from `Other flows`:

1. Choose `Claim`, or open `Other flows` for `Batch` or `Vesting`.
2. Enter distribution details.
3. Import recipients with `address,amount`.
4. Review the privacy boundary before launch.
5. Continue into the execution step for the selected flow.

The app is designed to avoid showing every possible control at once. At execution time, it should prioritize the next useful action for the admin.

## Recipient Import Format

Phase accepts a CSV in this exact format:

```csv
address,amount
0x742d35Cc6634C0532925a3b844Bc454e4438f44e,1250.50
0x8ba1f109551bD432803012645Ac136ddd64DBA72,875.00
```

Rules:

- first column: recipient wallet address
- second column: token amount
- amount supports up to `6` decimals
- duplicate recipient rows are rejected

The import step supports both:

- pasting CSV manually
- uploading a `.csv` file

## Claim Mode

Claim mode is for private token distributions where each recipient later opens a claim page, reveals only their own amount, and claims.

### Admin journey

1. Choose `Claim`.
2. Enter:
   `Drop name`, `Token recipients claim`, `Claims open`, `Claims close`
3. Import recipients.
4. Continue to execution.

### Execution step

The app should surface only the next meaningful action:

1. `Create + fund drop`
   This is the preferred path for new claim distributions. It creates the TokenOps-backed distribution and funds it in one flow.
2. `Create drop only`
   Use this only when the admin intentionally wants a two-step create-then-fund path.
3. `Fund drop`
   Appears only after a claim distribution exists and still needs funding.
4. `Seal claims`
   Appears only after the distribution is funded.
5. `Open Claim Portal`
   Appears only after claim payloads have been signed and stored.

### What the app does

At each stage:

- create: deploys a TokenOps confidential airdrop clone for the claim distribution
- fund: encrypts the total amount and funds the distribution
- sign: encrypts each recipient allocation and signs an admin claim authorization
- portal: exposes the recipient claim route for reveal and claim

### Recommended admin path

For most admins:

1. `Create + fund drop`
2. `Seal claims`
3. `Open Claim Portal`

## Batch Mode

Batch mode is for one-to-many confidential payouts without a recipient claim portal.

### Admin journey

1. Choose `Batch`.
2. Enter:
   `Drop name`, `Token recipients claim`
3. Import recipients.
4. Continue to execution.

### Execution step

The app should guide the admin through the next required step instead of exposing the full control panel at once.

Possible actions, in order:

1. `Register Wallets`
   Needed for wallet-based batch modes.
2. `Approve Wallets` or `Approve Direct`
   Grants the correct operator path for confidential transfers.
3. `Preflight`
   Validates fees, limits, wallet setup, approvals, and batch readiness before sending.
4. `Disperse Queue`
   Runs all pending batches when the queue is ready.
5. `Disperse Next`
   Runs the next pending batch when queue execution is not the right action.
6. `Retry Failed`
   Appears only when prior batches failed.
7. `Pause` or `Resume`
   Appears only once execution has started or been paused.
8. `Recover Wallets`
   Appears only for wallet-based modes when recovery is meaningful.
9. `Export Failed`
   Appears only when there are failed rows or blocked rows to export.

### What the app does

- chunks recipients into execution batches
- runs TokenOps preflight validation before disperse
- supports direct and wallet-backed distribution modes
- tracks executed and failed batches separately

### Recommended admin path

For most admins:

1. `Register Wallets` if required
2. `Approve Wallets` or `Approve Direct`
3. `Preflight`
4. `Disperse Queue`

## Vesting Mode

Vesting mode is for private vesting schedules managed through a confidential vesting manager.

### Admin journey

1. Choose `Vesting`.
2. Enter:
   `Drop name`, `Token recipients claim`, `Claims open`, `Claims close`
3. Import recipients.
4. Continue to execution.

### Execution step

The app should show only the next operational action:

1. `Deploy Manager`
   Creates the confidential vesting manager.
2. `Open All`
   Opens vesting schedules for all pending batches when the manager is ready.
3. `Open Next`
   Opens the next pending vesting batch when that is the more precise action.
4. `Retry Failed`
   Appears only if some vesting batches failed.
5. `Pause Manager`
   Available once the manager is active and pausable.
6. `Unpause Manager`
   Available only while paused.
7. `Set Batch Cap`
   Manager operation shown once schedule creation is no longer the main next step.
8. `Withdraw Residual`
   Shown when the manager is active and a withdrawal amount is provided.

### What the app does

- deploys a confidential vesting manager
- creates encrypted vesting schedules in batches
- supports pause, unpause, batch cap updates, and admin residual withdrawal
- tracks created and failed vesting batches

### Recommended admin path

For most admins:

1. `Deploy Manager`
2. `Open All`
3. `Pause Manager` or `Set Batch Cap` only when needed later

## Save Behavior

`Save` exists across modes as a secondary admin action.

Use it when:

- you want to preserve campaign metadata before the main execution step
- you are preparing a draft and not launching immediately
- you need to return later without changing the intended campaign identity

It should not dominate the flow. The primary path in every mode is the next executable action, not draft management.

## UX Principle

For an individual admin, the correct UX is:

- ask for one decision at a time
- show one primary action at a time
- keep advanced controls secondary
- reveal recovery and manager operations only when they become relevant

The app should feel like a guided distribution workflow, not a form dump or an operations console exposed too early.
