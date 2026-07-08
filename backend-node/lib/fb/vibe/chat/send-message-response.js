import * as flatbuffers from "flatbuffers";
class SendMessageResponse {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsSendMessageResponse(bb, obj) {
    return (obj || new SendMessageResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsSendMessageResponse(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new SendMessageResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  messageId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  createdAt() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
  }
  static startSendMessageResponse(builder) {
    builder.startObject(2);
  }
  static addMessageId(builder, messageId) {
    builder.addFieldInt64(0, messageId, BigInt("0"));
  }
  static addCreatedAt(builder, createdAt) {
    builder.addFieldInt32(1, createdAt, 0);
  }
  static endSendMessageResponse(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createSendMessageResponse(builder, messageId, createdAt) {
    SendMessageResponse.startSendMessageResponse(builder);
    SendMessageResponse.addMessageId(builder, messageId);
    SendMessageResponse.addCreatedAt(builder, createdAt);
    return SendMessageResponse.endSendMessageResponse(builder);
  }
}
export {
  SendMessageResponse
};
