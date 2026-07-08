import * as flatbuffers from "flatbuffers";
class SendCodeResponse {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsSendCodeResponse(bb, obj) {
    return (obj || new SendCodeResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsSendCodeResponse(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new SendCodeResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  ok() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
  }
  code(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  error(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startSendCodeResponse(builder) {
    builder.startObject(3);
  }
  static addOk(builder, ok) {
    builder.addFieldInt8(0, +ok, 0);
  }
  static addCode(builder, codeOffset) {
    builder.addFieldOffset(1, codeOffset, 0);
  }
  static addError(builder, errorOffset) {
    builder.addFieldOffset(2, errorOffset, 0);
  }
  static endSendCodeResponse(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createSendCodeResponse(builder, ok, codeOffset, errorOffset) {
    SendCodeResponse.startSendCodeResponse(builder);
    SendCodeResponse.addOk(builder, ok);
    SendCodeResponse.addCode(builder, codeOffset);
    SendCodeResponse.addError(builder, errorOffset);
    return SendCodeResponse.endSendCodeResponse(builder);
  }
}
export {
  SendCodeResponse
};
