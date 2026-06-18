// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @title cUSDCToken
/// @notice Confidential ERC-7984 token used by Phase demos and faucet flows.
contract CUSDCToken is ZamaEthereumConfig, ERC7984, Ownable {
    error UnauthorizedMinter(address caller);
    error InvalidFaucet();

    event FaucetUpdated(address indexed faucet);
    event OwnerMint(address indexed to, uint64 amount);
    event FaucetMint(address indexed to, uint64 amount);

    address public faucet;

    constructor(address initialOwner, string memory contractURI_)
        ERC7984("Confidential USDC", "cUSDC", contractURI_)
        Ownable(initialOwner)
    {}

    function setFaucet(address nextFaucet) external onlyOwner {
        if (nextFaucet == address(0)) revert InvalidFaucet();
        faucet = nextFaucet;
        emit FaucetUpdated(nextFaucet);
    }

    function ownerMint(address to, uint64 amount) external onlyOwner {
        _mint(to, FHE.asEuint64(amount));
        emit OwnerMint(to, amount);
    }

    function faucetMint(address to, uint64 amount) external {
        if (msg.sender != faucet) revert UnauthorizedMinter(msg.sender);
        _mint(to, FHE.asEuint64(amount));
        emit FaucetMint(to, amount);
    }
}
