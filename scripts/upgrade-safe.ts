import { ethers, upgrades, run } from "hardhat";
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { OperationType } from "@safe-global/types-kit";
import TrezorConnect from "@trezor/connect";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const prod = process.env.PROD === "yes";
  const PROXY_ADDRESS = prod ? process.env.CONTRACT_ADDRESS : process.env.TEST_CONTRACT_ADDRESS;
  const SAFE_ADDRESS = prod ? process.env.SAFE_ADDRESS : process.env.TEST_SAFE_ADDRESS;
  const RPC_URL = process.env.POLYGON_MAINNET_URL;
  const TREZOR_PATH = process.env.TREZOR_PATH ?? "m/44'/60'/0'/0/0";

  if (!PROXY_ADDRESS) throw new Error("Missing CONTRACT_ADDRESS in .env");
  if (!SAFE_ADDRESS) throw new Error("Missing SAFE_ADDRESS in .env");
  if (!RPC_URL) throw new Error("Missing POLYGON_MAINNET_URL in .env");

  // --- Step 1: Deploy new implementation (validates storage layout, updates OZ manifest) ---
  const GOIDRFactory = await ethers.getContractFactory("GOIDR");

  console.log("Deploying new implementation...");
  const newImplAddress = (await upgrades.prepareUpgrade(PROXY_ADDRESS, GOIDRFactory, {
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

  // --- Step 3: Encode upgradeToAndCall calldata ---
  // upgradeToAndCall atomically swaps the implementation and calls initializeV7()
  // on the new implementation, bumping versionCode in proxy storage. The GIDR -> GOIDR
  // symbol rebrand takes effect via the symbol() override in the new implementation.
  const reinitCalldata = new ethers.Interface([
    "function initializeV7()",
  ]).encodeFunctionData("initializeV7");

  const upgradeCalldata = new ethers.Interface([
    "function upgradeToAndCall(address newImplementation, bytes memory data)",
  ]).encodeFunctionData("upgradeToAndCall", [newImplAddress, reinitCalldata]);

  // --- Step 4: Get Trezor address ---
  // Trezor Suite must be running — it starts the Bridge at 127.0.0.1:21325.
  await TrezorConnect.init({
    manifest: { appName: "GOIDR Smart Contract", appUrl: "https://goidr.co.id", email: "hi@goidr.co.id" },
    transports: ["BridgeTransport"],
  });

  console.log("Fetching address from Trezor...");
  const addrResult = await TrezorConnect.ethereumGetAddress({ path: TREZOR_PATH, showOnTrezor: false, useEmptyPassphrase: true });
  if (!addrResult.success) throw new Error(`Trezor: ${(addrResult.payload as any).error}`);
  const signerAddress = addrResult.payload.address;
  console.log("Proposer (Trezor):", signerAddress);

  // --- Step 5: Connect to Safe (no signer — read-only for tx construction) ---
  const safeSdk = await Safe.init({ provider: RPC_URL, safeAddress: SAFE_ADDRESS });

  const owners = await safeSdk.getOwners();
  if (!owners.map((o) => o.toLowerCase()).includes(signerAddress.toLowerCase())) {
    throw new Error(`Trezor address ${signerAddress} is not a Safe owner. Owners: ${owners.join(", ")}`);
  }

  // --- Step 6: Create transaction and compute hash ---
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
  console.log("Safe tx hash:", safeTxHash);

  // --- Step 7: Sign hash with Trezor (eth_sign — adds Ethereum prefix before hashing) ---
  console.log("Please confirm signing on your Trezor device...");
  const signResult = await TrezorConnect.ethereumSignMessage({
    path: TREZOR_PATH,
    message: safeTxHash.slice(2), // hex bytes without 0x
    hex: true,
    useEmptyPassphrase: true,
  });
  if (!signResult.success) throw new Error(`Trezor signing: ${(signResult.payload as any).error}`);

  // Trezor always prepends the Ethereum signed message prefix, but returns v=27/28 (or 0/1).
  // Safe's contract expects v=31/32 for prefixed eth_sign signatures (v > 30 is the flag).
  // Source: Safe docs https://docs.safe.global/advanced/smart-account-signatures
  // and protocol-kit/dist/src/utils/signatures/utils.js `adjustVInSignature`
  //
  // @trezor/protobuf/lib/decode.js returns `bytes` fields as raw hex WITHOUT 0x prefix,
  // and ethereumSignMessage.js applies no addHexPrefix transform (unlike ethereumSignTx).
  const rawSigHex = signResult.payload.signature.startsWith("0x")
    ? signResult.payload.signature.slice(2)
    : signResult.payload.signature;
  const sigBytes = Buffer.from(rawSigHex, "hex");
  let v = sigBytes[64];
  if (v < 27) v += 27; // normalize 0/1 → 27/28 (firmware may return either)
  sigBytes[64] = v + 4; // mark as prefixed eth_sign for Safe contract
  const trezorSignature = "0x" + sigBytes.toString("hex");

  // --- Step 8: Propose to Safe Transaction Service ---
  // Polygon (chainId 137) auto-resolves to https://safe-transaction-polygon.safe.global
  const apiKit = new SafeApiKit({ chainId: BigInt(137) });

  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: signerAddress,
    senderSignature: trezorSignature,
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
