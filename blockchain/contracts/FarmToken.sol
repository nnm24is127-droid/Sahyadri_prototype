// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FarmToken (FARM)
 * @author FarmConnect AI Engineering Team
 * @notice Standard ERC-20 utility test token for platform demonstration and escrow workflow testing.
 * @dev DISCLAIMER: THIS CONTRACT IS FOR LOCAL DEMONSTRATION AND TESTNET BENCHMARKING ONLY.
 *      IT HAS NO MONETARY VALUE AND MUST NEVER BE USED WITH REAL CAPITAL OR PRODUCTION ASSETS.
 */
contract FarmToken is ERC20, Ownable {

    constructor() ERC20("FarmConnect Test Token", "FARM") Ownable(msg.sender) {
        // Mint 1,000,000 FARM test tokens to deployer for local testnet settlement
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /**
     * @notice Allows test faucet minting for local development and demonstration scenarios.
     * @param to Recipient address (buyer or test farmer).
     * @param amount Token amount in wei.
     */
    function faucetMint(address to, uint256 amount) external {
        require(amount <= 10_000 * 10 ** decimals(), "Faucet limit exceeded per request");
        _mint(to, amount);
    }
}
