package kafka

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/linuxer41/vibe/backend-go/internal/tracer"
	"github.com/segmentio/kafka-go"
)

var requiredTopics = []string{"chat-messages", "chat-new", "chat-events", "user-presence"}

type Client struct {
	writer   *kafka.Writer
	reader   *kafka.Reader
	broker   string
	once     sync.Once
}

func NewClient(broker string) (*Client, error) {
	return &Client{
		broker: broker,
	}, nil
}

func (c *Client) ensureTopics() {
	conn, err := kafka.Dial("tcp", c.broker)
	if err != nil {
		log.Printf("[kafka] dial error: %v", err)
		return
	}
	defer conn.Close()

	controller, err := conn.Controller()
	if err != nil {
		log.Printf("[kafka] controller error: %v", err)
		return
	}
	controllerConn, err := kafka.Dial("tcp", fmt.Sprintf("%s:%d", controller.Host, controller.Port))
	if err != nil {
		log.Printf("[kafka] controller dial error: %v", err)
		return
	}
	defer controllerConn.Close()

	existing, err := controllerConn.ReadPartitions()
	if err != nil {
		log.Printf("[kafka] read partitions error: %v", err)
		return
	}
	existingMap := make(map[string]bool)
	for _, p := range existing {
		existingMap[p.Topic] = true
	}

	var missing []string
	for _, t := range requiredTopics {
		if !existingMap[t] {
			missing = append(missing, t)
		}
	}
	if len(missing) > 0 {
		topicConfigs := make([]kafka.TopicConfig, len(missing))
		for i, t := range missing {
			topicConfigs[i] = kafka.TopicConfig{
				Topic:             t,
				NumPartitions:     3,
				ReplicationFactor: 1,
			}
		}
		err = controllerConn.CreateTopics(topicConfigs...)
		if err != nil {
			log.Printf("[kafka] create topics error: %v", err)
			return
		}
		log.Printf("[kafka] topics created: %v", missing)
	} else {
		log.Printf("[kafka] topics already exist")
	}
}

func (c *Client) StartConsumer(groupID string, topics []string, handler func(msgType string, key string, value []byte)) error {
	c.ensureTopics()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        []string{c.broker},
		GroupID:        groupID,
		GroupTopics:    topics,
		MinBytes:       1,
		MaxBytes:       100 * 1024 * 1024,
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})
	c.reader = reader

	go func() {
		log.Printf("[kafka] consumer started for topics: %v", topics)
		for {
			msg, err := reader.ReadMessage(context.Background())
			if err != nil {
				log.Printf("[kafka] consume error: %v", err)
				time.Sleep(time.Second)
				continue
			}
			tracer.KafkaConsume(msg.Topic, string(msg.Key), msg.Value)
			handler(msg.Topic, string(msg.Key), msg.Value)
		}
	}()
	return nil
}

func (c *Client) Publish(topic string, key string, value []byte) error {
	tracer.KafkaProduce(topic, key, value)
	c.once.Do(func() {
		c.writer = &kafka.Writer{
			Addr:     kafka.TCP(c.broker),
			Balancer: &kafka.LeastBytes{},
		}
	})
	err := c.writer.WriteMessages(context.Background(),
		kafka.Message{
			Topic: topic,
			Key:   []byte(key),
			Value: value,
		},
	)
	if err != nil {
		return fmt.Errorf("produce: %w", err)
	}
	return nil
}

func (c *Client) Close() {
	if c.reader != nil {
		c.reader.Close()
	}
	if c.writer != nil {
		c.writer.Close()
	}
}
