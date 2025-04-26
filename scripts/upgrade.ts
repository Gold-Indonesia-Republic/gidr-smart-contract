// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  // const contract_owner = await ethers.getSigner(
  //   process.env.OWNER_ADDRESS || ""
  // );
  const GIDR = await ethers.getContractFactory("GIDR");
  var CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
  const TEST_CONTRACT_ADDRESS = process.env.TEST_CONTRACT_ADDRESS || "";
  if (process.env.PROD != "yes") {
    CONTRACT_ADDRESS = TEST_CONTRACT_ADDRESS;
  }

  console.log("Upgrading contract...");
  const instance_gidr = await upgrades.upgradeProxy(
    CONTRACT_ADDRESS,
    GIDR,
    { kind: "uups" }
  );
  await instance_gidr.deployed();

  console.log("Contract upgraded, migrating data...");
  const tx = await instance_gidr.migrateToNewFeeSystem();
  await tx.wait();
  
  console.log("Migration complete");
  console.log("New implementation deployed to:", instance_gidr.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
