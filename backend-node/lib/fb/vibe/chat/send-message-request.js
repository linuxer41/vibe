import * as flatbuffers from "flatbuffers";
class SendMessageRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsSendMessageRequest(bb, obj) {
    return (obj || new SendMessageRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsSendMessageRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new SendMessageRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  chatId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  text(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  contentType() {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
  }
  replyToId() {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  static startSendMessageRequest(builder) {
    builder.startObject(4);
  }
  static addChatId(builder, chatId) {
    builder.addFieldInt64(0, chatId, BigInt("0"));
  }
  static addText(builder, textOffset) {
    builder.addFieldOffset(1, textOffset, 0);
  }
  static addContentType(builder, contentType) {
    builder.addFieldInt16(2, contentType, 0);
  }
  static addReplyToId(builder, replyToId) {
    builder.addFieldInt64(3, replyToId, BigInt("0"));
  }
  static endSendMessageRequest(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createSendMessageRequest(builder, chatId, textOffset, contentType, replyToId) {
    SendMessageRequest.startSendMessageRequest(builder);
    SendMessageRequest.addChatId(builder, chatId);
    SendMessageRequest.addText(builder, textOffset);
    SendMessageRequest.addContentType(builder, contentType);
    SendMessageRequest.addReplyToId(builder, replyToId);
    return SendMessageRequest.endSendMessageRequest(builder);
  }
}
export {
  SendMessageRequest
};
