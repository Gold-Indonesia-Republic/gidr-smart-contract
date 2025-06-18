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
  let relayer: SignerWithAddress;
  let forwarder: any;

  function decodeRevert(returndata: string): string {
    if (!returndata || returndata.length < 10) return "Silent revert";
    try {
      const reason = ethers.utils.toUtf8String("0x" + returndata.slice(138));
      return reason;
    } catch {
      return "Failed to decode revert reason";
    }
  }

  async function relayMetaTx(
    signer: SignerWithAddress,
    to: string,
    data: string,
    fun: string,
    stc: boolean = false
  ) {
    const from = await signer.getAddress();
    const nonce = await forwarder.getNonce(from);
    const request = {
      from,
      to,
      value: 0,
      gas: 1e6,
      nonce,
      data,
    };
    const domain = {
      name: "MinimalForwarder",
      version: "0.0.1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: forwarder.address,
    };
    const types = {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    };
    const signature = await signer._signTypedData(domain, types, request);

    if (stc) {
      const [success, returndata] = await forwarder.callStatic.execute(
        request,
        signature
      );
      if (!success) {
        throw new Error(decodeRevert(returndata));
      }
    }
    const tx = await forwarder.connect(relayer).execute(request, signature);
    return tx;
  }

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    relayer = accounts[3];

    // Deploy the MinimalForwarder
    const Forwarder = await ethers.getContractFactory("MinimalForwarder");
    forwarder = await Forwarder.deploy();
    await forwarder.deployed();

    // Deploy GIDR with the forwarder as trustedForwarder
    const GIDR = await ethers.getContractFactory("GIDR");
    gidr = (await upgrades.deployProxy(GIDR, {
      initializer: "initialize",
      unsafeAllow: ["constructor"],
      constructorArgs: [forwarder.address],
    })) as GIDR;
    await gidr.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await gidr.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await gidr.balanceOf(owner.address);
      expect(await gidr.totalSupply()).to.equal(ownerBalance);
    });

    it("Should set the correct name and symbol", async function () {
      expect(await gidr.name()).to.equal("Gold Indonesia Republic");
      expect(await gidr.symbol()).to.equal("GIDR");
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

    it("Should transfer tokens between accounts using relayer", async function () {
      // Get relayer balance
      const relayerBalance = await gidr.balanceOf(relayer.address);
      // Mint 50 tokens to user1
      await gidr.connect(owner).mint(user1.address, 50);
      expect(await gidr.balanceOf(user1.address)).to.equal(50);

      // Transfer 30 tokens from user1 to user2 using relayer
      const transferAmount = 30;
      const data = gidr.interface.encodeFunctionData("transfer", [
        user2.address,
        transferAmount,
      ]);
      await relayMetaTx(user1, gidr.address, data, "transfer");

      // Check balances after transfer
      expect(await gidr.balanceOf(user1.address)).to.equal(20); // 50 - 30
      expect(await gidr.balanceOf(user2.address)).to.equal(30);
      expect(await gidr.balanceOf(relayer.address)).to.equal(relayerBalance);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await gidr.balanceOf(owner.address);

      // Try to send 1 token from user1 (0 tokens) to owner (100 tokens).
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

    it("Should fail transfers using relayer when sender doesn't have enough tokens", async function () {
      const relayerBalance = await gidr.balanceOf(relayer.address);
      const user2Balance = await gidr.balanceOf(user2.address);

      // Try to transfer 100 tokens from user1 (0 tokens) to user2
      const transferAmount = 100;
      const data = gidr.interface.encodeFunctionData("transfer", [
        user2.address,
        transferAmount,
      ]);

      // Relay meta-tx should fail
      await expect(
        relayMetaTx(user1, gidr.address, data, "transfer", true)
      ).to.be.rejectedWith("ERC20: transfer amount exceeds balance");

      // Balances should remain unchanged
      expect(await gidr.balanceOf(user1.address)).to.equal(0);
      expect(await gidr.balanceOf(user2.address)).to.equal(user2Balance);
      expect(await gidr.balanceOf(relayer.address)).to.equal(relayerBalance);
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
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Minting and Burning", function () {
    it("Should mint tokens correctly", async function () {
      const amount = ethers.utils.parseEther("1000");
      await gidr.connect(owner).mint(user1.address, amount);
      expect(await gidr.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should only burn tokens when owner calls it", async function () {
      const amount = ethers.utils.parseEther("1000");
      await gidr.connect(owner).mint(user1.address, amount);
      await expect(gidr.connect(user1).burn(amount)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should let the owner burn tokens", async function () {
      const amount = ethers.utils.parseEther("1000");
      const ownerStartingBalance = await gidr.balanceOf(owner.address);
      await gidr.connect(owner).mint(owner.address, amount);
      await gidr.connect(owner).burn(amount);
      expect(await gidr.balanceOf(owner.address)).to.equal(
        ownerStartingBalance
      );
    });

    it("Should fail to mint if not owner", async function () {
      const amount = ethers.utils.parseEther("1000");
      await expect(
        gidr.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Frozen Accounts", function () {
    it("Should freeze and unfreeze accounts correctly", async function () {
      // Freeze account
      await gidr.connect(owner).freezeAccount(user1.address);
      expect(await gidr.frozenAccounts(user1.address)).to.be.true;

      // Try to transfer from frozen account
      await gidr
        .connect(owner)
        .mint(user1.address, ethers.utils.parseEther("1000"));
      await expect(
        gidr
          .connect(user1)
          .transfer(user2.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Sender account is frozen");

      // Unfreeze account
      await gidr.connect(owner).unfreezeAccount(user1.address);
      expect(await gidr.frozenAccounts(user1.address)).to.be.false;

      // Transfer should work now
      await gidr
        .connect(user1)
        .transfer(user2.address, ethers.utils.parseEther("100"));
      expect(await gidr.balanceOf(user2.address)).to.equal(
        ethers.utils.parseEther("100")
      );
    });

    it("Should fail to freeze/unfreeze if not owner", async function () {
      await expect(
        gidr.connect(user1).freezeAccount(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        gidr.connect(user1).unfreezeAccount(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Burn with Fee", function () {
    beforeEach(async function () {
      // Set up burn fee
      await gidr.connect(owner).setBurnFee(user2.address, 100, 4); // 1% fee
      // Mint tokens to user1
      await gidr
        .connect(owner)
        .mint(user1.address, ethers.utils.parseEther("1000"));
    });

    it("Should burn tokens with fee correctly", async function () {
      const user1StartingBalance = await gidr.balanceOf(user1.address);
      const user2StartingBalance = await gidr.balanceOf(user2.address);
      const relayerStartingBalance = await gidr.balanceOf(relayer.address);
      const burnAmount = ethers.utils.parseEther("100");
      const expectedFee = burnAmount.mul(100).div(10000); // 1% of burn amount

      // Relay meta-tx as relayer for user1
      const data = gidr.interface.encodeFunctionData("burnWithFee", [
        burnAmount,
      ]);
      await relayMetaTx(user1, gidr.address, data, "burnWithFee");

      expect(await gidr.balanceOf(user1.address)).to.equal(
        user1StartingBalance.sub(burnAmount).sub(expectedFee)
      );
      expect(await gidr.balanceOf(user2.address)).to.equal(
        user2StartingBalance.add(expectedFee)
      );
      expect(await gidr.balanceOf(relayer.address)).to.equal(
        relayerStartingBalance
      );
    });

    it("Should fail to burn with fee if not relayer", async function () {
      const burnAmount = ethers.utils.parseEther("100");
      // Try to relay meta-tx as user1 (not relayer)
      await expect(
        gidr.connect(user1).burnWithFee(burnAmount)
      ).to.be.revertedWith("Only relayer can call burnWithFee");
    });

    it("Should fail to burn with fee if account is frozen", async function () {
      // Verify burn fee is set correctly
      const burnFee = await gidr.burnFee();
      const burnFeeDecimal = await gidr.burnFeeDecimal();
      const burnFeeReceived = await gidr.burnFeeReceived();
      expect(burnFee).to.equal(100); // 1%
      expect(burnFeeDecimal).to.equal(4);
      expect(burnFeeReceived).to.equal(user2.address);

      // Freeze the account and verify it's frozen
      await gidr.connect(owner).freezeAccount(user1.address);
      const isFrozen = await gidr.frozenAccounts(user1.address);
      expect(isFrozen).to.be.true;
      expect(await gidr.isAccountFrozen(user1.address)).to.be.true;

      // Get initial balance
      const initialBalance = await gidr.balanceOf(user1.address);

      // Mint tokens to user1 to ensure they have enough balance
      const burnAmount = ethers.utils.parseEther("100");
      await gidr.connect(owner).mint(user1.address, burnAmount);

      // Verify the account is still frozen after minting
      expect(await gidr.isAccountFrozen(user1.address)).to.be.true;

      // Try to burn with fee using relayer
      const data = gidr.interface.encodeFunctionData("burnWithFee", [
        burnAmount,
      ]);
      await expect(
        relayMetaTx(user1, gidr.address, data, "burnWithFeeShouldFail", true)
      ).to.be.rejectedWith("Account is frozen");

      // Verify balances haven't changed
      expect(await gidr.balanceOf(user1.address)).to.equal(
        initialBalance.add(burnAmount)
      );
      expect(await gidr.balanceOf(user2.address)).to.equal(0);
    });
  });

  describe("GIDR Fee Negative Testing", () => {
    it("1. Transfer Fee > Transfer Amount", async () => {
      const amountTransfer = await ethers.utils.parseEther("0.50");
      const excessiveFee = await ethers.utils.parseEther("0.51");
      await gidr
        .connect(owner)
        .setTransferFee(accounts[1].address, excessiveFee);
      await expect(
        gidr.connect(owner).transfer(accounts[1].address, amountTransfer)
      ).to.be.revertedWith("ERC20: transfer amount is less than fee");
    });

    it("2. Fee + Transfer Amount > Balance", async () => {
      const amountTransfer = await ethers.utils.parseEther("50000000000000000");
      const excessiveFee = await ethers.utils.parseEther("0.51");
      await gidr
        .connect(owner)
        .setTransferFee(accounts[1].address, excessiveFee);
      await expect(
        gidr.connect(owner).transfer(accounts[1].address, amountTransfer)
      ).to.be.revertedWith("ERC20: total amount exceeds balance");
    });

    it("3. Transfer fails when sender account is frozen", async () => {
      // Mint some tokens to user1
      const transferAmount = ethers.utils.parseEther("100");
      await gidr.connect(owner).mint(user1.address, transferAmount);

      // Freeze user1's account
      await gidr.connect(owner).freezeAccount(user1.address);
      expect(await gidr.isAccountFrozen(user1.address)).to.be.true;

      // Attempt transfer from frozen account should fail
      await expect(
        gidr.connect(user1).transfer(user2.address, transferAmount)
      ).to.be.revertedWith("Sender account is frozen");
    });

    it("4. Transfer fails when recipient account is frozen", async () => {
      // Mint some tokens to user1
      const transferAmount = ethers.utils.parseEther("100");
      await gidr.connect(owner).mint(user1.address, transferAmount);

      // Freeze user2's account (recipient)
      await gidr.connect(owner).freezeAccount(user2.address);
      expect(await gidr.isAccountFrozen(user2.address)).to.be.true;

      // Attempt transfer to frozen account should fail
      await expect(
        gidr.connect(user1).transfer(user2.address, transferAmount)
      ).to.be.revertedWith("Recipient account is frozen");
    });

    it("5. Cannot freeze an already frozen account", async () => {
      // First freeze
      await gidr.connect(owner).freezeAccount(user1.address);
      expect(await gidr.isAccountFrozen(user1.address)).to.be.true;

      // Attempt to freeze again should fail
      await expect(
        gidr.connect(owner).freezeAccount(user1.address)
      ).to.be.revertedWith("Account is already frozen");
    });

    it("6. Cannot unfreeze an account that is not frozen", async () => {
      // Verify account is not frozen initially
      expect(await gidr.isAccountFrozen(user1.address)).to.be.false;

      // Attempt to unfreeze should fail
      await expect(
        gidr.connect(owner).unfreezeAccount(user1.address)
      ).to.be.revertedWith("Account is not frozen");
    });
  });
});
