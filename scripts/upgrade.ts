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
  let CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
  const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS || "";
  const OWNER_ADDRESS = process.env.OWNER_ADDRESS || "";
  const TEST_CONTRACT_ADDRESS = process.env.TEST_CONTRACT_ADDRESS || "";
  if (process.env.PROD !== "yes") {
    CONTRACT_ADDRESS = TEST_CONTRACT_ADDRESS;
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error("CONTRACT_ADDRESS is not set.");
  }

  const impl = await upgrades.erc1967.getImplementationAddress(
    CONTRACT_ADDRESS
  );
  console.log("Impl address:", impl);

  const proxy = await ethers.getContractAt("GIDR", CONTRACT_ADDRESS);
  const owner = await proxy.owner();
  console.log("Owner:", owner);

  const implContract = await ethers.getContractAt("GIDR", impl);
  try {
    const implOwner = await implContract.owner();
    console.log("Impl owner:", implOwner); // Should usually fail or return junk
  } catch (e) {
    console.log("Impl contract does not return a valid owner (expected)");
  }

  console.log("Upgrading contract...");
  const instance_gidr = await upgrades.upgradeProxy(CONTRACT_ADDRESS, GIDR as any, {
    unsafeAllow: ["constructor"],
    constructorArgs: [RELAYER_ADDRESS] // Pass trustedForwarder address as constructor argument
  });

  await instance_gidr.waitForDeployment();
  console.log("New implementation deployed to:", await instance_gidr.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
