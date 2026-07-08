import * as flatbuffers from "flatbuffers";
class DeleteMessageRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsDeleteMessageRequest(bb, obj) {
    return (obj || new DeleteMessageRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsDeleteMessageRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new DeleteMessageRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  messageId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  chatId() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  static startDeleteMessageRequest(builder) {
    builder.startObject(2);
  }
  static addMessageId(builder, messageId) {
    builder.addFieldInt64(0, messageId, BigInt("0"));
  }
  static addChatId(builder, chatId) {
    builder.addFieldInt64(1, chatId, BigInt("0"));
  }
  static endDeleteMessageRequest(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createDeleteMessageRequest(builder, messageId, chatId) {
    DeleteMessageRequest.startDeleteMessageRequest(builder);
    DeleteMessageRequest.addMessageId(builder, messageId);
    DeleteMessageRequest.addChatId(builder, chatId);
    return DeleteMessageRequest.endDeleteMessageRequest(builder);
  }
}
export {
  DeleteMessageRequest
};
