import { ethers, upgrades, run } from "hardhat";
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { OperationType } from "@safe-global/types-kit";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = process.env.CONTRACT_ADDRESS;
  const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const RPC_URL = process.env.POLYGON_MAINNET_URL;

  if (!PROXY_ADDRESS) throw new Error("Missing CONTRACT_ADDRESS in .env");
  if (!SAFE_ADDRESS) throw new Error("Missing SAFE_ADDRESS in .env");
  if (!PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY in .env");
  if (!RPC_URL) throw new Error("Missing POLYGON_MAINNET_URL in .env");

  // --- Step 1: Deploy new implementation (validates storage layout, updates OZ manifest) ---
  const GIDRFactory = await ethers.getContractFactory("GIDR");

  console.log("Deploying new implementation...");
  const newImplAddress = (await upgrades.prepareUpgrade(PROXY_ADDRESS, GIDRFactory, {
    unsafeAllow: ["constructor", "missing-initializer-call"] as any,
    redeployImplementation: "onchange",
  })) as string;

  console.log("New implementation:", newImplAddress);

  // --- Step 2: Verify on Polygonscan ---
  console.log("Verifying implementation on Polygonscan...");
  try {
    await run("verify:verify", { address: newImplAddress, constructorArguments: [] });
    console.log("Verified:", newImplAddress);
  } catch (e: any) {
    if (e.message?.includes("Already Verified")) {
      console.log("Already verified.");
    } else {
      console.warn("Verification failed (non-fatal):", e.message);
    }
  }

  // --- Step 3: Encode upgradeTo calldata ---
  // `to` is the proxy — UUPS executes upgradeTo via delegatecall through the proxy
  const upgradeCalldata = new ethers.Interface([
    "function upgradeTo(address newImplementation)",
  ]).encodeFunctionData("upgradeTo", [newImplAddress]);

  // --- Step 4: Connect to Safe (protocol-kit v5) ---
  const safeSdk = await Safe.init({
    provider: RPC_URL,
    signer: PRIVATE_KEY,
    safeAddress: SAFE_ADDRESS,
  });

  const signerAddress = (await safeSdk.getSafeProvider().getSignerAddress()) as string;
  console.log("Proposer:", signerAddress);

  const owners = await safeSdk.getOwners();
  if (!owners.map((o) => o.toLowerCase()).includes(signerAddress.toLowerCase())) {
    throw new Error(`Signer ${signerAddress} is not a Safe owner. Owners: ${owners.join(", ")}`);
  }

  // --- Step 5: Create and sign the Safe transaction ---
  const safeTransaction = await safeSdk.createTransaction({
    transactions: [
      {
        to: PROXY_ADDRESS,
        value: "0",
        data: upgradeCalldata,
        operation: OperationType.Call,
      },
    ],
  });

  const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
  const senderSignature = await safeSdk.signHash(safeTxHash);
  console.log("Safe tx hash:", safeTxHash);

  // --- Step 6: Propose to Safe Transaction Service ---
  // Polygon (chainId 137) auto-resolves to https://safe-transaction-polygon.safe.global
  const apiKit = new SafeApiKit({ chainId: BigInt(137) });

  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: signerAddress,
    senderSignature: senderSignature.data,
  });

  const safeUiUrl = `https://app.safe.global/transactions/queue?safe=matic:${SAFE_ADDRESS}`;
  console.log("\nTransaction proposed successfully!");
  console.log("  New implementation: ", newImplAddress);
  console.log("  Safe tx hash:       ", safeTxHash);
  console.log("  Sign in Safe UI:    ", safeUiUrl);
  console.log("\nRemaining owners must sign at the URL above, then execute to complete the upgrade.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
