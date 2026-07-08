package main

import (
	"context"
	"encoding/binary"
	"io"
	"log"
	"net"
	"time"

	"github.com/linuxer41/vibe/backend-go/internal/connection"
	"github.com/linuxer41/vibe/backend-go/internal/frame"
	"github.com/linuxer41/vibe/backend-go/internal/protocol"
	"github.com/linuxer41/vibe/backend-go/internal/tracer"
)

const (
	authTimeout  = 5 * time.Second
	keepAlive    = 30 * time.Second
	maxFrameSize = 100 * 1024 * 1024
)

type tcpClient struct {
	conn    net.Conn
	session *connection.Session
	buf     []byte
}

func startTCPServer(cfg *Config) {
	addr := cfg.TCPHost + ":" + cfg.TCPPort
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("[tcp] listen error: %v", err)
	}
	log.Printf("[tcp] TCP server listening on %s", addr)
	defer listener.Close()

	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Printf("[tcp] accept error: %v", err)
			continue
		}
		go handleTCPConnection(conn, cfg)
	}
}

func handleTCPConnection(conn net.Conn, cfg *Config) {
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetKeepAlive(true)
		tcpConn.SetKeepAlivePeriod(keepAlive)
		tcpConn.SetNoDelay(true)
	}

	client := &tcpClient{
		conn: conn,
		buf:  make([]byte, 0, 4096),
	}

	peer := conn.RemoteAddr().String()
	tracer.ConnConnect("tcp", 0, peer)

	// Auth timeout: first frame must be AuthRestore within 5s
	conn.SetReadDeadline(time.Now().Add(authTimeout))
	raw, err := readFrame(conn, client)
	conn.SetReadDeadline(time.Time{})
	if err != nil {
		tracer.AuthEvent("tcp", 0, peer, false)
		log.Printf("[tcp] auth read error: %v", err)
		conn.Close()
		return
	}
	f, err := frame.Decode(raw)
	if err != nil || f.Type != 261 { // AuthRestore
		tracer.AuthEvent("tcp", 0, peer, false)
		log.Printf("[tcp] invalid auth frame from %s", peer)
		conn.Close()
		return
	}

	session, err := cfg.DB.GetSession(context.Background(), string(f.Payload))
	if err != nil {
		tracer.AuthEvent("tcp", 0, peer, false)
		log.Printf("[tcp] auth failed from %s", peer)
		conn.Write(frame.EncodeError(f, "auth failed"))
		conn.Close()
		return
	}

	tracer.AuthEvent("tcp", session.UserID, peer, true)

	s := &connection.Session{
		UserID:    session.UserID,
		SessionID: session.Token,
		Transport: connection.TransportTCP,
		Send: func(data []byte) error {
			_, err := conn.Write(data)
			return err
		},
	}
	client.session = s
	connection.Global().Add(s)
	cfg.DB.SetUserOnline(context.Background(), session.UserID, true)
	log.Printf("[tcp] user %d connected from %s", session.UserID, peer)

	// Send auth success
	conn.Write(frame.EncodeResponse(f, nil))

	defer func() {
		tracer.ConnDisconnect("tcp", session.UserID, peer)
		connection.Global().Remove(session.UserID, session.Token)
		cfg.DB.SetUserOnline(context.Background(), session.UserID, false)
		conn.Close()
		log.Printf("[tcp] user %d disconnected", session.UserID)
	}()

	for {
		raw, err := readFrame(conn, client)
		if err != nil {
			break
		}
		f, err := frame.Decode(raw)
		if err != nil {
			log.Printf("[tcp] frame decode error: %v", err)
			continue
		}
		tracer.MsgReceived("tcp", session.UserID, f.Type, len(raw))
		if f.Type == frame.TypePing {
			conn.Write(frame.PongFrame())
			continue
		}
		resp, err := protocol.Dispatch(context.Background(), f, s)
		if err != nil {
			log.Printf("[tcp] handler error: %v", err)
			continue
		}
		if resp != nil {
			if _, err := conn.Write(resp); err != nil {
				break
			}
		}
	}
}

func readFrame(conn net.Conn, client *tcpClient) ([]byte, error) {
	header := make([]byte, frame.HeaderSize)
	if _, err := io.ReadFull(conn, header); err != nil {
		return nil, err
	}
	payloadLen := binary.BigEndian.Uint32(header[10:14])
	if payloadLen > maxFrameSize {
		return nil, io.ErrUnexpectedEOF
	}
	buf := make([]byte, frame.HeaderSize+payloadLen)
	copy(buf, header)
	if payloadLen > 0 {
		if _, err := io.ReadFull(conn, buf[frame.HeaderSize:]); err != nil {
			return nil, err
		}
	}
	return buf, nil
}
