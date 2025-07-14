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
PROD=yes npx hardhat run scripts/upgrade.ts --network polygon
npx hardhat verify --network polygon 0xbe436d572Ba6CBD82234011f710eB20e6b51b6E1 # Test
npx hardhat verify --network polygon 0x0a40ff165736f5989e9F40fFbEd24A640c760754 # Production
```
