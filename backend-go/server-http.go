package main

import (
	"log"
	"net/http"

	"github.com/linuxer41/vibe/backend-go/internal/auth"
)

func startHTTPServer(cfg *Config) {
	handler := auth.NewHandler(cfg.DB)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /auth/send-code", handler.SendCode)
	mux.HandleFunc("POST /auth/verify-code", handler.VerifyCode)
	mux.HandleFunc("POST /auth/restore", handler.Restore)
	mux.HandleFunc("GET /health", handler.Health)

	addr := cfg.HTTPHost + ":" + cfg.HTTPPort
	log.Printf("[http] auth server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("[http] server error: %v", err)
	}
}
