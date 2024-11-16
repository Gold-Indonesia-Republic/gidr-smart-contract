import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("GIDR", function () {
    let instance_gidr: any;
    let accounts: any;
    const parseEther: any = ethers.utils.parseEther;
    const addressNull: string = '0x0000000000000000000000000000000000000000';

    before(async function() {
        accounts = await ethers.getSigners();
        instance_gidr = await upgrades.deployProxy((await ethers.getContractFactory("GIDR")), [], { kind: 'uups' });
        await instance_gidr.deployed();

        expect(await instance_gidr.name()).to.equal("Gold Indonesia Republic");
        expect(await instance_gidr.symbol()).to.equal("GIDR");
    });

    it("1. Minting", async () => {
        const amountMint = await parseEther("1000000");
        await expect(instance_gidr.mint(accounts[0].address, amountMint))
        .to.emit(instance_gidr, 'Transfer')
        .withArgs(addressNull, accounts[0].address, amountMint);
        expect(await instance_gidr.balanceOf(accounts[0].address)).to.equal(amountMint);
    });

    it("2. Transfer", async () => {
        const amountTransfer = await parseEther("1000");
        await expect(instance_gidr.transfer(accounts[2].address, amountTransfer))
        .to.emit(instance_gidr, 'Transfer')
        .withArgs(accounts[0].address, accounts[2].address, amountTransfer);
        expect(await instance_gidr.balanceOf(accounts[2].address)).to.equal(amountTransfer);

        await instance_gidr.increaseAllowance(accounts[1].address, amountTransfer);
        await expect(instance_gidr.connect(accounts[1]).transferFrom(accounts[0].address, accounts[3].address, amountTransfer))
        .to.emit(instance_gidr, 'Transfer')
        .withArgs(accounts[0].address, accounts[3].address, amountTransfer);
        expect(await instance_gidr.balanceOf(accounts[3].address)).to.equal(amountTransfer);
    });

    it("3. Burn", async () => {
        const amountBurn = await parseEther("1000");
        await expect(instance_gidr.connect(accounts[3]).burn(amountBurn))
        .to.emit(instance_gidr, 'Transfer')
        .withArgs(accounts[3].address, addressNull, amountBurn);
        expect(await instance_gidr.balanceOf(accounts[3].address)).to.equal(0);
    });

    it("4. Decimals", async () => {
        expect(await instance_gidr.decimals()).to.equal(4);
    });

    it("5. Transfer Fee", async () => {
        const amountTransfer = await parseEther("1000");
        const fee = await parseEther("100");
        // Transfer Fee
        await expect(instance_gidr.setFee(accounts[4].address, fee))
        .to.emit(instance_gidr, 'SetFee')
        .withArgs(accounts[4].address, fee);
        await expect(instance_gidr.transfer(accounts[5].address, amountTransfer))
        .to.emit(instance_gidr, 'Fee')
        .withArgs(accounts[0].address, accounts[4].address, fee)
        .to.emit(instance_gidr, 'Transfer')
        .withArgs(accounts[0].address, accounts[5].address, await parseEther(String(1000 - 100)));
        expect(await instance_gidr.balanceOf(accounts[4].address)).to.equal(fee);
        expect(await instance_gidr.balanceOf(accounts[5].address)).to.equal(await parseEther(String(1000 - 100)));
    });

    it('6. Upgrade Contract', async () => {
        expect(Number(await instance_gidr.versionCode())).to.equal(0);
        const instance_gidr2 = await upgrades.upgradeProxy(instance_gidr.address, (await ethers.getContractFactory("GIDR")));
        expect(Number(await instance_gidr2.versionCode())).to.equal(1);
    });
});
