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

    async function deployErc20Fixture() {
        const fixture = await deployFixture();
        const tokenFactory = await ethers.getContractFactory("TestERC20", fixture.deployer);
        const token = await tokenFactory.deploy();
        await token.waitForDeployment();

        const mintAmount = ethers.parseEther("10");
        await token.mint(fixture.poster.address, mintAmount);
        await token.mint(fixture.agentA.address, mintAmount);
        await token.mint(fixture.agentB.address, mintAmount);

        return { ...fixture, token };
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

        const winnerBalanceAfterJudge = await ethers.provider.getBalance(agentA.address);
        const loserBalanceAfterJudge = await ethers.provider.getBalance(agentB.address);
        const treasuryAfter = await ethers.provider.getBalance(treasury.address);

        expect(winnerBalanceAfterJudge - winnerBalanceBefore).to.equal(
            (reward * 9500n) / 10000n,
        );
        expect(loserBalanceAfterJudge - loserBalanceBefore).to.equal(0n);
        expect(treasuryAfter - treasuryBefore).to.equal((reward * 200n) / 10000n);

        await expect(() => contract.connect(agentA).claim_stake(1n)).to.changeEtherBalance(agentA, minStake);
        await expect(() => contract.connect(agentB).claim_stake(1n)).to.changeEtherBalance(agentB, minStake);

        const task = await contract.tasks(1n);
        expect(task[7]).to.equal(1n);
        expect(task[9]).to.equal(agentA.address);
        expect(task[10]).to.equal(80n);
    });

    it("supports ERC20 reward and stake lifecycle", async function () {
        const { contract, poster, judge, agentA, agentB, attacker, treasury, token } =
            await deployErc20Fixture();
        const reward = ethers.parseEther("1");
        const minStake = ethers.parseEther("0.1");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await token.connect(poster).approve(await contract.getAddress(), reward);
        await contract
            .connect(poster)
            .post_task_erc20(
                "cid://eval-erc20",
                deadline,
                judgeDeadline,
                judge.address,
                2,
                minStake,
                await token.getAddress(),
                reward,
            );

        await token.connect(agentA).approve(await contract.getAddress(), minStake);
        await token.connect(agentB).approve(await contract.getAddress(), minStake);
        await contract.connect(agentA).apply_for_task(1n);
        await contract.connect(agentB).apply_for_task(1n);
        await expect(contract.connect(attacker).apply_for_task(1n, { value: 1n }))
            .to.be.revertedWithCustomError(contract, "UnexpectedEther")
            .withArgs(1n);

        await contract.connect(agentA).submit_result(1n, "cid://result-a", "cid://trace-a");
        await contract.connect(agentB).submit_result(1n, "cid://result-b", "cid://trace-b");

        const winnerBefore = await token.balanceOf(agentA.address);
        const loserBefore = await token.balanceOf(agentB.address);
        const judgeBefore = await token.balanceOf(judge.address);
        const treasuryBefore = await token.balanceOf(treasury.address);

        await contract.connect(judge).judge_and_pay(1n, agentA.address, 80);

        const winnerAfterJudge = await token.balanceOf(agentA.address);
        const loserAfterJudge = await token.balanceOf(agentB.address);
        const judgeAfter = await token.balanceOf(judge.address);
        const treasuryAfter = await token.balanceOf(treasury.address);

        expect(winnerAfterJudge - winnerBefore).to.equal((reward * 9500n) / 10000n);
        expect(loserAfterJudge - loserBefore).to.equal(0n);
        expect(judgeAfter - judgeBefore).to.equal((reward * 300n) / 10000n);
        expect(treasuryAfter - treasuryBefore).to.equal((reward * 200n) / 10000n);

        const winnerAfterStake = await token.balanceOf(agentA.address);
        const loserAfterStake = await token.balanceOf(agentB.address);
        await contract.connect(agentA).claim_stake(1n);
        await contract.connect(agentB).claim_stake(1n);
        const winnerFinal = await token.balanceOf(agentA.address);
        const loserFinal = await token.balanceOf(agentB.address);
        expect(winnerFinal - winnerAfterStake).to.equal(minStake);
        expect(loserFinal - loserAfterStake).to.equal(minStake);

        const task = await contract.tasks(1n);
        expect(task[11]).to.equal(await token.getAddress());
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
        const agentAfterJudge = await ethers.provider.getBalance(agentA.address);

        expect(posterAfter - posterBefore).to.equal(reward);
        expect(agentAfterJudge - agentBefore).to.equal(0n);
        await expect(() => contract.connect(agentA).claim_stake(1n)).to.changeEtherBalance(agentA, minStake);

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

    it("submit_result rejects overwrite and judge cannot apply", async function () {
        const { contract, poster, judge, agentA } = await deployFixture();
        const reward = ethers.parseEther("0.2");
        const minStake = ethers.parseEther("0.01");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await contract
            .connect(poster)
            .post_task("cid://eval", deadline, judgeDeadline, judge.address, 1, minStake, {
                value: reward,
            });
        await expect(contract.connect(judge).apply_for_task(1n, { value: minStake }))
            .to.be.revertedWithCustomError(contract, "JudgeCannotApply")
            .withArgs(1n, judge.address);

        await contract.connect(agentA).apply_for_task(1n, { value: minStake });
        await contract.connect(agentA).submit_result(1n, "cid://result-a", "cid://trace-a");
        await expect(
            contract.connect(agentA).submit_result(1n, "cid://result-b", "cid://trace-b"),
        )
            .to.be.revertedWithCustomError(contract, "AlreadySubmitted")
            .withArgs(1n, agentA.address);
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
        const agentAfterJudge = await ethers.provider.getBalance(agentA.address);
        expect(posterAfter - posterBefore).to.equal(reward);
        expect(agentAfterJudge - agentBefore).to.equal(0n);
        await expect(() => contract.connect(agentA).claim_stake(1n)).to.changeEtherBalance(agentA, minStake);

        const task = await contract.tasks(1n);
        expect(task[7]).to.equal(2n);
    });

    it("force_refund compensates submitted agents when judge times out", async function () {
        const { contract, poster, judge, agentA, agentB, attacker, treasury } = await deployFixture();
        const reward = ethers.parseEther("1");
        const minStake = ethers.parseEther("0.01");
        const now = await currentTime();
        const deadline = now + 60n;
        const judgeDeadline = deadline + 60n;

        await contract
            .connect(poster)
            .post_task("cid://eval-force-refund", deadline, judgeDeadline, judge.address, 1, minStake, {
                value: reward,
            });
        await contract.connect(agentA).apply_for_task(1n, { value: minStake });
        await contract.connect(agentB).apply_for_task(1n, { value: minStake });
        await contract.connect(agentA).submit_result(1n, "cid://result-a", "cid://trace-a");
        await contract.connect(agentB).submit_result(1n, "cid://result-b", "cid://trace-b");

        await expect(contract.connect(attacker).force_refund(1n))
            .to.be.revertedWithCustomError(contract, "JudgeDeadlineNotReached")
            .withArgs(1n);

        await warpTo(judgeDeadline + 1n);

        const posterBefore = await ethers.provider.getBalance(poster.address);
        const treasuryBefore = await ethers.provider.getBalance(treasury.address);
        const agentABefore = await ethers.provider.getBalance(agentA.address);
        const agentBBefore = await ethers.provider.getBalance(agentB.address);

        await expect(contract.connect(attacker).force_refund(1n))
            .to.emit(contract, "TaskRefunded")
            .withArgs(1n, poster.address, (reward * 9500n) / 10000n, 0n);

        const posterAfter = await ethers.provider.getBalance(poster.address);
        const treasuryAfter = await ethers.provider.getBalance(treasury.address);
        const agentAAfter = await ethers.provider.getBalance(agentA.address);
        const agentBAfter = await ethers.provider.getBalance(agentB.address);

        expect(posterAfter - posterBefore).to.equal((reward * 9500n) / 10000n);
        expect(treasuryAfter - treasuryBefore).to.equal((reward * 200n) / 10000n);
        expect(agentAAfter - agentABefore).to.equal((reward * 300n) / 10000n / 2n);
        expect(agentBAfter - agentBBefore).to.equal((reward * 300n) / 10000n / 2n);
        await expect(() => contract.connect(agentA).claim_stake(1n)).to.changeEtherBalance(agentA, minStake);
        await expect(() => contract.connect(agentB).claim_stake(1n)).to.changeEtherBalance(agentB, minStake);

        const task = await contract.tasks(1n);
        expect(task[7]).to.equal(2n);
    });

    it("force_refund rejects tasks without any submitted agent", async function () {
        const { contract, poster, judge, agentA, attacker } = await deployFixture();
        const reward = ethers.parseEther("0.2");
        const minStake = ethers.parseEther("0.01");
        const now = await currentTime();
        const deadline = now + 60n;
        const judgeDeadline = deadline + 60n;

        await contract
            .connect(poster)
            .post_task("cid://eval-force-refund-empty", deadline, judgeDeadline, judge.address, 1, minStake, {
                value: reward,
            });
        await contract.connect(agentA).apply_for_task(1n, { value: minStake });
        await warpTo(judgeDeadline + 1n);

        await expect(contract.connect(attacker).force_refund(1n))
            .to.be.revertedWithCustomError(contract, "NoSubmittedAgents")
            .withArgs(1n);
    });

    it("cancel_task allows poster cancellation with 2% protocol fee", async function () {
        const { contract, poster, judge, agentA, attacker, treasury } = await deployFixture();
        const reward = ethers.parseEther("0.5");
        const minStake = ethers.parseEther("0.02");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await contract
            .connect(poster)
            .post_task("cid://eval-cancel", deadline, judgeDeadline, judge.address, 1, minStake, {
                value: reward,
            });
        await contract.connect(agentA).apply_for_task(1n, { value: minStake });

        await expect(contract.connect(attacker).cancel_task(1n))
            .to.be.revertedWithCustomError(contract, "NotTaskPoster")
            .withArgs(1n, attacker.address, poster.address);

        const posterBefore = await ethers.provider.getBalance(poster.address);
        const treasuryBefore = await ethers.provider.getBalance(treasury.address);

        const cancelTx = await contract.connect(poster).cancel_task(1n);
        await expect(cancelTx)
            .to.emit(contract, "TaskRefunded")
            .withArgs(1n, poster.address, (reward * 9800n) / 10000n, 0n);
        const cancelReceipt = await cancelTx.wait();
        const gasPrice = cancelReceipt.gasPrice ?? cancelReceipt.effectiveGasPrice ?? 0n;
        const gasCost = cancelReceipt.gasUsed * gasPrice;

        const posterAfter = await ethers.provider.getBalance(poster.address);
        const treasuryAfter = await ethers.provider.getBalance(treasury.address);

        expect(posterAfter - posterBefore + gasCost).to.equal((reward * 9800n) / 10000n);
        expect(treasuryAfter - treasuryBefore).to.equal((reward * 200n) / 10000n);
        await expect(() => contract.connect(agentA).claim_stake(1n)).to.changeEtherBalance(agentA, minStake);

        const task = await contract.tasks(1n);
        expect(task[7]).to.equal(2n);
    });

    it("get_reputation derives avg score from totalScore without cumulative drift", async function () {
        const { contract, poster, judge, agentA } = await deployFixture();
        const reward = ethers.parseEther("0.1");
        const scores = [60, 61, 62];

        for (const score of scores) {
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;
            await contract
                .connect(poster)
                .post_task("cid://eval", deadline, judgeDeadline, judge.address, 1, 0n, {
                    value: reward,
                });
            const taskId = await contract.taskCount();
            await contract.connect(agentA).apply_for_task(taskId, { value: 0n });
            await contract.connect(agentA).submit_result(taskId, "cid://result", "cid://trace");
            await contract.connect(judge).judge_and_pay(taskId, agentA.address, score);
        }

        const reputation = await contract.get_reputation(agentA.address);
        expect(reputation[1]).to.equal(3n);
        expect(reputation[3]).to.equal(183n);
        expect(reputation[4]).to.equal(61n);
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
