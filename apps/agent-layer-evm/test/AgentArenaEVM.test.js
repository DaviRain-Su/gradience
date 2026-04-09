const { expect } = require("chai");
require("@nomicfoundation/hardhat-chai-matchers");
const { ethers } = require("hardhat");

describe("AgentArenaEVM", function () {
    async function deployFixture() {
        const [deployer, poster, judge, agentA, agentB, treasury, attacker] =
            await ethers.getSigners();
        const factory = await ethers.getContractFactory("AgentArenaEVM", deployer);
        const impl = await factory.deploy();
        await impl.waitForDeployment();
        const proxyFactory = await ethers.getContractFactory("ERC1967Proxy", deployer);
        const initData = factory.interface.encodeFunctionData("initialize", [deployer.address, treasury.address]);
        const proxy = await proxyFactory.deploy(await impl.getAddress(), initData);
        await proxy.waitForDeployment();
        const contract = factory.attach(await proxy.getAddress());
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
                .postTask("cid://eval", deadline, judgeDeadline, judge.address, 1, 0n, false, {
                    value: reward,
                }),
        ).to.emit(contract, "TaskCreated");

        const task = await contract.tasks(1n);
        expect(task[0]).to.equal(poster.address);
        expect(task[1]).to.equal(judge.address);
        expect(task[5]).to.equal(reward);
        expect(task[10]).to.equal(0n);
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
            .postTask("cid://eval", deadline, judgeDeadline, judge.address, 2, minStake, false, {
                value: reward,
            });
        await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
        await contract.connect(agentB).applyForTask(1n, { value: minStake * 11n / 10n });
        await contract.connect(agentA).submitResult(1n, "cid://result-a", "cid://trace-a");
        await contract.connect(agentB).submitResult(1n, "cid://result-b", "cid://trace-b");

        const winnerBalanceBefore = await ethers.provider.getBalance(agentA.address);
        const loserBalanceBefore = await ethers.provider.getBalance(agentB.address);
        const treasuryBefore = await ethers.provider.getBalance(treasury.address);

        await expect(contract.connect(judge).judgeAndPay(1n, agentA.address, 80))
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

        expect(winnerBalanceAfterJudge - winnerBalanceBefore).to.equal(
            (reward * 9500n) / 10000n,
        );
        expect(loserBalanceAfterJudge - loserBalanceBefore).to.equal(0n);
        expect(await contract.protocolFees(ethers.ZeroAddress)).to.equal((reward * 200n) / 10000n);

        await expect(() => contract.connect(agentA).claimStake(1n)).to.changeEtherBalance(agentA, minStake * 11n / 10n);
        await expect(() => contract.connect(agentB).claimStake(1n)).to.changeEtherBalance(agentB, minStake * 11n / 10n);

        const task = await contract.tasks(1n);
        expect(task[10]).to.equal(1n);
        expect(task[2]).to.equal(agentA.address);
        expect(task[9]).to.equal(80n);
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
            .postTaskErc20(
                "cid://eval-erc20",
                deadline,
                judgeDeadline,
                judge.address,
                2,
                minStake,
                await token.getAddress(),
                reward,
                false
            );

        await token.connect(agentA).approve(await contract.getAddress(), minStake);
        await token.connect(agentB).approve(await contract.getAddress(), minStake);
        await contract.connect(agentA).applyForTask(1n);
        await contract.connect(agentB).applyForTask(1n);
        await expect(contract.connect(attacker).applyForTask(1n, { value: 1n }))
            .to.be.revertedWithCustomError(contract, "UnexpectedEther")
            .withArgs(1n);

        await contract.connect(agentA).submitResult(1n, "cid://result-a", "cid://trace-a");
        await contract.connect(agentB).submitResult(1n, "cid://result-b", "cid://trace-b");

        const winnerBefore = await token.balanceOf(agentA.address);
        const loserBefore = await token.balanceOf(agentB.address);
        const judgeBefore = await token.balanceOf(judge.address);
        const treasuryBefore = await token.balanceOf(treasury.address);

        await contract.connect(judge).judgeAndPay(1n, agentA.address, 80);

        const winnerAfterJudge = await token.balanceOf(agentA.address);
        const loserAfterJudge = await token.balanceOf(agentB.address);
        const judgeAfter = await token.balanceOf(judge.address);
        const treasuryAfter = await token.balanceOf(treasury.address);

        expect(winnerAfterJudge - winnerBefore).to.equal((reward * 9500n) / 10000n);
        expect(loserAfterJudge - loserBefore).to.equal(0n);
        expect(judgeAfter - judgeBefore).to.equal((reward * 300n) / 10000n);
        expect(await contract.protocolFees(await token.getAddress())).to.equal((reward * 200n) / 10000n);

        const winnerAfterStake = await token.balanceOf(agentA.address);
        const loserAfterStake = await token.balanceOf(agentB.address);
        await contract.connect(agentA).claimStake(1n);
        await contract.connect(agentB).claimStake(1n);
        const winnerFinal = await token.balanceOf(agentA.address);
        const loserFinal = await token.balanceOf(agentB.address);
        expect(winnerFinal - winnerAfterStake).to.equal(minStake);
        expect(loserFinal - loserAfterStake).to.equal(minStake);

        const task = await contract.tasks(1n);
        expect(task[3]).to.equal(await token.getAddress());
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
            .postTask("cid://eval-low", deadline, judgeDeadline, judge.address, 0, minStake, false, {
                value: reward,
            });
        await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
        await contract.connect(agentA).submitResult(1n, "cid://result", "cid://trace");

        const posterBefore = await ethers.provider.getBalance(poster.address);
        const agentBefore = await ethers.provider.getBalance(agentA.address);

        await expect(contract.connect(judge).judgeAndPay(1n, agentA.address, 59))
            .to.emit(contract, "TaskRefunded")
            .withArgs(1n, poster.address, reward, 59n);

        const posterAfter = await ethers.provider.getBalance(poster.address);
        const agentAfterJudge = await ethers.provider.getBalance(agentA.address);

        expect(posterAfter - posterBefore).to.equal(reward);
        expect(agentAfterJudge - agentBefore).to.equal(0n);
        await expect(() => contract.connect(agentA).claimStake(1n)).to.changeEtherBalance(agentA, minStake * 11n / 10n);

        const task = await contract.tasks(1n);
        expect(task[10]).to.equal(2n);
    });

    it("judge_and_pay rejects non-judge signer", async function () {
        const { contract, poster, judge, agentA, attacker } = await deployFixture();
        const reward = ethers.parseEther("0.2");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await contract
            .connect(poster)
            .postTask("cid://eval", deadline, judgeDeadline, judge.address, 1, 0n, false, {
                value: reward,
            });
        await contract.connect(agentA).applyForTask(1n, { value: 0n });
        await contract.connect(agentA).submitResult(1n, "cid://result", "cid://trace");

        await expect(contract.connect(attacker).judgeAndPay(1n, agentA.address, 80))
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
            .postTask("cid://eval", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                value: reward,
            });
        await expect(contract.connect(judge).applyForTask(1n, { value: minStake * 11n / 10n }))
            .to.be.revertedWithCustomError(contract, "JudgeCannotApply")
            .withArgs(1n, judge.address);

        await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
        await contract.connect(agentA).submitResult(1n, "cid://result-a", "cid://trace-a");
        await expect(
            contract.connect(agentA).submitResult(1n, "cid://result-b", "cid://trace-b"),
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
            .postTask("cid://eval-expired", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                value: reward,
            });
        await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
        await contract.connect(agentA).submitResult(1n, "cid://result-expired", "cid://trace-expired");

        await expect(contract.connect(attacker).claimExpired(1n))
            .to.be.revertedWithCustomError(contract, "JudgeDeadlineNotReached")
            .withArgs(1n);

        await warpTo(judgeDeadline + 1n);

        const posterBefore = await ethers.provider.getBalance(poster.address);
        const agentBefore = await ethers.provider.getBalance(agentA.address);
        await expect(contract.connect(attacker).claimExpired(1n))
            .to.emit(contract, "TaskRefunded")
            .withArgs(1n, poster.address, reward, 0n);

        const posterAfter = await ethers.provider.getBalance(poster.address);
        const agentAfterJudge = await ethers.provider.getBalance(agentA.address);
        expect(posterAfter - posterBefore).to.equal(reward);
        expect(agentAfterJudge - agentBefore).to.equal(0n);
        await expect(() => contract.connect(agentA).claimStake(1n)).to.changeEtherBalance(agentA, minStake * 11n / 10n);

        const task = await contract.tasks(1n);
        expect(task[10]).to.equal(2n);
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
            .postTask("cid://eval-force-refund", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                value: reward,
            });
        await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
        await contract.connect(agentB).applyForTask(1n, { value: minStake * 11n / 10n });
        await contract.connect(agentA).submitResult(1n, "cid://result-a", "cid://trace-a");
        await contract.connect(agentB).submitResult(1n, "cid://result-b", "cid://trace-b");

        await expect(contract.connect(attacker).forceRefund(1n))
            .to.be.revertedWithCustomError(contract, "JudgeDeadlineNotReached")
            .withArgs(1n);

        await warpTo(judgeDeadline + 1n);

        const posterBefore = await ethers.provider.getBalance(poster.address);
        const treasuryBefore = await ethers.provider.getBalance(treasury.address);
        const agentABefore = await ethers.provider.getBalance(agentA.address);
        const agentBBefore = await ethers.provider.getBalance(agentB.address);

        await expect(contract.connect(attacker).forceRefund(1n))
            .to.emit(contract, "TaskRefunded")
            .withArgs(1n, poster.address, (reward * 9500n) / 10000n, 0n);

        const posterAfter = await ethers.provider.getBalance(poster.address);
        const treasuryAfter = await ethers.provider.getBalance(treasury.address);
        const agentAAfter = await ethers.provider.getBalance(agentA.address);
        const agentBAfter = await ethers.provider.getBalance(agentB.address);

        expect(posterAfter - posterBefore).to.equal((reward * 9500n) / 10000n);
        expect(await contract.protocolFees(ethers.ZeroAddress)).to.equal((reward * 200n) / 10000n);
        expect(agentAAfter - agentABefore).to.equal((reward * 300n) / 10000n / 2n);
        expect(agentBAfter - agentBBefore).to.equal((reward * 300n) / 10000n / 2n);
        await expect(() => contract.connect(agentA).claimStake(1n)).to.changeEtherBalance(agentA, minStake * 11n / 10n);
        await expect(() => contract.connect(agentB).claimStake(1n)).to.changeEtherBalance(agentB, minStake * 11n / 10n);

        const task = await contract.tasks(1n);
        expect(task[10]).to.equal(2n);
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
            .postTask("cid://eval-force-refund-empty", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                value: reward,
            });
        await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
        await warpTo(judgeDeadline + 1n);

        await expect(contract.connect(attacker).forceRefund(1n))
            .to.be.revertedWithCustomError(contract, "NoSubmittedAgents")
            .withArgs(1n);
    });

    it("cancelTask with no applicants: 100% refund, no protocol fee", async function () {
        const { contract, poster, judge, treasury } = await deployFixture();
        const reward = ethers.parseEther("0.5");
        const minStake = ethers.parseEther("0.02");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await contract
            .connect(poster)
            .postTask("cid://eval-cancel", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                value: reward,
            });

        const posterBefore = await ethers.provider.getBalance(poster.address);

        const cancelTx = await contract.connect(poster).cancelTask(1n);
        const cancelReceipt = await cancelTx.wait();
        const gasPrice = cancelReceipt.gasPrice ?? cancelReceipt.effectiveGasPrice ?? 0n;
        const gasCost = cancelReceipt.gasUsed * gasPrice;

        const posterAfter = await ethers.provider.getBalance(poster.address);

        expect(posterAfter - posterBefore + gasCost).to.equal(reward);
        expect(await contract.protocolFees(ethers.ZeroAddress)).to.equal(0n);

        const task = await contract.tasks(1n);
        expect(task[10]).to.equal(2n); // Refunded
    });

    it("cancel_task with applicants but no submissions: 5% compensation split", async function () {
        const { contract, poster, judge, agentA, attacker, treasury } = await deployFixture();
        const reward = ethers.parseEther("0.5");
        const minStake = ethers.parseEther("0.02");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await contract
            .connect(poster)
            .postTask("cid://eval-cancel", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                value: reward,
            });
        await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });

        await expect(contract.connect(attacker).cancelTask(1n))
            .to.be.revertedWithCustomError(contract, "NotTaskPoster")
            .withArgs(1n, attacker.address, poster.address);

        const posterBefore = await ethers.provider.getBalance(poster.address);
        const treasuryBefore = await ethers.provider.getBalance(treasury.address);
        const agentBefore = await ethers.provider.getBalance(agentA.address);

        const cancelTx = await contract.connect(poster).cancelTask(1n);
        const cancelReceipt = await cancelTx.wait();
        const gasPrice = cancelReceipt.gasPrice ?? cancelReceipt.effectiveGasPrice ?? 0n;
        const gasCost = cancelReceipt.gasUsed * gasPrice;

        const protocolFee = (reward * 200n) / 10000n;
        const cancelPenalty = (reward * 500n) / 10000n;
        const expectedRefund = reward - protocolFee - cancelPenalty;

        const posterAfter = await ethers.provider.getBalance(poster.address);
        const treasuryAfter = await ethers.provider.getBalance(treasury.address);
        const agentAfter = await ethers.provider.getBalance(agentA.address);

        expect(posterAfter - posterBefore + gasCost).to.equal(expectedRefund);
        expect(await contract.protocolFees(ethers.ZeroAddress)).to.equal(protocolFee);
        expect(agentAfter - agentBefore).to.equal(cancelPenalty);

        await expect(() => contract.connect(agentA).claimStake(1n)).to.changeEtherBalance(agentA, minStake * 11n / 10n);

        const task = await contract.tasks(1n);
        expect(task[10]).to.equal(2n);
    });

    it("cancel_task after submission is blocked", async function () {
        const { contract, poster, judge, agentA } = await deployFixture();
        const reward = ethers.parseEther("0.1");
        const minStake = ethers.parseEther("0.01");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await contract
            .connect(poster)
            .postTask("cid://eval-cancel-block", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                value: reward,
            });
        await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
        await contract.connect(agentA).submitResult(1n, "result", "trace");

        await expect(contract.connect(poster).cancelTask(1n))
            .to.be.revertedWithCustomError(contract, "CannotCancelAfterSubmission")
            .withArgs(1n);
    });

    it("treasury can withdraw accumulated protocol fees", async function () {
        const { contract, poster, judge, agentA, treasury } = await deployFixture();
        const reward = ethers.parseEther("0.1");
        const minStake = ethers.parseEther("0.01");
        const now = await currentTime();
        const deadline = now + 3600n;
        const judgeDeadline = deadline + 1800n;

        await contract
            .connect(poster)
            .postTask("cid://eval-withdraw", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                value: reward,
            });
        await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
        await contract.connect(agentA).submitResult(1n, "result", "trace");
        await contract.connect(judge).judgeAndPay(1n, agentA.address, 80);

        const expectedFee = (reward * 200n) / 10000n;
        expect(await contract.protocolFees(ethers.ZeroAddress)).to.equal(expectedFee);

        await expect(contract.connect(poster).withdrawProtocolFees(ethers.ZeroAddress))
            .to.be.revertedWithCustomError(contract, "NotTreasury")
            .withArgs(poster.address);

        await expect(contract.connect(treasury).withdrawProtocolFees(ethers.ZeroAddress))
            .to.emit(contract, "ProtocolFeesWithdrawn")
            .withArgs(ethers.ZeroAddress, treasury.address, expectedFee);

        expect(await contract.protocolFees(ethers.ZeroAddress)).to.equal(0n);
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
                .postTask("cid://eval", deadline, judgeDeadline, judge.address, 1, 0n, false, {
                    value: reward,
                });
            const taskId = await contract.taskCount();
            await contract.connect(agentA).applyForTask(taskId, { value: 0n });
            await contract.connect(agentA).submitResult(taskId, "cid://result", "cid://trace");
            await contract.connect(judge).judgeAndPay(taskId, agentA.address, score);
        }

        const reputation = await contract.getReputation(agentA.address);
        expect(reputation[1]).to.equal(3n);
        expect(reputation[3]).to.equal(183n);
        expect(reputation[4]).to.equal(61n);
    });

    describe("Dispute", function () {
        it("dispute_task opens a dispute during window with correct bond", async function () {
            const { contract, poster, judge, agentA, attacker } = await deployFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;

            await contract
                .connect(poster)
                .postTask("cid://eval", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                    value: reward,
                });
            await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
            await contract.connect(agentA).submitResult(1n, "cid://result", "cid://trace");
            await contract.connect(judge).judgeAndPay(1n, agentA.address, 80);

            const bond = reward / 10n;
            await expect(
                contract.connect(agentA).disputeTask(1n, ethers.encodeBytes32String("reason"), { value: bond }),
            )
                .to.emit(contract, "DisputeOpened")
                .withArgs(1n, agentA.address, bond, ethers.encodeBytes32String("reason"));

            const d = await contract.disputes(1n);
            expect(d[0]).to.equal(1n); // DisputeState.Open
            expect(d[1]).to.equal(agentA.address);
        });

        it("rejects dispute with wrong bond or outside window", async function () {
            const { contract, poster, judge, agentA, attacker } = await deployFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;

            await contract
                .connect(poster)
                .postTask("cid://eval", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                    value: reward,
                });
            await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
            await contract.connect(agentA).submitResult(1n, "cid://result", "cid://trace");
            await contract.connect(judge).judgeAndPay(1n, agentA.address, 80);

            const bond = reward / 10n;
            await expect(
                contract.connect(agentA).disputeTask(1n, ethers.encodeBytes32String("reason"), { value: bond - 1n }),
            ).to.be.revertedWithCustomError(contract, "BondAmountIncorrect");

            await warpTo(judgeDeadline + 7n * 86400n + 1n);
            await expect(
                contract.connect(agentA).disputeTask(1n, ethers.encodeBytes32String("reason"), { value: bond }),
            ).to.be.revertedWithCustomError(contract, "DisputeWindowClosed");
        });

        it("resolver can uphold dispute and redistribute", async function () {
            const { contract, poster, judge, agentA, attacker, deployer } = await deployFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;

            await contract
                .connect(poster)
                .postTask("cid://eval", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                    value: reward,
                });
            await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
            await contract.connect(agentA).submitResult(1n, "cid://result", "cid://trace");
            await contract.connect(judge).judgeAndPay(1n, agentA.address, 80);

            const bond = reward / 10n;
            await contract.connect(agentA).disputeTask(1n, ethers.encodeBytes32String("reason"), { value: bond });

            const challengerBefore = await ethers.provider.getBalance(agentA.address);

            const tx = await contract
                .connect(deployer)
                .resolveDispute(1n, 1, agentA.address, 80); // DisputeOutcome.Uphold = 1
            await expect(tx)
                .to.emit(contract, "DisputeResolved")
                .withArgs(1n, 1n, deployer.address, agentA.address, 80n);
            await tx.wait();

            const challengerAfter = await ethers.provider.getBalance(agentA.address);
            expect(challengerAfter - challengerBefore).to.equal(bond);

            const d = await contract.disputes(1n);
            expect(d[0]).to.equal(2n); // DisputeState.Resolved
            expect(d[5]).to.equal(1n); // DisputeOutcome.Uphold
        });

        it("resolver can reject dispute and split bond to judge and treasury", async function () {
            const { contract, poster, judge, agentA, attacker, deployer } = await deployFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;

            await contract
                .connect(poster)
                .postTask("cid://eval", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                    value: reward,
                });
            await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
            await contract.connect(agentA).submitResult(1n, "cid://result", "cid://trace");
            await contract.connect(judge).judgeAndPay(1n, agentA.address, 80);

            const bond = reward / 10n;
            await contract.connect(agentA).disputeTask(1n, ethers.encodeBytes32String("reason"), { value: bond });

            await expect(() =>
                contract.connect(deployer).resolveDispute(1n, 2, agentA.address, 80), // DisputeOutcome.Reject = 2
            ).to.changeEtherBalance(judge, bond / 2n);

            const d = await contract.disputes(1n);
            expect(d[0]).to.equal(2n); // DisputeState.Resolved
            expect(d[5]).to.equal(2n); // DisputeOutcome.Reject
        });

        it("non-resolver cannot resolve dispute", async function () {
            const { contract, poster, judge, agentA, attacker } = await deployFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;

            await contract
                .connect(poster)
                .postTask("cid://eval", deadline, judgeDeadline, judge.address, 1, minStake, false, {
                    value: reward,
                });
            await contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n });
            await contract.connect(agentA).submitResult(1n, "cid://result", "cid://trace");
            await contract.connect(judge).judgeAndPay(1n, agentA.address, 80);

            const bond = reward / 10n;
            await contract.connect(agentA).disputeTask(1n, ethers.encodeBytes32String("reason"), { value: bond });

            await expect(
                contract.connect(attacker).resolveDispute(1n, 1, agentA.address, 80),
            ).to.be.revertedWithCustomError(contract, "NotDisputeResolver");
        });
    });

    describe("Quorum", function () {
        it("post_task_quorum creates a pool-based task", async function () {
            const { contract, poster, judge, agentA, agentB } = await deployFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;
            const judges = [judge.address, agentA.address, agentB.address];

            await expect(
                contract
                    .connect(poster)
                    .postTaskQuorum("cid://eval", deadline, judgeDeadline, 1, minStake, 1, false, judges, {
                        value: reward,
                    }),
            )
                .to.emit(contract, "TaskCreated")
                .withArgs(1n, poster.address, ethers.ZeroAddress, 1n, minStake * 11n / 10n, reward, deadline, judgeDeadline, false, "cid://eval");

            const task = await contract.tasks(1n);
            expect(task[10]).to.equal(0n); // TaskState.Open
            expect(task[11]).to.equal(1n); // judgeMode = SINGLE_POOL

            const pool = await contract.getTaskJudgePool(1n);
            expect(pool.map((a) => a)).to.deep.equal(judges);
        });

        it("pool judges can submit judgements and settle with quorum", async function () {
            const { contract, poster, judge, agentA, agentB, treasury, attacker } = await deployFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;
            const judges = [judge.address, agentA.address, agentB.address];

            await contract
                .connect(poster)
                .postTaskQuorum("cid://eval", deadline, judgeDeadline, 1, minStake, 1, false, judges, {
                    value: reward,
                });

            const applicant = attacker;
            await contract.connect(applicant).applyForTask(1n, { value: minStake * 11n / 10n });
            await contract.connect(applicant).submitResult(1n, "cid://result", "cid://trace");

            // 2-of-3 majority required
            await contract.connect(judge).submitJudgement(1n, applicant.address, 80);
            await contract.connect(agentA).submitJudgement(1n, applicant.address, 80);
            // agentB votes differently
            await contract.connect(agentB).submitJudgement(1n, ethers.ZeroAddress, 0);

            await expect(contract.connect(treasury).settleWithQuorum(1n))
                .to.be.revertedWithCustomError(contract, "JudgeDeadlineNotReached")
                .withArgs(1n);

            await warpTo(judgeDeadline + 1n);

            const winnerBefore = await ethers.provider.getBalance(applicant.address);
            await expect(contract.connect(treasury).settleWithQuorum(1n))
                .to.emit(contract, "TaskJudged")
                .withArgs(
                    1n,
                    applicant.address,
                    80n,
                    (reward * 9500n) / 10000n,
                    (reward * 300n) / 10000n,
                    (reward * 200n) / 10000n,
                );
            const winnerAfter = await ethers.provider.getBalance(applicant.address);
            expect(winnerAfter - winnerBefore).to.equal((reward * 9500n) / 10000n);

            const task = await contract.tasks(1n);
            expect(task[10]).to.equal(1n); // Completed
            expect(task[2]).to.equal(applicant.address);
            expect(task[9]).to.equal(80n);
        });

        it("non-pool judge cannot submit judgement", async function () {
            const { contract, poster, judge, agentA, agentB, attacker } = await deployFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;
            const judges = [judge.address, agentA.address];

            await contract
                .connect(poster)
                .postTaskQuorum("cid://eval", deadline, judgeDeadline, 1, minStake, 1, false, judges, {
                    value: reward,
                });

            await expect(
                contract.connect(attacker).submitJudgement(1n, agentA.address, 80),
            ).to.be.revertedWithCustomError(contract, "NotPoolJudge");
        });

        it("quorum rejects when no majority reached", async function () {
            const { contract, poster, judge, agentA, agentB, attacker } = await deployFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;
            const judges = [judge.address, agentA.address, agentB.address];

            await contract
                .connect(poster)
                .postTaskQuorum("cid://eval", deadline, judgeDeadline, 1, minStake, 1, false, judges, {
                    value: reward,
                });

            await contract.connect(attacker).applyForTask(1n, { value: minStake * 11n / 10n });
            await contract.connect(attacker).submitResult(1n, "cid://result", "cid://trace");

            // No majority: 1-1-0 split
            await contract.connect(judge).submitJudgement(1n, attacker.address, 80);
            await contract.connect(agentA).submitJudgement(1n, attacker.address, 70);

            await warpTo(judgeDeadline + 1n);
            await expect(contract.settleWithQuorum(1n))
                .to.be.revertedWithCustomError(contract, "QuorumNotReached")
                .withArgs(1n);
        });
    });

    describe("JudgeRegistry Integration (GRA-179)", function () {
        async function deployWithRegistry() {
            const base = await deployFixture();
            const registryFactory = await ethers.getContractFactory("JudgeRegistry", base.deployer);
            const registry = await registryFactory.deploy(base.deployer.address);
            await registry.waitForDeployment();
            await registry.connect(base.deployer).setArena(await base.contract.getAddress());
            await base.contract.connect(base.deployer).setJudgeRegistry(await registry.getAddress());
            return { ...base, registry };
        }

        it("auto-assigns judge from registry when judge is zero address", async function () {
            const { contract, poster, judge, registry } = await deployWithRegistry();
            await registry.connect(judge).register(2);

            const reward = ethers.parseEther("0.5");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;

            await expect(
                contract.connect(poster).postTask("cid://eval", deadline, judgeDeadline, ethers.ZeroAddress, 2, 0n, false, {
                    value: reward,
                }),
            )
                .to.emit(contract, "TaskCreated")
                .withArgs(1n, poster.address, judge.address, 2n, 0n, reward, deadline, judgeDeadline, false, "cid://eval");

            const task = await contract.tasks(1n);
            expect(task[1]).to.equal(judge.address);
        });

        it("reverts auto-assignment for high-value tasks without designated judge", async function () {
            const { contract, poster, registry } = await deployWithRegistry();

            const reward = ethers.parseEther("2"); // > 1 ether
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 1800n;

            await expect(
                contract.connect(poster).postTask("cid://eval", deadline, judgeDeadline, ethers.ZeroAddress, 2, 0n, false, {
                    value: reward,
                }),
            ).to.be.revertedWithCustomError(contract, "HighValueTaskRequiresDesignatedJudge");
        });

        it("reassign_judge slashes inactive judge and picks new one", async function () {
            const { contract, poster, judge, agentA, registry } = await deployWithRegistry();
            await registry.connect(judge).register(2);
            await registry.connect(agentA).register(2);

            const reward = ethers.parseEther("0.5");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            const deadline = now + 3600n;
            const judgeDeadline = deadline + 2n * 86400n; // 2 days after deadline

            await contract
                .connect(poster)
                .postTask("cid://eval", deadline, judgeDeadline, ethers.ZeroAddress, 2, minStake, false, {
                    value: reward,
                });

            const taskBefore = await contract.tasks(1n);
            const oldJudge = taskBefore[1];
            expect(oldJudge).to.not.equal(ethers.ZeroAddress);

            await expect(contract.reassignJudge(1n)).to.be.revertedWithCustomError(
                contract,
                "ReassignWindowNotOpen",
            );

            await warpTo(judgeDeadline - 60n * 60n * 23n); // 23h before judgeDeadline, inside reassign window
            await expect(contract.reassignJudge(1n))
                .to.emit(contract, "JudgeSlashed")
                .withArgs(0n, oldJudge, minStake * 11n / 100n, "SLASHED")
                .to.emit(contract, "JudgeSlashed"); // second event not matched full

            const taskAfter = await contract.tasks(1n);
            expect(taskAfter[1]).to.not.equal(oldJudge);
        });
    });

    describe("Reputation Integration (GRA-243 / GRA-248)", function () {
        async function deployWithReputationFixture() {
            const base = await deployFixture();
            const oracleWallet = ethers.Wallet.createRandom();
            const feedFactory = await ethers.getContractFactory("GradienceReputationFeed", base.deployer);
            const feedImpl = await feedFactory.deploy();
            await feedImpl.waitForDeployment();
            const proxyFactory = await ethers.getContractFactory("ERC1967Proxy", base.deployer);
            const initData = feedFactory.interface.encodeFunctionData("initialize", [base.deployer.address, oracleWallet.address]);
            const proxy = await proxyFactory.deploy(await feedImpl.getAddress(), initData);
            await proxy.waitForDeployment();
            const feed = feedFactory.attach(await proxy.getAddress());
            await base.contract.setReputationFeed(await feed.getAddress());
            return { ...base, feed, oracleWallet };
        }

        function signReputationUpdate(oracleWallet, evmAddress, solanaPubkey, globalScore, categoryScores, merkleRoot, timestamp, chainId) {
            const abiCoder = new ethers.AbiCoder();
            const encoded = abiCoder.encode(
                ["address", "bytes32", "uint16", "uint16[8]", "bytes32", "uint64", "uint256"],
                [evmAddress, solanaPubkey, globalScore, categoryScores, merkleRoot, timestamp, chainId],
            );
            const digest = ethers.keccak256(encoded);
            const sig = oracleWallet.signingKey.sign(digest);
            return ethers.Signature.from(sig).serialized;
        }

        it("applies with base stake when reputationFeed is not set", async function () {
            const { contract, poster, agentA } = await deployFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            await contract.connect(poster).postTask("cid://eval", now + 3600n, now + 7200n, poster.address, 2, minStake, false, { value: reward });
            await expect(contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n })).to.not.be.reverted;
        });

        it("requires 2x stake when reputationFeed is set but agent has no record", async function () {
            const { contract, poster, agentA } = await deployWithReputationFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            await contract.connect(poster).postTask("cid://eval", now + 3600n, now + 7200n, poster.address, 2, minStake, false, { value: reward });
            await expect(contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n }))
                .to.be.revertedWithCustomError(contract, "InvalidStakeAmount");
            await expect(contract.connect(agentA).applyForTask(1n, { value: minStake * 22n / 10n })).to.not.be.reverted;
        });

        it("applies with base stake when reputationFeed has agent record", async function () {
            const { contract, poster, agentA, feed, oracleWallet } = await deployWithReputationFixture();
            const reward = ethers.parseEther("1");
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            await contract.connect(poster).postTask("cid://eval", now + 3600n, now + 7200n, poster.address, 2, minStake, false, { value: reward });
            const cats = [10, 20, 30, 40, 50, 60, 70, 80];
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const sig = signReputationUpdate(oracleWallet, agentA.address, ethers.ZeroHash, 75, cats, ethers.ZeroHash, now, chainId);
            await feed.updateReputation(agentA.address, ethers.ZeroHash, 75, cats, ethers.ZeroHash, now, chainId, sig);
            await expect(contract.connect(agentA).applyForTask(1n, { value: minStake * 11n / 10n })).to.not.be.reverted;
        });

        it("getRequiredStake reflects reputation state", async function () {
            const { contract, poster, agentA, feed, oracleWallet } = await deployWithReputationFixture();
            const minStake = ethers.parseEther("0.1");
            const now = await currentTime();
            await contract.connect(poster).postTask("cid://eval", now + 3600n, now + 7200n, poster.address, 2, minStake, false, { value: ethers.parseEther("1") });
            expect(await contract.getRequiredStake(1n, agentA.address)).to.equal(minStake * 22n / 10n);
            const cats = [10, 20, 30, 40, 50, 60, 70, 80];
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const sig = signReputationUpdate(oracleWallet, agentA.address, ethers.ZeroHash, 75, cats, ethers.ZeroHash, now, chainId);
            await feed.updateReputation(agentA.address, ethers.ZeroHash, 75, cats, ethers.ZeroHash, now, chainId, sig);
            expect(await contract.getRequiredStake(1n, agentA.address)).to.equal(minStake * 11n / 10n);
        });
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
