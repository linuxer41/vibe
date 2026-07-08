package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/linuxer41/vibe/backend-go/internal/connection"
	"github.com/linuxer41/vibe/backend-go/internal/frame"
	"github.com/linuxer41/vibe/backend-go/internal/protocol"
	"github.com/linuxer41/vibe/backend-go/internal/tracer"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func startWSServer(cfg *Config) {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		peer := r.RemoteAddr

		token := r.URL.Query().Get("token")
		if token == "" {
			tracer.AuthEvent("ws", 0, peer, false)
			http.Error(w, "token required", http.StatusUnauthorized)
			return
		}
		session, err := cfg.DB.GetSession(r.Context(), token)
		if err != nil {
			tracer.AuthEvent("ws", 0, peer, false)
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[ws] upgrade error: %v", err)
			return
		}
		s := &connection.Session{
			UserID:    session.UserID,
			SessionID: token,
			Transport: connection.TransportWS,
			Send: func(data []byte) error {
				return conn.WriteMessage(websocket.BinaryMessage, data)
			},
		}
		connection.Global().Add(s)
		cfg.DB.SetUserOnline(r.Context(), session.UserID, true)
		tracer.ConnConnect("ws", session.UserID, peer)
		log.Printf("[ws] user %d connected from %s", session.UserID, peer)

		pingTicker := time.NewTicker(30 * time.Second)
		defer func() {
			pingTicker.Stop()
			tracer.ConnDisconnect("ws", session.UserID, peer)
			connection.Global().Remove(session.UserID, token)
			cfg.DB.SetUserOnline(context.Background(), session.UserID, false)
			conn.Close()
			log.Printf("[ws] user %d disconnected", session.UserID)
		}()

		go func() {
			for range pingTicker.C {
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			}
		}()

		conn.SetPongHandler(func(string) error {
			return nil
		})

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				break
			}
			f, err := frame.Decode(msg)
			if err != nil {
				log.Printf("[ws] frame decode error: %v", err)
				continue
			}
			tracer.MsgReceived("ws", session.UserID, f.Type, len(msg))
			if f.Type == frame.TypePing {
				if err := conn.WriteMessage(websocket.BinaryMessage, frame.PongFrame()); err != nil {
					break
				}
				continue
			}
			resp, err := protocol.Dispatch(context.Background(), f, s)
			if err != nil {
				log.Printf("[ws] handler error: %v", err)
				continue
			}
			if resp != nil {
				if err := conn.WriteMessage(websocket.BinaryMessage, resp); err != nil {
					break
				}
			}
		}
	})

	addr := cfg.WSHost + ":" + cfg.WSPort
	log.Printf("[ws] WebSocket server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("[ws] server error: %v", err)
	}
}
