import * as flatbuffers from "flatbuffers";
class MessageStatusPayload {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsMessageStatusPayload(bb, obj) {
    return (obj || new MessageStatusPayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsMessageStatusPayload(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new MessageStatusPayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  messageId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  status() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
  }
  static startMessageStatusPayload(builder) {
    builder.startObject(2);
  }
  static addMessageId(builder, messageId) {
    builder.addFieldInt64(0, messageId, BigInt("0"));
  }
  static addStatus(builder, status) {
    builder.addFieldInt16(1, status, 0);
  }
  static endMessageStatusPayload(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createMessageStatusPayload(builder, messageId, status) {
    MessageStatusPayload.startMessageStatusPayload(builder);
    MessageStatusPayload.addMessageId(builder, messageId);
    MessageStatusPayload.addStatus(builder, status);
    return MessageStatusPayload.endMessageStatusPayload(builder);
  }
}
export {
  MessageStatusPayload
};
