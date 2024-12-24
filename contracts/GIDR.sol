pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract GIDR is UUPSUpgradeable, OwnableUpgradeable, ERC20Upgradeable {
    uint256 public versionCode;

    address public feeReceived;
    uint256 public fee;

    event SetFee(address indexed feeReceived, uint256 indexed fee);
    event Fee(
        address indexed from,
        address indexed feeReceived,
        uint256 indexed amount
    );

    function initialize() public initializer {
        __Ownable_init();
        __ERC20_init("Gold Indonesia Republic", "GIDR");
    }

    function _authorizeUpgrade(address) internal override onlyOwner {
        versionCode += 1;
    }

    function setFee(address _feeReceived, uint256 _fee) external onlyOwner {
        require(_feeReceived != address(0), "Address cannot be null");
        feeReceived = _feeReceived;
        fee = _fee;
        emit SetFee(_feeReceived, _fee);
    }

    // Tidak diperlukan MAX_MINT di bagian ini karena minting akan menggunakan multi-sig wallet (1 Party)
    // Selain itu, GIDR bersifat stablecoin sehingga minting tidak mempengaruhi harga
    function mint(address _to, uint256 _amount) external onlyOwner {
        _mint(_to, _amount);
    }

    function burn(uint256 _amount) external {
        _burn(_msgSender(), _amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        uint256 amountReceived = amount;
        if (fee > 0) {
            require(fee <= amount, "ERC20: transfer amount is less than fee");
            require(fee + amount <= balanceOf(from), "ERC20: total amount exceeds balance");
            amountReceived -= fee;
            super._transfer(from, feeReceived, fee);
            emit Fee(from, feeReceived, fee);
        }
        super._transfer(from, to, amountReceived);
    }
}
