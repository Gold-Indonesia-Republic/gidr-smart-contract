import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("GIDR Positive Testing", function () {
  let instance_gidr: any;
  let accounts: any;
  const parseEther: any = ethers.utils.parseEther;
  const addressNull: string = "0x0000000000000000000000000000000000000000";

  before(async function () {
    accounts = await ethers.getSigners();
    instance_gidr = await upgrades.deployProxy(
      await ethers.getContractFactory("GIDR"),
      [],
      { kind: "uups" }
    );
    await instance_gidr.deployed();

    expect(await instance_gidr.name()).to.equal("Gold Indonesia Republic");
    expect(await instance_gidr.symbol()).to.equal("GIDR");
  });

  it("1. Minting", async () => {
    const amountMint = await parseEther("1000000");
    await expect(instance_gidr.mint(accounts[0].address, amountMint))
      .to.emit(instance_gidr, "Transfer")
      .withArgs(addressNull, accounts[0].address, amountMint);
    expect(await instance_gidr.balanceOf(accounts[0].address)).to.equal(
      amountMint
    );
  });

  it("2. Transfer", async () => {
    const amountTransfer = await parseEther("1000");
    await expect(instance_gidr.transfer(accounts[2].address, amountTransfer))
      .to.emit(instance_gidr, "Transfer")
      .withArgs(accounts[0].address, accounts[2].address, amountTransfer);
    expect(await instance_gidr.balanceOf(accounts[2].address)).to.equal(
      amountTransfer
    );

    await instance_gidr.increaseAllowance(accounts[1].address, amountTransfer);
    await expect(
      instance_gidr
        .connect(accounts[1])
        .transferFrom(accounts[0].address, accounts[3].address, amountTransfer)
    )
      .to.emit(instance_gidr, "Transfer")
      .withArgs(accounts[0].address, accounts[3].address, amountTransfer);
    expect(await instance_gidr.balanceOf(accounts[3].address)).to.equal(
      amountTransfer
    );
  });

  it("3. Burn", async () => {
    const amountBurn = await parseEther("1000");
    const finalValue = await parseEther("0");
    await expect(instance_gidr.connect(accounts[3]).burn(amountBurn))
    .to.emit(instance_gidr, "Transfer")
    .withArgs(accounts[3].address, addressNull, amountBurn);
    expect(await instance_gidr.balanceOf(accounts[3].address)).to.equal(finalValue);
  });

  it("4. Transfer Fee", async () => {
    const amountTransfer = await parseEther("1000");
    const fee = await parseEther("100");
    // Transfer Fee
    await expect(instance_gidr.setFee(accounts[4].address, fee))
      .to.emit(instance_gidr, "SetFee")
      .withArgs(accounts[4].address, fee);
    await expect(instance_gidr.transfer(accounts[5].address, amountTransfer))
      .to.emit(instance_gidr, "Fee")
      .withArgs(accounts[0].address, accounts[4].address, fee)
      .to.emit(instance_gidr, "Transfer")
      .withArgs(
        accounts[0].address,
        accounts[5].address,
        await parseEther(String(1000 - 100))
      );
    expect(await instance_gidr.balanceOf(accounts[4].address)).to.equal(fee);
    expect(await instance_gidr.balanceOf(accounts[5].address)).to.equal(
      await parseEther(String(1000 - 100))
    );
  });

  it("5. Burn with Fee", async () => {
    const amountMint = await parseEther("10100");
    await expect(instance_gidr.mint(accounts[3].address, amountMint))
      .to.emit(instance_gidr, "Transfer")
      .withArgs(addressNull, accounts[3].address, amountMint);
    expect(await instance_gidr.balanceOf(accounts[3].address)).to.equal(
      amountMint
    );
    const amountBurn = await parseEther("10000");
    const amountTransfer = await parseEther("100");
    await expect(instance_gidr.connect(accounts[3]).burnWithFee(amountBurn, accounts[6].address, amountTransfer))
      .to.emit(instance_gidr, "Transfer")
      .withArgs(accounts[3].address, accounts[6].address, amountTransfer);
    expect(await instance_gidr.balanceOf(accounts[3].address)).to.equal(0);
    expect(await instance_gidr.balanceOf(accounts[6].address)).to.equal(amountTransfer);
  });

  it("6. Decimals", async () => {
    expect(await instance_gidr.decimals()).to.equal(18);
  });

  it("7. Upgrade Contract", async () => {
    expect(Number(await instance_gidr.versionCode())).to.equal(0);
    const instance_gidr2 = await upgrades.upgradeProxy(
      instance_gidr.address,
      await ethers.getContractFactory("GIDR")
    );
    expect(Number(await instance_gidr2.versionCode())).to.equal(1);
  });
});

describe("GIDR Negative Testing", () => {
    let instance_gidr: any;
    let accounts: any;
    const parseEther: any = ethers.utils.parseEther;
    const addressNull: string = "0x0000000000000000000000000000000000000000";
  
    before(async function () {
      accounts = await ethers.getSigners();
      instance_gidr = await upgrades.deployProxy(
        await ethers.getContractFactory("GIDR"),
        [],
        { kind: "uups" }
      );
      await instance_gidr.deployed();
  
      expect(await instance_gidr.name()).to.equal("Gold Indonesia Republic");
      expect(await instance_gidr.symbol()).to.equal("GIDR");
    });

    it("1. Transfer Fee > Transfer Amount", async () => {
      const amountTransfer = await parseEther("50");
      const excessiveFee = await parseEther("51");
      await instance_gidr.setFee(accounts[1].address, excessiveFee);
      await expect(instance_gidr.transfer(accounts[1].address, amountTransfer))
        .to.be.revertedWith("ERC20: transfer amount is less than fee")
    });

    it("2. Fee + Transfer Amount > Balance", async () => {
        const amountTransfer = await parseEther("50000000000000000");
        const excessiveFee = await parseEther("51");
        await instance_gidr.setFee(accounts[1].address, excessiveFee);
        await expect(instance_gidr.transfer(accounts[1].address, amountTransfer))
          .to.be.revertedWith("ERC20: total amount exceeds balance")
      });

})