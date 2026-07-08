import * as flatbuffers from "flatbuffers";
class CreateGroupResponse {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsCreateGroupResponse(bb, obj) {
    return (obj || new CreateGroupResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsCreateGroupResponse(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new CreateGroupResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  chatId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  memberIds(index) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint64(this.bb.__vector(this.bb_pos + offset) + index * 8) : BigInt(0);
  }
  memberIdsLength() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
  }
  static startCreateGroupResponse(builder) {
    builder.startObject(2);
  }
  static addChatId(builder, chatId) {
    builder.addFieldInt64(0, chatId, BigInt("0"));
  }
  static addMemberIds(builder, memberIdsOffset) {
    builder.addFieldOffset(1, memberIdsOffset, 0);
  }
  static createMemberIdsVector(builder, data) {
    builder.startVector(8, data.length, 8);
    for (let i = data.length - 1; i >= 0; i--) {
      builder.addInt64(data[i]);
    }
    return builder.endVector();
  }
  static startMemberIdsVector(builder, numElems) {
    builder.startVector(8, numElems, 8);
  }
  static endCreateGroupResponse(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createCreateGroupResponse(builder, chatId, memberIdsOffset) {
    CreateGroupResponse.startCreateGroupResponse(builder);
    CreateGroupResponse.addChatId(builder, chatId);
    CreateGroupResponse.addMemberIds(builder, memberIdsOffset);
    return CreateGroupResponse.endCreateGroupResponse(builder);
  }
}
export {
  CreateGroupResponse
};
