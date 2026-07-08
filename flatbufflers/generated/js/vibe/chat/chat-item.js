import * as flatbuffers from "flatbuffers";
class ChatItem {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsChatItem(bb, obj) {
    return (obj || new ChatItem()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsChatItem(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new ChatItem()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  id() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  name(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  avatar(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  type() {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.readUint8(this.bb_pos + offset) : 0;
  }
  lastMessage(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  lastMessageTime() {
    const offset = this.bb.__offset(this.bb_pos, 14);
    return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
  }
  lastSenderId() {
    const offset = this.bb.__offset(this.bb_pos, 16);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  lastMessageStatus() {
    const offset = this.bb.__offset(this.bb_pos, 18);
    return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
  }
  unread() {
    const offset = this.bb.__offset(this.bb_pos, 20);
    return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
  }
  pinned() {
    const offset = this.bb.__offset(this.bb_pos, 22);
    return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
  }
  static startChatItem(builder) {
    builder.startObject(10);
  }
  static addId(builder, id) {
    builder.addFieldInt64(0, id, BigInt("0"));
  }
  static addName(builder, nameOffset) {
    builder.addFieldOffset(1, nameOffset, 0);
  }
  static addAvatar(builder, avatarOffset) {
    builder.addFieldOffset(2, avatarOffset, 0);
  }
  static addType(builder, type) {
    builder.addFieldInt8(3, type, 0);
  }
  static addLastMessage(builder, lastMessageOffset) {
    builder.addFieldOffset(4, lastMessageOffset, 0);
  }
  static addLastMessageTime(builder, lastMessageTime) {
    builder.addFieldInt32(5, lastMessageTime, 0);
  }
  static addLastSenderId(builder, lastSenderId) {
    builder.addFieldInt64(6, lastSenderId, BigInt("0"));
  }
  static addLastMessageStatus(builder, lastMessageStatus) {
    builder.addFieldInt16(7, lastMessageStatus, 0);
  }
  static addUnread(builder, unread) {
    builder.addFieldInt32(8, unread, 0);
  }
  static addPinned(builder, pinned) {
    builder.addFieldInt8(9, +pinned, 0);
  }
  static endChatItem(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createChatItem(builder, id, nameOffset, avatarOffset, type, lastMessageOffset, lastMessageTime, lastSenderId, lastMessageStatus, unread, pinned) {
    ChatItem.startChatItem(builder);
    ChatItem.addId(builder, id);
    ChatItem.addName(builder, nameOffset);
    ChatItem.addAvatar(builder, avatarOffset);
    ChatItem.addType(builder, type);
    ChatItem.addLastMessage(builder, lastMessageOffset);
    ChatItem.addLastMessageTime(builder, lastMessageTime);
    ChatItem.addLastSenderId(builder, lastSenderId);
    ChatItem.addLastMessageStatus(builder, lastMessageStatus);
    ChatItem.addUnread(builder, unread);
    ChatItem.addPinned(builder, pinned);
    return ChatItem.endChatItem(builder);
  }
}
export {
  ChatItem
};
