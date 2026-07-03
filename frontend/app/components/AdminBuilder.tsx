"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useZamaSDK } from "@zama-fhe/react-sdk";
import {
  type AirdropParams,
  encryptUint64,
  useCreateAndFundConfidentialAirdropAndGetAddress,
  useCreateConfidentialAirdropAndGetAddress,
  useFactoryCustomFee,
  useFactoryDefaultGasFee,
  useFundConfidentialAirdrop,
  useSignClaimAuthorization,
} from "@tokenops/sdk/fhe-airdrop/react";
import {
  useApproveTokenOnWallets,
  useDisperse,
  useGetFees,
  useGetWallets,
  useHasApprovedSubwallets,
  useIsRegistered,
  usePreflightDisperse,
  useRecoverFromWallets,
  useRegister,
  type DisperseMode,
} from "@tokenops/sdk/fhe-disperse/react";
import { erc7984OperatorAbi, setOperator } from "@tokenops/sdk/fhe";
import { getFheAirdropFactoryAddress, getFheDisperseSingletonAddress } from "@tokenops/sdk";
import {
  useBatchCreateVesting,
  useCreateManagerAndGetAddress,
  usePause,
  useSetMaxBatchSize,
  useUnpause,
  type VestingParams,
} from "@tokenops/sdk/fhe-vesting/react";
import { confidentialVestingManagerAbi } from "@tokenops/sdk/fhe-vesting";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  KeyRound,
  Layers3,
  PauseCircle,
  Play,
  RefreshCcw,
  Rocket,
  Save,
  Send,
  ShieldCheck,
  EyeOff,
  LockKeyhole,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { formatEther, isAddress, keccak256, parseEventLogs, toHex, zeroAddress, type Address, type Hex } from "viem";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { configuredToken, cusdcTokenAddress, sepoliaChainId, tokenOpsFactoryAddress } from "@/lib/env";
import { dateInputToUnix, formatTokenUnits, maskAddress, nowUnix, safeAddress, unixToDateInput } from "@/lib/format";
import { parseRecipientCsv } from "@/lib/csv";
import type { Campaign, CampaignKind, RecipientCsvRow } from "@/lib/types";

const defaultStart = nowUnix() + 900;
const defaultEnd = nowUnix() + 14 * 86400;
const initialTokenAddress = configuredToken === zeroAddress ? "" : configuredToken;

type ReleaseCadence = "single" | "monthly" | "milestone";
type BatchStrategy = "auto" | "fixed" | "manual";
type ClaimCreateMode = "fund" | "deploy";
type LaunchStep = "details" | "recipients" | "review" | "flow";
const launchProgressByStep: Record<LaunchStep, number> = {
  details: 0,
  recipients: 33,
  review: 67,
  flow: 100,
};

type VestingCliff = "none" | "30d" | "90d" | "180d";
type VestingTimelock = "none" | "7d" | "30d";
type VestingUnlock = "0" | "1000" | "2500" | "5000";
type VestingCliffUnlock = "0" | "1000" | "2500";

type ClaimDeployment = {
  params: AirdropParams;
  userSalt: Hex;
  deployer: Address;
  gasFee: bigint;
};

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function claimIssueErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : "Claim issuing failed";
  const isRelayerFetchFailure =
    message.includes("relayer.testnet.zama.org") &&
    message.includes("input-proof") &&
    message.includes("Failed to fetch");

  if (!isRelayerFetchFailure) return message;

  return "Could not reach the Zama testnet relayer while creating the input proof. Check your network, VPN or ad blocker, and Sepolia RPC, then try issuing claims again.";
}

const campaignKinds: Array<{ id: CampaignKind; label: string }> = [
  { id: "claim", label: "Claim" },
  { id: "batch", label: "Batch" },
  { id: "vesting", label: "Vesting" },
];

const advancedCampaignKinds = campaignKinds.filter((kind) => kind.id !== "claim");

const releaseCadences: Array<{ id: ReleaseCadence; label: string }> = [
  { id: "single", label: "Single" },
  { id: "monthly", label: "Monthly" },
  { id: "milestone", label: "Milestone" },
];

const batchStrategies: Array<{ id: BatchStrategy; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "fixed", label: "Fixed size" },
  { id: "manual", label: "Manual batch" },
];

const batchDisperseModes: Array<{ id: DisperseMode; label: string }> = [
  { id: "direct", label: "Direct transfer" },
  { id: "wallet", label: "Wallet split" },
  { id: "wallet-token-fee", label: "Token-fee split" },
];

const vestingCliffOptions: Array<{ id: VestingCliff; label: string; seconds: number }> = [
  { id: "none", label: "No cliff", seconds: 0 },
  { id: "30d", label: "30 days", seconds: 30 * 86400 },
  { id: "90d", label: "90 days", seconds: 90 * 86400 },
  { id: "180d", label: "180 days", seconds: 180 * 86400 },
];

const vestingTimelockOptions: Array<{ id: VestingTimelock; label: string; seconds: number }> = [
  { id: "none", label: "No timelock", seconds: 0 },
  { id: "7d", label: "7 days", seconds: 7 * 86400 },
  { id: "30d", label: "30 days", seconds: 30 * 86400 },
];

const vestingInitialUnlockOptions: Array<{ id: VestingUnlock; label: string; bps: number }> = [
  { id: "0", label: "0%", bps: 0 },
  { id: "1000", label: "10%", bps: 1000 },
  { id: "2500", label: "25%", bps: 2500 },
  { id: "5000", label: "50%", bps: 5000 },
];

const vestingCliffUnlockOptions: Array<{ id: VestingCliffUnlock; label: string; bps: number }> = [
  { id: "0", label: "0%", bps: 0 },
  { id: "1000", label: "10%", bps: 1000 },
  { id: "2500", label: "25%", bps: 2500 },
];

export default function AdminBuilder() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const queryClient = useQueryClient();
  const sdk = useZamaSDK();
  const create = useCreateConfidentialAirdropAndGetAddress(
    tokenOpsFactoryAddress ? { address: tokenOpsFactoryAddress } : undefined,
  );
  const createAndFund = useCreateAndFundConfidentialAirdropAndGetAddress(
    tokenOpsFactoryAddress ? { address: tokenOpsFactoryAddress, encryptor: () => sdk.relayer } : { encryptor: () => sdk.relayer },
  );
  const fundAirdrop = useFundConfidentialAirdrop(
    tokenOpsFactoryAddress ? { address: tokenOpsFactoryAddress, encryptor: () => sdk.relayer } : { encryptor: () => sdk.relayer },
  );
  const factoryDefaultGasFee = useFactoryDefaultGasFee(
    tokenOpsFactoryAddress ? { address: tokenOpsFactoryAddress } : undefined,
  );
  const factoryCustomFee = useFactoryCustomFee(
    address
      ? tokenOpsFactoryAddress
        ? { address: tokenOpsFactoryAddress, creator: address }
        : { creator: address }
      : undefined,
  );
  const signClaim = useSignClaimAuthorization();
  const disperse = useDisperse({ encryptor: () => sdk.relayer });
  const registerDisperse = useRegister();
  const approveDisperseWallets = useApproveTokenOnWallets();
  const recoverDisperseWallets = useRecoverFromWallets();
  const createVestingManager = useCreateManagerAndGetAddress();

  const [campaignKind, setCampaignKind] = useState<CampaignKind>("claim");
  const [releaseCadence, setReleaseCadence] = useState<ReleaseCadence>("monthly");
  const [claimCreateMode, setClaimCreateMode] = useState<ClaimCreateMode>("fund");
  const observerMode = "public";
  const [batchStrategy, setBatchStrategy] = useState<BatchStrategy>("auto");
  const [batchDisperseMode, setBatchDisperseMode] = useState<DisperseMode>("direct");
  const [batchSize, setBatchSize] = useState("250");
  const [manualBatch, setManualBatch] = useState("1");
  const [batchPaused] = useState(false);
  const [executedBatchIndexes, setExecutedBatchIndexes] = useState<number[]>([]);
  const [failedBatchIndexes, setFailedBatchIndexes] = useState<number[]>([]);
  const [directApprovalPending, setDirectApprovalPending] = useState(false);
  const [claimApprovalPending, setClaimApprovalPending] = useState(false);
  const [vestingApprovalPending, setVestingApprovalPending] = useState(false);
  const [vestingBatchSize, setVestingBatchSize] = useState("100");
  const [vestingCliff, setVestingCliff] = useState<VestingCliff>("none");
  const [vestingTimelock, setVestingTimelock] = useState<VestingTimelock>("none");
  const [vestingInitialUnlock, setVestingInitialUnlock] = useState<VestingUnlock>("0");
  const [vestingCliffUnlock, setVestingCliffUnlock] = useState<VestingCliffUnlock>("0");
  const [vestingRevocable, setVestingRevocable] = useState(true);
  const [vestingSplitEnabled, setVestingSplitEnabled] = useState(true);
  const [vestingPausable, setVestingPausable] = useState(true);
  const [createdVestingIndexes, setCreatedVestingIndexes] = useState<number[]>([]);
  const [failedVestingIndexes, setFailedVestingIndexes] = useState<number[]>([]);
  const [latestVestingHash, setLatestVestingHash] = useState<Hex | null>(null);
  const [latestVestingOpHash, setLatestVestingOpHash] = useState<Hex | null>(null);
  const [vestingProgress, setVestingProgress] = useState({ done: 0, total: 0 });
  const [vestingPaused, setVestingPaused] = useState(false);
  const [fundedCampaign, setFundedCampaign] = useState(false);
  const [claimDeployment, setClaimDeployment] = useState<ClaimDeployment | null>(null);
  const allowExtensions = true;
  const [campaignName, setCampaignName] = useState("");
  const [tokenAddress, setTokenAddress] = useState<Address | "">(initialTokenAddress);
  const [startDate, setStartDate] = useState(unixToDateInput(defaultStart));
  const [endDate, setEndDate] = useState(unixToDateInput(defaultEnd));
  const [csv, setCsv] = useState("");
  const [airdropAddress, setAirdropAddress] = useState<Address | "">("");
  const [savedCampaign, setSavedCampaign] = useState<Campaign | null>(null);
  const [issueProgress, setIssueProgress] = useState({ done: 0, total: 0 });
  const [status, setStatus] = useState("Ready.");
  const [error, setError] = useState<string | null>(null);
  const [launchOpen, setLaunchOpen] = useState(true);
  const [launchStep, setLaunchStep] = useState<LaunchStep>("details");

  const targetAirdrop = airdropAddress || savedCampaign?.airdropAddress || "";
  const vestingManagerAddress = safeAddress(targetAirdrop);
  const vestingManagerOptions = {
    address: vestingManagerAddress ?? zeroAddress,
    encryptor: () => sdk.relayer,
  };
  const batchCreateVesting = useBatchCreateVesting(vestingManagerOptions);
  const pauseVesting = usePause(vestingManagerOptions);
  const unpauseVesting = useUnpause(vestingManagerOptions);
  const setMaxVestingBatchSize = useSetMaxBatchSize(vestingManagerOptions);

  const parsed = useMemo(() => parseRecipientCsv(csv), [csv]);
  const recipientExampleCsvHref = useMemo(() => {
    const lines = [
      "address,amount",
      "0x742d35Cc6634C0532925a3b844Bc454e4438f44e,1250.50",
      "0x8ba1f109551bD432803012645Ac136ddd64DBA72,875.00",
      "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4,430.25",
    ];
    return `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
  }, []);
  const totalAmount = useMemo(
    () => parsed.rows.reduce((sum, row) => sum + row.amount, 0n),
    [parsed.rows],
  );

  const tokenValid = isAddress(tokenAddress) && tokenAddress !== zeroAddress;
  const startTimestamp = dateInputToUnix(startDate, defaultStart);
  const endTimestamp = dateInputToUnix(endDate, defaultEnd);
  const dateValid = endTimestamp > startTimestamp;
  const recipientReady = parsed.rows.length > 0 && parsed.errors.length === 0;
  const batchSizeNumber = batchStrategy === "auto" ? 250 : parseBatchSize(batchSize);
  const batchGroups = useMemo(() => chunkRows(parsed.rows, batchSizeNumber), [batchSizeNumber, parsed.rows]);
  const executedBatchSet = useMemo(() => new Set(executedBatchIndexes), [executedBatchIndexes]);
  const failedBatchSet = useMemo(() => new Set(failedBatchIndexes), [failedBatchIndexes]);
  const manualBatchNumber = clampBatchIndex(manualBatch, batchGroups.length);
  const pendingBatchIndex = batchGroups.findIndex((_, index) => !executedBatchSet.has(index));
  const nextBatchIndex = pendingBatchIndex >= 0 ? pendingBatchIndex : Math.max(batchGroups.length - 1, 0);
  const activeBatchIndex = batchStrategy === "manual" ? manualBatchNumber : nextBatchIndex;
  const activeBatchRows = useMemo(() => batchGroups[activeBatchIndex] ?? [], [activeBatchIndex, batchGroups]);
  const activeBatchPending = activeBatchRows.length > 0 && !executedBatchSet.has(activeBatchIndex);
  const activeBatchRecipients = useMemo(() => activeBatchRows.map((row) => row.address), [activeBatchRows]);
  const activeBatchAmounts = useMemo(() => activeBatchRows.map((row) => row.amount), [activeBatchRows]);
  const failedBatchRows = useMemo(
    () => failedBatchIndexes.flatMap((index) => batchGroups[index] ?? []),
    [batchGroups, failedBatchIndexes],
  );
  const failedExportHref = useMemo(() => {
    if (failedBatchRows.length === 0 && parsed.errors.length === 0) return "";
    const lines = [
      "address,amount",
      ...failedBatchRows.map((row) => `${row.address},${formatTokenUnits(row.amount)}`),
      ...parsed.errors.map((errorMessage) => `# ${errorMessage}`),
    ];
    return `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
  }, [failedBatchRows, parsed.errors]);
  const vestingBatchSizeNumber = parseBatchSize(vestingBatchSize);
  const vestingGroups = useMemo(() => chunkRows(parsed.rows, vestingBatchSizeNumber), [parsed.rows, vestingBatchSizeNumber]);
  const createdVestingSet = useMemo(() => new Set(createdVestingIndexes), [createdVestingIndexes]);
  const failedVestingSet = useMemo(() => new Set(failedVestingIndexes), [failedVestingIndexes]);
  const vestingPendingIndex = vestingGroups.findIndex((_, index) => !createdVestingSet.has(index));
  const activeVestingIndex = vestingPendingIndex >= 0 ? vestingPendingIndex : Math.max(vestingGroups.length - 1, 0);
  const activeVestingRows = useMemo(() => vestingGroups[activeVestingIndex] ?? [], [activeVestingIndex, vestingGroups]);
  const activeVestingPending = activeVestingRows.length > 0 && !createdVestingSet.has(activeVestingIndex);
  const createdVestingRecipientCount = vestingGroups.reduce(
    (count, group, index) => count + (createdVestingSet.has(index) ? group.length : 0),
    0,
  );
  const vestingCliffSeconds = optionSeconds(vestingCliffOptions, vestingCliff);
  const vestingTimelockSeconds = optionSeconds(vestingTimelockOptions, vestingTimelock);
  const vestingInitialUnlockBps = optionBps(vestingInitialUnlockOptions, vestingInitialUnlock);
  const vestingCliffAmountBps = optionBps(vestingCliffUnlockOptions, vestingCliffUnlock);
  const vestingReleaseIntervalSecs = releaseIntervalSeconds(releaseCadence, startTimestamp, endTimestamp);
  const vestingCliffWindowValid = vestingCliffSeconds === 0 || (dateValid && startTimestamp + vestingCliffSeconds < endTimestamp);
  const vestingBpsValid = vestingInitialUnlockBps + vestingCliffAmountBps <= 10000;
  const vestingScheduleReady = recipientReady && dateValid && vestingCliffWindowValid && vestingBpsValid;
  const workflowToken = tokenValid ? (tokenAddress as Address) : undefined;
  const vestingManagerApproval = useQuery({
    queryKey: ["phase", "vesting-manager-operator", chainId, address, workflowToken, vestingManagerAddress],
    enabled:
      campaignKind === "vesting" &&
      Boolean(address) &&
      Boolean(workflowToken) &&
      Boolean(vestingManagerAddress) &&
      Boolean(publicClient),
    queryFn: async () => {
      if (!address || !workflowToken || !vestingManagerAddress || !publicClient) return false;
      return publicClient.readContract({
        address: workflowToken,
        abi: erc7984OperatorAbi,
        functionName: "isOperator",
        args: [address, vestingManagerAddress],
      });
    },
  });
  const vestingManagerApproved = Boolean(vestingManagerApproval.data);
  const canApproveVestingManager =
    Boolean(address) &&
    Boolean(workflowToken) &&
    Boolean(vestingManagerAddress) &&
    Boolean(publicClient) &&
    Boolean(walletClient.data) &&
    !vestingManagerApproved;
  const vestingApprovalLabel = !vestingManagerAddress
    ? "Deploy manager first"
    : vestingManagerApproval.isError
      ? "Approval check failed"
      : vestingManagerApproved
        ? "Manager approved"
        : vestingManagerApproval.isFetching
          ? "Checking manager approval"
          : "Approve manager";
  const vestingCanCreateSchedules = Boolean(address) && Boolean(vestingManagerAddress) && tokenValid && vestingScheduleReady && vestingManagerApproved;
  const vestingOpsReady = Boolean(address) && Boolean(vestingManagerAddress);
  const claimToken = workflowToken;
  const claimFactoryAddress = tokenOpsFactoryAddress ?? getFheAirdropFactoryAddress(chainId ?? sepoliaChainId);
  const claimFactoryApproval = useQuery({
    queryKey: ["phase", "claim-factory-operator", chainId, address, claimToken, claimFactoryAddress],
    enabled: campaignKind === "claim" && Boolean(address) && Boolean(claimToken) && Boolean(claimFactoryAddress) && Boolean(publicClient),
    queryFn: async () => {
      if (!address || !claimToken || !claimFactoryAddress || !publicClient) return false;
      return publicClient.readContract({
        address: claimToken,
        abi: erc7984OperatorAbi,
        functionName: "isOperator",
        args: [address, claimFactoryAddress],
      });
    },
  });
  const claimFactoryApproved = Boolean(claimFactoryApproval.data);
  const claimApprovalLabel = !claimFactoryAddress
    ? "Distribution factory unavailable"
    : claimFactoryApproval.isError
      ? "Approval check failed"
      : claimFactoryApproved
        ? "Token approval confirmed"
        : claimFactoryApproval.isFetching
          ? "Checking token approval"
          : "Token approval needed";
  const canApproveClaimFactory =
    Boolean(address) && Boolean(claimToken) && Boolean(claimFactoryAddress) && Boolean(publicClient) && Boolean(walletClient.data) && !claimFactoryApproved;
  const batchToken = claimToken;
  const batchIsWalletMode = batchDisperseMode !== "direct";
  const batchSingletonAddress = getFheDisperseSingletonAddress(chainId ?? sepoliaChainId);
  const batchRegistered = useIsRegistered({ user: address });
  const batchWallets = useGetWallets({ user: address });
  const batchFees = useGetFees({ user: address });
  const batchWalletApprovals = useHasApprovedSubwallets({ user: address, token: batchToken });
  const batchPreflight = usePreflightDisperse(
    campaignKind === "batch" && address && batchToken && activeBatchRows.length > 0
      ? {
          user: address,
          token: batchToken,
          recipients: activeBatchRecipients,
          amounts: activeBatchAmounts,
          mode: batchDisperseMode,
        }
      : undefined,
  );
  const batchPreflightReady = Boolean(batchPreflight.data?.ready);
  const batchWalletRegistered = !batchIsWalletMode || Boolean(batchPreflight.data?.isUserRegistered ?? batchRegistered.data);
  const batchWalletApproved = batchIsWalletMode
    ? Boolean(batchPreflight.data?.hasApprovedSubwallets.both ?? batchWalletApprovals.data?.both)
    : Boolean(batchPreflight.data?.hasApprovedSingleton);
  const batchFeeLabel =
    batchDisperseMode === "wallet-token-fee"
      ? batchPreflight.data?.feeTokenAmount !== undefined
        ? `${formatTokenUnits(batchPreflight.data.feeTokenAmount)} cUSDC`
        : batchFees.data
          ? `${batchFees.data.tokenFeeBps} bps`
          : "pending"
      : batchPreflight.data
        ? formatEthFee(batchPreflight.data.feeEth)
        : batchFees.data
          ? `${formatEther(batchFees.data.gasFeeWei)} ETH / recipient`
          : "pending";
  const batchPreflightState = batchPreflight.isFetching ? "Checking" : batchPreflightReady ? "Ready" : "Run preflight";
  const batchApprovalLabel = batchWalletApproved ? "Approved" : batchIsWalletMode ? "Wallet approval needed" : "Direct approval needed";

  const busy =
    create.isPending ||
    createAndFund.isPending ||
    fundAirdrop.isPending ||
    signClaim.isPending ||
    disperse.isPending ||
    registerDisperse.isPending ||
    approveDisperseWallets.isPending ||
    recoverDisperseWallets.isPending ||
    claimApprovalPending ||
    vestingApprovalPending ||
    directApprovalPending ||
    createVestingManager.isPending ||
    batchCreateVesting.isPending ||
    pauseVesting.isPending ||
    unpauseVesting.isPending ||
    setMaxVestingBatchSize.isPending;
  const progressPercent = issueProgress.total > 0 ? Math.round((issueProgress.done / issueProgress.total) * 100) : 0;
  const vestingProgressPercent = vestingProgress.total > 0 ? Math.round((vestingProgress.done / vestingProgress.total) * 100) : 0;
  const claimPayloadReady = issueProgress.total > 0 && issueProgress.done === issueProgress.total;
  const claimPortalHref = savedCampaign ? "/recipient" : "";
  const resolvedClaimGasFee = factoryCustomFee.data?.enabled ? factoryCustomFee.data.gasFee : factoryDefaultGasFee.data;
  const claimFeeReady = resolvedClaimGasFee !== undefined && (!address || Boolean(factoryCustomFee.data) || !factoryCustomFee.isLoading);
  const canDeploy =
    Boolean(address) &&
    Boolean(campaignName.trim()) &&
    tokenValid &&
    recipientReady &&
    dateValid;
  const canCreateAndFundClaim = canDeploy && claimFeeReady && claimFactoryApproved && totalAmount > 0n;
  const canFundClaimPot =
    Boolean(address) &&
    Boolean(targetAirdrop) &&
    Boolean(claimDeployment) &&
    !fundedCampaign &&
    tokenValid &&
    claimFactoryApproved &&
    recipientReady &&
    dateValid &&
    totalAmount > 0n;
  const canSignClaims = Boolean(savedCampaign) && Boolean(targetAirdrop) && fundedCampaign && recipientReady && dateValid;
  const batchCanRegisterWallets = batchIsWalletMode && Boolean(address) && Boolean(batchToken) && !batchWalletRegistered;
  const batchCanApprove =
    Boolean(address) &&
    Boolean(batchToken) &&
    (batchIsWalletMode ? batchWalletRegistered && !batchWalletApproved : Boolean(batchSingletonAddress) && !batchWalletApproved);
  const batchCanPreflight = !busy && recipientReady && tokenValid && !batchPreflightReady;
  const batchCanRunQueue =
    batchPreflightReady && !batchPaused && batchGroups.length > 0 && executedBatchSet.size < batchGroups.length && batchStrategy !== "manual";
  const batchCanRunActive = batchPreflightReady && !batchPaused && activeBatchPending;
  const batchCanRetry = failedBatchIndexes.length > 0 && !batchPaused;
  const batchCanRecover = batchIsWalletMode && Boolean(address) && Boolean(batchToken) && batchWalletRegistered;
  const vestingCanDeploy = !vestingManagerAddress && canDeploy;
  const vestingCanOpenAll =
    vestingCanCreateSchedules && !vestingPaused && vestingGroups.length > 0 && createdVestingSet.size < vestingGroups.length;
  const vestingCanOpenNext = vestingCanCreateSchedules && !vestingPaused && activeVestingPending;
  const vestingCanRetry = failedVestingIndexes.length > 0;
  const claimNeedsFreshDeployment = Boolean(targetAirdrop) && !fundedCampaign && !claimDeployment;
  const showClaimCreateActions = !targetAirdrop || claimNeedsFreshDeployment;
  const showClaimFundAction = Boolean(targetAirdrop) && !fundedCampaign && canFundClaimPot;
  const showClaimSignAction = fundedCampaign && !claimPayloadReady;
  const showClaimPortalAction = claimPayloadReady && Boolean(claimPortalHref);
  const showClaimApprovalAction = (showClaimCreateActions || showClaimFundAction) && !claimFactoryApproved;
  const showClaimCreateChoice = showClaimCreateActions && claimFactoryApproved;
  const selectedClaimCreateLabel = claimCreateMode === "fund" ? "Create + fund drop" : "Create drop only";
  const selectedClaimCreateDisabled =
    busy ||
    (claimCreateMode === "fund"
      ? !canCreateAndFundClaim
      : !canDeploy || !claimFeeReady);
  const launchWindowDays = dateValid ? Math.ceil((endTimestamp - startTimestamp) / 86400) : 0;
  const vestingRecipientTotal = parsed.rows.length;
  const vestingComplete = vestingRecipientTotal > 0 && createdVestingRecipientCount === vestingRecipientTotal;
  const vestingCompletionPercent = vestingRecipientTotal > 0 ? Math.round((createdVestingRecipientCount / vestingRecipientTotal) * 100) : 0;
  const vestingReadyToOpen = Boolean(vestingManagerAddress) && vestingScheduleReady && !vestingPaused && !vestingComplete;
  const vestingShowSaveAction = !vestingManagerAddress && !vestingComplete;
  const vestingShowPauseAction = vestingOpsReady && vestingPausable && !vestingPaused && !vestingComplete;
  const vestingShowUnpauseAction = vestingOpsReady && vestingPausable && vestingPaused;
  const vestingShowBatchCapAction = vestingOpsReady && !vestingComplete && !vestingCanOpenAll && !vestingCanOpenNext && !vestingCanRetry;
  const vestingRecipientHref = vestingComplete && savedCampaign ? `/vesting/${savedCampaign.id}` : null;
  const vestingStateLabel = !vestingManagerAddress
    ? "Deploy manager"
    : !vestingManagerApproved
      ? "Approve manager"
    : vestingPaused
      ? "Paused"
      : vestingComplete
        ? "Complete"
        : vestingReadyToOpen
          ? "Ready"
          : "Needs attention";
  const vestingHeadline =
    vestingRecipientTotal === 0
      ? "Import recipients to build schedules"
      : !vestingManagerAddress
        ? `Deploy manager for ${vestingRecipientTotal.toLocaleString()} wallets`
        : !vestingManagerApproved
          ? "Approve manager spending"
        : vestingComplete
          ? "Schedules open"
          : vestingPaused
            ? "Manager paused"
            : `Open ${Math.max(vestingRecipientTotal - createdVestingRecipientCount, 0).toLocaleString()} remaining schedules`;
  const vestingGuidance = !tokenValid
    ? "Set a valid cUSDC token before deploying."
    : parsed.errors.length > 0
      ? "Fix invalid recipient rows before launch."
      : !dateValid
        ? "Set a valid vesting window."
        : !vestingCliffWindowValid
          ? "Choose a cliff inside the vesting window."
          : !vestingBpsValid
            ? "Reduce start and cliff unlocks to 100% or less."
            : !vestingManagerAddress
              ? "Deploy once, then open schedules in batches."
              : !vestingManagerApproved
                ? "Approve token spending by the manager contract before opening schedules."
              : vestingComplete
                ? "Recipient vesting is ready."
                : "Open schedules now or run the next pending batch.";
  const vestingCadenceLabel = releaseIntervalLabel(releaseCadence, vestingReleaseIntervalSecs);
  const vestingUnlockTotalLabel = vestingBpsValid ? bpsLabel(vestingInitialUnlockBps + vestingCliffAmountBps) : "Over 100%";
  const vestingPolicyLabel = `${vestingRevocable ? "Revocable" : "Locked"}, ${vestingSplitEnabled ? "splits on" : "splits off"}, ${
    vestingPausable ? "pause on" : "pause off"
  }`;
  const vestingBatchLabel =
    vestingGroups.length > 0
      ? `${vestingGroups.length.toLocaleString()} ${vestingGroups.length === 1 ? "batch" : "batches"}, max ${vestingBatchSizeNumber.toLocaleString()}`
      : `Max ${vestingBatchSizeNumber.toLocaleString()}`;
  const launchDetailsReady = Boolean(campaignName.trim()) && tokenValid && (campaignKind !== "claim" || dateValid);
  const launchTimelineLabel = dateValid ? `${launchWindowDays} day window` : "Set a valid window";
  const selectedKind = campaignKinds.find((item) => item.id === campaignKind) ?? campaignKinds[0];
  const modeSummary =
    campaignKind === "batch"
      ? "Send sealed allocations to a CSV list in batches."
      : campaignKind === "vesting"
        ? "Open private vesting schedules for recipients."
        : "Launch a claim portal where each wallet can reveal only its own allocation.";

  const launchDialogTitle =
    launchStep === "details"
      ? "Setup"
      : launchStep === "recipients"
        ? "Add recipients"
        : launchStep === "review"
          ? "Review privacy"
          : campaignKind === "batch"
            ? "Disperse"
            : campaignKind === "vesting"
              ? "Vesting"
              : "Launch claim drop";
  const launchProgressPercent = launchProgressByStep[launchStep];

  async function persistCampaign(nextAirdropAddress?: Address, status?: Campaign["status"]) {
    if (!campaignName.trim()) throw new Error("Enter a campaign name.");
    if (!tokenValid) throw new Error("Enter a valid token address.");
    if (campaignKind !== "batch" && !dateValid) throw new Error("Set a valid campaign window.");

    const campaignStartTimestamp = campaignKind === "batch" ? nowUnix() : startTimestamp;
    const campaignEndTimestamp = campaignKind === "batch" ? campaignStartTimestamp + 86400 : endTimestamp;

    const slug = campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const metadataUri = `ipfs://phase/${slug || "campaign"}/private-${campaignKind}-${releaseCadence}-${observerMode}`;

    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: campaignName.trim(),
        kind: campaignKind,
        tokenAddress: tokenAddress as Address,
        airdropAddress: nextAirdropAddress,
        creator: address,
        startTimestamp: campaignStartTimestamp,
        endTimestamp: campaignEndTimestamp,
        recipientCount: parsed.rows.length,
        status,
        metadataUri,
      }),
    });
    const result = await readJsonResponse<{ campaign?: Campaign; error?: string }>(response);
    if (!response.ok || !result?.campaign) throw new Error(result?.error ?? "Could not save campaign");
    setSavedCampaign(result.campaign);
    return result.campaign;
  }

  async function markCampaignStatus(campaign: Campaign, nextStatus: Campaign["status"]) {
    const response = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const result = await readJsonResponse<{ campaign?: Campaign; error?: string }>(response);
    if (!response.ok || !result?.campaign) throw new Error(result?.error ?? "Could not update campaign status");

    setSavedCampaign(result.campaign);
    return result.campaign;
  }

  async function persistVestingSchedules(campaign: Campaign, batchIndex: number, hash: Hex) {
    if (!publicClient) throw new Error("Public client is not ready. Could not read vesting receipt.");
    if (!vestingManagerAddress) throw new Error("Vesting manager address is missing.");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const events = parseEventLogs({
      abi: confidentialVestingManagerAbi,
      eventName: "VestingCreated",
      logs: receipt.logs,
    });

    if (events.length === 0) {
      throw new Error("Vesting transaction confirmed, but no schedules were emitted.");
    }

    const response = await fetch(`/api/campaigns/${campaign.id}/vestings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vestings: events.map((event) => ({
          recipient: event.args.recipient,
          vestingId: event.args.vestingId,
          managerAddress: vestingManagerAddress,
          batchIndex,
          txHash: hash,
        })),
      }),
    });
    const result = await readJsonResponse<{ error?: string }>(response);
    if (!response.ok) throw new Error(result?.error ?? "Could not save vesting schedules");
  }

  async function deployCampaign(mode: "deploy" | "fund") {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!canDeploy) {
      setError("Complete configuration, token, and recipients before creating the distribution.");
      return;
    }
    if (mode === "fund" && totalAmount <= 0n) {
      setError("Add a positive allocation before creating and funding the distribution.");
      return;
    }

    if (!claimFeeReady || resolvedClaimGasFee === undefined) {
      setError("Factory gas fee is still loading. Try again in a moment.");
      return;
    }

    const params: AirdropParams = {
      token: tokenAddress as Address,
      startTimestamp,
      endTimestamp,
      canExtendClaimWindow: allowExtensions,
      admin: address,
    };
    const userSalt = keccak256(toHex(`${campaignName}:${campaignKind}:${address}:${Date.now()}`));
    const deployment: ClaimDeployment = {
      params,
      userSalt,
      deployer: address,
      gasFee: resolvedClaimGasFee,
    };

    try {
      setStatus(mode === "fund" ? "Creating and funding distribution." : "Creating distribution.");
      const result =
        mode === "fund"
          ? await createAndFund.mutateAsync({ params, userSalt, amount: totalAmount })
          : await create.mutateAsync({ params, userSalt });
      setAirdropAddress(result.airdrop);
      setFundedCampaign(mode === "fund");
      setClaimDeployment(deployment);
      await persistCampaign(result.airdrop);
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-airdrop"] });
      setStatus(mode === "fund" ? "Distribution created and funded. Sign authorizations next." : "Distribution created. Fund it before signing authorizations.");
    } catch (cause) {
      setError(formatClaimFundingError(cause, "Distribution creation failed"));
    }
  }

  async function fundCampaignPot() {
    setError(null);
    const airdropContract = safeAddress(airdropAddress || savedCampaign?.airdropAddress || "");
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!airdropContract) {
      setError("Create the distribution before funding it.");
      return;
    }
    if (!claimDeployment) {
      setError("Use Create + Fund drop for new claim campaigns.");
      return;
    }
    if (!recipientReady || totalAmount <= 0n) {
      setError("Add valid recipients before funding the distribution.");
      return;
    }

    try {
      setStatus("Encrypting funding amount and funding distribution.");
      await fundAirdrop.mutateAsync({
        token: claimDeployment.params.token,
        params: claimDeployment.params,
        userSalt: claimDeployment.userSalt,
        deployer: claimDeployment.deployer,
        gasFee: claimDeployment.gasFee,
        amount: totalAmount,
        account: address,
      });
      setFundedCampaign(true);
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-airdrop"] });
      setStatus("Distribution funded. Sign authorizations next.");
    } catch (cause) {
      setError(formatClaimFundingError(cause, "Funding failed"));
    }
  }

  async function deployVestingManager() {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!canDeploy) {
      setError("Complete configuration, token, and recipients before deploying vesting.");
      return;
    }
    if (!vestingScheduleReady) {
      setError("Fix the vesting schedule before deploying.");
      return;
    }

    const userSalt = keccak256(toHex(`${campaignName}:vesting:${address}:${Date.now()}`));

    try {
      setStatus("Deploying vesting manager.");
      const result = await createVestingManager.mutateAsync({
        token: tokenAddress as Address,
        userSalt,
        splitEnabled: vestingSplitEnabled,
        pausableEnabled: vestingPausable,
        account: address,
      });
      setAirdropAddress(result.manager);
      setVestingPaused(false);
      await persistCampaign(result.manager);
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-vesting"] });
      setStatus("Vesting manager live. Approve token spending next.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vesting deployment failed");
    }
  }

  async function setVestingPauseState(nextPaused: boolean) {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!vestingManagerAddress) {
      setError("Deploy the vesting manager before changing pause state.");
      return;
    }
    if (!vestingPausable) {
      setError("Pause is off for this manager configuration.");
      return;
    }

    try {
      setStatus(nextPaused ? "Pausing vesting manager." : "Unpausing vesting manager.");
      const hash = nextPaused
        ? await pauseVesting.mutateAsync({ account: address })
        : await unpauseVesting.mutateAsync({ account: address });
      setLatestVestingOpHash(hash);
      setVestingPaused(nextPaused);
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-vesting"] });
      setStatus(nextPaused ? "Vesting manager paused." : "Vesting manager unpaused.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pause operation failed");
    }
  }

  async function setVestingBatchCap() {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!vestingManagerAddress) {
      setError("Deploy the vesting manager before setting the cap.");
      return;
    }

    try {
      setStatus("Setting cap.");
      const hash = await setMaxVestingBatchSize.mutateAsync({
        newMax: BigInt(vestingBatchSizeNumber),
        account: address,
      });
      setLatestVestingOpHash(hash);
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-vesting"] });
      setStatus(`Cap set to ${vestingBatchSizeNumber.toLocaleString()}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cap update failed");
    }
  }

  async function createVestingScheduleGroups(indexes: number[]) {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!vestingManagerAddress) {
      setError("Deploy the vesting manager before creating schedules.");
      return;
    }
    if (!vestingScheduleReady) {
      setError("Fix recipients and vesting rules before creating schedules.");
      return;
    }
    if (!vestingManagerApproved) {
      setError("Approve token spending by the vesting manager before opening schedules.");
      return;
    }
    if (vestingPaused) {
      setError("Unpause the vesting manager before creating schedules.");
      return;
    }

    const pendingIndexes = indexes.filter((index) => vestingGroups[index]?.length && !createdVestingSet.has(index));
    if (pendingIndexes.length === 0) {
      setStatus("No pending schedules.");
      return;
    }

    const campaign = savedCampaign ?? (await persistCampaign(vestingManagerAddress));
    let done = createdVestingRecipientCount;
    setVestingProgress({ done, total: parsed.rows.length });

    for (const batchIndex of pendingIndexes) {
      const rows = vestingGroups[batchIndex] ?? [];
      const items = rows.map((row) => ({
        params: {
          recipient: row.address,
          startTimestamp,
          endTimestamp,
          cliffSeconds: vestingCliffSeconds,
          releaseIntervalSecs: vestingReleaseIntervalSecs,
          timelockSeconds: vestingTimelockSeconds,
          initialUnlockBps: vestingInitialUnlockBps,
          cliffAmountBps: vestingCliffAmountBps,
          isRevocable: vestingRevocable,
        } satisfies VestingParams,
        amount: row.amount,
      }));

      try {
        setStatus(`Creating vesting batch ${batchIndex + 1} of ${vestingGroups.length}.`);
        const hash = await batchCreateVesting.mutateAsync({ items, account: address });
        await persistVestingSchedules(campaign, batchIndex, hash);
        setLatestVestingHash(hash);
        setCreatedVestingIndexes((current) => sortedUnique([...current, batchIndex]));
        setFailedVestingIndexes((current) => current.filter((index) => index !== batchIndex));
        done += rows.length;
        setVestingProgress({ done, total: parsed.rows.length });
      } catch (cause) {
        setFailedVestingIndexes((current) => sortedUnique([...current, batchIndex]));
        setError(cause instanceof Error ? cause.message : `Vesting batch ${batchIndex + 1} failed`);
        return;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-vesting"] });
    setStatus(pendingIndexes.length > 1 ? "Vesting schedules created." : "Vesting batch created.");
  }

  async function saveDraft() {
    setError(null);
    try {
      const candidate = safeAddress(airdropAddress || savedCampaign?.airdropAddress || "");
      const campaign = await persistCampaign(candidate ?? undefined);
      setStatus(`Saved: ${campaign.id}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save campaign");
    }
  }

  async function importRecipientFile(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const nextCsv = await file.text();
      setCsv(nextCsv);
      setStatus(`Imported ${file.name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read import file");
    }
  }

  async function issueClaims() {
    setError(null);
    const airdropContract = safeAddress(airdropAddress || savedCampaign?.airdropAddress || "");
    if (!airdropContract) {
      setError("Create the distribution before issuing claims.");
      return;
    }
    if (!savedCampaign) {
      setError("Save the campaign before issuing claim payloads.");
      return;
    }
    if (!recipientReady) {
      setError("Fix the CSV before issuing claim payloads.");
      return;
    }
    if (!fundedCampaign) {
      setError("Fund the distribution before signing claim authorizations.");
      return;
    }

    setIssueProgress({ done: 0, total: parsed.rows.length });
    setStatus("Encrypting amounts and signing claim authorizations.");

    try {
      for (let i = 0; i < parsed.rows.length; i += 1) {
        const row = parsed.rows[i] as RecipientCsvRow;
        const encrypted = await encryptUint64({
          encryptor: sdk.relayer,
          contractAddress: airdropContract,
          userAddress: row.address,
          value: row.amount,
        });
        const signature = await signClaim.mutateAsync({
          airdropAddress: airdropContract,
          recipient: row.address,
          encryptedAmountHandle: encrypted.handle,
        });
        const response = await fetch(`/api/campaigns/${savedCampaign.id}/claims`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            recipient: row.address,
            encryptedInput: encrypted,
            signature,
          }),
        });
        if (!response.ok) {
          const result = await readJsonResponse<{ error?: string }>(response);
          throw new Error(result?.error ?? `Could not store payload for ${row.address}`);
        }
        setIssueProgress({ done: i + 1, total: parsed.rows.length });
      }
      setStatus(campaignKind === "vesting" ? "Vesting inputs issued." : "Claim authorizations signed. Recipient portal is ready.");
    } catch (cause) {
      setError(claimIssueErrorMessage(cause));
    }
  }

  async function approveClaimFactoryOperator() {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!claimToken) {
      setError("Set a valid token before approving the distribution factory.");
      return;
    }
    if (!publicClient || !walletClient.data) {
      setError("Wallet client is not ready. Reconnect and try again.");
      return;
    }
    if (!claimFactoryAddress) {
      setError("Distribution factory is not configured for this chain.");
      return;
    }

    try {
      setClaimApprovalPending(true);
      setStatus("Approving distribution factory as token operator.");
      const hash = await setOperator({
        publicClient,
        walletClient: walletClient.data,
        token: claimToken,
        spender: claimFactoryAddress,
        account: address,
      });
      await claimFactoryApproval.refetch();
      queryClient.invalidateQueries({ queryKey: ["phase", "claim-factory-operator"] });
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-airdrop"] });
      setStatus(`Distribution factory approval confirmed: ${maskAddress(hash)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Distribution factory approval failed");
    } finally {
      setClaimApprovalPending(false);
    }
  }

  async function approveVestingManagerOperator() {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!workflowToken) {
      setError("Set a valid token before approving the vesting manager.");
      return;
    }
    if (!vestingManagerAddress) {
      setError("Deploy the vesting manager before approving token spending.");
      return;
    }
    if (!publicClient || !walletClient.data) {
      setError("Wallet client is not ready. Reconnect and try again.");
      return;
    }

    try {
      setVestingApprovalPending(true);
      setStatus("Approving vesting manager as token operator.");
      const hash = await setOperator({
        publicClient,
        walletClient: walletClient.data,
        token: workflowToken,
        spender: vestingManagerAddress,
        account: address,
      });
      await vestingManagerApproval.refetch();
      queryClient.invalidateQueries({ queryKey: ["phase", "vesting-manager-operator"] });
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-vesting"] });
      setStatus(`Vesting manager approved: ${maskAddress(hash)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vesting manager approval failed");
    } finally {
      setVestingApprovalPending(false);
    }
  }

  async function registerBatchWallets() {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!batchToken) {
      setError("Set a valid token before registering Disperse wallets.");
      return;
    }

    try {
      setStatus("Registering Disperse wallet pair.");
      const result = await registerDisperse.mutateAsync({ token: batchToken, account: address });
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-disperse"] });
      setStatus(`Wallet pair registered: ${maskAddress(result.wallets[0])} / ${maskAddress(result.wallets[1])}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Disperse wallet registration failed");
    }
  }

  async function approveBatchWallets() {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!batchToken) {
      setError("Set a valid token before approving Disperse wallets.");
      return;
    }

    try {
      setStatus("Approving Disperse wallet pair for this token.");
      await approveDisperseWallets.mutateAsync({ token: batchToken, account: address });
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-disperse"] });
      setStatus("Disperse wallet pair approved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet approval failed");
    }
  }

  async function approveDirectDisperseOperator() {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!batchToken) {
      setError("Set a valid token before approving direct disperse.");
      return;
    }
    if (!publicClient || !walletClient.data) {
      setError("Wallet client is not ready. Reconnect and try again.");
      return;
    }
    if (!batchSingletonAddress) {
      setError("Disperse singleton is not configured for this chain.");
      return;
    }

    try {
      setDirectApprovalPending(true);
      setStatus("Approving Disperse singleton as token operator.");
      const hash = await setOperator({
        publicClient,
        walletClient: walletClient.data,
        token: batchToken,
        spender: batchSingletonAddress,
        account: address,
      });
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-disperse"] });
      setStatus(`Direct Disperse approval confirmed: ${maskAddress(hash)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Direct Disperse approval failed");
    } finally {
      setDirectApprovalPending(false);
    }
  }

  async function recoverBatchWallets() {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!batchToken) {
      setError("Set a valid token before recovering wallet balances.");
      return;
    }
    if (!batchIsWalletMode) {
      setError("Recovery only applies to wallet-mode Disperse batches.");
      return;
    }

    try {
      setStatus("Recovering residual Disperse wallet balances.");
      const hash = await recoverDisperseWallets.mutateAsync({ token: batchToken, to: address, account: address });
      queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-disperse"] });
      setStatus(`Recovery submitted: ${maskAddress(hash)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet recovery failed");
    }
  }

  async function runBatchIndexes(indexes: number[]) {
    setError(null);
    if (!address) {
      setError("Connect the admin wallet first.");
      return;
    }
    if (!campaignName.trim() || !tokenValid) {
      setError("Complete campaign and token before executing batches.");
      return;
    }
    if (!recipientReady) {
      setError("Fix the recipient list before executing batches.");
      return;
    }
    if (batchPaused) {
      setError("Resume the batch queue before executing.");
      return;
    }
    if (!batchPreflightReady) {
      setError("Run a passing Disperse preflight for the active batch before executing.");
      return;
    }

    const pendingIndexes = indexes.filter((index) => batchGroups[index]?.length && !executedBatchSet.has(index));
    if (pendingIndexes.length === 0) {
      setStatus("No pending batches.");
      return;
    }

    for (const batchIndex of pendingIndexes) {
      const rows = batchGroups[batchIndex] ?? [];
      try {
        setStatus(`Executing batch ${batchIndex + 1} of ${batchGroups.length}.`);
        await disperse.mutateAsync({
          token: tokenAddress as Address,
          mode: batchDisperseMode,
          recipients: rows.map((row) => row.address),
          amounts: rows.map((row) => row.amount),
          account: address,
        });
        setExecutedBatchIndexes((current) => sortedUnique([...current, batchIndex]));
        setFailedBatchIndexes((current) => current.filter((index) => index !== batchIndex));
      } catch (cause) {
        setFailedBatchIndexes((current) => sortedUnique([...current, batchIndex]));
        setError(cause instanceof Error ? cause.message : `Batch ${batchIndex + 1} failed`);
        return;
      }
    }

    const completedBatchIndexes = new Set([...executedBatchIndexes, ...pendingIndexes]);
    const queueComplete = batchGroups.length > 0 && completedBatchIndexes.size >= batchGroups.length;
    if (queueComplete) {
      const matchingSavedCampaign =
        savedCampaign &&
        savedCampaign.kind === "batch" &&
        savedCampaign.name.trim() === campaignName.trim() &&
        savedCampaign.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
          ? savedCampaign
          : null;

      if (matchingSavedCampaign) {
        await markCampaignStatus(matchingSavedCampaign, "ended");
      } else {
        await persistCampaign(undefined, "ended");
      }
    }

    setStatus(queueComplete ? "Batch complete." : pendingIndexes.length > 1 ? "Batch execution complete." : "Batch executed.");
  }

  async function refreshBatchPreflight() {
    setError(null);
    if (!address || !tokenValid || activeBatchRows.length === 0) {
      setError("Set wallet, token, and recipients before preflight.");
      return;
    }
    await batchPreflight.refetch();
    setStatus("Preflight refreshed.");
  }

  function handleCampaignKindChange(nextKind: CampaignKind) {
    setCampaignKind(nextKind);
    if (nextKind === "vesting") {
      const nextStart = nowUnix() + 900;
      setStartDate(unixToDateInput(nextStart));
      setEndDate(unixToDateInput(nextStart + 14 * 86400));
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-hero admin-hero-clean">
        <div>
          <h1>Private claim drop</h1>
          <p>Recipients reveal their own allocation. Observers see activity, not amounts.</p>
        </div>
      </div>

      {!launchOpen ? (
      <div className="admin-layout admin-layout-single admin-console-layout">
        <div className="admin-primary">
          <section className="admin-panel admin-config-panel">
            <div className="admin-config-grid admin-campaign-grid">
              <button
                className="admin-envelope-trigger field-wide"
                type="button"
                onClick={() => {
                  setLaunchStep("details");
                  setLaunchOpen(true);
                }}
              >
                <span className="admin-setting-icon"><Rocket size={18} aria-hidden="true" /></span>
                <span>
                  <strong>Resume setup</strong>
                  <small>Continue configuring the drop.</small>
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
      ) : null}

      {launchOpen ? (
        <div className="admin-envelope-backdrop">
          <section className="admin-envelope-dialog" aria-labelledby="admin-envelope-title">
            <div className="admin-envelope-header">
              <div className="admin-envelope-title-block">
                <div className={launchStep === "details" ? "admin-launch-journey" : "admin-launch-journey has-back"} aria-label="Setup progress">
                  {launchStep !== "details" ? (
                    <button
                      className="admin-launch-back"
                      type="button"
                      aria-label="Back to previous launch step"
                      onClick={() => {
                        if (launchStep === "recipients") setLaunchStep("details");
                        else if (launchStep === "review") setLaunchStep("recipients");
                        else setLaunchStep("review");
                      }}
                    >
                      <ArrowLeft size={13} aria-hidden="true" />
                      <span>Back</span>
                    </button>
                  ) : null}
                  <div className="admin-launch-progress">
                    <div
                      className="admin-launch-progress-track"
                      role="progressbar"
                      aria-label="Setup progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={launchProgressPercent}
                    >
                      <span style={{ width: `${launchProgressPercent}%` }} />
                    </div>
                  </div>
                </div>
                <h2 id="admin-envelope-title">{launchDialogTitle}</h2>
              </div>
              <button className="admin-envelope-close" type="button" aria-label="Close launch setup" onClick={() => setLaunchOpen(false)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="admin-envelope-grid">
              <div className="admin-envelope-main">
                {launchStep === "details" ? (
                  <div className="admin-launch-step">
                    <div className="admin-launch-setup">
                      <div className="admin-mode-row field-wide">
                        <button
                          className={campaignKind === "claim" ? "admin-mode-choice is-active" : "admin-mode-choice"}
                          type="button"
                          aria-pressed={campaignKind === "claim"}
                          onClick={() => handleCampaignKindChange("claim")}
                        >
                          Claim
                        </button>
                        <details className="admin-advanced-modes">
                          <summary>Other flows</summary>
                          <div className="admin-mode-tabs" role="group" aria-label="Other distribution flows">
                            {advancedCampaignKinds.map((kind) => (
                              <button
                                className={campaignKind === kind.id ? "is-active" : ""}
                                type="button"
                                aria-pressed={campaignKind === kind.id}
                                onClick={() => handleCampaignKindChange(kind.id)}
                                key={kind.id}
                              >
                                {kind.label}
                              </button>
                            ))}
                          </div>
                        </details>
                      </div>
                      <Field label="Drop name">
                        <input className="input" placeholder="Private investor distribution" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
                      </Field>
                      <div className="admin-field token-contract-field field-wide">
                        <label htmlFor="admin-token-contract">Token recipients claim</label>
                        <input
                          id="admin-token-contract"
                          className="input mono"
                          placeholder="0x..."
                          value={tokenAddress}
                          onChange={(event) => setTokenAddress(event.target.value as Address)}
                        />
                        <div className="contract-helper-row">
                          <button
                            className="button-ghost"
                            type="button"
                            onClick={() => {
                              setTokenAddress(cusdcTokenAddress);
                              setStatus("cUSDC selected for this drop.");
                            }}
                          >
                            Use cUSDC
                          </button>
                          <Link className="button-ghost" href="/faucet">
                            Get cUSDC
                          </Link>
                        </div>
                      </div>
                      {campaignKind === "claim" ? (
                        <>
                          <Field label="Claims open">
                            <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                          </Field>
                          <Field label="Claims close">
                            <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                          </Field>
                        </>
                      ) : null}
                      {campaignKind === "vesting" ? null : (
                        <div className="admin-launch-summary field-wide">
                          <span>{selectedKind.label}</span>
                          <strong>{modeSummary}</strong>
                          {campaignKind === "claim" ? <small>{launchTimelineLabel}</small> : null}
                        </div>
                      )}
                    </div>
                    <div className="admin-action-grid admin-envelope-actions admin-launch-actions">
                      <button className="button-primary" type="button" disabled={!launchDetailsReady} onClick={() => setLaunchStep("recipients")}>
                        <Play size={16} aria-hidden="true" />
                        Continue
                      </button>
                    </div>
                  </div>
                ) : launchStep === "recipients" ? (
                  <div className="admin-launch-step">
                    <div className="admin-launch-import">
                      <div className="admin-launch-import-tools">
                        <Field label="Import file">
                          <input
                            className="input"
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(event) => {
                              void importRecipientFile(event.target.files?.[0] ?? null);
                              event.currentTarget.value = "";
                            }}
                          />
                        </Field>
                        <a className="button-secondary" href={recipientExampleCsvHref} download="example.csv">
                          <Download size={16} aria-hidden="true" />
                          Download Example CSV
                        </a>
                      </div>
                      <textarea
                        className="textarea admin-csv"
                        placeholder="address,amount"
                        value={csv}
                        onChange={(event) => setCsv(event.target.value)}
                      />
                      <div className="admin-import-footer">
                        <div className="csv-preview" aria-label="Parsed recipient preview">
                          {parsed.rows.slice(0, 4).map((row) => (
                            <div className="csv-row" key={row.address}>
                              <span className="mono">{maskAddress(row.address)}</span>
                              <strong>{formatTokenUnits(row.amount)} cUSDC</strong>
                            </div>
                          ))}
                          {parsed.rows.length === 0 ? <p>No valid rows yet.</p> : null}
                        </div>
                        <div className="admin-import-stats">
                          <Metric label="Recipients" value={parsed.rows.length.toLocaleString()} />
                          <Metric label="Allocation" value={formatTokenUnits(totalAmount) + " cUSDC"} sealed />
                        </div>
                      </div>
                      {parsed.errors.length > 0 ? (
                        <div className="admin-blocker-list">
                          {parsed.errors.slice(0, 3).map((blocker) => (
                            <div className="validation-message" key={blocker}>
                              <AlertTriangle size={16} aria-hidden="true" />
                              <span>{blocker}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="admin-action-grid admin-envelope-actions admin-launch-actions">
                      <button className="button-primary" type="button" disabled={!recipientReady} onClick={() => setLaunchStep("review")}>
                        <Play size={16} aria-hidden="true" />
                        Continue
                      </button>
                    </div>
                  </div>
                ) : launchStep === "review" ? (
                  <div className="admin-launch-step">
                    <section className="admin-review-panel" aria-labelledby="admin-review-title">
                      <div className="admin-review-header">
                        <span className="pill pill-live">Observer-safe</span>
                        <h3 id="admin-review-title">Review before the drop is sealed</h3>
                        <p>Confirm what recipients can reveal and what the public observer will never see.</p>
                      </div>
                      <div className="admin-review-grid">
                        <ReviewItem icon={<Users size={18} aria-hidden="true" />} label="Recipients" value={parsed.rows.length.toLocaleString() + " wallets"} note="Only matching wallets can load claim payloads." />
                        <ReviewItem icon={<LockKeyhole size={18} aria-hidden="true" />} label="Total allocation" value="Sealed" note={formatTokenUnits(totalAmount) + " cUSDC stays out of the public observer view."} />
                        <ReviewItem icon={<ShieldCheck size={18} aria-hidden="true" />} label="Token" value={tokenValid ? maskAddress(tokenAddress as Address) : "Set token"} note="Recipients claim confidential cUSDC through their own wallet." />
                        <ReviewItem icon={<CalendarDays size={18} aria-hidden="true" />} label="Claim window" value={campaignKind === "claim" ? launchTimelineLabel : selectedKind.label} note={campaignKind === "claim" ? startDate + " to " + endDate : modeSummary} />
                      </div>
                      <div className="admin-review-boundary">
                        <EyeOff size={17} aria-hidden="true" />
                        <span>Observer view shows status, masked recipients, and proof activity. It never shows recipient amounts.</span>
                      </div>
                    </section>
                    <div className="admin-action-grid admin-envelope-actions admin-launch-actions">
                      <button className="button-primary" type="button" disabled={!recipientReady || !launchDetailsReady} onClick={() => setLaunchStep("flow")}>
                        <ShieldCheck size={16} aria-hidden="true" />
                        Continue to launch
                      </button>
                    </div>
                  </div>
                ) : campaignKind === "batch" ? (
                  <>
                    <section className="admin-disperse-panel" aria-labelledby="admin-disperse-title">
                      <div className="admin-disperse-panel-header">
                        <div>
                          <span className={batchPreflightReady ? "pill pill-live" : "pill pill-watch"}>{batchPreflightState}</span>
                          <h3 id="admin-disperse-title">Preflight</h3>
                        </div>
                      </div>

                      <div className="admin-disperse-setup">
                        <Field label="Mode">
                          <select className="input" value={batchDisperseMode} onChange={(event) => setBatchDisperseMode(event.target.value as DisperseMode)}>
                            {batchDisperseModes.map((mode) => (
                              <option key={mode.id} value={mode.id}>
                                {mode.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Grouping">
                          <select className="input" value={batchStrategy} onChange={(event) => setBatchStrategy(event.target.value as BatchStrategy)}>
                            {batchStrategies.map((strategy) => (
                              <option key={strategy.id} value={strategy.id}>
                                {strategy.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {batchStrategy === "fixed" || batchStrategy === "manual" ? (
                          <Field label="Wallets per batch">
                            <input className="input" type="number" min="1" step="1" value={batchSize} onChange={(event) => setBatchSize(event.target.value)} />
                          </Field>
                        ) : null}
                        {batchStrategy === "manual" ? (
                          <Field label="Selected batch">
                            <select className="input" value={(manualBatchNumber + 1).toString()} onChange={(event) => setManualBatch(event.target.value)}>
                              {batchGroups.map((group, index) => (
                                <option key={index} value={(index + 1).toString()}>
                                  Batch {index + 1} · {group.length} wallets
                                </option>
                              ))}
                            </select>
                          </Field>
                        ) : null}
                      </div>

                      <div className="admin-disperse-summary">
                        <Metric label="Recipients" value={parsed.rows.length.toLocaleString() + " wallets"} />
                        <Metric label="Allocation" value={formatTokenUnits(totalAmount) + " cUSDC"} sealed />
                        <Metric label="Batch" value={activeBatchRows.length ? (activeBatchIndex + 1).toString() + " / " + batchGroups.length.toString() : "none"} />
                        <Metric label="Approval" value={batchApprovalLabel} />
                      </div>

                      <div className="admin-disperse-checks" aria-label="Preflight checks">
                        <LaunchSignal label="Preflight" value={batchPreflightState} good={batchPreflightReady} />
                        <LaunchSignal label="Fee" value={batchFeeLabel} good={Boolean(batchPreflight.data ?? batchFees.data)} />
                        <LaunchSignal label="Limit" value={batchLimitLabel(batchPreflight.data?.batchLimit)} good={batchPreflight.data?.batchOk ?? false} />
                        {failedBatchSet.size > 0 ? (
                          <LaunchSignal label="Failed" value={failedBatchSet.size.toLocaleString()} />
                        ) : null}
                      </div>
                    </section>

                    <div className="admin-action-grid admin-envelope-actions admin-batch-actions">
                      {batchCanRegisterWallets ? (
                        <button className="button-primary" type="button" disabled={busy || !batchCanRegisterWallets} onClick={registerBatchWallets}>
                          <Wallet size={16} aria-hidden="true" />
                          Register Wallets
                        </button>
                      ) : null}
                      {!batchCanRegisterWallets && batchCanApprove ? (
                        <button
                          className="button-primary"
                          type="button"
                          disabled={busy || !batchCanApprove}
                          onClick={batchIsWalletMode ? approveBatchWallets : approveDirectDisperseOperator}
                        >
                          <ShieldCheck size={16} aria-hidden="true" />
                          {batchIsWalletMode ? "Approve Wallets" : "Approve Direct"}
                        </button>
                      ) : null}
                      {!batchCanRegisterWallets && !batchCanApprove && batchCanPreflight ? (
                        <button className="button-primary" type="button" disabled={busy || !batchCanPreflight} onClick={refreshBatchPreflight}>
                          <RefreshCcw size={16} aria-hidden="true" />
                          Preflight
                        </button>
                      ) : null}
                      {batchCanRunQueue ? (
                        <button className="button-primary" type="button" disabled={busy || !batchCanRunQueue} onClick={() => runBatchIndexes(batchGroups.map((_, index) => index))}>
                          <Play size={16} aria-hidden="true" />
                          Disperse Queue
                        </button>
                      ) : null}
                      {!batchCanRunQueue && batchCanRunActive ? (
                        <button className="button-primary" type="button" disabled={busy || !batchCanRunActive} onClick={() => runBatchIndexes([activeBatchIndex])}>
                          <Send size={16} aria-hidden="true" />
                          {batchStrategy === "manual" ? "Disperse Selected" : "Disperse Next"}
                        </button>
                      ) : null}
                      {batchCanRetry ? (
                        <button className="button-secondary" type="button" disabled={busy || !batchCanRetry} onClick={() => runBatchIndexes(failedBatchIndexes)}>
                          <RefreshCcw size={16} aria-hidden="true" />
                          Retry Failed
                        </button>
                      ) : null}
                      {batchCanRecover ? (
                        <button className="button-secondary" type="button" disabled={busy || !batchCanRecover} onClick={recoverBatchWallets}>
                          <Download size={16} aria-hidden="true" />
                          Recover Wallets
                        </button>
                      ) : null}
                      {failedExportHref ? (
                        <a className="button-secondary" href={failedExportHref} download="phase-failed-batches.csv">
                          <Download size={16} aria-hidden="true" />
                          Export failed
                        </a>
                      ) : null}
                    </div>
                    <StatusMessage status={status} error={error ?? batchPreflight.error?.message ?? batchRegistered.error?.message ?? batchWallets.error?.message ?? batchFees.error?.message ?? batchWalletApprovals.error?.message ?? registerDisperse.error?.message ?? approveDisperseWallets.error?.message ?? recoverDisperseWallets.error?.message ?? null} />
                    {batchPreflight.data?.blockers.length ? (
                      <div className="admin-blocker-list">
                        {batchPreflight.data.blockers.slice(0, 3).map((blocker) => (
                          <div className="validation-message" key={blocker}>
                            <AlertTriangle size={16} aria-hidden="true" />
                            <span>{blocker}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : campaignKind === "claim" ? (
                  <>
                    <div className="admin-action-grid admin-envelope-actions admin-claim-actions">
                      {showClaimApprovalAction ? (
                        <button className="button-primary" type="button" disabled={busy || !canApproveClaimFactory} onClick={approveClaimFactoryOperator}>
                          <ShieldCheck size={16} aria-hidden="true" />
                          Approve token
                        </button>
                      ) : null}
                      {showClaimCreateChoice ? (
                        <div className="admin-claim-create-choice field-wide">
                          <div className="segmented-control admin-claim-create-toggle" aria-label="Distribution creation mode">
                            <button
                              className={claimCreateMode === "fund" ? "is-active" : ""}
                              type="button"
                              aria-pressed={claimCreateMode === "fund"}
                              onClick={() => setClaimCreateMode("fund")}
                            >
                              Create + fund
                            </button>
                            <button
                              className={claimCreateMode === "deploy" ? "is-active" : ""}
                              type="button"
                              aria-pressed={claimCreateMode === "deploy"}
                              onClick={() => setClaimCreateMode("deploy")}
                            >
                              Create only
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {showClaimCreateChoice ? (
                        <button className="button-primary" type="button" disabled={selectedClaimCreateDisabled} onClick={() => deployCampaign(claimCreateMode)}>
                          {claimCreateMode === "fund" ? <ShieldCheck size={16} aria-hidden="true" /> : <Rocket size={16} aria-hidden="true" />}
                          {selectedClaimCreateLabel}
                        </button>
                      ) : null}
                      {showClaimFundAction ? (
                        <button className="button-primary" type="button" disabled={busy || !canFundClaimPot} onClick={fundCampaignPot}>
                          <Wallet size={16} aria-hidden="true" />
                          Fund drop
                        </button>
                      ) : null}
                      {showClaimSignAction ? (
                        <button className="button-primary" type="button" disabled={busy || !canSignClaims} onClick={issueClaims}>
                          <KeyRound size={16} aria-hidden="true" />
                          Sign authorizations
                        </button>
                      ) : null}
                      {showClaimPortalAction ? (
                        <a className="button-primary" href={claimPortalHref}>
                          <Send size={16} aria-hidden="true" />
                          Open Claim Portal
                        </a>
                      ) : null}
                      <button className="button-secondary" type="button" disabled={busy} onClick={saveDraft}>
                        <Save size={16} aria-hidden="true" />
                        Save draft
                      </button>
                    </div>
                    <StatusMessage status={status} error={error ?? factoryDefaultGasFee.error?.message ?? factoryCustomFee.error?.message ?? fundAirdrop.error?.message ?? null} />
                    {showClaimApprovalAction ? (
                      <div className="validation-message">
                        <AlertTriangle size={16} aria-hidden="true" />
                        <span>{claimApprovalLabel}. Approve token spending once so Phase can create and fund this drop.</span>
                      </div>
                    ) : null}
                    {issueProgress.total > 0 ? (
                      <div className="progress-block">
                        <div>
                          <span>Authorization progress</span>
                          <strong>{progressPercent}%</strong>
                        </div>
                        <div className="progress-track">
                          <span style={{ width: progressPercent.toString() + "%" }} />
                        </div>
                      </div>
                    ) : null}
                    {parsed.errors.length > 0 ? (
                      <div className="admin-blocker-list">
                        {parsed.errors.slice(0, 3).map((blocker) => (
                          <div className="validation-message" key={blocker}>
                            <AlertTriangle size={16} aria-hidden="true" />
                            <span>{blocker}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="admin-vesting-stack">
                      <section className="admin-vesting-hero" aria-label="Vesting launch summary">
                        <div className="admin-vesting-hero-copy">
                          <span className={vestingComplete ? "pill pill-live" : vestingScheduleReady ? "pill pill-sealed" : "pill pill-watch"}>{vestingStateLabel}</span>
                          <h3>{vestingHeadline}</h3>
                          <p>{vestingGuidance}</p>
                        </div>
                        <div className="admin-vesting-progress-card">
                          <span>Schedules</span>
                          <strong>
                            {createdVestingRecipientCount.toLocaleString()} / {vestingRecipientTotal.toLocaleString()}
                          </strong>
                          <div className="progress-track" aria-hidden="true">
                            <span style={{ width: vestingCompletionPercent.toString() + "%" }} />
                          </div>
                        </div>
                      </section>

                      <div className="admin-vesting-facts">
                        <Metric label="Recipients" value={`${vestingRecipientTotal.toLocaleString()} wallets`} />
                        <Metric label="Allocation" value={formatTokenUnits(totalAmount) + " cUSDC"} sealed />
                        <Metric label="Batching" value={vestingBatchLabel} />
                      </div>

                      {!vestingComplete ? (
                        <div className="admin-vesting-layout">
                          <section className="admin-vesting-card admin-vesting-card-wide">
                            <div className="admin-vesting-card-header">
                              <span className="admin-setting-icon">
                                <CalendarDays size={18} aria-hidden="true" />
                              </span>
                              <div>
                                <h3>Schedule</h3>
                                <p>{vestingCadenceLabel}</p>
                              </div>
                            </div>
                            <div className="admin-vesting-form-grid">
                              <Field label="Cadence">
                                <select className="input" value={releaseCadence} onChange={(event) => setReleaseCadence(event.target.value as ReleaseCadence)}>
                                  {releaseCadences.map((cadence) => (
                                    <option key={cadence.id} value={cadence.id}>
                                      {cadence.label}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Start">
                                <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                              </Field>
                              <Field label="End">
                                <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                              </Field>
                              <Field label="Cliff">
                                <select className="input" value={vestingCliff} onChange={(event) => setVestingCliff(event.target.value as VestingCliff)}>
                                  {vestingCliffOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Timelock">
                                <select className="input" value={vestingTimelock} onChange={(event) => setVestingTimelock(event.target.value as VestingTimelock)}>
                                  {vestingTimelockOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Batch size">
                                <input className="input" type="number" min="1" step="1" value={vestingBatchSize} onChange={(event) => setVestingBatchSize(event.target.value)} />
                              </Field>
                            </div>
                          </section>

                          <section className="admin-vesting-card">
                            <div className="admin-vesting-card-header">
                              <span className="admin-setting-icon">
                                <ShieldCheck size={18} aria-hidden="true" />
                              </span>
                              <div>
                                <h3>Rules</h3>
                                <p>
                                  {vestingUnlockTotalLabel} upfront - {vestingPolicyLabel}
                                </p>
                              </div>
                            </div>
                            <div className="admin-vesting-form-grid admin-vesting-policy-grid">
                              <Field label="Start unlock">
                                <select className="input" value={vestingInitialUnlock} onChange={(event) => setVestingInitialUnlock(event.target.value as VestingUnlock)}>
                                  {vestingInitialUnlockOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Cliff unlock">
                                <select className="input" value={vestingCliffUnlock} onChange={(event) => setVestingCliffUnlock(event.target.value as VestingCliffUnlock)}>
                                  {vestingCliffUnlockOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <SettingToggle label="Revocable" checked={vestingRevocable} onChange={setVestingRevocable} onLabel="Yes" offLabel="No" />
                              <SettingToggle label="Splits" checked={vestingSplitEnabled} onChange={setVestingSplitEnabled} />
                              <SettingToggle label="Pause" checked={vestingPausable} onChange={setVestingPausable} />
                            </div>
                          </section>

                          {vestingOpsReady ? (
                            <section className="admin-vesting-card">
                              <div className="admin-vesting-card-header">
                                <span className="admin-setting-icon">
                                  <KeyRound size={18} aria-hidden="true" />
                                </span>
                                <div>
                                  <h3>Manager</h3>
                                  <p>{vestingPaused ? "Paused" : "Active"} - {vestingManagerAddress ? maskAddress(vestingManagerAddress) : ""}</p>
                                </div>
                              </div>
                              <div className="admin-vesting-manager-grid">
                                <Metric label="Approval" value={vestingManagerApproved ? "Approved" : "Needed"} />
                                <Metric label="Created" value={createdVestingRecipientCount.toLocaleString()} />
                                <Metric label="Failed" value={failedVestingSet.size.toLocaleString()} />
                                <Metric label="Proof" value={latestVestingHash ? maskAddress(latestVestingHash) : "None"} />
                                <Metric label="Last op" value={latestVestingOpHash ? maskAddress(latestVestingOpHash) : "None"} />
                              </div>
                            </section>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="admin-action-grid admin-envelope-actions admin-batch-actions">
                      {vestingRecipientHref ? (
                        <Link className="button-primary" href={vestingRecipientHref}>
                          Recipient View
                        </Link>
                      ) : null}
                      {vestingShowSaveAction ? (
                        <button className="button-secondary" type="button" disabled={busy} onClick={saveDraft}>
                          <Save size={16} aria-hidden="true" />
                          Save
                        </button>
                      ) : null}
                      {vestingCanDeploy ? (
                        <button className="button-primary" type="button" disabled={!vestingCanDeploy || busy} onClick={deployVestingManager}>
                          <Rocket size={16} aria-hidden="true" />
                          Deploy Manager
                        </button>
                      ) : null}
                      {vestingManagerAddress && !vestingManagerApproved ? (
                        <button className="button-primary" type="button" disabled={busy || !canApproveVestingManager} onClick={approveVestingManagerOperator}>
                          <ShieldCheck size={16} aria-hidden="true" />
                          Approve Manager
                        </button>
                      ) : null}
                      {vestingShowUnpauseAction ? (
                        <button className="button-primary" type="button" disabled={busy || !vestingShowUnpauseAction} onClick={() => setVestingPauseState(false)}>
                          <Play size={16} aria-hidden="true" />
                          Unpause Manager
                        </button>
                      ) : null}
                      {!vestingShowUnpauseAction && vestingCanOpenAll ? (
                        <button className="button-primary" type="button" disabled={busy || !vestingCanOpenAll} onClick={() => createVestingScheduleGroups(vestingGroups.map((_, index) => index))}>
                          <Play size={16} aria-hidden="true" />
                          Open All
                        </button>
                      ) : null}
                      {!vestingShowUnpauseAction && !vestingCanOpenAll && vestingCanOpenNext ? (
                        <button className="button-primary" type="button" disabled={busy || !vestingCanOpenNext} onClick={() => createVestingScheduleGroups([activeVestingIndex])}>
                          <Send size={16} aria-hidden="true" />
                          Open Next
                        </button>
                      ) : null}
                      {vestingCanRetry ? (
                        <button className="button-secondary" type="button" disabled={busy || !vestingCanRetry} onClick={() => createVestingScheduleGroups(failedVestingIndexes)}>
                          <RefreshCcw size={16} aria-hidden="true" />
                          Retry Failed
                        </button>
                      ) : null}
                      {vestingShowPauseAction ? (
                        <button className="button-secondary" type="button" disabled={busy || !vestingShowPauseAction} onClick={() => setVestingPauseState(true)}>
                          <PauseCircle size={16} aria-hidden="true" />
                          Pause
                        </button>
                      ) : null}
                      {vestingShowBatchCapAction ? (
                        <button className="button-secondary" type="button" disabled={busy || !vestingOpsReady} onClick={setVestingBatchCap}>
                          <Layers3 size={16} aria-hidden="true" />
                          Set Cap
                        </button>
                      ) : null}
                    </div>
                    <StatusMessage status={status} error={error ?? createVestingManager.error?.message ?? batchCreateVesting.error?.message ?? pauseVesting.error?.message ?? unpauseVesting.error?.message ?? setMaxVestingBatchSize.error?.message ?? null} />
                    {vestingManagerAddress && !vestingManagerApproved ? (
                      <div className="validation-message">
                        <AlertTriangle size={16} aria-hidden="true" />
                        <span>{vestingApprovalLabel}. Approve token spending by the manager contract before opening schedules.</span>
                      </div>
                    ) : null}
                    {vestingProgress.total > 0 ? (
                      <div className="progress-block">
                        <div>
                          <span>Schedule progress</span>
                          <strong>{vestingProgressPercent}%</strong>
                        </div>
                        <div className="progress-track">
                          <span style={{ width: vestingProgressPercent.toString() + "%" }} />
                        </div>
                      </div>
                    ) : null}
                    {parsed.errors.length > 0 || !vestingCliffWindowValid || !vestingBpsValid ? (
                      <div className="admin-blocker-list">
                        {parsed.errors.slice(0, 3).map((blocker) => (
                          <div className="validation-message" key={blocker}>
                            <AlertTriangle size={16} aria-hidden="true" />
                            <span>{blocker}</span>
                          </div>
                        ))}
                        {!vestingCliffWindowValid ? (
                          <div className="validation-message">
                            <AlertTriangle size={16} aria-hidden="true" />
                            <span>Cliff must end before the vesting window.</span>
                          </div>
                        ) : null}
                        {!vestingBpsValid ? (
                          <div className="validation-message">
                            <AlertTriangle size={16} aria-hidden="true" />
                            <span>Start and cliff unlocks cannot exceed 100%.</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ReviewItem({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="admin-review-item">
      <span className="admin-review-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={"admin-field " + className}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
  onLabel = "On",
  offLabel = "Off",
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <div className="admin-setting-toggle">
      <span>{label}</span>
      <div className="segmented-control admin-compact-toggle" aria-label={label}>
        <button className={checked ? "is-active" : ""} type="button" aria-pressed={checked} onClick={() => onChange(true)}>
          {onLabel}
        </button>
        <button className={!checked ? "is-active" : ""} type="button" aria-pressed={!checked} onClick={() => onChange(false)}>
          {offLabel}
        </button>
      </div>
    </div>
  );
}

function LaunchSignal({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className={good ? "launch-signal is-good" : "launch-signal"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusMessage({ status, error }: { status: string; error: string | null }) {
  return (
    <div className={error ? "status-message is-error" : "status-message"}>
      {error ? <AlertTriangle size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
      <span>{error ?? status}</span>
    </div>
  );
}

function Metric({ label, value, sealed }: { label: string; value: string; sealed?: boolean }) {
  return (
    <div className="run-stat">
      <span>{label}</span>
      {sealed ? <span className="masked" aria-label={label + " sealed"} /> : <strong className="mono">{value}</strong>}
    </div>
  );
}

function formatClaimFundingError(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : fallback;
  if (message.includes("0x79f2cb38") || message.includes("ERC7984UnauthorizedSpender")) {
    return "Approve factory operator before funding. ERC-7984 requires setOperator.";
  }
  return message;
}

function parseBatchSize(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 250;
  return Math.min(5000, Math.max(1, parsed));
}

function chunkRows(rows: RecipientCsvRow[], size: number): RecipientCsvRow[][] {
  const groups: RecipientCsvRow[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    groups.push(rows.slice(index, index + size));
  }
  return groups;
}

function clampBatchIndex(value: string, count: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed - 1, 0), Math.max(count - 1, 0));
}

function sortedUnique(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function optionSeconds(options: Array<{ id: string; seconds: number }>, id: string): number {
  return options.find((option) => option.id === id)?.seconds ?? 0;
}

function optionBps(options: Array<{ id: string; bps: number }>, id: string): number {
  return options.find((option) => option.id === id)?.bps ?? 0;
}

function releaseIntervalSeconds(cadence: ReleaseCadence, startTimestamp: number, endTimestamp: number): number {
  const windowSeconds = Math.max(endTimestamp - startTimestamp, 86400);
  if (cadence === "single") return windowSeconds;
  if (cadence === "milestone") return Math.max(Math.floor(windowSeconds / 4), 86400);
  return 30 * 86400;
}

function releaseIntervalLabel(cadence: ReleaseCadence, seconds: number): string {
  if (cadence === "single") return "single release";
  if (cadence === "milestone") return "milestones";
  const days = Math.max(Math.round(seconds / 86400), 1);
  return `${days} day cadence`;
}

function bpsLabel(bps: number): string {
  return `${bps / 100}%`;
}

function formatEthFee(value: bigint): string {
  if (value === 0n) return "0 ETH";
  return `${formatEther(value)} ETH`;
}

function batchLimitLabel(value?: bigint): string {
  if (value === undefined) return "pending";
  return value === 0n ? "none" : value.toString();
}
