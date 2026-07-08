import * as flatbuffers from "flatbuffers";
class CreatePrivateChatRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsCreatePrivateChatRequest(bb, obj) {
    return (obj || new CreatePrivateChatRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsCreatePrivateChatRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new CreatePrivateChatRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  contactId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  static startCreatePrivateChatRequest(builder) {
    builder.startObject(1);
  }
  static addContactId(builder, contactId) {
    builder.addFieldInt64(0, contactId, BigInt("0"));
  }
  static endCreatePrivateChatRequest(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createCreatePrivateChatRequest(builder, contactId) {
    CreatePrivateChatRequest.startCreatePrivateChatRequest(builder);
    CreatePrivateChatRequest.addContactId(builder, contactId);
    return CreatePrivateChatRequest.endCreatePrivateChatRequest(builder);
  }
}
export {
  CreatePrivateChatRequest
};
