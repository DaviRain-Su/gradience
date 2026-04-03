export default function ArenaStatePage() {
    return (
        <div className="prose">
            <h1>Arena State Accounts</h1>
            <table>
                <thead><tr><th>Account</th><th>PDA Seeds</th><th>Key Fields</th></tr></thead>
                <tbody>
                    <tr><td>ProgramConfig</td><td><code>{`["config"]`}</code></td><td>task_count, min_judge_stake, upgrade_authority, treasury</td></tr>
                    <tr><td>Task</td><td><code>{`["task", task_id]`}</code></td><td>poster, judge, reward, state (Open/Completed/Refunded), deadline</td></tr>
                    <tr><td>Escrow</td><td><code>{`["escrow", task_id]`}</code></td><td>task_id, mint, amount</td></tr>
                    <tr><td>Application</td><td><code>{`["application", task_id, agent]`}</code></td><td>stake_amount, applied_at</td></tr>
                    <tr><td>Submission</td><td><code>{`["submission", task_id, agent]`}</code></td><td>result_ref, trace_ref, runtime_env</td></tr>
                    <tr><td>Reputation</td><td><code>{`["reputation", agent]`}</code></td><td>avg_score, completed, win_rate, total_earned</td></tr>
                    <tr><td>Stake</td><td><code>{`["stake", judge]`}</code></td><td>amount, deposited_at, last_unstake_requested_at</td></tr>
                    <tr><td>JudgePool</td><td><code>{`["judge_pool", category]`}</code></td><td>entries (max 200), total_weight</td></tr>
                </tbody>
            </table>
            <h2>Task State Machine</h2>
            <pre><code>{`Open ──→ Completed (judge_and_pay, score >= 60)
  │
  ├──→ Refunded (cancel_task / refund_expired / force_refund / low score)`}</code></pre>
        </div>
    );
}
