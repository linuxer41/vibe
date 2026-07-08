package tracer

import (
	"fmt"
	"log"
	"strings"
)

const (
	Inbound  = "\u2190"
	Outbound = "\u2192"
)

func KafkaProduce(topic, key string, value []byte) {
	log.Printf("[tracer] KAFKA %s %s key=%s %s", Outbound, topic, key, summarize(value))
}

func KafkaConsume(topic, key string, value []byte) {
	log.Printf("[tracer] KAFKA %s %s key=%s %s", Inbound, topic, key, summarize(value))
}

func ConnConnect(transport string, userID int64, peer string) {
	log.Printf("[tracer] %s %s user=%d from %s", strings.ToUpper(transport), Inbound, userID, peer)
}

func ConnDisconnect(transport string, userID int64, peer string) {
	log.Printf("[tracer] %s %s user=%d disconnected from %s", strings.ToUpper(transport), Outbound, userID, peer)
}

func MsgReceived(transport string, userID int64, msgType uint16, size int) {
	log.Printf("[tracer] %s %s user=%d type=%d size=%d", strings.ToUpper(transport), Inbound, userID, msgType, size)
}

func MsgSent(transport string, userID int64, msgType uint16, size int) {
	log.Printf("[tracer] %s %s user=%d type=%d size=%d", strings.ToUpper(transport), Outbound, userID, msgType, size)
}

func AuthEvent(transport string, userID int64, peer string, success bool) {
	if success {
		log.Printf("[tracer] AUTH OK %d %s via %s", userID, peer, transport)
	} else {
		log.Printf("[tracer] AUTH FAIL from %s via %s", peer, transport)
	}
}

func summarize(value []byte) string {
	if len(value) == 0 {
		return "(empty)"
	}
	s := tryExtractMsgpackFields(value)
	return s
}

func tryExtractMsgpackFields(data []byte) string {
	if len(data) == 0 {
		return "(empty)"
	}
	// fixmap
	first := data[0]
	if first >= 0x80 && first <= 0x8f {
		n := int(first & 0x0f)
		if n == 0 {
			return "{}"
		}
		p := 1
		var parts []string
		for i := 0; i < n && p < len(data); i++ {
			key, next, ok := decodeMPStr(data, p)
			if !ok {
				break
			}
			p = next
			val, next2, ok2 := decodeMPValue(data, p)
			if !ok2 {
				break
			}
			p = next2
			if isInterestingKey(key) {
				parts = append(parts, fmt.Sprintf("%s:%s", key, val))
			}
		}
		if len(parts) > 0 {
			return "{" + strings.Join(parts, " ") + "}"
		}
	}
	// Show hex preview
	previewLen := len(data)
	if previewLen > 32 {
		previewLen = 32
	}
	return fmt.Sprintf("raw[%db] 0x%x", len(data), data[:previewLen])
}

func isInterestingKey(key string) bool {
	switch key {
	case "chatId", "userId", "senderId", "messageId", "type", "online":
		return true
	}
	return false
}

func decodeMPStr(data []byte, off int) (string, int, bool) {
	if off >= len(data) {
		return "", off, false
	}
	b := data[off]
	// fixstr (0xa0-0xbf)
	if b >= 0xa0 && b <= 0xbf {
		l := int(b & 0x1f)
		if off+1+l > len(data) {
			return "", off, false
		}
		return string(data[off+1 : off+1+l]), off + 1 + l, true
	}
	// str8
	if b == 0xd9 && off+2 <= len(data) {
		l := int(data[off+1])
		if off+2+l > len(data) {
			return "", off, false
		}
		return string(data[off+2 : off+2+l]), off + 2 + l, true
	}
	// str16
	if b == 0xda && off+3 <= len(data) {
		l := int(data[off+1])<<8 | int(data[off+2])
		if off+3+l > len(data) {
			return "", off, false
		}
		return string(data[off+3 : off+3+l]), off + 3 + l, true
	}
	return "", off, false
}

func decodeMPValue(data []byte, off int) (string, int, bool) {
	if off >= len(data) {
		return "", off, false
	}
	b := data[off]
	// nil
	if b == 0xc0 {
		return "null", off + 1, true
	}
	// false/true
	if b == 0xc2 {
		return "false", off + 1, true
	}
	if b == 0xc3 {
		return "true", off + 1, true
	}
	// positive fixint
	if b <= 0x7f {
		return fmt.Sprintf("%d", b), off + 1, true
	}
	// negative fixint
	if b >= 0xe0 {
		return fmt.Sprintf("%d", int8(b)), off + 1, true
	}
	// fixstr
	if b >= 0xa0 && b <= 0xbf {
		return decodeMPStr(data, off)
	}
	// uint8
	if b == 0xcc && off+2 <= len(data) {
		return fmt.Sprintf("%d", data[off+1]), off + 2, true
	}
	// uint16
	if b == 0xcd && off+3 <= len(data) {
		v := uint32(data[off+1])<<8 | uint32(data[off+2])
		return fmt.Sprintf("%d", v), off + 3, true
	}
	// uint32
	if b == 0xce && off+5 <= len(data) {
		v := uint32(data[off+1])<<24 | uint32(data[off+2])<<16 | uint32(data[off+3])<<8 | uint32(data[off+4])
		return fmt.Sprintf("%d", v), off + 5, true
	}
	// int8
	if b == 0xd0 && off+2 <= len(data) {
		return fmt.Sprintf("%d", int8(data[off+1])), off + 2, true
	}
	// int16
	if b == 0xd1 && off+3 <= len(data) {
		v := int32(data[off+1])<<8 | int32(data[off+2])
		return fmt.Sprintf("%d", int16(v)), off + 3, true
	}
	// int32
	if b == 0xd2 && off+5 <= len(data) {
		v := int32(data[off+1])<<24 | int32(data[off+2])<<16 | int32(data[off+3])<<8 | int32(data[off+4])
		return fmt.Sprintf("%d", v), off + 5, true
	}
	// str8
	if b == 0xd9 {
		return decodeMPStr(data, off)
	}
	// str16
	if b == 0xda {
		return decodeMPStr(data, off)
	}
	// Skip unknown: return size
	return fmt.Sprintf("?"), off + 1, true
}
