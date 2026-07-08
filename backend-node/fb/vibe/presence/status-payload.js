import * as flatbuffers from "flatbuffers";
class StatusPayload {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsStatusPayload(bb, obj) {
    return (obj || new StatusPayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsStatusPayload(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new StatusPayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  userId() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt("0");
  }
  online() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
  }
  static startStatusPayload(builder) {
    builder.startObject(2);
  }
  static addUserId(builder, userId) {
    builder.addFieldInt64(0, userId, BigInt("0"));
  }
  static addOnline(builder, online) {
    builder.addFieldInt8(1, +online, 0);
  }
  static endStatusPayload(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createStatusPayload(builder, userId, online) {
    StatusPayload.startStatusPayload(builder);
    StatusPayload.addUserId(builder, userId);
    StatusPayload.addOnline(builder, online);
    return StatusPayload.endStatusPayload(builder);
  }
}
export {
  StatusPayload
};
