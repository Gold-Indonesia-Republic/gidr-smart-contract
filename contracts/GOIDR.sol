// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/// @title GOIDR - Gold Indonesia Republic
/// @author Oksidian Tafly - GOIDR Dev
/// @notice GOIDR is a stablecoin that is pegged to the price of gold.
/// @dev All is functional as of v5
contract GOIDR is UUPSUpgradeable, OwnableUpgradeable, ERC20Upgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    /// @notice Version code of the contract, as contract is upgradable
    /// @dev This is used to prevent reverts due to upgradeable contract
    uint256 public versionCode;

    /// @notice Old variable for fee receiver, will be removed in v7
    /// @dev Still up in v5 but not used
    address public feeReceived; // deprecated
    /// @notice Old variable for fee amount, will be removed in v7
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
    /// @notice Address of the vault contract allowed to burn tokens
    address public burnVault;

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
    /// @notice Event for setting the burn vault
    event SetBurnVault(address indexed vault);

    modifier onlyBurnVault() {
        require(_msgSender() == burnVault, "Caller is not burn vault");
        _;
    }

    modifier onlyOwnerOrBurnVault() {
        require(
            owner() == _msgSender() || _msgSender() == burnVault,
            "Caller is not owner or burn vault"
        );
        _;
    }

    /// @notice Initialize the contract
    function initialize() public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init();
        __ERC20_init("Gold Indonesia Republic", "GOIDR");
        versionCode = 7; // Update version code to 7, as this is the v7 implementation
    }

    /// @notice Authorize the upgrade
    /// @dev Only the owner can authorize the upgrade
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice ERC20 symbol, rebranded GIDR -> GOIDR in v7.
    /// @dev Overrides ERC20Upgradeable.symbol(). The live proxy's stored _symbol still reads
    ///      "GIDR" (set by the original initialize(), which cannot re-run), so the symbol is
    ///      rebranded here at the code level. Fresh deploys also set "GOIDR" via __ERC20_init,
    ///      keeping both paths consistent. The token name is unchanged.
    function symbol() public pure override returns (string memory) {
        return "GOIDR";
    }

    /// @notice Reinitializer for v7 — bumps versionCode in existing proxy storage.
    /// @dev Called atomically via upgradeToAndCall; reinitializer(3) runs once after the original initializer(1).
    ///      Uses slot 3 (not 2) so the upgrade succeeds regardless of whether an earlier v6 reinitializer
    ///      was ever executed on-chain — the live proxy is still at v5.
    ///      Intentionally omits __Ownable_init — already called in initialize(), re-calling would reset the owner.
    ///      The symbol rebrand is handled by the symbol() override above, not storage.
    function initializeV7() public reinitializer(3) onlyOwner {
        versionCode = 7;
    }

    /// @notice Set transfer fee, it cannot be over 1 GOIDR
    /// @param _transferFeeReceived The address of the receiver of the transfer fee
    /// @param _transferFee The amount of the transfer fee
    /// @dev Only the owner can set transfer fee, limit is still hardcoded and set to 1 GOIDR
    function setTransferFee(
        address _transferFeeReceived,
        uint256 _transferFee
    ) external onlyOwner {
        require(_transferFeeReceived != address(0), "Address cannot be null");
        // Adding reasonable limit
        require(_transferFee / 10 ** 18 < 1, "Fee is over 1 GOIDR");
        transferFeeReceived = _transferFeeReceived;
        transferFee = _transferFee;
        emit SetTransferFee(_transferFeeReceived, _transferFee);
    }

    /** @notice Set burn fee in percentage, the final amount is calculated from total GOIDRs burned.
     * Percentage is calculated as: (burnFee / 10 ** burnFeeDecimal)%. It cannot be over 100%
     */
    /// @param _burnFee The amount of the burn fee
    /// @param _burnFeeDecimal The decimal of the burn fee
    /// @dev Only the owner or burn vault can set burn fee, limit is still hardcoded and set to 100%
    function setBurnFee(
        uint256 _burnFee,
        uint256 _burnFeeDecimal
    ) external onlyOwnerOrBurnVault {
        require(_burnFeeDecimal <= 18, "Decimal cannot be greater than 18");
        // Adding reasonable limit
        require(_burnFee / 10 ** _burnFeeDecimal < 1, "Fee is over 100%");
        burnFeeReceived = owner();
        burnFee = _burnFee;
        burnFeeDecimal = _burnFeeDecimal;
        emit SetBurnFee(owner(), _burnFee, _burnFeeDecimal);
    }

    /// @notice Set the vault contract that is allowed to burn tokens
    /// @param _burnVault The address of the vault contract
    /// @dev Only the owner can set the vault contract
    function setBurnVault(address _burnVault) external onlyOwner {
        require(_burnVault != address(0), "Burn vault cannot be zero");
        burnVault = _burnVault;
        emit SetBurnVault(_burnVault);
    }

    // Tidak diperlukan MAX_MINT di bagian ini karena minting akan menggunakan multi-sig wallet (3/3 Party)
    // Selain itu, GOIDR bersifat stablecoin sehingga minting tidak mempengaruhi harga
    /** @notice Mint GOIDR, only the owner can mint, no need to set limits as GOIDR is protected by multi-sig wallet (3/3 Party)
     * @param _to The address of the recipient
     * @param _amount The amount of GOIDR to mint
     */
    function mint(address _to, uint256 _amount) external onlyOwner {
        _mint(_to, _amount);
    }

    /** @notice Burning GOIDR, only the configured vault can burn
     * @dev Restrict burning to the vault to centralize redemption flow
     * @param _amount The amount of GOIDR to burn
     */
    function burn(uint256 _amount) external onlyBurnVault {
        _burn(_msgSender(), _amount);
    }

    /** @notice Transfer tokens to burn vault (minus fee sent to owner)
     * @param _amount The total amount of GOIDR to send
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
        _transfer(_msgSender(), burnVault, _amount);
    }

    /** @notice Transferring GOIDR
     * @dev No changes in v7
     * @param from The address of the sender
     * @param to The address of the recipient
     * @param amount The amount of GOIDR to transfer
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
