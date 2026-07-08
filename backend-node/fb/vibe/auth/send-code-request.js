import * as flatbuffers from "flatbuffers";
class SendCodeRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsSendCodeRequest(bb, obj) {
    return (obj || new SendCodeRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsSendCodeRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new SendCodeRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  phone(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startSendCodeRequest(builder) {
    builder.startObject(1);
  }
  static addPhone(builder, phoneOffset) {
    builder.addFieldOffset(0, phoneOffset, 0);
  }
  static endSendCodeRequest(builder) {
    const offset = builder.endObject();
    builder.requiredField(offset, 4);
    return offset;
  }
  static createSendCodeRequest(builder, phoneOffset) {
    SendCodeRequest.startSendCodeRequest(builder);
    SendCodeRequest.addPhone(builder, phoneOffset);
    return SendCodeRequest.endSendCodeRequest(builder);
  }
}
export {
  SendCodeRequest
};
