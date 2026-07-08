import * as flatbuffers from "flatbuffers";
class Message {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsMessage(bb, obj) {
    return (obj || new Message()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsMessage(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new Message()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  id() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  chatId() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  senderId() {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  senderName(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  senderAvatar(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  text(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 14);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  contentType() {
    const offset = this.bb.__offset(this.bb_pos, 16);
    return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
  }
  createdAt() {
    const offset = this.bb.__offset(this.bb_pos, 18);
    return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
  }
  status() {
    const offset = this.bb.__offset(this.bb_pos, 20);
    return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
  }
  replyToId() {
    const offset = this.bb.__offset(this.bb_pos, 22);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  forwarded() {
    const offset = this.bb.__offset(this.bb_pos, 24);
    return offset ? this.bb.readUint8(this.bb_pos + offset) : 0;
  }
  static startMessage(builder) {
    builder.startObject(11);
  }
  static addId(builder, id) {
    builder.addFieldInt64(0, id, BigInt("0"));
  }
  static addChatId(builder, chatId) {
    builder.addFieldInt64(1, chatId, BigInt("0"));
  }
  static addSenderId(builder, senderId) {
    builder.addFieldInt64(2, senderId, BigInt("0"));
  }
  static addSenderName(builder, senderNameOffset) {
    builder.addFieldOffset(3, senderNameOffset, 0);
  }
  static addSenderAvatar(builder, senderAvatarOffset) {
    builder.addFieldOffset(4, senderAvatarOffset, 0);
  }
  static addText(builder, textOffset) {
    builder.addFieldOffset(5, textOffset, 0);
  }
  static addContentType(builder, contentType) {
    builder.addFieldInt16(6, contentType, 0);
  }
  static addCreatedAt(builder, createdAt) {
    builder.addFieldInt32(7, createdAt, 0);
  }
  static addStatus(builder, status) {
    builder.addFieldInt16(8, status, 0);
  }
  static addReplyToId(builder, replyToId) {
    builder.addFieldInt64(9, replyToId, BigInt("0"));
  }
  static addForwarded(builder, forwarded) {
    builder.addFieldInt8(10, forwarded, 0);
  }
  static endMessage(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createMessage(builder, id, chatId, senderId, senderNameOffset, senderAvatarOffset, textOffset, contentType, createdAt, status, replyToId, forwarded) {
    Message.startMessage(builder);
    Message.addId(builder, id);
    Message.addChatId(builder, chatId);
    Message.addSenderId(builder, senderId);
    Message.addSenderName(builder, senderNameOffset);
    Message.addSenderAvatar(builder, senderAvatarOffset);
    Message.addText(builder, textOffset);
    Message.addContentType(builder, contentType);
    Message.addCreatedAt(builder, createdAt);
    Message.addStatus(builder, status);
    Message.addReplyToId(builder, replyToId);
    Message.addForwarded(builder, forwarded);
    return Message.endMessage(builder);
  }
}
export {
  Message
};
