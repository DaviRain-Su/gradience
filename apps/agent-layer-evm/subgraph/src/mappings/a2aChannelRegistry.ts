import { ChannelCreated, MessageAnchored } from '../../generated/A2AChannelRegistry/A2AChannelRegistry';
import { Channel, MessageAnchor } from '../../generated/schema';

export function handleChannelCreated(event: ChannelCreated): void {
    let channelId = event.params.channelId.toHex();
    let channel = new Channel(channelId);
    channel.channelId = event.params.channelId;
    channel.participants = event.params.participants.map((a) => a.toHex());
    channel.createdAt = event.block.timestamp;
    channel.lastMessageHash = null;
    channel.lastAnchorAt = null;
    channel.exists = true;
    channel.save();
}

export function handleMessageAnchored(event: MessageAnchored): void {
    let channelId = event.params.channelId.toHex();
    let channel = Channel.load(channelId);
    if (channel) {
        channel.lastMessageHash = event.params.messageHash;
        channel.lastAnchorAt = event.block.timestamp;
        channel.save();
    }

    let anchorId = event.transaction.hash.toHex() + '-' + event.logIndex.toString();
    let anchor = new MessageAnchor(anchorId);
    anchor.channel = channelId;
    anchor.messageHash = event.params.messageHash;
    anchor.previousHash = event.params.previousHash;
    anchor.sender = event.params.sender;
    anchor.anchoredAt = event.block.timestamp;
    anchor.save();
}
