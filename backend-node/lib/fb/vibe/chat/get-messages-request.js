import * as flatbuffers from "flatbuffers";
class GetMessagesRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsGetMessagesRequest(bb, obj) {
    return (obj || new GetMessagesRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsGetMessagesRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new GetMessagesRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  chatId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  limit() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
  }
  cursor() {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  static startGetMessagesRequest(builder) {
    builder.startObject(3);
  }
  static addChatId(builder, chatId) {
    builder.addFieldInt64(0, chatId, BigInt("0"));
  }
  static addLimit(builder, limit) {
    builder.addFieldInt16(1, limit, 0);
  }
  static addCursor(builder, cursor) {
    builder.addFieldInt64(2, cursor, BigInt("0"));
  }
  static endGetMessagesRequest(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createGetMessagesRequest(builder, chatId, limit, cursor) {
    GetMessagesRequest.startGetMessagesRequest(builder);
    GetMessagesRequest.addChatId(builder, chatId);
    GetMessagesRequest.addLimit(builder, limit);
    GetMessagesRequest.addCursor(builder, cursor);
    return GetMessagesRequest.endGetMessagesRequest(builder);
  }
}
export {
  GetMessagesRequest
};
