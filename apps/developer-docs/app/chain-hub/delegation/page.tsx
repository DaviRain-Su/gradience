export default function DelegationPage() {
    return (
        <div className="prose">
            <h1>Delegation Tasks</h1>
            <p>Chain Hub delegation tasks enable structured task assignment across the agent network.</p>
            <h2>State Machine</h2>
            <pre>
                <code>{`Created ──→ Active ──→ Completed
  │            │
  └→ Cancelled   └→ Expired`}</code>
            </pre>
            <h2>Instructions</h2>
            <table>
                <thead>
                    <tr>
                        <th>Instruction</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <code>create_delegation_task</code>
                        </td>
                        <td>Create task with skill, protocol, agent, judge</td>
                    </tr>
                    <tr>
                        <td>
                            <code>activate_delegation_task</code>
                        </td>
                        <td>Transition Created → Active</td>
                    </tr>
                    <tr>
                        <td>
                            <code>record_delegation_execution</code>
                        </td>
                        <td>Record execution, increment counter</td>
                    </tr>
                    <tr>
                        <td>
                            <code>complete_delegation_task</code>
                        </td>
                        <td>Mark as completed</td>
                    </tr>
                    <tr>
                        <td>
                            <code>cancel_delegation_task</code>
                        </td>
                        <td>Cancel task</td>
                    </tr>
                </tbody>
            </table>
            <h2>Account Layout</h2>
            <p>
                DelegationTaskAccount: 253 bytes, stores task_id, skill, protocol, agent, judge, deadline,
                execution_count, status.
            </p>
        </div>
    );
}
