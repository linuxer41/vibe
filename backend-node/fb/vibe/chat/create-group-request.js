import * as flatbuffers from "flatbuffers";
class CreateGroupRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsCreateGroupRequest(bb, obj) {
    return (obj || new CreateGroupRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsCreateGroupRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new CreateGroupRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  name(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  memberIds(index) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint64(this.bb.__vector(this.bb_pos + offset) + index * 8) : BigInt(0);
  }
  memberIdsLength() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
  }
  static startCreateGroupRequest(builder) {
    builder.startObject(2);
  }
  static addName(builder, nameOffset) {
    builder.addFieldOffset(0, nameOffset, 0);
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
  static endCreateGroupRequest(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createCreateGroupRequest(builder, nameOffset, memberIdsOffset) {
    CreateGroupRequest.startCreateGroupRequest(builder);
    CreateGroupRequest.addName(builder, nameOffset);
    CreateGroupRequest.addMemberIds(builder, memberIdsOffset);
    return CreateGroupRequest.endCreateGroupRequest(builder);
  }
}
export {
  CreateGroupRequest
};
