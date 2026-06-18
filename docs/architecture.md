# Phase Architecture

## Boundary

Phase uses TokenOps for the confidential airdrop primitive. The recommended app flow keeps campaign metadata off-chain and does not require a registry contract.

## Confidential Data

Never store or expose these through public routes:

- plaintext allocation amounts
- recipient CSV
- full recipient list
- aggregate distribution amount

The recipient API returns a claim payload only for the connected recipient address. The observer API returns sanitized campaign metadata and aggregate claim counts.

## TokenOps Lifecycle

1. `useCreateConfidentialAirdropAndGetAddress` deploys the airdrop clone.
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
