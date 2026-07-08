import * as flatbuffers from "flatbuffers";
import { Message } from "../../vibe/chat/message.js";
class NewMessagePayload {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsNewMessagePayload(bb, obj) {
    return (obj || new NewMessagePayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsNewMessagePayload(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new NewMessagePayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  chatId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  chatName(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  chatAvatar(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  chatType() {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.readUint8(this.bb_pos + offset) : 0;
  }
  unread() {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
  }
  message(obj) {
    const offset = this.bb.__offset(this.bb_pos, 14);
    return offset ? (obj || new Message()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
  }
  static startNewMessagePayload(builder) {
    builder.startObject(6);
  }
  static addChatId(builder, chatId) {
    builder.addFieldInt64(0, chatId, BigInt("0"));
  }
  static addChatName(builder, chatNameOffset) {
    builder.addFieldOffset(1, chatNameOffset, 0);
  }
  static addChatAvatar(builder, chatAvatarOffset) {
    builder.addFieldOffset(2, chatAvatarOffset, 0);
  }
  static addChatType(builder, chatType) {
    builder.addFieldInt8(3, chatType, 0);
  }
  static addUnread(builder, unread) {
    builder.addFieldInt32(4, unread, 0);
  }
  static addMessage(builder, messageOffset) {
    builder.addFieldOffset(5, messageOffset, 0);
  }
  static endNewMessagePayload(builder) {
    const offset = builder.endObject();
    builder.requiredField(offset, 14);
    return offset;
  }
}
export {
  NewMessagePayload
};
