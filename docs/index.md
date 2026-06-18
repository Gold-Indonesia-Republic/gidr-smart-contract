# Solidity API

## GOIDR

GOIDR is a stablecoin that is pegged to the price of gold.

_All is functional as of v5_

### constructor

```solidity
constructor() public
```

### versionCode

```solidity
uint256 versionCode
```

Version code of the contract, as contract is upgradable

_This is used to prevent reverts due to upgradeable contract_

### feeReceived

```solidity
address feeReceived
```

Old variable for fee receiver, will be removed in v7

_Still up in v5 but not used_

### fee

```solidity
uint256 fee
```

Old variable for fee amount, will be removed in v7

_Still up in v5 but not used_

### transferFeeReceived

```solidity
address transferFeeReceived
```

New variable for transfer fee receiver, is in use since v5

### transferFee

```solidity
uint256 transferFee
```

New variable for transfer fee amount, is in use since v5

### burnFeeReceived

```solidity
address burnFeeReceived
```

New variable for burn fee receiver, is in use since v5

### burnFee

```solidity
uint256 burnFee
```

New variable for burn fee amount, is in use since v5

### burnFeeDecimal

```solidity
uint256 burnFeeDecimal
```

New variable for burn fee decimal, is in use since v5

### burnVault

```solidity
address burnVault
```

Address of the vault contract allowed to burn tokens

### SetTransferFee

```solidity
event SetTransferFee(address feeReceived, uint256 fee)
```

Event for setting transfer fee

### TransferFee

```solidity
event TransferFee(address from, address feeReceived, uint256 amount)
```

Event for transferring transfer fee

### SetBurnFee

```solidity
event SetBurnFee(address feeReceived, uint256 fee, uint256 decimal)
```

Event for setting burn fee

### BurnFee

```solidity
event BurnFee(address from, address feeReceived, uint256 amount)
```

Event for transferring burn fee

### SetBurnVault

```solidity
event SetBurnVault(address vault)
```

Event for setting the burn vault

### onlyBurnVault

```solidity
modifier onlyBurnVault()
```

### onlyOwnerOrBurnVault

```solidity
modifier onlyOwnerOrBurnVault()
```

### initialize

```solidity
function initialize() public
```

Initialize the contract

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address) internal
```

Authorize the upgrade

_Only the owner can authorize the upgrade_

### symbol

```solidity
function symbol() public pure returns (string)
```

ERC20 symbol, rebranded GIDR -> GOIDR in v7.

_Overrides ERC20Upgradeable.symbol(). The live proxy's stored _symbol still reads
     "GIDR" (set by the original initialize(), which cannot re-run), so the symbol is
     rebranded here at the code level. Fresh deploys also set "GOIDR" via __ERC20_init,
     keeping both paths consistent. The token name is unchanged._

### initializeV7

```solidity
function initializeV7() public
```

Reinitializer for v7 — bumps versionCode in existing proxy storage.

_Called atomically via upgradeToAndCall; reinitializer(3) runs once after the original initializer(1).
     Uses slot 3 (not 2) so the upgrade succeeds regardless of whether an earlier v6 reinitializer
     was ever executed on-chain — the live proxy is still at v5.
     Intentionally omits __Ownable_init — already called in initialize(), re-calling would reset the owner.
     The symbol rebrand is handled by the symbol() override above, not storage._

### setTransferFee

```solidity
function setTransferFee(address _transferFeeReceived, uint256 _transferFee) external
```

Set transfer fee, it cannot be over 1 GOIDR

_Only the owner can set transfer fee, limit is still hardcoded and set to 1 GOIDR_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _transferFeeReceived | address | The address of the receiver of the transfer fee |
| _transferFee | uint256 | The amount of the transfer fee |

### setBurnFee

```solidity
function setBurnFee(uint256 _burnFee, uint256 _burnFeeDecimal) external
```

_Only the owner or burn vault can set burn fee, limit is still hardcoded and set to 100%_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _burnFee | uint256 | The amount of the burn fee |
| _burnFeeDecimal | uint256 | The decimal of the burn fee |

### setBurnVault

```solidity
function setBurnVault(address _burnVault) external
```

Set the vault contract that is allowed to burn tokens

_Only the owner can set the vault contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _burnVault | address | The address of the vault contract |

### mint

```solidity
function mint(address _to, uint256 _amount) external
```

Mint GOIDR, only the owner can mint, no need to set limits as GOIDR is protected by multi-sig wallet (3/3 Party)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _to | address | The address of the recipient |
| _amount | uint256 | The amount of GOIDR to mint |

### burn

```solidity
function burn(uint256 _amount) external
```

Burning GOIDR, only the configured vault can burn

_Restrict burning to the vault to centralize redemption flow_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | The amount of GOIDR to burn |

### burnWithFee

```solidity
function burnWithFee(uint256 _amount) external
```

Transfer tokens to burn vault (minus fee sent to owner)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | The total amount of GOIDR to send |

### _transfer

```solidity
function _transfer(address from, address to, uint256 amount) internal
```

Transferring GOIDR

_No changes in v7_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The address of the sender |
| to | address | The address of the recipient |
| amount | uint256 | The amount of GOIDR to transfer |

## IGOIDR

### burn

```solidity
function burn(uint256 amount) external
```

## GOIDRVault

Stores GOIDR deposits and lets an owner-managed list of burners destroy the stored tokens.

### goidr

```solidity
contract IGOIDR goidr
```

### burners

```solidity
mapping(address => bool) burners
```

### burnFeeReceiver

```solidity
address burnFeeReceiver
```

### burnFee

```solidity
uint256 burnFee
```

### burnFeeDecimal

```solidity
uint256 burnFeeDecimal
```

### BurnerAdded

```solidity
event BurnerAdded(address account)
```

### BurnerRemoved

```solidity
event BurnerRemoved(address account)
```

### Deposited

```solidity
event Deposited(address from, uint256 amount)
```

### Burned

```solidity
event Burned(address caller, uint256 amount)
```

### Recovered

```solidity
event Recovered(address to, uint256 amount)
```

### BurnFeeUpdated

```solidity
event BurnFeeUpdated(address receiver, uint256 fee, uint256 decimal)
```

### BurnFeeCharged

```solidity
event BurnFeeCharged(address receiver, uint256 amount)
```

### constructor

```solidity
constructor(address goidrToken) public
```

### onlyBurner

```solidity
modifier onlyBurner()
```

### addBurner

```solidity
function addBurner(address account) external
```

### removeBurner

```solidity
function removeBurner(address account) external
```

### setBurnFee

```solidity
function setBurnFee(address receiver, uint256 fee, uint256 feeDecimal) external
```

Configure burn fee for this vault.

_Fee is expressed as burnFee / 10 ** burnFeeDecimal (e.g., 50, 2 = 0.5%)._

### deposit

```solidity
function deposit(uint256 amount) external
```

Pull GOIDR into the vault. Caller must approve first.

### burnStored

```solidity
function burnStored(uint256 amount) external
```

Burn stored GOIDR from the vault balance.

### burnAll

```solidity
function burnAll() external
```

### totalStored

```solidity
function totalStored() external view returns (uint256)
```

### recover

```solidity
function recover(uint256 amount) external
```

Recover GOIDR from the vault back to the contract owner.

_Only callable by owner, allows reclaiming unburned tokens._

### _burnWithFee

```solidity
function _burnWithFee(uint256 amount) internal
```

