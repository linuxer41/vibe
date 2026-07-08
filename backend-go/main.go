package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/linuxer41/vibe/backend-go/internal/config"
	"github.com/linuxer41/vibe/backend-go/internal/connection"
	"github.com/linuxer41/vibe/backend-go/internal/db"
	"github.com/linuxer41/vibe/backend-go/internal/kafka"
	"github.com/linuxer41/vibe/backend-go/internal/protocol"
)

type Config struct {
	*config.Config
	DB    *db.Pool
	Kafka *kafka.Client
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("[main] Vibe Go Backend starting...")

	cfg := config.Load()

	database, err := db.Connect(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[main] database connection failed: %v", err)
	}
	defer database.Close()
	log.Println("[main] database connected")

	// Kafka
	kafkaClient, err := kafka.NewClient(cfg.KafkaBroker)
	if err != nil {
		log.Printf("[main] kafka not available, continuing without: %v", err)
	} else {
		defer kafkaClient.Close()
		if err := kafkaClient.StartConsumer("vibe-go-backend",
			[]string{"chat-messages", "chat-new", "user-presence"},
			func(msgType string, key string, value []byte) {
				log.Printf("[kafka] msg type=%s key=%s len=%d", msgType, key, len(value))
				connection.Global().Broadcast(value)
			},
		); err != nil {
			log.Printf("[main] kafka consumer error: %v", err)
		}
	}

	app := &Config{
		Config: cfg,
		DB:     database,
		Kafka:  kafkaClient,
	}

	protocol.RegisterAll(database)

	// Start all servers
	go startHTTPServer(app)
	go startWSServer(app)
	go startTCPServer(app)

	// Wait for signal
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Println("[main] shutting down...")
}
