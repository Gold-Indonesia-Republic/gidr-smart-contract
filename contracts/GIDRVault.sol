// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IGIDR is IERC20 {
    function burn(uint256 amount) external;
}

/// @title GIDR Vault
/// @notice Stores GIDR deposits and lets an owner-managed list of burners destroy the stored tokens.
contract GIDRVault is Ownable {
    IGIDR public immutable gidr;

    mapping(address => bool) public burners;
    address public burnFeeReceiver;
    uint256 public burnFee;
    uint256 public burnFeeDecimal;

    event BurnerAdded(address indexed account);
    event BurnerRemoved(address indexed account);
    event Deposited(address indexed from, uint256 amount);
    event Burned(address indexed caller, uint256 amount);
    event Recovered(address indexed to, uint256 amount);
    event BurnFeeUpdated(
        address indexed receiver,
        uint256 fee,
        uint256 decimal
    );
    event BurnFeeCharged(address indexed receiver, uint256 amount);

    constructor(address gidrToken) {
        require(gidrToken != address(0), "GIDR address is zero");
        gidr = IGIDR(gidrToken);
    }

    modifier onlyBurner() {
        require(burners[_msgSender()], "Caller cannot burn");
        _;
    }

    function addBurner(address account) external onlyOwner {
        require(account != address(0), "Burner is zero address");
        require(!burners[account], "Already burner");
        burners[account] = true;
        emit BurnerAdded(account);
    }

    function removeBurner(address account) external onlyOwner {
        require(burners[account], "Not a burner");
        delete burners[account];
        emit BurnerRemoved(account);
    }

    /// @notice Configure burn fee for this vault.
    /// @dev Fee is expressed as burnFee / 10 ** burnFeeDecimal (e.g., 50, 2 = 0.5%).
    function setBurnFee(
        address receiver,
        uint256 fee,
        uint256 feeDecimal
    ) external onlyOwner {
        require(feeDecimal <= 18, "Decimal too high");
        if (fee > 0) {
            require(receiver != address(0), "Fee receiver is zero");
            require(fee < 10 ** feeDecimal, "Fee over 100%");
        }
        burnFeeReceiver = receiver;
        burnFee = fee;
        burnFeeDecimal = feeDecimal;
        emit BurnFeeUpdated(receiver, fee, feeDecimal);
    }

    /// @notice Pull GIDR into the vault. Caller must approve first.
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount is zero");
        gidr.transferFrom(_msgSender(), address(this), amount);
        emit Deposited(_msgSender(), amount);
    }

    /// @notice Burn stored GIDR from the vault balance.
    function burnStored(uint256 amount) external onlyBurner {
        _burnWithFee(amount);
    }

    function burnAll() external onlyBurner {
        uint256 balance = gidr.balanceOf(address(this));
        require(balance > 0, "No GIDR to burn");
        _burnWithFee(balance);
    }

    function totalStored() external view returns (uint256) {
        return gidr.balanceOf(address(this));
    }

    /// @notice Recover GIDR from the vault back to the contract owner.
    /// @dev Only callable by owner, allows reclaiming unburned tokens.
    function recover(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount is zero");
        uint256 balance = gidr.balanceOf(address(this));
        require(amount <= balance, "Insufficient vault balance");
        gidr.transfer(owner(), amount);
        emit Recovered(owner(), amount);
    }

    function _burnWithFee(uint256 amount) internal {
        require(amount > 0, "Amount is zero");
        uint256 balance = gidr.balanceOf(address(this));
        require(balance >= amount, "Insufficient vault balance");

        uint256 denominator = 10 ** burnFeeDecimal;
        uint256 feeAmount = (amount * burnFee) / denominator;
        uint256 burnAmount = amount - feeAmount;
        require(burnAmount > 0, "Amount too small after fee");

        if (feeAmount > 0) {
            require(burnFeeReceiver != address(0), "Fee receiver is zero");
            gidr.transfer(burnFeeReceiver, feeAmount);
            emit BurnFeeCharged(burnFeeReceiver, feeAmount);
        }

        gidr.burn(burnAmount);
        emit Burned(_msgSender(), burnAmount);
    }
}
