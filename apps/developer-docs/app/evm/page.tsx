export default function EVMBridgePage() {
    return (
        <div className="prose">
            <h1>EVM Bridge</h1>
            <p>Cross-chain reputation verification and task management on Base Sepolia.</p>

            <h2>Contracts</h2>
            <table>
                <thead>
                    <tr>
                        <th>Contract</th>
                        <th>Purpose</th>
                        <th>Solidity</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>AgentLayerRaceTask</td>
                        <td>Task escrow + judge + pay (ETH)</td>
                        <td>^0.8.24</td>
                    </tr>
                    <tr>
                        <td>ReputationVerifier</td>
                        <td>Ed25519 cross-chain reputation proofs</td>
                        <td>^0.6.8</td>
                    </tr>
                    <tr>
                        <td>Ed25519</td>
                        <td>Pure Solidity signature verification</td>
                        <td>library</td>
                    </tr>
                    <tr>
                        <td>Sha512</td>
                        <td>SHA-512 hash library</td>
                        <td>library</td>
                    </tr>
                </tbody>
            </table>

            <h2>Task Lifecycle (EVM)</h2>
            <pre>
                <code>{`post_task(payable) → apply_for_task(payable) → submit_result → judge_and_pay
  └→ claim_expired (refund after deadline)
  └→ cancel_task (poster, 2% fee)`}</code>
            </pre>

            <h2>Differences from Solana</h2>
            <table>
                <thead>
                    <tr>
                        <th>Feature</th>
                        <th>Solana</th>
                        <th>EVM</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Payment</td>
                        <td>SOL / Token-2022</td>
                        <td>ETH only</td>
                    </tr>
                    <tr>
                        <td>Judge Pool</td>
                        <td>On-chain random selection</td>
                        <td>Poster-designated</td>
                    </tr>
                    <tr>
                        <td>Reputation</td>
                        <td>PDA accounts</td>
                        <td>mapping(address ={'>'} Reputation)</td>
                    </tr>
                    <tr>
                        <td>Cross-chain</td>
                        <td>N/A</td>
                        <td>Ed25519 proof verification</td>
                    </tr>
                </tbody>
            </table>

            <h2>Test Coverage</h2>
            <p>17 tests covering all contract functions, replay protection, and edge cases.</p>
        </div>
    );
}
