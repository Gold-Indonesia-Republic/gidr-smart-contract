# GIDR Smart Contract

Smart contract for Gold-backed stablecoin GIDR (Gold Indonesia Republic)

Setting up:
```shell
npm i
cp .env.example .env
```

Running local test:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```

Upgrading contracts:

```shell
PROD=yes npx hardhat run scripts/upgrade.ts --network polygon
npx hardhat verify --network polygon {{Staging contract address}} # Test
npx hardhat verify --network polygon {{Production contract address}} # Production
```
