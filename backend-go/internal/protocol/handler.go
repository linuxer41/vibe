package protocol

import (
	"context"
	"log"

	"github.com/linuxer41/vibe/backend-go/internal/connection"
	"github.com/linuxer41/vibe/backend-go/internal/db"
	"github.com/linuxer41/vibe/backend-go/internal/frame"
)

type HandlerFunc func(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error)

var handlers = make(map[uint16]HandlerFunc)

func Register(msgType uint16, fn HandlerFunc) {
	if _, ok := handlers[msgType]; ok {
		log.Printf("[proto] warning: duplicate handler for type %d", msgType)
	}
	handlers[msgType] = fn
}

func Dispatch(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error) {
	if fn, ok := handlers[f.Type]; ok {
		return fn(ctx, f, s)
	}
	return frame.EncodeError(f, "unknown message type"), nil
}

func RegisterAll(database *db.Pool) {
	RegisterPing()
	RegisterAuth(database)
	RegisterChat(database)
	RegisterPresence(database)
	RegisterMedia(database)
}

func RegisterPing() {
	Register(1, func(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error) {
		return frame.PongFrame(), nil
	})
}

func RegisterAuth(database *db.Pool) {
	Register(257, func(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error) {
		return frame.EncodeError(f, "auth over HTTP only"), nil
	})
	Register(259, func(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error) {
		return frame.EncodeError(f, "auth over HTTP only"), nil
	})
	Register(261, func(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error) {
		return frame.EncodeError(f, "auth over HTTP only"), nil
	})
}

func RegisterChat(database *db.Pool) {
	Register(513, func(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error) {
		return frame.EncodeResponse(f, []byte(`{"status":"ok"}`)), nil
	})
	Register(516, func(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error) {
		return frame.EncodeResponse(f, []byte(`{"chats":[]}`)), nil
	})
	Register(518, func(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error) {
		return frame.EncodeResponse(f, []byte(`{"messages":[]}`)), nil
	})
}

func RegisterPresence(database *db.Pool) {
	Register(769, func(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error) {
		return frame.EncodeResponse(f, []byte(`{"status":"ok"}`)), nil
	})
}

func RegisterMedia(database *db.Pool) {
	Register(1025, func(ctx context.Context, f *frame.Frame, s *connection.Session) ([]byte, error) {
		return frame.EncodeError(f, "upload not implemented"), nil
	})
}
