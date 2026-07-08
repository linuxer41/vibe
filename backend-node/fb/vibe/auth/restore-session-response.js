import * as flatbuffers from "flatbuffers";
class RestoreSessionResponse {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsRestoreSessionResponse(bb, obj) {
    return (obj || new RestoreSessionResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsRestoreSessionResponse(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new RestoreSessionResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  ok() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
  }
  userId() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  displayName(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  phone(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  avatar(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  bio(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 14);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startRestoreSessionResponse(builder) {
    builder.startObject(6);
  }
  static addOk(builder, ok) {
    builder.addFieldInt8(0, +ok, 0);
  }
  static addUserId(builder, userId) {
    builder.addFieldInt64(1, userId, BigInt("0"));
  }
  static addDisplayName(builder, displayNameOffset) {
    builder.addFieldOffset(2, displayNameOffset, 0);
  }
  static addPhone(builder, phoneOffset) {
    builder.addFieldOffset(3, phoneOffset, 0);
  }
  static addAvatar(builder, avatarOffset) {
    builder.addFieldOffset(4, avatarOffset, 0);
  }
  static addBio(builder, bioOffset) {
    builder.addFieldOffset(5, bioOffset, 0);
  }
  static endRestoreSessionResponse(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createRestoreSessionResponse(builder, ok, userId, displayNameOffset, phoneOffset, avatarOffset, bioOffset) {
    RestoreSessionResponse.startRestoreSessionResponse(builder);
    RestoreSessionResponse.addOk(builder, ok);
    RestoreSessionResponse.addUserId(builder, userId);
    RestoreSessionResponse.addDisplayName(builder, displayNameOffset);
    RestoreSessionResponse.addPhone(builder, phoneOffset);
    RestoreSessionResponse.addAvatar(builder, avatarOffset);
    RestoreSessionResponse.addBio(builder, bioOffset);
    return RestoreSessionResponse.endRestoreSessionResponse(builder);
  }
}
export {
  RestoreSessionResponse
};
