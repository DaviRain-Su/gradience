import { User, ProtocolMetric } from '../../generated/schema';
import { Address, BigInt } from '@graphprotocol/graph-ts';

export function getOrCreateUser(address: Address): User {
    let id = address.toHex();
    let user = User.load(id);
    if (!user) {
        user = new User(id);
        user.address = address;
        user.save();
    }
    return user;
}

export function getProtocolMetric(): ProtocolMetric {
    let metric = ProtocolMetric.load('singleton');
    if (!metric) {
        metric = new ProtocolMetric('singleton');
        metric.totalTasks = BigInt.zero();
        metric.totalCompletedTasks = BigInt.zero();
        metric.totalRefundedTasks = BigInt.zero();
        metric.totalDisputes = BigInt.zero();
        metric.totalProtocolFeesETH = BigInt.zero();
        metric.totalProtocolFeesToken = BigInt.zero();
        metric.updatedAt = BigInt.zero();
        metric.save();
    }
    return metric;
}
