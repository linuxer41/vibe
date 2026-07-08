import * as flatbuffers from "flatbuffers";
import { Message } from "../../vibe/chat/message.js";
class GetMessagesResponse {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsGetMessagesResponse(bb, obj) {
    return (obj || new GetMessagesResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsGetMessagesResponse(bb, obj) {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
    return (obj || new GetMessagesResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  messages(index, obj) {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? (obj || new Message()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
  }
  messagesLength() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
  }
  static startGetMessagesResponse(builder) {
    builder.startObject(1);
  }
  static addMessages(builder, messagesOffset) {
    builder.addFieldOffset(0, messagesOffset, 0);
  }
  static createMessagesVector(builder, data) {
    builder.startVector(4, data.length, 4);
    for (let i = data.length - 1; i >= 0; i--) {
      builder.addOffset(data[i]);
    }
    return builder.endVector();
  }
  static startMessagesVector(builder, numElems) {
    builder.startVector(4, numElems, 4);
  }
  static endGetMessagesResponse(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createGetMessagesResponse(builder, messagesOffset) {
    GetMessagesResponse.startGetMessagesResponse(builder);
    GetMessagesResponse.addMessages(builder, messagesOffset);
    return GetMessagesResponse.endGetMessagesResponse(builder);
  }
}
export {
  GetMessagesResponse
};
