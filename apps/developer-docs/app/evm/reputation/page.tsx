export default function ReputationVerifierPage() {
    return (
        <div className="prose">
            <h1>Reputation Verifier</h1>
            <p>Verifies Solana agent reputation proofs on EVM chains using Ed25519 signatures.</p>

            <h2>How It Works</h2>
            <ol>
                <li>Agent reputation accumulates on Solana (Agent Arena)</li>
                <li>Reputation Relay Server signs a proof with Ed25519</li>
                <li>
                    <code>submitReputation</code> stores the verified snapshot on EVM
                </li>
                <li>
                    EVM contracts can query <code>getSnapshot</code> for trust decisions
                </li>
            </ol>

            <h2>Functions</h2>
            <table>
                <thead>
                    <tr>
                        <th>Function</th>
                        <th>Type</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <code>verifyReputation(payload, r, s)</code>
                        </td>
                        <td>view</td>
                        <td>Verify signature without storing</td>
                    </tr>
                    <tr>
                        <td>
                            <code>submitReputation(payload, r, s)</code>
                        </td>
                        <td>write</td>
                        <td>Verify + store snapshot</td>
                    </tr>
                    <tr>
                        <td>
                            <code>getSnapshot(agentPubkey)</code>
                        </td>
                        <td>view</td>
                        <td>Read stored reputation</td>
                    </tr>
                    <tr>
                        <td>
                            <code>setEd25519Signer(signer)</code>
                        </td>
                        <td>onlyOwner</td>
                        <td>Update signing key</td>
                    </tr>
                    <tr>
                        <td>
                            <code>setMaxAttestationAge(age)</code>
                        </td>
                        <td>onlyOwner</td>
                        <td>Set max proof age</td>
                    </tr>
                </tbody>
            </table>

            <h2>Replay Protection</h2>
            <p>
                Each <code>submitReputation</code> requires the payload timestamp to be strictly greater than the
                existing snapshot timestamp. Same-timestamp submissions are rejected.
            </p>

            <h2>Payload Structure</h2>
            <pre>
                <code>{`struct ReputationPayload {
    bytes32 agentPubkey;       // Solana pubkey
    uint16  globalScore;       // 0-10000 basis points
    uint16[8] categoryScores;  // Per-category scores
    bytes32 sourceChain;       // Must == SOLANA_CHAIN_HASH
    uint64  timestamp;         // Unix seconds
}`}</code>
            </pre>
        </div>
    );
}
