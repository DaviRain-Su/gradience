const { expect } = require('chai');
require('@nomicfoundation/hardhat-chai-matchers');
const { ethers } = require('hardhat');

describe('JudgeRegistry', function () {
    async function deployFixture() {
        const [deployer, judgeA, judgeB, judgeC, attacker] = await ethers.getSigners();
        const factory = await ethers.getContractFactory('JudgeRegistry', deployer);
        const registry = await factory.deploy(deployer.address);
        await registry.waitForDeployment();
        return { registry, deployer, judgeA, judgeB, judgeC, attacker };
    }

    it('register and unregister per category', async function () {
        const { registry, judgeA } = await deployFixture();
        await expect(registry.connect(judgeA).register(2))
            .to.emit(registry, 'JudgeRegistered')
            .withArgs(judgeA.address, 2);

        expect(await registry.isEligibleForCategory(judgeA.address, 2)).to.equal(true);
        expect(await registry.isEligibleForCategory(judgeA.address, 3)).to.equal(false);

        await expect(registry.connect(judgeA).unregister(2))
            .to.emit(registry, 'JudgeUnregistered')
            .withArgs(judgeA.address, 2);

        expect(await registry.isEligibleForCategory(judgeA.address, 2)).to.equal(false);
    });

    it('selectJudgePool returns distinct judges without replacement', async function () {
        const { registry, judgeA, judgeB, judgeC } = await deployFixture();
        await registry.connect(judgeA).register(1);
        await registry.connect(judgeB).register(1);
        await registry.connect(judgeC).register(1);

        const randomness = ethers.toBigInt(ethers.randomBytes(32));
        const pool = await registry.selectJudgePool(1, randomness, { poolSize: 2, quorum: 1, category: 1 });
        expect(pool.length).to.equal(2n);
        expect(pool[0]).to.not.equal(pool[1]);
    });

    it('rejects pool selection if insufficient judges', async function () {
        const { registry, judgeA } = await deployFixture();
        await registry.connect(judgeA).register(1);
        const randomness = ethers.toBigInt(ethers.randomBytes(32));
        await expect(
            registry.selectJudgePool(1, randomness, { poolSize: 2, quorum: 1, category: 1 }),
        ).to.be.revertedWithCustomError(registry, 'InsufficientPool');
    });

    it('owner or arena can slash', async function () {
        const { registry, judgeA, attacker } = await deployFixture();
        await expect(registry.connect(attacker).slash(judgeA.address, 100n, 'test')).to.be.revertedWithCustomError(
            registry,
            'OwnableUnauthorizedAccount',
        );

        await expect(registry.slash(judgeA.address, 100n, 'test'))
            .to.emit(registry, 'JudgeSlashed')
            .withArgs(judgeA.address, 100n, 'test');
    });

    it('arena can slash after setArena', async function () {
        const { registry, judgeA, attacker } = await deployFixture();
        await registry.setArena(attacker.address);

        await expect(registry.connect(attacker).slash(judgeA.address, 100n, 'test'))
            .to.emit(registry, 'JudgeSlashed')
            .withArgs(judgeA.address, 100n, 'test');
    });
});
