// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ICUSDCToken {
    function faucetMint(address to, uint64 amount) external;
}

/// @title CUSDCFaucet
/// @notice Fixed-rate faucet for the Phase demo token.
contract CUSDCFaucet is Ownable {
    error InvalidToken();
    error ClaimTooSoon(uint48 nextClaimAt);

    event Claimed(address indexed account, uint64 amount, uint48 nextClaimAt);

    uint64 public constant CLAIM_AMOUNT = 1_000_000 * 1_000_000;
    uint48 public constant CLAIM_COOLDOWN = 1 days;

    ICUSDCToken public immutable token;
    mapping(address account => uint48 nextClaimAt) public nextClaimTimes;

    constructor(address initialOwner, address tokenAddress) Ownable(initialOwner) {
        if (tokenAddress == address(0)) revert InvalidToken();
        token = ICUSDCToken(tokenAddress);
    }

    function claim() external {
        uint48 nextClaimAt = nextClaimTimes[msg.sender];
        if (block.timestamp < nextClaimAt) revert ClaimTooSoon(nextClaimAt);

        uint48 refreshedClaimAt = uint48(block.timestamp + CLAIM_COOLDOWN);
        nextClaimTimes[msg.sender] = refreshedClaimAt;

        token.faucetMint(msg.sender, CLAIM_AMOUNT);
        emit Claimed(msg.sender, CLAIM_AMOUNT, refreshedClaimAt);
    }
}
