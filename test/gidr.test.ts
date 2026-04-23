import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GIDR } from "../typechain-types";

describe("GIDR", function () {
  let gidr: GIDR;
  let accounts: SignerWithAddress[];
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];

    // Deploy GIDR
    const GIDR = await ethers.getContractFactory("GIDR");
    gidr = (await upgrades.deployProxy(GIDR, {
      initializer: "initialize",
      unsafeAllow: ["constructor"],
    })) as GIDR;
    await gidr.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await gidr.owner()).to.equal(owner.address);
    });

    it("Should set the correct name and symbol", async function () {
      expect(await gidr.name()).to.equal("Gold Indonesia Republic");
      expect(await gidr.symbol()).to.equal("GIDR");
    });

    it("Should initialize with version code 0", async function () {
      expect(await gidr.versionCode()).to.equal(0);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      // Mint 50 tokens to owner
      await gidr.connect(owner).mint(owner.address, 50);
      expect(await gidr.balanceOf(owner.address)).to.equal(50);

      // Transfer 50 tokens from owner to user1
      await gidr.connect(owner).transfer(user1.address, 50);
      const user1Balance = await gidr.balanceOf(user1.address);
      expect(user1Balance).to.equal(50);

      // Transfer 50 tokens from user1 to user2
      await gidr.connect(user1).transfer(user2.address, 50);
      const user2Balance = await gidr.balanceOf(user2.address);
      expect(user2Balance).to.equal(50);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await gidr.balanceOf(owner.address);

      // Try to send 1 token from user1 (0 tokens) to owner
      await expect(
        gidr.connect(user1).transfer(owner.address, 1)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // Owner balance shouldn't have changed.
      expect(await gidr.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });

    it("Should update balances after transfers", async function () {
      // Mint some tokens to owner
      await gidr.connect(owner).mint(owner.address, 5000);
      const initialOwnerBalance = await gidr.balanceOf(owner.address);

      // Transfer 100 tokens from owner to user1.
      await gidr.connect(owner).transfer(user1.address, 100);

      // Transfer another 50 tokens from owner to user2.
      await gidr.connect(owner).transfer(user2.address, 50);

      // Check balances.
      const finalOwnerBalance = await gidr.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance.sub(150));

      const user1Balance = await gidr.balanceOf(user1.address);
      expect(user1Balance).to.equal(100);

      const user2Balance = await gidr.balanceOf(user2.address);
      expect(user2Balance).to.equal(50);
    });
  });

  describe("Fee Management", function () {
    it("Should set and get transfer fee correctly", async function () {
      const feeReceiver = user1.address;
      const fee = ethers.utils.parseEther("0.1"); // 0.1 GIDR

      await gidr.connect(owner).setTransferFee(feeReceiver, fee);

      expect(await gidr.transferFeeReceived()).to.equal(feeReceiver);
      expect(await gidr.transferFee()).to.equal(fee);
    });

    it("Should set and get burn fee correctly", async function () {
      const feeReceiver = user1.address;
      const fee = 100; // 1% (100 basis points)
      const decimal = 4; // 4 decimal places

      await gidr.connect(owner).setBurnFee(feeReceiver, fee, decimal);

      expect(await gidr.burnFeeReceived()).to.equal(feeReceiver);
      expect(await gidr.burnFee()).to.equal(fee);
      expect(await gidr.burnFeeDecimal()).to.equal(decimal);
    });

    it("Should fail to set transfer fee if not owner", async function () {
      const feeReceiver = user1.address;
      const fee = ethers.utils.parseEther("0.1");

      await expect(
        gidr.connect(user1).setTransferFee(feeReceiver, fee)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail to set burn fee if not owner", async function () {
      const feeReceiver = user1.address;
      const fee = 100;
      const decimal = 4;

      await expect(
        gidr.connect(user1).setBurnFee(feeReceiver, fee, decimal)
      ).to.be.revertedWith("Caller is not owner or burn vault");
    });

    it("Should reject transfer fee > 1 GIDR", async function () {
      const feeReceiver = user1.address;
      const excessiveFee = ethers.utils.parseEther("1.1"); // 1.1 GIDR

      await expect(
        gidr.connect(owner).setTransferFee(feeReceiver, excessiveFee)
      ).to.be.revertedWith("Fee is over 1 GIDR");
    });

    it("Should reject burn fee > 100%", async function () {
      const feeReceiver = user1.address;
      const fee = 100001; // > 100%
      const decimal = 4;

      await expect(
        gidr.connect(owner).setBurnFee(feeReceiver, fee, decimal)
      ).to.be.revertedWith("Fee is over 100%");
    });

    it("Should reject transfer fee with null address", async function () {
      const fee = ethers.utils.parseEther("0.1");

      await expect(
        gidr.connect(owner).setTransferFee(ethers.constants.AddressZero, fee)
      ).to.be.revertedWith("Address cannot be null");
    });

    it("Should reject burn fee with null address", async function () {
      await expect(
        gidr
          .connect(owner)
          .setBurnFee(ethers.constants.AddressZero, 100, 4)
      ).to.be.revertedWith("Address cannot be null");
    });

    it("Should reject burn fee decimal > 18", async function () {
      const feeReceiver = user1.address;
      const fee = 100;
      const decimal = 19;

      await expect(
        gidr.connect(owner).setBurnFee(feeReceiver, fee, decimal)
      ).to.be.revertedWith("Decimal cannot be greater than 18");
    });
  });

  describe("Transfer with Fee", function () {
    beforeEach(async function () {
      // Set up transfer fee
      const fee = ethers.utils.parseEther("0.1"); // 0.1 GIDR
      await gidr.connect(owner).setTransferFee(user2.address, fee);
      // Mint tokens to user1
      await gidr
        .connect(owner)
        .mint(user1.address, ethers.utils.parseEther("1000"));
    });

    it("Should deduct transfer fee from sender", async function () {
      const transferAmount = ethers.utils.parseEther("100");
      const fee = ethers.utils.parseEther("0.1");
      const user1StartingBalance = await gidr.balanceOf(user1.address);
      const user2StartingBalance = await gidr.balanceOf(user2.address);
      const receiverAddress = accounts[4];

      await gidr.connect(user1).transfer(receiverAddress.address, transferAmount);

      const user1EndBalance = await gidr.balanceOf(user1.address);
      const user2EndBalance = await gidr.balanceOf(user2.address);
      const receiverBalance = await gidr.balanceOf(receiverAddress.address);

      // user1 loses the transfer amount (fee is deducted from the recipient, not added to sender loss)
      expect(user1EndBalance).to.equal(user1StartingBalance.sub(transferAmount));
      // Recipient gets transfer amount minus fee
      expect(receiverBalance).to.equal(transferAmount.sub(fee));
      // Fee receiver gets the fee
      expect(user2EndBalance).to.equal(user2StartingBalance.add(fee));
    });

    it("Should fail if transfer amount less than fee", async function () {
      const smallTransfer = ethers.utils.parseEther("0.05"); // Less than 0.1 fee

      await expect(
        gidr.connect(user1).transfer(accounts[4].address, smallTransfer)
      ).to.be.revertedWith("ERC20: transfer amount is less than fee");
    });

    it("Should fail if transfer amount + fee exceeds balance", async function () {
      const transferAmount = ethers.utils.parseEther("999.95");
      const fee = ethers.utils.parseEther("0.1");

      await expect(
        gidr.connect(user1).transfer(accounts[4].address, transferAmount)
      ).to.be.revertedWith("ERC20: total amount exceeds balance");
    });
  });

  describe("Minting and Burn Vault", function () {
    it("Should mint tokens correctly", async function () {
      const amount = ethers.utils.parseEther("1000");
      await gidr.connect(owner).mint(user1.address, amount);
      expect(await gidr.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should fail to mint if not owner", async function () {
      const amount = ethers.utils.parseEther("1000");
      await expect(
        gidr.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow burn vault to burn tokens", async function () {
      const amount = ethers.utils.parseEther("1000");
      await gidr.connect(owner).mint(user1.address, amount);

      // Set up user1 as the burn vault
      await gidr.connect(owner).setBurnVault(user1.address);
      expect(await gidr.burnVault()).to.equal(user1.address);

      // Now user1 can burn tokens
      const balanceBefore = await gidr.balanceOf(user1.address);
      await gidr.connect(user1).burn(amount);
      const balanceAfter = await gidr.balanceOf(user1.address);

      expect(balanceAfter).to.equal(balanceBefore.sub(amount));
    });

    it("Should fail to burn if not burn vault", async function () {
      const amount = ethers.utils.parseEther("1000");
      await gidr.connect(owner).mint(user1.address, amount);

      await expect(
        gidr.connect(user1).burn(amount)
      ).to.be.revertedWith("Caller is not burn vault");
    });

    it("Should set burn vault", async function () {
      await gidr.connect(owner).setBurnVault(user1.address);
      expect(await gidr.burnVault()).to.equal(user1.address);
    });

    it("Should update burn vault allowlist", async function () {
      await gidr.connect(owner).setBurnVault(user1.address);
      expect(await gidr.burnVaults(user1.address)).to.be.true;

      // Add another vault to the allowlist
      await gidr.connect(owner).updateBurnVault(user2.address, true);
      expect(await gidr.burnVaults(user2.address)).to.be.true;
    });

    it("Should fail to set burn vault if not owner", async function () {
      await expect(
        gidr.connect(user1).setBurnVault(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if trying to call deprecated burnWithFee", async function () {
      const amount = ethers.utils.parseEther("100");
      await expect(
        gidr.connect(user1).burnWithFee(amount)
      ).to.be.revertedWith("Deprecated: use vault fee flow");
    });

    it("Should allow burn vault to set burn fee", async function () {
      const feeReceiver = user2.address;
      const fee = 100; // 1% (100 basis points)
      const decimal = 4; // 4 decimal places

      // Set up user1 as the burn vault
      await gidr.connect(owner).setBurnVault(user1.address);

      // Now user1 (burn vault) can set burn fee
      await gidr.connect(user1).setBurnFee(feeReceiver, fee, decimal);

      expect(await gidr.burnFeeReceived()).to.equal(feeReceiver);
      expect(await gidr.burnFee()).to.equal(fee);
      expect(await gidr.burnFeeDecimal()).to.equal(decimal);
    });

    it("Should fail to set burn fee if not owner or burn vault", async function () {
      const feeReceiver = user2.address;
      const fee = 100;
      const decimal = 4;

      // user1 is not the owner or burn vault
      await expect(
        gidr.connect(user1).setBurnFee(feeReceiver, fee, decimal)
      ).to.be.revertedWith("Caller is not owner or burn vault");
    });
  });
});

