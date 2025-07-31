// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/// @title GIDR - Gold Indonesia Republic
/// @author Oksidian Tafly - GIDR Dev
/// @notice GIDR is a stablecoin that is pegged to the price of gold.
/// @dev All is functional as of v5
contract GIDR is UUPSUpgradeable, OwnableUpgradeable, ERC20Upgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    /// @notice Version code of the contract, as contract is upgradable
    /// @dev This is used to prevent reverts due to upgradeable contract
    uint256 public versionCode;

    /// @notice Old variable for fee receiver, will be removed in v6
    /// @dev Still up in v5 but not used
    address public feeReceived; // deprecated
    /// @notice Old variable for fee amount, will be removed in v6
    /// @dev Still up in v5 but not used
    uint256 public fee; // deprecated

    // Add new variables
    /// @notice New variable for transfer fee receiver, is in use since v5
    address public transferFeeReceived;
    /// @notice New variable for transfer fee amount, is in use since v5
    uint256 public transferFee;
    /// @notice New variable for burn fee receiver, is in use since v5
    address public burnFeeReceived;
    /// @notice New variable for burn fee amount, is in use since v5
    uint256 public burnFee;
    /// @notice New variable for burn fee decimal, is in use since v5
    uint256 public burnFeeDecimal;

    /// @notice Event for setting transfer fee
    event SetTransferFee(address indexed feeReceived, uint256 indexed fee);
    /// @notice Event for transferring transfer fee
    event TransferFee(
        address indexed from,
        address indexed feeReceived,
        uint256 indexed amount
    );

    /// @notice Event for setting burn fee
    event SetBurnFee(
        address indexed feeReceived,
        uint256 indexed fee,
        uint256 indexed decimal
    );
    /// @notice Event for transferring burn fee
    event BurnFee(
        address indexed from,
        address indexed feeReceived,
        uint256 indexed amount
    );

    /// @notice Initialize the contract
    function initialize() public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init();
        __ERC20_init("Gold Indonesia Republic", "GIDR");
    }

    /// @notice Authorize the upgrade
    /// @dev Only the owner can authorize the upgrade
    function _authorizeUpgrade(address) internal override onlyOwner {
        versionCode += 1;
    }

    /// @notice Migrate to new fee system, already used and deprecated as of v5, will be removed in v6
    /// @dev Only the owner can migrate to new fee system, remove in v6
    function migrateToNewFeeSystem() external onlyOwner {
        require(transferFeeReceived == address(0), "Already migrated");
        transferFeeReceived = feeReceived;
        transferFee = fee;

        // Optionally clear old values
        feeReceived = address(0);
        fee = 0;
    }

    /// @notice Set transfer fee, it cannot be over 1 GIDR
    /// @param _transferFeeReceived The address of the receiver of the transfer fee
    /// @param _transferFee The amount of the transfer fee
    /// @dev Only the owner can set transfer fee, limit is still hardcoded and set to 1 GIDR
    function setTransferFee(
        address _transferFeeReceived,
        uint256 _transferFee
    ) external onlyOwner {
        require(_transferFeeReceived != address(0), "Address cannot be null");
        // Adding reasonable limit
        require(_transferFee / 10 ** 18 < 1, "Fee is over 1 GIDR");
        transferFeeReceived = _transferFeeReceived;
        transferFee = _transferFee;
        emit SetTransferFee(_transferFeeReceived, _transferFee);
    }

    /** @notice Set burn fee in percentage, the final amount is calculated from total GIDRs burned.
     * Percentage is calculated as: (burnFee / 10 ** burnFeeDecimal)%. It cannot be over 100%
     */
    /// @param _burnFeeReceived The address of the receiver of the burn fee
    /// @param _burnFee The amount of the burn fee
    /// @param _burnFeeDecimal The decimal of the burn fee
    /// @dev Only the owner can set burn fee, limit is still hardcoded and set to 100%
    function setBurnFee(
        address _burnFeeReceived,
        uint256 _burnFee,
        uint256 _burnFeeDecimal
    ) external onlyOwner {
        require(_burnFeeReceived != address(0), "Address cannot be null");
        require(_burnFeeDecimal <= 18, "Decimal cannot be greater than 18");
        // Adding reasonable limit
        require(_burnFee / 10 ** _burnFeeDecimal < 1, "Fee is over 100%");
        burnFeeReceived = _burnFeeReceived;
        burnFee = _burnFee;
        burnFeeDecimal = _burnFeeDecimal;
        emit SetBurnFee(_burnFeeReceived, _burnFee, _burnFeeDecimal);
    }

    // Tidak diperlukan MAX_MINT di bagian ini karena minting akan menggunakan multi-sig wallet (3/3 Party)
    // Selain itu, GIDR bersifat stablecoin sehingga minting tidak mempengaruhi harga
    /** @notice Mint GIDR, only the owner can mint, no need to set limits as GIDR is protected by multi-sig wallet (3/3 Party)
     * @param _to The address of the recipient
     * @param _amount The amount of GIDR to mint
     */
    function mint(address _to, uint256 _amount) external onlyOwner {
        _mint(_to, _amount);
    }

    /** @notice Burning GIDR, as of v5 all users can burn GIDR, this will be set to only owner in v6
     * @dev Setting to only owner is imperative in v6 to protect the balance of physical gold & GIDR
     * @param _amount The amount of GIDR to burn
     */
    function burn(uint256 _amount) external {
        _burn(_msgSender(), _amount);
    }

    /** @notice Burning GIDR with fee, as of v5 all users can burn GIDR with fee. 
     * This function will be set to using forwarders (meta-tx) in v6
     * @dev Setting forwarder(s) is imperative in v6 to protect the balance of physical gold & GIDR
     * @param _amount The amount of GIDR to burn
     */
    function burnWithFee(uint256 _amount) external {
        // Untuk melengkapi kebutuhan admin fee dari pihak gold redemption
        uint256 feeAmount = (_amount * burnFee) / 10 ** burnFeeDecimal;
        if (feeAmount > 0) {
            // Cek jika balance memenuhi
            require(
                feeAmount + _amount <= balanceOf(_msgSender()),
                "ERC20: total amount plus fee exceeds balance"
            );
            super._transfer(_msgSender(), burnFeeReceived, feeAmount);
            emit BurnFee(_msgSender(), burnFeeReceived, feeAmount);
        }
        _burn(_msgSender(), _amount);
    }

    /** @notice Transferring GIDR
     * @dev No changes in v6
     * @param from The address of the sender
     * @param to The address of the recipient
     * @param amount The amount of GIDR to transfer
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        uint256 amountReceived = amount;
        if (transferFee > 0) {
            // Cek jika balance memenuhi
            require(
                transferFee <= amount,
                "ERC20: transfer amount is less than fee"
            );
            require(
                transferFee + amount <= balanceOf(from),
                "ERC20: total amount exceeds balance"
            );
            amountReceived -= transferFee;
            super._transfer(from, transferFeeReceived, transferFee);
            emit TransferFee(from, transferFeeReceived, transferFee);
        }
        super._transfer(from, to, amountReceived);
    }
}
