package config

import "os"

type Config struct {
	DatabaseURL string
	WSHost      string
	WSPort      string
	TCPHost     string
	TCPPort     string
	HTTPHost    string
	HTTPPort    string
	ValkeyURL   string
	KafkaBroker string
	StorageURL  string
}

func Load() *Config {
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://user:password@localhost:5432/vibe"),
		WSHost:      getEnv("WS_HOST", "0.0.0.0"),
		WSPort:      getEnv("WS_PORT", "3000"),
		TCPHost:     getEnv("TCP_HOST", "0.0.0.0"),
		TCPPort:     getEnv("TCP_PORT", "4000"),
		HTTPHost:    getEnv("HTTP_HOST", "0.0.0.0"),
		HTTPPort:    getEnv("HTTP_PORT", "2000"),
		ValkeyURL:   getEnv("VALKEY_URL", "redis://127.0.0.1:6379"),
		KafkaBroker: getEnv("KAFKA_BROKER", "127.0.0.1:9092"),
		StorageURL:  getEnv("STORAGE_URL", "http://localhost:3002"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
