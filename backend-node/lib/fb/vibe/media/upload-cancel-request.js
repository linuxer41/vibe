import * as flatbuffers from "flatbuffers";
class UploadCancelRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsUploadCancelRequest(bb, obj) {
    return (obj || new UploadCancelRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsUploadCancelRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new UploadCancelRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  uploadId(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startUploadCancelRequest(builder) {
    builder.startObject(1);
  }
  static addUploadId(builder, uploadIdOffset) {
    builder.addFieldOffset(0, uploadIdOffset, 0);
  }
  static endUploadCancelRequest(builder) {
    const offset = builder.endObject();
    builder.requiredField(offset, 4);
    return offset;
  }
  static createUploadCancelRequest(builder, uploadIdOffset) {
    UploadCancelRequest.startUploadCancelRequest(builder);
    UploadCancelRequest.addUploadId(builder, uploadIdOffset);
    return UploadCancelRequest.endUploadCancelRequest(builder);
  }
}
export {
  UploadCancelRequest
};
