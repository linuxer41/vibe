import * as flatbuffers from "flatbuffers";
class VerifyCodeRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsVerifyCodeRequest(bb, obj) {
    return (obj || new VerifyCodeRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsVerifyCodeRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new VerifyCodeRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  phone(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  code(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  username(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  displayName(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  countryCode(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startVerifyCodeRequest(builder) {
    builder.startObject(5);
  }
  static addPhone(builder, phoneOffset) {
    builder.addFieldOffset(0, phoneOffset, 0);
  }
  static addCode(builder, codeOffset) {
    builder.addFieldOffset(1, codeOffset, 0);
  }
  static addUsername(builder, usernameOffset) {
    builder.addFieldOffset(2, usernameOffset, 0);
  }
  static addDisplayName(builder, displayNameOffset) {
    builder.addFieldOffset(3, displayNameOffset, 0);
  }
  static addCountryCode(builder, countryCodeOffset) {
    builder.addFieldOffset(4, countryCodeOffset, 0);
  }
  static endVerifyCodeRequest(builder) {
    const offset = builder.endObject();
    builder.requiredField(offset, 4);
    builder.requiredField(offset, 6);
    return offset;
  }
  static createVerifyCodeRequest(builder, phoneOffset, codeOffset, usernameOffset, displayNameOffset, countryCodeOffset) {
    VerifyCodeRequest.startVerifyCodeRequest(builder);
    VerifyCodeRequest.addPhone(builder, phoneOffset);
    VerifyCodeRequest.addCode(builder, codeOffset);
    VerifyCodeRequest.addUsername(builder, usernameOffset);
    VerifyCodeRequest.addDisplayName(builder, displayNameOffset);
    VerifyCodeRequest.addCountryCode(builder, countryCodeOffset);
    return VerifyCodeRequest.endVerifyCodeRequest(builder);
  }
}
export {
  VerifyCodeRequest
};
