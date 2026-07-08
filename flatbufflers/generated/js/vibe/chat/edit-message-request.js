import * as flatbuffers from "flatbuffers";
class EditMessageRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsEditMessageRequest(bb, obj) {
    return (obj || new EditMessageRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsEditMessageRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new EditMessageRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  messageId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  chatId() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  text(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startEditMessageRequest(builder) {
    builder.startObject(3);
  }
  static addMessageId(builder, messageId) {
    builder.addFieldInt64(0, messageId, BigInt("0"));
  }
  static addChatId(builder, chatId) {
    builder.addFieldInt64(1, chatId, BigInt("0"));
  }
  static addText(builder, textOffset) {
    builder.addFieldOffset(2, textOffset, 0);
  }
  static endEditMessageRequest(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createEditMessageRequest(builder, messageId, chatId, textOffset) {
    EditMessageRequest.startEditMessageRequest(builder);
    EditMessageRequest.addMessageId(builder, messageId);
    EditMessageRequest.addChatId(builder, chatId);
    EditMessageRequest.addText(builder, textOffset);
    return EditMessageRequest.endEditMessageRequest(builder);
  }
}
export {
  EditMessageRequest
};
