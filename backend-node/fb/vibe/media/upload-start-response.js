import * as flatbuffers from "flatbuffers";
class UploadStartResponse {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsUploadStartResponse(bb, obj) {
    return (obj || new UploadStartResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsUploadStartResponse(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new UploadStartResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  ok() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
  }
  uploadId(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  error(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startUploadStartResponse(builder) {
    builder.startObject(3);
  }
  static addOk(builder, ok) {
    builder.addFieldInt8(0, +ok, 0);
  }
  static addUploadId(builder, uploadIdOffset) {
    builder.addFieldOffset(1, uploadIdOffset, 0);
  }
  static addError(builder, errorOffset) {
    builder.addFieldOffset(2, errorOffset, 0);
  }
  static endUploadStartResponse(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createUploadStartResponse(builder, ok, uploadIdOffset, errorOffset) {
    UploadStartResponse.startUploadStartResponse(builder);
    UploadStartResponse.addOk(builder, ok);
    UploadStartResponse.addUploadId(builder, uploadIdOffset);
    UploadStartResponse.addError(builder, errorOffset);
    return UploadStartResponse.endUploadStartResponse(builder);
  }
}
export {
  UploadStartResponse
};
