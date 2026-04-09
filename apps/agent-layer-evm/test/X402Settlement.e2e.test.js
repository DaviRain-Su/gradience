const { expect } = require('chai');
require('@nomicfoundation/hardhat-chai-matchers');
const { ethers, network } = require('hardhat');

describe('X402Settlement E2E', function () {
    beforeEach(async function () {
        await network.provider.send('hardhat_reset');
    });

    async function deployFixture() {
        const [deployer, payer, recipient, other] = await ethers.getSigners();

        const Token = await ethers.getContractFactory('TestPermitERC20', deployer);
        const token = await Token.deploy();
        await token.waitForDeployment();

        const Settlement = await ethers.getContractFactory('X402Settlement', deployer);
        const settlement = await Settlement.deploy();
        await settlement.waitForDeployment();

        const mintAmount = ethers.parseEther('10000');
        await token.mint(payer.address, mintAmount);

        return { token, settlement, deployer, payer, recipient, other };
    }

    function createChannelId() {
        return ethers.keccak256(ethers.toUtf8Bytes(`x402_evm_${Date.now()}_${Math.random()}`));
    }

    async function buildPermitSignature(token, owner, spender, value, deadline, nonce) {
        const name = await token.name();
        const version = '1';
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const verifyingContract = await token.getAddress();

        const domain = {
            name,
            version,
            chainId,
            verifyingContract,
        };

        const types = {
            Permit: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
            ],
        };

        const ownerAddress = typeof owner === 'string' ? owner : owner.address;
        const spenderAddress = typeof spender === 'string' ? spender : spender.address;
        const message = {
            owner: ownerAddress,
            spender: spenderAddress,
            value,
            nonce,
            deadline,
        };

        const signature = await owner.signTypedData(domain, types, message);
        return ethers.Signature.from(signature);
    }

    it('E2E1: full permit -> lock -> service -> settle flow', async function () {
        const { token, settlement, payer, recipient } = await deployFixture();
        const channelId = createChannelId();
        const maxAmount = ethers.parseEther('1000');
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const nonce = await token.nonces(payer.address);

        const sig = await buildPermitSignature(token, payer, await settlement.getAddress(), maxAmount, deadline, nonce);

        await expect(
            settlement
                .connect(recipient)
                .lockWithPermit(
                    channelId,
                    payer.address,
                    recipient.address,
                    await token.getAddress(),
                    maxAmount,
                    deadline,
                    ethers.zeroPadValue(ethers.toBeHex(nonce), 32),
                    sig.v,
                    sig.r,
                    sig.s,
                ),
        )
            .to.emit(settlement, 'Locked')
            .withArgs(channelId, payer.address, recipient.address, await token.getAddress(), maxAmount);

        expect(await token.balanceOf(await settlement.getAddress())).to.equal(maxAmount);

        const actualAmount = ethers.parseEther('800');
        const refund = maxAmount - actualAmount;

        await expect(settlement.connect(recipient).settle(channelId, actualAmount))
            .to.emit(settlement, 'Settled')
            .withArgs(channelId, actualAmount, refund);

        expect(await token.balanceOf(recipient.address)).to.equal(actualAmount);
        expect(await token.balanceOf(payer.address)).to.equal(ethers.parseEther('9200'));
    });

    it('E2E2: permit -> lock -> service failure -> rollback by recipient', async function () {
        const { token, settlement, payer, recipient } = await deployFixture();
        const channelId = createChannelId();
        const maxAmount = ethers.parseEther('500');
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const nonce = await token.nonces(payer.address);

        const sig = await buildPermitSignature(token, payer, await settlement.getAddress(), maxAmount, deadline, nonce);

        await settlement
            .connect(recipient)
            .lockWithPermit(
                channelId,
                payer.address,
                recipient.address,
                await token.getAddress(),
                maxAmount,
                deadline,
                ethers.zeroPadValue(ethers.toBeHex(nonce), 32),
                sig.v,
                sig.r,
                sig.s,
            );

        await expect(settlement.connect(recipient).rollback(channelId))
            .to.emit(settlement, 'RolledBack')
            .withArgs(channelId);

        expect(await token.balanceOf(payer.address)).to.equal(ethers.parseEther('10000'));
    });

    it('E2E3: payer rolls back after deadline if recipient ignores settlement', async function () {
        const { token, settlement, payer, recipient } = await deployFixture();
        const channelId = createChannelId();
        const maxAmount = ethers.parseEther('500');
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const nonce = await token.nonces(payer.address);

        const sig = await buildPermitSignature(token, payer, await settlement.getAddress(), maxAmount, deadline, nonce);

        await settlement
            .connect(recipient)
            .lockWithPermit(
                channelId,
                payer.address,
                recipient.address,
                await token.getAddress(),
                maxAmount,
                deadline,
                ethers.zeroPadValue(ethers.toBeHex(nonce), 32),
                sig.v,
                sig.r,
                sig.s,
            );

        // Cannot rollback before deadline as payer
        await expect(settlement.connect(payer).rollback(channelId)).to.be.revertedWithCustomError(
            settlement,
            'DeadlineNotReached',
        );

        // Warp past deadline
        await ethers.provider.send('evm_increaseTime', [7200]);
        await ethers.provider.send('evm_mine');

        await expect(settlement.connect(payer).rollback(channelId))
            .to.emit(settlement, 'RolledBack')
            .withArgs(channelId);

        expect(await token.balanceOf(payer.address)).to.equal(ethers.parseEther('10000'));
    });
});
