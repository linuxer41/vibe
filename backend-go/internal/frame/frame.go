package frame

import (
	"encoding/binary"
	"fmt"
)

const (
	HeaderSize = 14
	Magic      = 0xEB01
)

type Flags uint16

const (
	FlagNone     Flags = 0
	FlagRequest  Flags = 1
	FlagResponse Flags = 2
	FlagError    Flags = 4
	FlagMore     Flags = 8
)

const (
	TypePing = 1
	TypePong = 2
)

type Frame struct {
	Magic    uint16
	Type     uint16
	Flags    uint16
	StreamID uint32
	Length   uint32
	Payload  []byte
}

func Encode(frameType uint16, flags uint16, streamID uint32, payload []byte) []byte {
	if payload == nil {
		payload = []byte{}
	}
	buf := make([]byte, HeaderSize+len(payload))
	binary.BigEndian.PutUint16(buf[0:2], Magic)
	binary.BigEndian.PutUint16(buf[2:4], frameType)
	binary.BigEndian.PutUint16(buf[4:6], flags)
	binary.BigEndian.PutUint32(buf[6:10], streamID)
	binary.BigEndian.PutUint32(buf[10:14], uint32(len(payload)))
	copy(buf[14:], payload)
	return buf
}

func EncodeResponse(f *Frame, payload []byte) []byte {
	return Encode(f.Type, uint16(FlagResponse), f.StreamID, payload)
}

func EncodeError(f *Frame, errMsg string) []byte {
	return Encode(f.Type, uint16(FlagResponse|FlagError), f.StreamID, []byte(errMsg))
}

func Decode(buf []byte) (*Frame, error) {
	if len(buf) < HeaderSize {
		return nil, fmt.Errorf("frame too short: %d < %d", len(buf), HeaderSize)
	}
	magic := binary.BigEndian.Uint16(buf[0:2])
	if magic != Magic {
		return nil, fmt.Errorf("invalid magic: 0x%04X", magic)
	}
	payloadLen := binary.BigEndian.Uint32(buf[10:14])
	if uint32(len(buf)) < HeaderSize+payloadLen {
		return nil, fmt.Errorf("frame truncated: %d < %d", len(buf), HeaderSize+payloadLen)
	}
	return &Frame{
		Magic:    magic,
		Type:     binary.BigEndian.Uint16(buf[2:4]),
		Flags:    binary.BigEndian.Uint16(buf[4:6]),
		StreamID: binary.BigEndian.Uint32(buf[6:10]),
		Length:   payloadLen,
		Payload:  buf[14 : 14+payloadLen],
	}, nil
}

func PingFrame() []byte {
	return Encode(TypePing, 0, 0, nil)
}

func PongFrame() []byte {
	return Encode(TypePong, 0, 0, nil)
}
