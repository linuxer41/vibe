import * as flatbuffers from "flatbuffers";
class UploadStartRequest {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsUploadStartRequest(bb, obj) {
    return (obj || new UploadStartRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsUploadStartRequest(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new UploadStartRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  name(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  mime(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  size() {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
  }
  totalChunks() {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
  }
  static startUploadStartRequest(builder) {
    builder.startObject(4);
  }
  static addName(builder, nameOffset) {
    builder.addFieldOffset(0, nameOffset, 0);
  }
  static addMime(builder, mimeOffset) {
    builder.addFieldOffset(1, mimeOffset, 0);
  }
  static addSize(builder, size) {
    builder.addFieldInt32(2, size, 0);
  }
  static addTotalChunks(builder, totalChunks) {
    builder.addFieldInt16(3, totalChunks, 0);
  }
  static endUploadStartRequest(builder) {
    const offset = builder.endObject();
    builder.requiredField(offset, 4);
    builder.requiredField(offset, 6);
    return offset;
  }
  static createUploadStartRequest(builder, nameOffset, mimeOffset, size, totalChunks) {
    UploadStartRequest.startUploadStartRequest(builder);
    UploadStartRequest.addName(builder, nameOffset);
    UploadStartRequest.addMime(builder, mimeOffset);
    UploadStartRequest.addSize(builder, size);
    UploadStartRequest.addTotalChunks(builder, totalChunks);
    return UploadStartRequest.endUploadStartRequest(builder);
  }
}
export {
  UploadStartRequest
};
