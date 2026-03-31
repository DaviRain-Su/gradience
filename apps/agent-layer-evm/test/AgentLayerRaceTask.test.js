const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentLayerRaceTask", function () {
    async function deployFixture() {
        const [deployer, poster, judge, agentA, agentB, treasury, attacker] =
            await ethers.getSigners();
        const factory = await ethers.getContractFactory("AgentLayerRaceTask", deployer);
        const contract = await factory.deploy(treasury.address);
        await contract.waitForDeployment();
        return { contract, deployer, poster, judge, agentA, agentB, treasury, attacker };
    }

    it("post_task creates an open task with reward locked", async function () {
        const { contract, poster, judge } = await deployFixture();
        const reward = ethers.parseEther("1");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await expect(
            contract
                .connect(poster)
                .post_task("cid://eval", deadline, judgeDeadline, judge.address, 1, 0n, {
                    value: reward,
                }),
        ).to.emit(contract, "TaskCreated");

        const task = await contract.tasks(1n);
        expect(task[0]).to.equal(poster.address);
        expect(task[1]).to.equal(judge.address);
        expect(task[6]).to.equal(reward);
        expect(task[7]).to.equal(0n);
    });

    it("apply_for_task + submit_result + judge_and_pay completes payout path", async function () {
        const { contract, poster, judge, agentA, agentB, treasury } = await deployFixture();
        const reward = ethers.parseEther("1");
        const minStake = ethers.parseEther("0.1");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await contract
            .connect(poster)
            .post_task("cid://eval", deadline, judgeDeadline, judge.address, 2, minStake, {
                value: reward,
            });
        await contract.connect(agentA).apply_for_task(1n, { value: minStake });
        await contract.connect(agentB).apply_for_task(1n, { value: minStake });
        await contract.connect(agentA).submit_result(1n, "cid://result-a", "cid://trace-a");
        await contract.connect(agentB).submit_result(1n, "cid://result-b", "cid://trace-b");

        const winnerBalanceBefore = await ethers.provider.getBalance(agentA.address);
        const loserBalanceBefore = await ethers.provider.getBalance(agentB.address);
        const treasuryBefore = await ethers.provider.getBalance(treasury.address);

        await expect(contract.connect(judge).judge_and_pay(1n, agentA.address, 80))
            .to.emit(contract, "TaskJudged")
            .withArgs(
                1n,
                agentA.address,
                80n,
                (reward * 9500n) / 10000n,
                (reward * 300n) / 10000n,
                (reward * 200n) / 10000n,
            );

        const winnerBalanceAfter = await ethers.provider.getBalance(agentA.address);
        const loserBalanceAfter = await ethers.provider.getBalance(agentB.address);
        const treasuryAfter = await ethers.provider.getBalance(treasury.address);

        expect(winnerBalanceAfter - winnerBalanceBefore).to.equal(
            (reward * 9500n) / 10000n + minStake,
        );
        expect(loserBalanceAfter - loserBalanceBefore).to.equal(minStake);
        expect(treasuryAfter - treasuryBefore).to.equal((reward * 200n) / 10000n);

        const task = await contract.tasks(1n);
        expect(task[7]).to.equal(1n);
        expect(task[9]).to.equal(agentA.address);
        expect(task[10]).to.equal(80n);
    });

    it("judge_and_pay with score < MIN_SCORE refunds poster", async function () {
        const { contract, poster, judge, agentA } = await deployFixture();
        const reward = ethers.parseEther("0.5");
        const minStake = ethers.parseEther("0.05");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await contract
            .connect(poster)
            .post_task("cid://eval-low", deadline, judgeDeadline, judge.address, 0, minStake, {
                value: reward,
            });
        await contract.connect(agentA).apply_for_task(1n, { value: minStake });
        await contract.connect(agentA).submit_result(1n, "cid://result", "cid://trace");

        const posterBefore = await ethers.provider.getBalance(poster.address);
        const agentBefore = await ethers.provider.getBalance(agentA.address);

        await expect(contract.connect(judge).judge_and_pay(1n, agentA.address, 59))
            .to.emit(contract, "TaskRefunded")
            .withArgs(1n, poster.address, reward, 59n);

        const posterAfter = await ethers.provider.getBalance(poster.address);
        const agentAfter = await ethers.provider.getBalance(agentA.address);

        expect(posterAfter - posterBefore).to.equal(reward);
        expect(agentAfter - agentBefore).to.equal(minStake);

        const task = await contract.tasks(1n);
        expect(task[7]).to.equal(2n);
    });

    it("judge_and_pay rejects non-judge signer", async function () {
        const { contract, poster, judge, agentA, attacker } = await deployFixture();
        const reward = ethers.parseEther("0.2");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await contract
            .connect(poster)
            .post_task("cid://eval", deadline, judgeDeadline, judge.address, 1, 0n, {
                value: reward,
            });
        await contract.connect(agentA).apply_for_task(1n, { value: 0n });
        await contract.connect(agentA).submit_result(1n, "cid://result", "cid://trace");

        await expect(contract.connect(attacker).judge_and_pay(1n, agentA.address, 80))
            .to.be.revertedWithCustomError(contract, "NotTaskJudge")
            .withArgs(1n, attacker.address, judge.address);
    });

    it("claim_expired refunds poster and stakes after judge deadline", async function () {
        const { contract, poster, judge, agentA, attacker } = await deployFixture();
        const reward = ethers.parseEther("0.4");
        const minStake = ethers.parseEther("0.03");
        const now = await currentTime();
        const deadline = now + 60n;
        const judgeDeadline = deadline + 60n;

        await contract
            .connect(poster)
            .post_task("cid://eval-expired", deadline, judgeDeadline, judge.address, 1, minStake, {
                value: reward,
            });
        await contract.connect(agentA).apply_for_task(1n, { value: minStake });
        await contract.connect(agentA).submit_result(1n, "cid://result-expired", "cid://trace-expired");

        await expect(contract.connect(attacker).claim_expired(1n))
            .to.be.revertedWithCustomError(contract, "JudgeDeadlineNotReached")
            .withArgs(1n);

        await warpTo(judgeDeadline + 1n);

        const posterBefore = await ethers.provider.getBalance(poster.address);
        const agentBefore = await ethers.provider.getBalance(agentA.address);
        await expect(contract.connect(attacker).claim_expired(1n))
            .to.emit(contract, "TaskRefunded")
            .withArgs(1n, poster.address, reward, 0n);

        const posterAfter = await ethers.provider.getBalance(poster.address);
        const agentAfter = await ethers.provider.getBalance(agentA.address);
        expect(posterAfter - posterBefore).to.equal(reward);
        expect(agentAfter - agentBefore).to.equal(minStake);

        const task = await contract.tasks(1n);
        expect(task[7]).to.equal(2n);
    });

    async function currentTime() {
        const latestBlock = await ethers.provider.getBlock("latest");
        return BigInt(latestBlock.timestamp);
    }

    async function warpTo(timestamp) {
        await ethers.provider.send("evm_setNextBlockTimestamp", [Number(timestamp)]);
        await ethers.provider.send("evm_mine", []);
    }
});
