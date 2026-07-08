import * as flatbuffers from "flatbuffers";
class VerifyCodeResponse {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsVerifyCodeResponse(bb, obj) {
    return (obj || new VerifyCodeResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsVerifyCodeResponse(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new VerifyCodeResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  ok() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
  }
  token(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  userId() {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  displayName(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  avatar(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  isNew() {
    const offset = this.bb.__offset(this.bb_pos, 14);
    return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
  }
  error(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 16);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startVerifyCodeResponse(builder) {
    builder.startObject(7);
  }
  static addOk(builder, ok) {
    builder.addFieldInt8(0, +ok, 0);
  }
  static addToken(builder, tokenOffset) {
    builder.addFieldOffset(1, tokenOffset, 0);
  }
  static addUserId(builder, userId) {
    builder.addFieldInt64(2, userId, BigInt("0"));
  }
  static addDisplayName(builder, displayNameOffset) {
    builder.addFieldOffset(3, displayNameOffset, 0);
  }
  static addAvatar(builder, avatarOffset) {
    builder.addFieldOffset(4, avatarOffset, 0);
  }
  static addIsNew(builder, isNew) {
    builder.addFieldInt8(5, +isNew, 0);
  }
  static addError(builder, errorOffset) {
    builder.addFieldOffset(6, errorOffset, 0);
  }
  static endVerifyCodeResponse(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createVerifyCodeResponse(builder, ok, tokenOffset, userId, displayNameOffset, avatarOffset, isNew, errorOffset) {
    VerifyCodeResponse.startVerifyCodeResponse(builder);
    VerifyCodeResponse.addOk(builder, ok);
    VerifyCodeResponse.addToken(builder, tokenOffset);
    VerifyCodeResponse.addUserId(builder, userId);
    VerifyCodeResponse.addDisplayName(builder, displayNameOffset);
    VerifyCodeResponse.addAvatar(builder, avatarOffset);
    VerifyCodeResponse.addIsNew(builder, isNew);
    VerifyCodeResponse.addError(builder, errorOffset);
    return VerifyCodeResponse.endVerifyCodeResponse(builder);
  }
}
export {
  VerifyCodeResponse
};
