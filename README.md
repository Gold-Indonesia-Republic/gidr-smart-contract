# GIDR Smart Contract

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Example tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```

Upgrading contracts:

```shell
npx hardhat verify --network polygon 0x0a40ff165736f5989e9F40fFbEd24A640c760754
npx hardhat run scripts/upgrade.ts --network polygon
```
