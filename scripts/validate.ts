// scripts/validate-upgrade.js
import { ethers, upgrades } from 'hardhat';

async function main() {
  const proxyAddress = process.env.TEST_CONTRACT_ADDRESS || '0x58E48bF29FBCa0450C03FdFaaDCc78A5d5a95153'; // Replace with your deployed proxy address
  
  // Get the current implementation address
  const currentImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  // Get the current implementation contract
  const currentImpl = await ethers.getContractAt('GIDR', currentImplAddress);
  
  // Get the new implementation contract factory
  const newImpl = await ethers.getContractFactory('GIDR');
  
  await upgrades.validateUpgrade(currentImpl, newImpl, {
    kind: 'uups',
  });
  console.log('Upgrade validated!');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});