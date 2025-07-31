// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract GIDR is UUPSUpgradeable, OwnableUpgradeable, ERC20Upgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    uint256 public versionCode;

    // Keep old variables (mark as deprecated)
    address public feeReceived; // deprecated
    uint256 public fee; // deprecated

    // Add new variables
    address public transferFeeReceived;
    uint256 public transferFee;
    address public burnFeeReceived;
    uint256 public burnFee;
    uint256 public burnFeeDecimal;

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
        __UUPSUpgradeable_init();
        __Ownable_init();
        __ERC20_init("Gold Indonesia Republic", "GIDR");
    }

    function _authorizeUpgrade(address) internal override onlyOwner {
        versionCode += 1;
    }

    function migrateToNewFeeSystem() external onlyOwner {
        require(transferFeeReceived == address(0), "Already migrated");
        transferFeeReceived = feeReceived;
        transferFee = fee;
        
        // Optionally clear old values
        feeReceived = address(0);
        fee = 0;
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

    // Tidak diperlukan MAX_MINT di bagian ini karena minting akan menggunakan multi-sig wallet (1 Party)
    // Selain itu, GIDR bersifat stablecoin sehingga minting tidak mempengaruhi harga
    function mint(address _to, uint256 _amount) external onlyOwner {
        _mint(_to, _amount);
    }

    function burn(uint256 _amount) external {
        _burn(_msgSender(), _amount);
    }

    function burnWithFee(uint256 _amount) external {
    // Untuk melengkapi kebutuhan admin fee dari pihak gold redemption
        uint256 feeAmount = _amount * burnFee / 10 ** burnFeeDecimal;
        if (feeAmount > 0) {
            // Cek jika balance memenuhi
            require(feeAmount + _amount <= balanceOf(_msgSender()), "ERC20: total amount plus fee exceeds balance");
            super._transfer(_msgSender(), burnFeeReceived, feeAmount);
            emit BurnFee(_msgSender(), burnFeeReceived, feeAmount);
        }
        _burn(_msgSender(), _amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
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
}