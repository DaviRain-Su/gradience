const { expect } = require('chai');
require('@nomicfoundation/hardhat-chai-matchers');
const { ethers } = require('hardhat');

describe('SocialGraph', function () {
    async function deployFixture() {
        const [deployer, userA, userB, userC] = await ethers.getSigners();
        const factory = await ethers.getContractFactory('SocialGraph', deployer);
        const impl = await factory.deploy();
        await impl.waitForDeployment();
        const proxyFactory = await ethers.getContractFactory('ERC1967Proxy', deployer);
        const initData = factory.interface.encodeFunctionData('initialize', [deployer.address]);
        const proxy = await proxyFactory.deploy(await impl.getAddress(), initData);
        await proxy.waitForDeployment();
        const graph = factory.attach(await proxy.getAddress());
        return { graph, userA, userB, userC };
    }

    it('should allow follow and emit event', async function () {
        const { graph, userA, userB } = await deployFixture();
        await expect(graph.connect(userA).follow(userB.address))
            .to.emit(graph, 'Followed')
            .withArgs(userA.address, userB.address);
        expect(await graph.isFollowing(userA.address, userB.address)).to.equal(true);
        expect(await graph.getFollowings(userA.address)).to.deep.equal([userB.address]);
        expect(await graph.getFollowers(userB.address)).to.deep.equal([userA.address]);
    });

    it('should allow unfollow and emit event', async function () {
        const { graph, userA, userB } = await deployFixture();
        await graph.connect(userA).follow(userB.address);
        await expect(graph.connect(userA).unfollow(userB.address))
            .to.emit(graph, 'Unfollowed')
            .withArgs(userA.address, userB.address);
        expect(await graph.isFollowing(userA.address, userB.address)).to.equal(false);
        expect(await graph.getFollowings(userA.address)).to.deep.equal([]);
        expect(await graph.getFollowers(userB.address)).to.deep.equal([]);
    });

    it('should revert self-follow', async function () {
        const { graph, userA } = await deployFixture();
        await expect(graph.connect(userA).follow(userA.address)).to.be.revertedWithCustomError(graph, 'SelfFollow');
    });

    it('should revert double follow', async function () {
        const { graph, userA, userB } = await deployFixture();
        await graph.connect(userA).follow(userB.address);
        await expect(graph.connect(userA).follow(userB.address)).to.be.revertedWithCustomError(
            graph,
            'AlreadyFollowing',
        );
    });

    it('should revert unfollow when not following', async function () {
        const { graph, userA, userB } = await deployFixture();
        await expect(graph.connect(userA).unfollow(userB.address)).to.be.revertedWithCustomError(graph, 'NotFollowing');
    });

    it('should handle multiple followers and followings', async function () {
        const { graph, userA, userB, userC } = await deployFixture();
        await graph.connect(userA).follow(userB.address);
        await graph.connect(userC).follow(userB.address);
        await graph.connect(userA).follow(userC.address);

        expect(await graph.getFollowers(userB.address)).to.deep.equal([userA.address, userC.address]);
        expect(await graph.getFollowings(userA.address)).to.deep.equal([userB.address, userC.address]);
    });
});
