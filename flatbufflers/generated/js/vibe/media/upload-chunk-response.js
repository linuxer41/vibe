import * as flatbuffers from "flatbuffers";
class UploadChunkResponse {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsUploadChunkResponse(bb, obj) {
    return (obj || new UploadChunkResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsUploadChunkResponse(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new UploadChunkResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  ok() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
  }
  received() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
  }
  total() {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
  }
  url(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  error(optionalEncoding) {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
  }
  static startUploadChunkResponse(builder) {
    builder.startObject(5);
  }
  static addOk(builder, ok) {
    builder.addFieldInt8(0, +ok, 0);
  }
  static addReceived(builder, received) {
    builder.addFieldInt32(1, received, 0);
  }
  static addTotal(builder, total) {
    builder.addFieldInt32(2, total, 0);
  }
  static addUrl(builder, urlOffset) {
    builder.addFieldOffset(3, urlOffset, 0);
  }
  static addError(builder, errorOffset) {
    builder.addFieldOffset(4, errorOffset, 0);
  }
  static endUploadChunkResponse(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createUploadChunkResponse(builder, ok, received, total, urlOffset, errorOffset) {
    UploadChunkResponse.startUploadChunkResponse(builder);
    UploadChunkResponse.addOk(builder, ok);
    UploadChunkResponse.addReceived(builder, received);
    UploadChunkResponse.addTotal(builder, total);
    UploadChunkResponse.addUrl(builder, urlOffset);
    UploadChunkResponse.addError(builder, errorOffset);
    return UploadChunkResponse.endUploadChunkResponse(builder);
  }
}
export {
  UploadChunkResponse
};
