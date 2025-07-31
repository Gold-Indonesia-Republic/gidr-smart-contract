# Solidity API

## GIDR

GIDR is a stablecoin that is pegged to the price of gold.

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

Old variable for fee receiver, will be removed in v6

_Still up in v5 but not used_

### fee

```solidity
uint256 fee
```

Old variable for fee amount, will be removed in v6

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

### migrateToNewFeeSystem

```solidity
function migrateToNewFeeSystem() external
```

Migrate to new fee system, already used and deprecated as of v5, will be removed in v6

_Only the owner can migrate to new fee system, remove in v6_

### setTransferFee

```solidity
function setTransferFee(address _transferFeeReceived, uint256 _transferFee) external
```

Set transfer fee, it cannot be over 1 GIDR

_Only the owner can set transfer fee, limit is still hardcoded and set to 1 GIDR_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _transferFeeReceived | address | The address of the receiver of the transfer fee |
| _transferFee | uint256 | The amount of the transfer fee |

### setBurnFee

```solidity
function setBurnFee(address _burnFeeReceived, uint256 _burnFee, uint256 _burnFeeDecimal) external
```

_Only the owner can set burn fee, limit is still hardcoded and set to 100%_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _burnFeeReceived | address | The address of the receiver of the burn fee |
| _burnFee | uint256 | The amount of the burn fee |
| _burnFeeDecimal | uint256 | The decimal of the burn fee |

### mint

```solidity
function mint(address _to, uint256 _amount) external
```

Mint GIDR, only the owner can mint, no need to set limits as GIDR is protected by multi-sig wallet (3/3 Party)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _to | address | The address of the recipient |
| _amount | uint256 | The amount of GIDR to mint |

### burn

```solidity
function burn(uint256 _amount) external
```

Burning GIDR, as of v5 all users can burn GIDR, this will be set to only owner in v6

_Setting to only owner is imperative in v6 to protect the balance of physical gold & GIDR_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | The amount of GIDR to burn |

### burnWithFee

```solidity
function burnWithFee(uint256 _amount) external
```

Burning GIDR with fee, as of v5 all users can burn GIDR with fee. 
This function will be set to using forwarders (meta-tx) in v6

_Setting forwarder(s) is imperative in v6 to protect the balance of physical gold & GIDR_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | The amount of GIDR to burn |

### _transfer

```solidity
function _transfer(address from, address to, uint256 amount) internal
```

Transferring GIDR

_No changes in v6_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The address of the sender |
| to | address | The address of the recipient |
| amount | uint256 | The amount of GIDR to transfer |

