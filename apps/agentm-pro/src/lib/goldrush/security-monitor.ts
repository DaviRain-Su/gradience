import type { WalletRiskReport } from './risk-scoring';

export interface SecurityAlert {
    code: 'drainer_approval' | 'lp_pull_risk' | 'phishing_airdrop' | 'high_risk_wallet';
    severity: 'warning' | 'critical';
    message: string;
    recommendation: string;
}

export function evaluateWalletSecurity(report: WalletRiskReport): SecurityAlert[] {
    const alerts: SecurityAlert[] = [];

    if (report.inputs.staleApprovals >= 3) {
        alerts.push({
            code: 'drainer_approval',
            severity: report.inputs.staleApprovals >= 5 ? 'critical' : 'warning',
            message: `${report.inputs.staleApprovals} stale token approvals detected`,
            recommendation: 'Revoke unused approvals before executing OTC transfers.',
        });
    }

    if (report.inputs.topHoldingRatio >= 0.8) {
        alerts.push({
            code: 'lp_pull_risk',
            severity: 'warning',
            message: 'Balance concentration is high and may amplify sudden LP pull risk',
            recommendation: 'Diversify token exposure and avoid thin-liquidity pairs.',
        });
    }

    if (report.inputs.suspiciousTxRatio >= 0.22) {
        alerts.push({
            code: 'phishing_airdrop',
            severity: 'warning',
            message: `Suspicious transfer ratio ${(report.inputs.suspiciousTxRatio * 100).toFixed(1)}%`,
            recommendation: 'Block unknown token airdrops and verify destination contracts.',
        });
    }

    if (report.riskScore >= 80) {
        alerts.push({
            code: 'high_risk_wallet',
            severity: 'critical',
            message: `Wallet risk score ${report.riskScore} indicates elevated compromise exposure`,
            recommendation: 'Enable manual review and pause automated settlement for this wallet.',
        });
    }

    return alerts;
}
