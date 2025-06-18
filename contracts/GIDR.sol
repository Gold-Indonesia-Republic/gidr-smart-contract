// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

contract GIDRStorageV1 {
    uint256 public versionCode;

    // Keep old variables (mark as deprecated)
    address private feeReceived; // deprecated
    uint256 private fee; // deprecated

    // Add new variables
    address public transferFeeReceived;
    uint256 public transferFee;
    address public burnFeeReceived;
    uint256 public burnFee;
    uint256 public burnFeeDecimal;

    // Add frozen accounts functionality
    mapping(address => bool) public frozenAccounts;

}

contract GIDR is UUPSUpgradeable, OwnableUpgradeable, ERC20Upgradeable, GIDRStorageV1, ERC2771ContextUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) initializer {}
    
    event AccountFrozen(address indexed account);
    event AccountUnfrozen(address indexed account);

    event SetTransferFee(address indexed feeReceived, uint256 indexed fee);
    event TransferFee(
        address indexed from,
        address indexed feeReceived,
        uint256 indexed amount
    );

    event SetBurnFee(address indexed feeReceived, uint256 indexed fee, uint256 indexed decimal);
    event BurnFee(
        address indexed from,
        address indexed feeReceived,
        uint256 indexed amount
    );

    function initialize() public initializer {
        __ERC20_init("Gold Indonesia Republic", "GIDR");
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {
        versionCode += 1;
    }

    function _msgSender() internal view virtual override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address) {
        return super._msgSender();
    }

    function _msgData() internal view virtual override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
        return super._msgData();
    }

    function _contextSuffixLength() internal view virtual override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (uint256) {
        return 20;
    }

    function isTrustedForwarder(address forwarder) public view virtual override returns (bool) {
        return super.isTrustedForwarder(forwarder);
    }

    function setTransferFee(address _transferFeeReceived, uint256 _transferFee) external onlyOwner {
        require(_transferFeeReceived != address(0), "Address cannot be null");
        // Adding reasonable limit
        require(_transferFee / 10 ** 18 < 1, "Fee is over 1 GIDR");
        transferFeeReceived = _transferFeeReceived;
        transferFee = _transferFee;
        emit SetTransferFee(_transferFeeReceived, _transferFee);
    }

    function setBurnFee(address _burnFeeReceived, uint256 _burnFee, uint256 _burnFeeDecimal) external onlyOwner {
        require(_burnFeeReceived != address(0), "Address cannot be null");
        require(_burnFeeDecimal <= 18, "Decimal cannot be greater than 18");
        // Adding reasonable limit
        require(_burnFee / 10 ** _burnFeeDecimal < 1, "Fee is over 100%");
        burnFeeReceived = _burnFeeReceived;
        burnFee = _burnFee;
        burnFeeDecimal = _burnFeeDecimal;
        emit SetBurnFee(_burnFeeReceived, _burnFee, _burnFeeDecimal);
    }

    function mint(address _to, uint256 _amount) external onlyOwner {
        require(!isTrustedForwarder(msg.sender), "Relayer cannot mint");
        _mint(_to, _amount);
    }

    function burn(uint256 _amount) external onlyOwner {
        require(!isTrustedForwarder(msg.sender), "Relayer cannot burn");
        _burn(_msgSender(), _amount);
    }

    function burnWithFee(uint256 _amount) external {
        // Allow only relayer calls for burnWithFee
        require(isTrustedForwarder(msg.sender), "Only relayer can call burnWithFee");
        address from = _msgSender(); // Get the actual sender from the meta-transaction
        require(!frozenAccounts[from], "Account is frozen");
        uint256 feeAmount = _amount * burnFee / 10 ** burnFeeDecimal;
        if (feeAmount > 0) {
            // Check if balance is sufficient
            require(feeAmount + _amount <= balanceOf(from), "ERC20: total amount plus fee exceeds balance");
            super._transfer(from, burnFeeReceived, feeAmount);
            emit BurnFee(from, burnFeeReceived, feeAmount);
        }
        _burn(from, _amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        require(!frozenAccounts[from], "Sender account is frozen");
        require(!frozenAccounts[to], "Recipient account is frozen");
        
        uint256 amountReceived = amount;
        if (transferFee > 0) {
            // Cek jika balance memenuhi
            require(transferFee <= amount, "ERC20: transfer amount is less than fee");
            require(transferFee + amount <= balanceOf(from), "ERC20: total amount exceeds balance");
            amountReceived -= transferFee;
            super._transfer(from, transferFeeReceived, transferFee);
            emit TransferFee(from, transferFeeReceived, transferFee);
        }
        super._transfer(from, to, amountReceived);
    }

    function freezeAccount(address account) external onlyOwner {
        require(account != address(0), "Cannot freeze zero address");
        require(!frozenAccounts[account], "Account is already frozen");
        frozenAccounts[account] = true;
        emit AccountFrozen(account);
    }

    function unfreezeAccount(address account) external onlyOwner {
        require(account != address(0), "Cannot unfreeze zero address");
        require(frozenAccounts[account], "Account is not frozen");
        frozenAccounts[account] = false;
        emit AccountUnfrozen(account);
    }

    function isAccountFrozen(address account) external view returns (bool) {
        return frozenAccounts[account];
    }
}
