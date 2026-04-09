import {
    GRADIENCE_PROGRAM_ADDRESS,
    getApplyForTaskInstructionAsync,
    getApplyForTaskInstruction,
    getCancelTaskInstructionAsync,
    getCancelTaskInstruction,
    getForceRefundInstructionAsync,
    getForceRefundInstruction,
    getInitializeInstruction,
    getJudgeAndPayInstructionAsync,
    getJudgeAndPayInstruction,
    getPostTaskInstructionAsync,
    getPostTaskInstruction,
    getRefundExpiredInstructionAsync,
    getRefundExpiredInstruction,
    getRegisterJudgeInstruction,
    fetchMaybeJudgePool,
    getSubmitResultInstructionAsync,
    getSubmitResultInstruction,
    getUnstakeJudgeInstruction,
    getUpgradeConfigInstruction,
} from './generated/index.js';
import {
    AccountRole,
    createSolanaRpc,
    fetchEncodedAccount,
    getAddressDecoder,
    getAddressEncoder,
    getProgramDerivedAddress,
} from '@solana/kit';
export class GradienceSDK {
    indexerEndpoint;
    attestationEndpoint;
    programAddress;
    rpc;
    constructor(options = {}) {
        this.indexerEndpoint = sanitizeBaseUrl(options.indexerEndpoint ?? 'http://127.0.0.1:3001');
        this.attestationEndpoint = sanitizeBaseUrl(
            options.attestationEndpoint ?? options.indexerEndpoint ?? 'http://127.0.0.1:3001',
        );
        this.programAddress = options.programAddress ?? GRADIENCE_PROGRAM_ADDRESS;
        const rpcEndpoint = options.rpcEndpoint ?? 'http://127.0.0.1:8899';
        this.rpc = options.rpc ?? createSolanaRpc(rpcEndpoint);
    }
    setIndexerEndpoint(endpoint) {
        this.indexerEndpoint = sanitizeBaseUrl(endpoint);
    }
    setAttestationEndpoint(endpoint) {
        this.attestationEndpoint = sanitizeBaseUrl(endpoint);
    }
    setRpc(rpc) {
        this.rpc = rpc;
    }
    instructions = {
        initialize: (input, config) => getInitializeInstruction(input, config),
        postTask: (input, config) => getPostTaskInstruction(input, config),
        applyForTask: (input, config) => getApplyForTaskInstruction(input, config),
        submitResult: (input, config) => getSubmitResultInstruction(input, config),
        judgeAndPay: (input, config) => getJudgeAndPayInstruction(input, config),
        cancelTask: (input, config) => getCancelTaskInstruction(input, config),
        refundExpired: (input, config) => getRefundExpiredInstruction(input, config),
        forceRefund: (input, config) => getForceRefundInstruction(input, config),
        registerJudge: (input, config) => getRegisterJudgeInstruction(input, config),
        unstakeJudge: (input, config) => getUnstakeJudgeInstruction(input, config),
        upgradeConfig: (input, config) => getUpgradeConfigInstruction(input, config),
    };
    task = {
        /** Post a new task on-chain. */
        post: (wallet, request) => this.postTask(wallet, request),
        /**
         * High-level helper: derive next task id from on-chain config and post task
         * with sensible deadline defaults.
         */
        postSimple: (wallet, request) => this.postTaskSimple(wallet, request),
        /** Apply to an existing task on-chain. */
        apply: (wallet, request) => this.applyForTask(wallet, request),
        /** Submit task result on-chain. */
        submit: (wallet, request) => this.submitResult(wallet, request),
        /** Judge a task and settle funds on-chain. */
        judge: (wallet, request) => this.judgeTask(wallet, request),
        /** Cancel a task and refund stakes/reward on-chain. */
        cancel: (wallet, request) => this.cancelTask(wallet, request),
        /** Refund expired task on-chain. */
        refund: (wallet, request) => this.refundExpiredTask(wallet, request),
        /** Force refund path on-chain with judge slash logic. */
        forceRefund: (wallet, request) => this.forceRefundTask(wallet, request),
        /**
         * Fetch submissions for a task from indexer.
         * Returns `null` when the task is not found.
         */
        submissions: (taskId, params) => this.getTaskSubmissions(taskId, params),
    };
    reputation = {
        /**
         * Fetch on-chain reputation PDA.
         * Returns `null` when the account does not exist.
         */
        get: agent => this.getReputationOnChain(agent),
    };
    judgePool = {
        /**
         * Fetch on-chain judge pool PDA members for a category.
         * Returns `null` when the pool account does not exist.
         */
        list: category => this.getJudgePoolOnChain(category),
    };
    config = {
        /**
         * Fetch on-chain ProgramConfig PDA.
         * Returns `null` when the config account does not exist.
         */
        get: () => this.getProgramConfigOnChain(),
    };
    profile = {
        /** Fetch agent profile from Indexer. Returns `null` when not found. */
        get: agent => this.getAgentProfile(agent),
        /** Update agent profile via Indexer. */
        update: (agent, data) => this.updateAgentProfile(agent, data),
    };
    attestations = {
        /**
         * Fetch TaskCompletion attestations for a given agent.
         * Returns `null` when the attestation endpoint or agent record is not found.
         */
        list: agent => this.getAgentAttestations(agent),
        /**
         * Fetch and normalize TaskCompletion attestations to strongly-typed bigint fields.
         * Returns `null` when the attestation endpoint or agent record is not found.
         */
        listDecoded: agent => this.getDecodedAgentAttestations(agent),
        /**
         * Decode on-chain TaskCompletion attestation payload bytes
         * ordered as [U64, U8, U8, U8, U64, I64].
         */
        decode: decodeTaskCompletionAttestation,
    };
    async postTask(wallet, request) {
        const taskId = BigInt(request.taskId);
        const [config] = await findConfigPda(this.programAddress);
        const [task] = await findTaskPda(this.programAddress, taskId);
        const [escrow] = await findEscrowPda(this.programAddress, taskId);
        const [judgePool] = await findJudgePoolPda(this.programAddress, request.category);
        const tokenCtx = await this.resolveTokenContext({
            owner: wallet.signer.address,
            escrow,
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            ownerTokenAccount: request.posterTokenAccount,
            escrowAta: request.escrowAta,
        });
        const instruction = await getPostTaskInstructionAsync({
            poster: wallet.signer,
            config,
            task,
            escrow,
            judgePool,
            gradienceProgram: this.programAddress,
            evalRef: request.evalRef,
            deadline: request.deadline,
            judgeDeadline: request.judgeDeadline,
            judgeMode: request.judgeMode,
            judge: addressToBytes(request.judge),
            category: request.category,
            mint: tokenCtx.mintBytes,
            minStake: request.minStake,
            reward: request.reward,
            posterTokenAccount: tokenCtx.ownerTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
            associatedTokenProgram: tokenCtx.associatedTokenProgram,
        });
        const normalizedInstruction = tokenCtx.isSpl
            ? instruction
            : stripOptionalTail(instruction, 5, this.programAddress);
        return wallet.signAndSendTransaction([normalizedInstruction]);
    }
    async postTaskSimple(wallet, request) {
        const judgeMode = request.judgeMode ?? 1;
        if (judgeMode === 0 && !request.judge) {
            throw new Error('judge is required when judgeMode=0 (designated)');
        }
        const now = BigInt(Math.floor(Date.now() / 1000));
        const deadline = request.deadline
            ? BigInt(request.deadline)
            : now + BigInt(request.deadlineOffsetSeconds ?? 3_600);
        const judgeDeadline = request.judgeDeadline
            ? BigInt(request.judgeDeadline)
            : deadline + BigInt(request.judgeDeadlineOffsetSeconds ?? 3_600);
        const config = await this.getProgramConfigOnChain();
        if (!config) {
            throw new Error('Program config account not found; initialize program before posting');
        }
        const taskId = config.taskCount;
        const signature = await this.postTask(wallet, {
            taskId,
            evalRef: request.evalRef,
            deadline,
            judgeDeadline,
            judgeMode,
            judge: request.judge,
            category: request.category,
            minStake: request.minStake ?? 0,
            reward: request.reward,
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            posterTokenAccount: request.posterTokenAccount,
            escrowAta: request.escrowAta,
        });
        return { taskId, signature };
    }
    async applyForTask(wallet, request) {
        const taskId = BigInt(request.taskId);
        const [task] = await findTaskPda(this.programAddress, taskId);
        const [escrow] = await findEscrowPda(this.programAddress, taskId);
        const [application] = await findApplicationPda(this.programAddress, taskId, wallet.signer.address);
        const [reputation] = await findReputationPda(this.programAddress, wallet.signer.address);
        const tokenCtx = await this.resolveTokenContext({
            owner: wallet.signer.address,
            escrow,
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            ownerTokenAccount: request.agentTokenAccount,
            escrowAta: request.escrowAta,
        });
        const instruction = await getApplyForTaskInstructionAsync({
            agent: wallet.signer,
            task,
            escrow,
            application,
            reputation,
            gradienceProgram: this.programAddress,
            agentTokenAccount: tokenCtx.ownerTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });
        const normalizedInstruction = tokenCtx.isSpl
            ? instruction
            : stripOptionalTail(instruction, 4, this.programAddress);
        return wallet.signAndSendTransaction([normalizedInstruction]);
    }
    async submitResult(wallet, request) {
        const taskId = BigInt(request.taskId);
        const [task] = await findTaskPda(this.programAddress, taskId);
        const [application] = await findApplicationPda(this.programAddress, taskId, wallet.signer.address);
        const [submission] = await findSubmissionPda(this.programAddress, taskId, wallet.signer.address);
        const instruction = await getSubmitResultInstructionAsync({
            agent: wallet.signer,
            task,
            application,
            submission,
            gradienceProgram: this.programAddress,
            resultRef: request.resultRef,
            traceRef: request.traceRef,
            runtimeEnv: request.runtimeEnv,
        });
        return wallet.signAndSendTransaction([instruction]);
    }
    async judgeTask(wallet, request) {
        const taskId = BigInt(request.taskId);
        const [task] = await findTaskPda(this.programAddress, taskId);
        const [escrow] = await findEscrowPda(this.programAddress, taskId);
        const [winnerApplication] = await findApplicationPda(this.programAddress, taskId, request.winner);
        const [winnerSubmission] = await findSubmissionPda(this.programAddress, taskId, request.winner);
        const [winnerReputation] = await findReputationPda(this.programAddress, request.winner);
        const [judgeStake] = await findStakePda(this.programAddress, wallet.signer.address);
        const [treasury] = await findTreasuryPda(this.programAddress);
        const tokenCtx = await this.resolveJudgeTokenContext({
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            escrow,
            judge: wallet.signer.address,
            winner: request.winner,
            poster: request.poster,
            judgeTokenAccount: request.judgeTokenAccount,
            winnerTokenAccount: request.winnerTokenAccount,
            posterTokenAccount: request.posterTokenAccount,
            treasuryAta: request.treasuryAta,
            escrowAta: request.escrowAta,
        });
        const remaining = await this.resolveRefundPairs(taskId, request.losers, {
            mint: request.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });
        const instruction = await getJudgeAndPayInstructionAsync({
            judge: wallet.signer,
            task,
            escrow,
            posterAccount: request.poster,
            winnerAccount: request.winner,
            winnerApplication,
            winnerSubmission,
            winnerReputation,
            judgeStake,
            treasury,
            gradienceProgram: this.programAddress,
            winner: addressToBytes(request.winner),
            score: request.score,
            reasonRef: request.reasonRef,
            judgeTokenAccount: tokenCtx.judgeTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            winnerTokenAccount: tokenCtx.winnerTokenAccount,
            posterTokenAccount: tokenCtx.posterTokenAccount,
            treasuryAta: tokenCtx.treasuryAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
            associatedTokenProgram: tokenCtx.associatedTokenProgram,
        });
        const normalizedInstruction = tokenCtx.isSpl
            ? instruction
            : stripOptionalTail(instruction, 8, this.programAddress);
        const instructionWithRemaining = appendRemainingAccounts(normalizedInstruction, remaining.metas);
        const sendOptions = await this.resolveSendOptions(wallet, taskId, remaining.addresses);
        return wallet.signAndSendTransaction([instructionWithRemaining], sendOptions);
    }
    async cancelTask(wallet, request) {
        const taskId = BigInt(request.taskId);
        const [task] = await findTaskPda(this.programAddress, taskId);
        const [escrow] = await findEscrowPda(this.programAddress, taskId);
        const [treasury] = await findTreasuryPda(this.programAddress);
        const tokenCtx = await this.resolveTokenContext({
            owner: wallet.signer.address,
            escrow,
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            ownerTokenAccount: request.posterTokenAccount,
            escrowAta: request.escrowAta,
        });
        const treasuryAta =
            tokenCtx.isSpl && tokenCtx.mint && tokenCtx.tokenProgram
                ? (request.treasuryAta ??
                  (
                      await findAssociatedTokenAddress(
                          treasury,
                          tokenCtx.mint,
                          tokenCtx.tokenProgram,
                          ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                      )
                  )[0])
                : undefined;
        const remaining = await this.resolveRefundPairs(taskId, request.refunds, {
            mint: request.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });
        const instruction = await getCancelTaskInstructionAsync({
            poster: wallet.signer,
            task,
            escrow,
            treasury,
            gradienceProgram: this.programAddress,
            posterTokenAccount: tokenCtx.ownerTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            treasuryAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
            associatedTokenProgram: tokenCtx.associatedTokenProgram,
        });
        const normalizedInstruction = tokenCtx.isSpl
            ? instruction
            : stripOptionalTail(instruction, 6, this.programAddress);
        const instructionWithRemaining = appendRemainingAccounts(normalizedInstruction, remaining.metas);
        const sendOptions = await this.resolveSendOptions(wallet, taskId, remaining.addresses);
        return wallet.signAndSendTransaction([instructionWithRemaining], sendOptions);
    }
    async refundExpiredTask(wallet, request) {
        const taskId = BigInt(request.taskId);
        const [task] = await findTaskPda(this.programAddress, taskId);
        const [escrow] = await findEscrowPda(this.programAddress, taskId);
        const tokenCtx = await this.resolveTokenContext({
            owner: request.poster,
            escrow,
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            ownerTokenAccount: request.posterTokenAccount,
            escrowAta: request.escrowAta,
        });
        const remaining = await this.resolveRefundPairs(taskId, request.refunds, {
            mint: request.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });
        const instruction = await getRefundExpiredInstructionAsync({
            anyone: wallet.signer,
            poster: tokenCtx.isSpl ? undefined : request.poster,
            task,
            escrow,
            gradienceProgram: this.programAddress,
            posterTokenAccount: tokenCtx.ownerTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });
        const normalizedInstruction = tokenCtx.isSpl
            ? removeAccountsAtIndexes(instruction, [1])
            : stripOptionalTail(instruction, 4, this.programAddress);
        const instructionWithRemaining = appendRemainingAccounts(normalizedInstruction, remaining.metas);
        const sendOptions = await this.resolveSendOptions(wallet, taskId, remaining.addresses);
        return wallet.signAndSendTransaction([instructionWithRemaining], sendOptions);
    }
    async forceRefundTask(wallet, request) {
        const taskId = BigInt(request.taskId);
        const [config] = await findConfigPda(this.programAddress);
        const [task] = await findTaskPda(this.programAddress, taskId);
        const [escrow] = await findEscrowPda(this.programAddress, taskId);
        const [judgeStake] = await findStakePda(this.programAddress, request.judge);
        const [judgeReputation] = await findReputationPda(this.programAddress, request.judge);
        const [treasury] = await findTreasuryPda(this.programAddress);
        const tokenCtx = await this.resolveForceRefundTokenContext({
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            escrow,
            poster: request.poster,
            mostActiveAgent: request.mostActiveAgent,
            posterTokenAccount: request.posterTokenAccount,
            mostActiveAgentTokenAccount: request.mostActiveAgentTokenAccount,
            escrowAta: request.escrowAta,
            treasuryAta: request.treasuryAta,
            treasury,
        });
        const judgePools = await Promise.all(
            request.judgeCategories.map(category => findJudgePoolPda(this.programAddress, category)),
        );
        const judgePoolMetas = judgePools.map(([pool]) => ({
            address: pool,
            role: AccountRole.WRITABLE,
        }));
        const remaining = await this.resolveRefundPairs(taskId, request.refunds, {
            mint: request.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });
        const instruction = await getForceRefundInstructionAsync({
            anyone: wallet.signer,
            posterAccount: request.poster,
            mostActiveAgent: request.mostActiveAgent,
            config,
            task,
            escrow,
            judgeStake,
            judgeAccount: request.judge,
            judgeReputation,
            treasury,
            gradienceProgram: this.programAddress,
            posterTokenAccount: tokenCtx.posterTokenAccount,
            mostActiveAgentTokenAccount: tokenCtx.mostActiveAgentTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            treasuryAta: tokenCtx.treasuryAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
            associatedTokenProgram: tokenCtx.associatedTokenProgram,
        });
        const normalizedInstruction = tokenCtx.isSpl
            ? instruction
            : stripOptionalTail(instruction, 7, this.programAddress);
        const instructionWithRemaining = appendRemainingAccounts(normalizedInstruction, [
            ...judgePoolMetas,
            ...remaining.metas,
        ]);
        const sendOptions = await this.resolveSendOptions(wallet, taskId, [
            ...judgePools.map(([pool]) => pool),
            ...remaining.addresses,
        ]);
        return wallet.signAndSendTransaction([instructionWithRemaining], sendOptions);
    }
    async getTasks(params = {}) {
        return this.getJson('/api/tasks', params);
    }
    async getTask(taskId) {
        return this.getJsonOrNull(`/api/tasks/${taskId}`);
    }
    async getTaskSubmissions(taskId, params = {}) {
        return this.getJsonOrNull(`/api/tasks/${taskId}/submissions`, params);
    }
    async getReputation(agent) {
        return this.getJsonOrNull(`/api/agents/${encodeURIComponent(agent)}/reputation`);
    }
    async getJudgePool(category) {
        return this.getJsonOrNull(`/api/judge-pool/${category}`);
    }
    async getAgentAttestations(agent) {
        const path = `/api/agents/${encodeURIComponent(agent)}/attestations`;
        return this.getJsonOrNull(path, {}, this.attestationEndpoint);
    }
    async getDecodedAgentAttestations(agent) {
        const attestations = await this.getAgentAttestations(agent);
        if (!attestations) {
            return null;
        }
        return attestations.map(normalizeTaskCompletionAttestation);
    }
    async getAgentProfile(agent) {
        return this.getJsonOrNull(`/api/agents/${encodeURIComponent(agent)}/profile`);
    }
    async updateAgentProfile(agent, data) {
        const url = `${this.indexerEndpoint}/api/agents/${encodeURIComponent(agent)}/profile`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
            throw new Error(`Profile update failed (${response.status}): ${await response.text()}`);
        }
        return { ok: true };
    }
    async getReputationOnChain(agent) {
        const [reputationPda] = await findReputationPda(this.programAddress, agent);
        const maybeAccount = await fetchEncodedAccount(this.rpc, reputationPda);
        if (!maybeAccount.exists) {
            return null;
        }
        return parseReputationAccount(maybeAccount.data);
    }
    async getJudgePoolOnChain(category) {
        const [poolPda] = await findJudgePoolPda(this.programAddress, category);
        const maybePool = await fetchMaybeJudgePool(this.rpc, poolPda);
        if (!maybePool.exists) {
            return null;
        }
        return maybePool.data.entries.map(entry => ({
            judge: bytesToAddress(entry.judge),
            weight: entry.weight,
        }));
    }
    async getProgramConfigOnChain() {
        const [configPda] = await findConfigPda(this.programAddress);
        const maybeConfig = await fetchEncodedAccount(this.rpc, configPda);
        if (!maybeConfig.exists) {
            return null;
        }
        return parseProgramConfigAccount(maybeConfig.data);
    }
    async getJson(path, query = {}) {
        return this.getJsonWithBase(path, query, this.indexerEndpoint);
    }
    async getJsonWithBase(path, query, baseUrl) {
        const url = new URL(path, `${baseUrl}/`);
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined) {
                params.set(key, String(value));
            }
        }
        if (params.size > 0) {
            url.search = params.toString();
        }
        const response = await fetch(url.toString());
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Indexer request failed (${response.status}): ${text}`);
        }
        return await response.json();
    }
    async getJsonOrNull(path, query = {}, baseUrl) {
        try {
            if (baseUrl) {
                return await this.getJsonWithBase(path, query, baseUrl);
            }
            return await this.getJson(path, query);
        } catch (error) {
            if (isNotFoundError(error)) {
                return null;
            }
            throw error;
        }
    }
    async resolveTokenContext(params) {
        if (!params.mint) {
            return {
                isSpl: false,
                mintBytes: new Array(32).fill(0),
            };
        }
        const tokenProgram = params.tokenProgram ?? SPL_TOKEN_PROGRAM_ADDRESS;
        const ownerTokenAccount =
            params.ownerTokenAccount ??
            (
                await findAssociatedTokenAddress(
                    params.owner,
                    params.mint,
                    tokenProgram,
                    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                )
            )[0];
        const escrowAta =
            params.escrowAta ??
            (
                await findAssociatedTokenAddress(
                    params.escrow,
                    params.mint,
                    tokenProgram,
                    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                )
            )[0];
        return {
            isSpl: true,
            mint: params.mint,
            tokenProgram,
            ownerTokenAccount,
            escrowAta,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
            mintBytes: addressToBytes(params.mint),
        };
    }
    async resolveJudgeTokenContext(params) {
        if (!params.mint) {
            return { isSpl: false };
        }
        const [treasury] = await findTreasuryPda(this.programAddress);
        const tokenProgram = params.tokenProgram ?? SPL_TOKEN_PROGRAM_ADDRESS;
        const judgeTokenAccount =
            params.judgeTokenAccount ??
            (
                await findAssociatedTokenAddress(
                    params.judge,
                    params.mint,
                    tokenProgram,
                    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                )
            )[0];
        const winnerTokenAccount =
            params.winnerTokenAccount ??
            (
                await findAssociatedTokenAddress(
                    params.winner,
                    params.mint,
                    tokenProgram,
                    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                )
            )[0];
        const posterTokenAccount =
            params.posterTokenAccount ??
            (
                await findAssociatedTokenAddress(
                    params.poster,
                    params.mint,
                    tokenProgram,
                    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                )
            )[0];
        const treasuryAta =
            params.treasuryAta ??
            (
                await findAssociatedTokenAddress(treasury, params.mint, tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ADDRESS)
            )[0];
        const escrowAta =
            params.escrowAta ??
            (
                await findAssociatedTokenAddress(
                    params.escrow,
                    params.mint,
                    tokenProgram,
                    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                )
            )[0];
        return {
            isSpl: true,
            mint: params.mint,
            tokenProgram,
            judgeTokenAccount,
            winnerTokenAccount,
            posterTokenAccount,
            treasuryAta,
            escrowAta,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
        };
    }
    async resolveForceRefundTokenContext(params) {
        if (!params.mint) {
            return { isSpl: false };
        }
        const tokenProgram = params.tokenProgram ?? SPL_TOKEN_PROGRAM_ADDRESS;
        const posterTokenAccount =
            params.posterTokenAccount ??
            (
                await findAssociatedTokenAddress(
                    params.poster,
                    params.mint,
                    tokenProgram,
                    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                )
            )[0];
        const mostActiveAgentTokenAccount =
            params.mostActiveAgentTokenAccount ??
            (
                await findAssociatedTokenAddress(
                    params.mostActiveAgent,
                    params.mint,
                    tokenProgram,
                    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                )
            )[0];
        const treasuryAta =
            params.treasuryAta ??
            (
                await findAssociatedTokenAddress(
                    params.treasury,
                    params.mint,
                    tokenProgram,
                    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                )
            )[0];
        const escrowAta =
            params.escrowAta ??
            (
                await findAssociatedTokenAddress(
                    params.escrow,
                    params.mint,
                    tokenProgram,
                    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                )
            )[0];
        return {
            isSpl: true,
            mint: params.mint,
            tokenProgram,
            posterTokenAccount,
            mostActiveAgentTokenAccount,
            treasuryAta,
            escrowAta,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
        };
    }
    async resolveRefundPairs(taskId, recipients, options) {
        if (!recipients || recipients.length === 0) {
            return { metas: [], addresses: [] };
        }
        const metas = [];
        const addresses = [];
        for (const recipient of recipients) {
            const [application] = await findApplicationPda(this.programAddress, taskId, recipient.agent);
            const destination =
                recipient.account ??
                (options.mint && options.tokenProgram
                    ? (
                          await findAssociatedTokenAddress(
                              recipient.agent,
                              options.mint,
                              options.tokenProgram,
                              ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                          )
                      )[0]
                    : recipient.agent);
            metas.push({
                address: application,
                role: AccountRole.READONLY,
            });
            metas.push({
                address: destination,
                role: AccountRole.WRITABLE,
            });
            addresses.push(application, destination);
        }
        return { metas, addresses };
    }
    async resolveSendOptions(wallet, taskId, remainingAddresses) {
        if (remainingAddresses.length <= LOOKUP_TABLE_THRESHOLD) {
            return undefined;
        }
        if (!wallet.ensureAddressLookupTable) {
            throw new Error(
                'remaining_accounts > 20 requires wallet adapter ensureAddressLookupTable support for v0 + ALT',
            );
        }
        const lookupTableAddress = await wallet.ensureAddressLookupTable({
            taskId,
            addresses: remainingAddresses,
        });
        if (!lookupTableAddress) {
            throw new Error('Failed to resolve address lookup table for oversized remaining_accounts');
        }
        return {
            useVersionedTransaction: true,
            addressLookupTableAddresses: [lookupTableAddress],
        };
    }
}
function sanitizeBaseUrl(value) {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}
const TEXT_ENCODER = new TextEncoder();
const LOOKUP_TABLE_THRESHOLD = 20;
const REPUTATION_DISCRIMINATOR = 0x05;
const PROGRAM_CONFIG_DISCRIMINATOR = 0x09;
export const SAS_PROGRAM_ID = '22zoJMtdu4rFKKrUQT8cNdqKouMXGMnqxdLY8nzaVmXq';
const SPL_TOKEN_PROGRAM_ADDRESS = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
async function findConfigPda(programAddress) {
    return getProgramDerivedAddress({ programAddress, seeds: [TEXT_ENCODER.encode('config')] });
}
async function findTaskPda(programAddress, taskId) {
    return getProgramDerivedAddress({
        programAddress,
        seeds: [TEXT_ENCODER.encode('task'), u64LeBytes(taskId)],
    });
}
async function findEscrowPda(programAddress, taskId) {
    return getProgramDerivedAddress({
        programAddress,
        seeds: [TEXT_ENCODER.encode('escrow'), u64LeBytes(taskId)],
    });
}
async function findJudgePoolPda(programAddress, category) {
    return getProgramDerivedAddress({
        programAddress,
        seeds: [TEXT_ENCODER.encode('judge_pool'), Uint8Array.of(category)],
    });
}
async function findApplicationPda(programAddress, taskId, agent) {
    return getProgramDerivedAddress({
        programAddress,
        seeds: [TEXT_ENCODER.encode('application'), u64LeBytes(taskId), getAddressEncoder().encode(agent)],
    });
}
async function findSubmissionPda(programAddress, taskId, agent) {
    return getProgramDerivedAddress({
        programAddress,
        seeds: [TEXT_ENCODER.encode('submission'), u64LeBytes(taskId), getAddressEncoder().encode(agent)],
    });
}
async function findReputationPda(programAddress, agent) {
    return getProgramDerivedAddress({
        programAddress,
        seeds: [TEXT_ENCODER.encode('reputation'), getAddressEncoder().encode(agent)],
    });
}
async function findStakePda(programAddress, judge) {
    return getProgramDerivedAddress({
        programAddress,
        seeds: [TEXT_ENCODER.encode('stake'), getAddressEncoder().encode(judge)],
    });
}
async function findTreasuryPda(programAddress) {
    return getProgramDerivedAddress({
        programAddress,
        seeds: [TEXT_ENCODER.encode('treasury')],
    });
}
async function findAssociatedTokenAddress(owner, mint, tokenProgram, associatedTokenProgram) {
    return getProgramDerivedAddress({
        programAddress: associatedTokenProgram,
        seeds: [
            getAddressEncoder().encode(owner),
            getAddressEncoder().encode(tokenProgram),
            getAddressEncoder().encode(mint),
        ],
    });
}
function u64LeBytes(value) {
    const bytes = new Uint8Array(8);
    let remaining = value;
    for (let i = 0; i < 8; i += 1) {
        bytes[i] = Number(remaining & 0xffn);
        remaining >>= 8n;
    }
    return bytes;
}
function addressToBytes(value) {
    if (!value) {
        return new Array(32).fill(0);
    }
    return Array.from(getAddressEncoder().encode(value));
}
function bytesToAddress(value) {
    const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
    return getAddressDecoder().decode(bytes);
}
function stripOptionalTail(instruction, optionalTailCount, placeholderAddress) {
    if (!instruction.accounts || optionalTailCount <= 0) {
        return instruction;
    }
    const pivot = instruction.accounts.length - optionalTailCount;
    if (pivot <= 0) {
        return instruction;
    }
    const required = instruction.accounts.slice(0, pivot);
    const optional = instruction.accounts
        .slice(pivot)
        // Codama's optional-account strategy ("programId") encodes omitted optionals
        // as readonly placeholders pointing at the program address.
        .filter(account => !isCodamaOptionalPlaceholder(account, placeholderAddress));
    return {
        ...instruction,
        accounts: [...required, ...optional],
    };
}
function removeAccountsAtIndexes(instruction, indexes) {
    if (!instruction.accounts || indexes.length === 0) {
        return instruction;
    }
    const omitted = new Set(indexes);
    return {
        ...instruction,
        accounts: instruction.accounts.filter((_, index) => !omitted.has(index)),
    };
}
function appendRemainingAccounts(instruction, remainingAccounts) {
    if (!instruction.accounts || remainingAccounts.length === 0) {
        return instruction;
    }
    return {
        ...instruction,
        accounts: [...instruction.accounts, ...remainingAccounts],
    };
}
function isCodamaOptionalPlaceholder(account, placeholderAddress) {
    return account.address === placeholderAddress && account.role === AccountRole.READONLY;
}
function parseReputationAccount(data) {
    const reader = new ByteReader(data);
    const discriminator = reader.readU8();
    if (discriminator !== REPUTATION_DISCRIMINATOR) {
        throw new Error(`Invalid reputation discriminator: ${discriminator}`);
    }
    reader.readU8(); // version
    const agent = bytesToAddress(reader.readFixedArray(32));
    const totalEarned = reader.readU64();
    const completed = reader.readU32();
    const totalApplied = reader.readU32();
    const avgScore = reader.readU16();
    const winRate = reader.readU16();
    const byCategory = [];
    for (let i = 0; i < MAX_CATEGORIES; i += 1) {
        byCategory.push({
            category: reader.readU8(),
            avgScore: reader.readU16(),
            completed: reader.readU32(),
        });
    }
    const bump = reader.readU8();
    return {
        agent,
        totalEarned,
        completed,
        totalApplied,
        avgScore,
        winRate,
        byCategory,
        bump,
    };
}
function parseProgramConfigAccount(data) {
    const reader = new ByteReader(data);
    const discriminator = reader.readU8();
    if (discriminator !== PROGRAM_CONFIG_DISCRIMINATOR) {
        throw new Error(`Invalid program config discriminator: ${discriminator}`);
    }
    reader.readU8(); // version
    const treasury = bytesToAddress(reader.readFixedArray(32));
    const upgradeAuthority = bytesToAddress(reader.readFixedArray(32));
    const minJudgeStake = reader.readU64();
    const taskCount = reader.readU64();
    const bump = reader.readU8();
    return {
        treasury,
        upgradeAuthority,
        minJudgeStake,
        taskCount,
        bump,
    };
}
export function normalizeTaskCompletionAttestation(attestation) {
    return {
        taskId: BigInt(attestation.task_id),
        taskCategory: attestation.task_category,
        judgeMethod: attestation.judge_method,
        score: attestation.score,
        rewardAmount: BigInt(attestation.reward_amount),
        completedAt: BigInt(attestation.completed_at),
        credential: attestation.credential,
        schema: attestation.schema,
        signature: attestation.signature,
    };
}
export function decodeTaskCompletionAttestation(raw) {
    const reader = new ByteReader(raw);
    return {
        taskId: reader.readU64(),
        taskCategory: reader.readU8(),
        judgeMethod: reader.readU8(),
        score: reader.readU8(),
        rewardAmount: reader.readU64(),
        completedAt: reader.readI64(),
    };
}
function isNotFoundError(error) {
    return (
        error instanceof Error &&
        (error.message.includes('Indexer request failed (404)') || error.message.includes('404'))
    );
}
const MAX_CATEGORIES = 8;
class ByteReader {
    data;
    view;
    offset = 0;
    constructor(data) {
        this.data = data;
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }
    readU8() {
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }
    readU16() {
        const value = this.view.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }
    readU32() {
        const value = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }
    readU64() {
        const value = this.view.getBigUint64(this.offset, true);
        this.offset += 8;
        return value;
    }
    readI64() {
        const value = this.view.getBigInt64(this.offset, true);
        this.offset += 8;
        return value;
    }
    readFixedArray(size) {
        const start = this.offset;
        this.offset += size;
        return this.data.slice(start, this.offset);
    }
}
