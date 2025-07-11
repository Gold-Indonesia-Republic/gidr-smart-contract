import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { GIDR, MinimalForwarder } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("GIDR", function () {
  let gidr: GIDR;
  let accounts: SignerWithAddress[];
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let relayer: SignerWithAddress;
  let forwarder: MinimalForwarder;

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
      await gidr.connect(owner).mint(owner.address, 50n);
      expect(await gidr.balanceOf(owner.address)).to.equal(50n);

      // Transfer 50 tokens from owner to user1
      await gidr.connect(owner).transfer(user1.address, 50n);
      const user1Balance = await gidr.balanceOf(user1.address);
      expect(user1Balance).to.equal(50n);

      // Transfer 50 tokens from user1 to user2
      await gidr.connect(user1).transfer(user2.address, 50n);
      const user2Balance = await gidr.balanceOf(user2.address);
      expect(user2Balance).to.equal(50n);
    });

    it("Should transfer tokens between accounts using relayer", async function () {
      // Get relayer balance
      const relayerBalance = await gidr.balanceOf(relayer.address);
      // Mint 50 tokens to user1
      await gidr.connect(owner).mint(user1.address, 50n);
      expect(await gidr.balanceOf(user1.address)).to.equal(50n);

      // Transfer 30 tokens from user1 to user2 using relayer
      const transferAmount = 30n;
      const data = gidr.interface.encodeFunctionData("transfer", [
        user2.address,
        transferAmount,
      ]);
      await relayMetaTx(user1, gidr.address, data, "transfer");

      // Check balances after transfer
      expect(await gidr.balanceOf(user1.address)).to.equal(20n); // 50 - 30
      expect(await gidr.balanceOf(user2.address)).to.equal(30n);
      expect(await gidr.balanceOf(relayer.address)).to.equal(relayerBalance);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await gidr.balanceOf(owner.address);

      // Try to send 1 token from user1 (0 tokens) to owner (100 tokens).
      await expect(
        gidr.connect(user1).transfer(owner.address, 1n)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // Owner balance shouldn't have changed.
      expect(await gidr.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });

    it("Should update balances after transfers", async function () {
      // Mint some tokens to owner
      await gidr.connect(owner).mint(owner.address, 5000n);
      const initialOwnerBalance = await gidr.balanceOf(owner.address);

      // Transfer 100 tokens from owner to user1.
      await gidr.connect(owner).transfer(user1.address, 100n);

      // Transfer another 50 tokens from owner to user2.
      await gidr.connect(owner).transfer(user2.address, 50n);

      // Check balances.
      const finalOwnerBalance = await gidr.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(Number(initialOwnerBalance) - 150);

      const user1Balance = await gidr.balanceOf(user1.address);
      expect(user1Balance).to.equal(100n);

      const user2Balance = await gidr.balanceOf(user2.address);
      expect(user2Balance).to.equal(50n);
    });

    it("Should fail transfers using relayer when sender doesn't have enough tokens", async function () {
      const relayerBalance = await gidr.balanceOf(relayer.address);
      const user2Balance = await gidr.balanceOf(user2.address);

      // Try to transfer 100 tokens from user1 (0 tokens) to user2
      const transferAmount = 100n;
      const data = gidr.interface.encodeFunctionData("transfer", [
        user2.address,
        transferAmount,
      ]);

      // Relay meta-tx should fail
      await expect(
        relayMetaTx(user1, gidr.address, data, "transfer", true)
      ).to.be.rejectedWith("ERC20: transfer amount exceeds balance");

      // Balances should remain unchanged
      expect(await gidr.balanceOf(user1.address)).to.equal(0n);
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
      const fee = 100n; // 1% (100 basis points)
      const decimal = 4n; // 4 decimal places

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
      const fee = 100n;
      const decimal = 4n;

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

  describe("Burn with Fee", function () {
    beforeEach(async function () {
      // Set up burn fee
      await gidr.connect(owner).setBurnFee(user2.address, 100n, 4n); // 1% fee
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
      const expectedFee = Number(burnAmount) * 100 / 10000; // 1% of burn amount

      // Relay meta-tx as relayer for user1
      const data = gidr.interface.encodeFunctionData("burnWithFee", [
        burnAmount,
      ]);
      await relayMetaTx(user1, gidr.address, data, "burnWithFee");

      expect(await gidr.balanceOf(user1.address)).to.equal(
        Number(user1StartingBalance) - Number(burnAmount) - expectedFee
      );
      expect(await gidr.balanceOf(user2.address)).to.equal(
        Number(user2StartingBalance) + expectedFee
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
  });

  describe("GIDR Fee Negative Testing", () => {
    it("1. Transfer Fee > Transfer Amount", async () => {
      const amountTransfer = ethers.utils.parseEther("0.50");
      const excessiveFee = ethers.utils.parseEther("0.51");
      await gidr
        .connect(owner)
        .setTransferFee(user1.address, excessiveFee);
      await expect(
        gidr.connect(owner).transfer(user1.address, amountTransfer)
      ).to.be.revertedWith("ERC20: transfer amount is less than fee");
    });

    it("2. Fee + Transfer Amount > Balance", async () => {
      const amountTransfer = ethers.utils.parseEther("50000000000000000");
      const excessiveFee = ethers.utils.parseEther("0.51");
      await gidr
        .connect(owner)
        .setTransferFee(user1.address, excessiveFee);
      await expect(
        gidr.connect(owner).transfer(user1.address, amountTransfer)
      ).to.be.revertedWith("ERC20: total amount exceeds balance");
    });
  });
});
