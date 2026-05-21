# GIDR Smart Contracts

Smart contract workspace for the **Gold Indonesia Republic (ticker: GIDR)** ERC-20 gold-backed stablecoin pegged 1 to 1 to gold.  
The project is powered by Hardhat, TypeScript, and OpenZeppelin’s upgradeable stack so that the ERC20 logic can evolve while keeping the proxy address that wallets and integrations use.

### Audits
This smart contract has been audited by [CertiK](https://skynet.certik.com/projects/gold-indonesia-republic) and [BRAIN IPB](https://gidr.co.id/assets/pdf/BRAIN-report.pdf)

---

## Highlights

- **Upgradeable ERC20** – `GIDR.sol` is a UUPS-upgradeable ERC20 with ownership control through OpenZeppelin’s `OwnableUpgradeable`.
- **Fee controls** – Owners can configure a fixed transfer fee (capped at `1 GIDR`) and a percentage-based burn fee to channel redemption costs to dedicated receivers.
- **Mint/burn admin flow** – The owner (currently a multisig) mints backing supply; any holder can currently burn tokens without the burn fee applied. Users burning GIDR for physical redemption will incur a burn fee.
- **Scripted operations** – Deployment and upgrade scripts wrap Hardhat Upgrades, while verification and flattening helpers (via `sol-merger`) assist audits.
- **Typed tests & docs** – TypeChain bindings drive the test suite in `test/gidr.test.ts` and `solidity-docgen` can emit API docs into `./docs`.


## Repository Layout

| Path | Description |
| ---- | ----------- |
| `contracts/GIDR.sol` | Core ERC20 implementation with upgrade, fee, and mint/burn logic. |
| `contracts/GIDRVault.sol` | Holds deposited GIDR and lets an owner-managed burner list destroy stored tokens. |
| `scripts/deploy.ts` | Deploys a proxy + implementation pair using Hardhat Upgrades. |
| `scripts/upgrade.ts` | Upgrades an existing proxy after fetching implementation + ownership data. |
| `test/gidr.test.ts` | Mocha/Chai tests that cover transfers, fees, burns, and negative cases. |
| `docs/index.md` | Example output from `solidity-docgen`. |
| `hardhat.config.ts` | Hardhat setup with Polygon (testnet/mainnet) & Mandala networks, gas reporter, docgen, and Etherscan API wiring. |


## Prerequisites

- **Node.js 18+** (LTS is recommended for Hardhat’s toolchain) and npm.
- A funded account/private key for whichever network you plan to deploy or upgrade on.
- PolygonScan API key (or other relevant explorer API key) for contract verification.


## Setup

```bash
git clone <repo-url>
cd gidr-smart-contract
npm install
cp .env.example .env
```

Update `.env` with the settings you need:

| Variable | Purpose |
| -------- | ------- |
| `PRIVATE_KEY` | Deployer/signing account (hex string with `0x`). |
| `REPORT_GAS` | Enable Hardhat Gas Reporter when set (any truthy value). |
| `MUMBAI_POLYGON_TESTNET_URL`, `POLYGON_MAINNET_URL`, `MANDALA_MAINNET_URL` | RPC URLs for each configured network. |
| `POLYGON_API_KEY` | PolygonScan API key used by `npx hardhat verify`. |
| `STAGING_CONTRACT_ADDRESS`, `CONTRACT_ADDRESS`, `TEST_CONTRACT_ADDRESS` | Proxy addresses the scripts should target (upgrade/verify flows). |
| `RELAYER_ADDRESS`, `OWNER_ADDRESS` | Optional addresses consumed by `scripts/upgrade.ts`. |
| `PROD` | When set to `yes`, upgrade script assumes production config; otherwise it uses the staging/test addresses. |


## Everyday Commands

```bash
# Compile + TypeChain generation
npx hardhat compile

# Test suite (gas reporter honours REPORT_GAS in .env)
npm test
# or
REPORT_GAS=true npx hardhat test

# Start a local JSON-RPC node with hardhat network configuration
npx hardhat node

# Flatten contracts into ./build using sol-merger (useful for audits)
npm run build-contracts
```


## Deployment Workflow

1. Ensure `.env` has the RPC URL and `PRIVATE_KEY` for the network you are targeting (e.g., `mumbaipolygon`, `polygon`, or `mandala`).
2. (Optional) Run `npx hardhat compile` to confirm the build succeeds.
3. Deploy the upgradeable proxy:

   ```bash
   npx hardhat run scripts/deploy.ts --network <network-name>
   ```

   The script:
   - Uses your signer as both the proxy admin (`Ownable`) and the trusted forwarder constructor argument.
   - Logs the deployed proxy address which should be recorded in `.env` for later upgrades.


## Upgrading an Existing Proxy

1. Set `CONTRACT_ADDRESS` (or `TEST_CONTRACT_ADDRESS` if not in production) and `RELAYER_ADDRESS` / `OWNER_ADDRESS` as needed inside `.env`.
2. Export `PROD=yes` when you want to use the production address. Leave it unset for staging.
3. Execute the upgrade:

   ```bash
   PROD=yes npx hardhat run scripts/upgrade.ts --network polygon
   ```

   The script:
   - Prints the current implementation and owner for traceability.
   - Calls `upgradeProxy` with the new `GIDR` implementation and deploys any constructor args for the trusted forwarder.
   - Waits for the new implementation transaction to be mined.


## Verification

After deploying or upgrading, verify the implementation on PolygonScan:

```bash
npx hardhat verify --network polygon <implementation-address>
npx hardhat verify --network mumbaipolygon <staging-implementation-address>
```

You can fetch implementation addresses by running a short Hardhat script/console session that calls `upgrades.erc1967.getImplementationAddress(<proxyAddress>)`, exactly as `scripts/upgrade.ts` demonstrates.


## Generating Solidity Docs

`solidity-docgen` is already wired through Hardhat. Run:

```bash
npx hardhat docgen
```

This rewrites the markdown API reference in `docs/`. Commit the generated files when documentation needs to accompany a release.


## Testing Notes

- The suite in `test/gidr.test.ts` covers positive flows (transfers, relayed transfers, fee configuration, mint/burn) and negative cases (frozen accounts, excessive fees, insufficient balances).
- Tests rely on Hardhat Network impersonating multiple `Signer`s and OpenZeppelin’s `MinimalForwarder` to simulate meta-transactions, so no external services are required.
- Run with `REPORT_GAS=true` to annotate gas costs per function.


## Troubleshooting

- **`Operation not permitted` warnings** – macOS + rvm may emit harmless `ps` errors; they do not affect Hardhat tasks.
- **Missing env vars** – Hardhat treats empty RPC URLs/accounts as “not configured”. Double-check `.env` if a network task immediately exits.
- **Upgrade failures** – confirm the proxy address is correct and that the deployer owns the proxy (`owner()` call in the upgrade script should match your signer). Use Hardhat console to inspect storage if needed.


## Next Steps

- Integrate the deployment/upgrade scripts with your multisig workflow or CI/CD (e.g., Safe transaction builder).
- Extend the README with business context such as gold custody process, multisig participant requirements, or off-chain reconciliation procedures as they become available.
