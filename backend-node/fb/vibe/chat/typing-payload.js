import * as flatbuffers from "flatbuffers";
class TypingPayload {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsTypingPayload(bb, obj) {
    return (obj || new TypingPayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsTypingPayload(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new TypingPayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  chatId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  userId() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  name(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startTypingPayload(builder) {
    builder.startObject(3);
  }
  static addChatId(builder, chatId) {
    builder.addFieldInt64(0, chatId, BigInt("0"));
  }
  static addUserId(builder, userId) {
    builder.addFieldInt64(1, userId, BigInt("0"));
  }
  static addName(builder, nameOffset) {
    builder.addFieldOffset(2, nameOffset, 0);
  }
  static endTypingPayload(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createTypingPayload(builder, chatId, userId, nameOffset) {
    TypingPayload.startTypingPayload(builder);
    TypingPayload.addChatId(builder, chatId);
    TypingPayload.addUserId(builder, userId);
    TypingPayload.addName(builder, nameOffset);
    return TypingPayload.endTypingPayload(builder);
  }
}
export {
  TypingPayload
};
