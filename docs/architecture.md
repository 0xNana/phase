# Phase Architecture

## Boundary

Phase uses TokenOps for the confidential claim-distribution primitive. Product flows are framed as private token distributions; the claim flow is backed by a TokenOps confidential airdrop clone. Campaign metadata and claim payloads are stored in Supabase via Next.js API routes.

## Confidential Data

Never store or expose these through public routes:

- plaintext allocation amounts
- recipient CSV
- full recipient list
- aggregate distribution amount

The recipient API returns a claim payload only for the connected recipient address. The observer API returns sanitized campaign metadata, proof activity, and aggregate claim counts.

## TokenOps Claim Lifecycle

1. `useCreateConfidentialAirdropAndGetAddress` deploys the claim-distribution clone.
2. `encryptUint64` encrypts each allocation as an external `euint64`.
3. `useSignClaimAuthorization` signs `Claim(address recipient, bytes32 encryptedAmount)`.
4. `useGetClaimAmount` submits a write transaction that grants ACL access to the caller and returns the decryptable handle.
5. `useUserDecrypt` requests the Zama user decrypt flow through EIP-712 wallet signing.
6. `useClaim` submits the same admin-issued `{ encryptedInput, signature }` pair verbatim.

## FHEVM Rules Preserved

- Recipient-side claim never re-encrypts. The signature commits to the original encrypted handle.
- `getClaimAmount` is treated as a write transaction, not a free read.
- Decryption is a visible lifecycle step with wallet authorization.
- Observer state never receives decrypted user amounts.
- ACL access is granted only by the TokenOps clone path.
