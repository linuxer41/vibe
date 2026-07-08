import * as flatbuffers from "flatbuffers";
class MarkReadRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsMarkReadRequest(bb, obj) {
    return (obj || new MarkReadRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsMarkReadRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new MarkReadRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  messageId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  static startMarkReadRequest(builder) {
    builder.startObject(1);
  }
  static addMessageId(builder, messageId) {
    builder.addFieldInt64(0, messageId, BigInt("0"));
  }
  static endMarkReadRequest(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createMarkReadRequest(builder, messageId) {
    MarkReadRequest.startMarkReadRequest(builder);
    MarkReadRequest.addMessageId(builder, messageId);
    return MarkReadRequest.endMarkReadRequest(builder);
  }
}
export {
  MarkReadRequest
};
