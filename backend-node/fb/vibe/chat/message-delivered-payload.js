import * as flatbuffers from "flatbuffers";
class MessageDeliveredPayload {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsMessageDeliveredPayload(bb, obj) {
    return (obj || new MessageDeliveredPayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsMessageDeliveredPayload(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new MessageDeliveredPayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  messageId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  senderId() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  static startMessageDeliveredPayload(builder) {
    builder.startObject(2);
  }
  static addMessageId(builder, messageId) {
    builder.addFieldInt64(0, messageId, BigInt("0"));
  }
  static addSenderId(builder, senderId) {
    builder.addFieldInt64(1, senderId, BigInt("0"));
  }
  static endMessageDeliveredPayload(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createMessageDeliveredPayload(builder, messageId, senderId) {
    MessageDeliveredPayload.startMessageDeliveredPayload(builder);
    MessageDeliveredPayload.addMessageId(builder, messageId);
    MessageDeliveredPayload.addSenderId(builder, senderId);
    return MessageDeliveredPayload.endMessageDeliveredPayload(builder);
  }
}
export {
  MessageDeliveredPayload
};
