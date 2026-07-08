import * as flatbuffers from "flatbuffers";
class RestoreSessionRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsRestoreSessionRequest(bb, obj) {
    return (obj || new RestoreSessionRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsRestoreSessionRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new RestoreSessionRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  token(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startRestoreSessionRequest(builder) {
    builder.startObject(1);
  }
  static addToken(builder, tokenOffset) {
    builder.addFieldOffset(0, tokenOffset, 0);
  }
  static endRestoreSessionRequest(builder) {
    const offset = builder.endObject();
    builder.requiredField(offset, 4);
    return offset;
  }
  static createRestoreSessionRequest(builder, tokenOffset) {
    RestoreSessionRequest.startRestoreSessionRequest(builder);
    RestoreSessionRequest.addToken(builder, tokenOffset);
    return RestoreSessionRequest.endRestoreSessionRequest(builder);
  }
}
export {
  RestoreSessionRequest
};
