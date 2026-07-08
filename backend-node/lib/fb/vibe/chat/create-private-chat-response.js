import * as flatbuffers from "flatbuffers";
class CreatePrivateChatResponse {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsCreatePrivateChatResponse(bb, obj) {
    return (obj || new CreatePrivateChatResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsCreatePrivateChatResponse(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new CreatePrivateChatResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  chatId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  static startCreatePrivateChatResponse(builder) {
    builder.startObject(1);
  }
  static addChatId(builder, chatId) {
    builder.addFieldInt64(0, chatId, BigInt("0"));
  }
  static endCreatePrivateChatResponse(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createCreatePrivateChatResponse(builder, chatId) {
    CreatePrivateChatResponse.startCreatePrivateChatResponse(builder);
    CreatePrivateChatResponse.addChatId(builder, chatId);
    return CreatePrivateChatResponse.endCreatePrivateChatResponse(builder);
  }
}
export {
  CreatePrivateChatResponse
};
