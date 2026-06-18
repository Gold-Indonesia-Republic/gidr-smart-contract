import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { GOIDR } from "../typechain-types";

describe("GOIDR", function () {
  let goidr: GOIDR;
  let accounts: HardhatEthersSigner[];
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];

    // Deploy GOIDR
    const GOIDR = await ethers.getContractFactory("GOIDR");
    goidr = (await upgrades.deployProxy(GOIDR, {
      initializer: "initialize",
      unsafeAllow: ["constructor", "missing-initializer-call"] as any,
    })) as unknown as GOIDR;
    await goidr.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await goidr.owner()).to.equal(owner.address);
    });

    it("Should set the correct name and symbol", async function () {
      expect(await goidr.name()).to.equal("Gold Indonesia Republic");
      expect(await goidr.symbol()).to.equal("GOIDR");
    });

    it("Should initialize with version code 7", async function () {
      expect(await goidr.versionCode()).to.equal(7n);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      // Mint 50 tokens to owner
      await goidr.connect(owner).mint(owner.address, 50n);
      expect(await goidr.balanceOf(owner.address)).to.equal(50n);

      // Transfer 50 tokens from owner to user1
      await goidr.connect(owner).transfer(user1.address, 50n);
      const user1Balance = await goidr.balanceOf(user1.address);
      expect(user1Balance).to.equal(50n);

      // Transfer 50 tokens from user1 to user2
      await goidr.connect(user1).transfer(user2.address, 50n);
      const user2Balance = await goidr.balanceOf(user2.address);
      expect(user2Balance).to.equal(50n);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await goidr.balanceOf(owner.address);

      // Try to send 1 token from user1 (0 tokens) to owner
      await expect(
        goidr.connect(user1).transfer(owner.address, 1n)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // Owner balance shouldn't have changed.
      expect(await goidr.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });

    it("Should update balances after transfers", async function () {
      // Mint some tokens to owner
      await goidr.connect(owner).mint(owner.address, 5000n);
      const initialOwnerBalance = await goidr.balanceOf(owner.address);

      // Transfer 100 tokens from owner to user1.
      await goidr.connect(owner).transfer(user1.address, 100n);

      // Transfer another 50 tokens from owner to user2.
      await goidr.connect(owner).transfer(user2.address, 50n);

      // Check balances.
      const finalOwnerBalance = await goidr.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance - 150n);

      const user1Balance = await goidr.balanceOf(user1.address);
      expect(user1Balance).to.equal(100n);

      const user2Balance = await goidr.balanceOf(user2.address);
      expect(user2Balance).to.equal(50n);
    });
  });

  describe("Fee Management", function () {
    it("Should set and get transfer fee correctly", async function () {
      const feeReceiver = user1.address;
      const fee = ethers.parseEther("0.1"); // 0.1 GOIDR

      await goidr.connect(owner).setTransferFee(feeReceiver, fee);

      expect(await goidr.transferFeeReceived()).to.equal(feeReceiver);
      expect(await goidr.transferFee()).to.equal(fee);
    });

    it("Should set and get burn fee correctly", async function () {
      const feeReceiver = user1.address;
      const fee = 100n; // 1% (100 basis points)
      const decimal = 4n; // 4 decimal places

      await goidr.connect(owner).setBurnFee(feeReceiver, fee, decimal);

      expect(await goidr.burnFeeReceived()).to.equal(feeReceiver);
      expect(await goidr.burnFee()).to.equal(fee);
      expect(await goidr.burnFeeDecimal()).to.equal(decimal);
    });

    it("Should fail to set transfer fee if not owner", async function () {
      const feeReceiver = user1.address;
      const fee = ethers.parseEther("0.1");

      await expect(
        goidr.connect(user1).setTransferFee(feeReceiver, fee)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail to set burn fee if not owner", async function () {
      const feeReceiver = user1.address;
      const fee = 100n;
      const decimal = 4n;

      await expect(
        goidr.connect(user1).setBurnFee(feeReceiver, fee, decimal)
      ).to.be.revertedWith("Caller is not owner or burn vault");
    });

    it("Should reject transfer fee > 1 GOIDR", async function () {
      const feeReceiver = user1.address;
      const excessiveFee = ethers.parseEther("1.1"); // 1.1 GOIDR

      await expect(
        goidr.connect(owner).setTransferFee(feeReceiver, excessiveFee)
      ).to.be.revertedWith("Fee is over 1 GOIDR");
    });

    it("Should reject burn fee > 100%", async function () {
      const feeReceiver = user1.address;
      const fee = 100001n; // > 100%
      const decimal = 4n;

      await expect(
        goidr.connect(owner).setBurnFee(feeReceiver, fee, decimal)
      ).to.be.revertedWith("Fee is over 100%");
    });

    it("Should reject transfer fee with null address", async function () {
      const fee = ethers.parseEther("0.1");

      await expect(
        goidr.connect(owner).setTransferFee(ethers.ZeroAddress, fee)
      ).to.be.revertedWith("Address cannot be null");
    });

    it("Should reject burn fee with null address", async function () {
      await expect(
        goidr
          .connect(owner)
          .setBurnFee(ethers.ZeroAddress, 100n, 4n)
      ).to.be.revertedWith("Address cannot be null");
    });

    it("Should reject burn fee decimal > 18", async function () {
      const feeReceiver = user1.address;
      const fee = 100n;
      const decimal = 19n;

      await expect(
        goidr.connect(owner).setBurnFee(feeReceiver, fee, decimal)
      ).to.be.revertedWith("Decimal cannot be greater than 18");
    });
  });

  describe("Transfer with Fee", function () {
    beforeEach(async function () {
      // Set up transfer fee
      const fee = ethers.parseEther("0.1"); // 0.1 GOIDR
      await goidr.connect(owner).setTransferFee(user2.address, fee);
      // Mint tokens to user1
      await goidr
        .connect(owner)
        .mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should deduct transfer fee from sender", async function () {
      const transferAmount = ethers.parseEther("100");
      const fee = ethers.parseEther("0.1");
      const user1StartingBalance = await goidr.balanceOf(user1.address);
      const user2StartingBalance = await goidr.balanceOf(user2.address);
      const receiverAddress = accounts[4];

      await goidr.connect(user1).transfer(receiverAddress.address, transferAmount);

      const user1EndBalance = await goidr.balanceOf(user1.address);
      const user2EndBalance = await goidr.balanceOf(user2.address);
      const receiverBalance = await goidr.balanceOf(receiverAddress.address);

      // user1 loses the transfer amount (fee is deducted from the recipient, not added to sender loss)
      expect(user1EndBalance).to.equal(user1StartingBalance - transferAmount);
      // Recipient gets transfer amount minus fee
      expect(receiverBalance).to.equal(transferAmount - fee);
      // Fee receiver gets the fee
      expect(user2EndBalance).to.equal(user2StartingBalance + fee);
    });

    it("Should fail if transfer amount less than fee", async function () {
      const smallTransfer = ethers.parseEther("0.05"); // Less than 0.1 fee

      await expect(
        goidr.connect(user1).transfer(accounts[4].address, smallTransfer)
      ).to.be.revertedWith("ERC20: transfer amount is less than fee");
    });

    it("Should fail if transfer amount + fee exceeds balance", async function () {
      const transferAmount = ethers.parseEther("999.95");

      await expect(
        goidr.connect(user1).transfer(accounts[4].address, transferAmount)
      ).to.be.revertedWith("ERC20: total amount exceeds balance");
    });
  });

  describe("Minting and Burn Vault", function () {
    it("Should mint tokens correctly", async function () {
      const amount = ethers.parseEther("1000");
      await goidr.connect(owner).mint(user1.address, amount);
      expect(await goidr.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should fail to mint if not owner", async function () {
      const amount = ethers.parseEther("1000");
      await expect(
        goidr.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow burn vault to burn tokens", async function () {
      const amount = ethers.parseEther("1000");
      await goidr.connect(owner).mint(user1.address, amount);

      // Set up user1 as the burn vault
      await goidr.connect(owner).setBurnVault(user1.address);
      expect(await goidr.burnVault()).to.equal(user1.address);

      // Now user1 can burn tokens
      const balanceBefore = await goidr.balanceOf(user1.address);
      await goidr.connect(user1).burn(amount);
      const balanceAfter = await goidr.balanceOf(user1.address);

      expect(balanceAfter).to.equal(balanceBefore - amount);
    });

    it("Should fail to burn if not burn vault", async function () {
      const amount = ethers.parseEther("1000");
      await goidr.connect(owner).mint(user1.address, amount);

      await expect(
        goidr.connect(user1).burn(amount)
      ).to.be.revertedWith("Caller is not burn vault");
    });

    it("Should set burn vault", async function () {
      await goidr.connect(owner).setBurnVault(user1.address);
      expect(await goidr.burnVault()).to.equal(user1.address);
    });

    it("Should replace burn vault when setBurnVault is called again", async function () {
      await goidr.connect(owner).setBurnVault(user1.address);
      expect(await goidr.burnVault()).to.equal(user1.address);

      await goidr.connect(owner).setBurnVault(user2.address);
      expect(await goidr.burnVault()).to.equal(user2.address);
    });

    it("Should fail to set burn vault if not owner", async function () {
      await expect(
        goidr.connect(user1).setBurnVault(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should burnWithFee: send fee to burnFeeReceived and full amount to burnVault", async function () {
      const amount = ethers.parseEther("100");
      const feeReceiver = accounts[3];

      // 1% fee (100 / 10^4 = 0.01 = 1%)
      await goidr.connect(owner).setBurnFee(feeReceiver.address, 100n, 4n);
      await goidr.connect(owner).setBurnVault(user2.address);

      const expectedFee = amount * 100n / 10000n; // 1 GOIDR
      // user1 must hold amount + fee
      await goidr.connect(owner).mint(user1.address, amount + expectedFee);

      const feeReceiverBefore = await goidr.balanceOf(feeReceiver.address);
      const vaultBefore = await goidr.balanceOf(user2.address);

      await goidr.connect(user1).burnWithFee(amount);

      expect(await goidr.balanceOf(feeReceiver.address)).to.equal(feeReceiverBefore + expectedFee);
      expect(await goidr.balanceOf(user2.address)).to.equal(vaultBefore + amount);
      expect(await goidr.balanceOf(user1.address)).to.equal(0n);
    });

    it("Should burnWithFee: send full amount to burnVault when fee is zero", async function () {
      const amount = ethers.parseEther("100");
      await goidr.connect(owner).mint(user1.address, amount);
      await goidr.connect(owner).setBurnVault(user2.address);

      const vaultBefore = await goidr.balanceOf(user2.address);
      await goidr.connect(user1).burnWithFee(amount);
      expect(await goidr.balanceOf(user2.address)).to.equal(vaultBefore + amount);
    });

    it("Should revert burnWithFee if burn vault not set", async function () {
      const amount = ethers.parseEther("100");
      await goidr.connect(owner).mint(user1.address, amount);
      await expect(
        goidr.connect(user1).burnWithFee(amount)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });

    it("Should allow burn vault to set burn fee", async function () {
      const feeReceiver = user2.address;
      const fee = 100n; // 1% (100 basis points)
      const decimal = 4n; // 4 decimal places

      // Set up user1 as the burn vault
      await goidr.connect(owner).setBurnVault(user1.address);

      // Now user1 (burn vault) can set burn fee
      await goidr.connect(user1).setBurnFee(feeReceiver, fee, decimal);

      expect(await goidr.burnFeeReceived()).to.equal(feeReceiver);
      expect(await goidr.burnFee()).to.equal(fee);
      expect(await goidr.burnFeeDecimal()).to.equal(decimal);
    });

    it("Should fail to set burn fee if not owner or burn vault", async function () {
      const feeReceiver = user2.address;
      const fee = 100n;
      const decimal = 4n;

      // user1 is not the owner or burn vault
      await expect(
        goidr.connect(user1).setBurnFee(feeReceiver, fee, decimal)
      ).to.be.revertedWith("Caller is not owner or burn vault");
    });
  });
});
