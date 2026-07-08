package kafka

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

type Client struct {
	producer *kafka.Producer
	consumer *kafka.Consumer
	broker   string
}

func NewClient(broker string) (*Client, error) {
	p, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": broker,
	})
	if err != nil {
		return nil, fmt.Errorf("kafka producer: %w", err)
	}
	return &Client{
		producer: p,
		broker:   broker,
	}, nil
}

func (c *Client) StartConsumer(groupID string, topics []string, handler func(msgType string, key string, value []byte)) error {
	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":  c.broker,
		"group.id":           groupID,
		"auto.offset.reset":  "latest",
		"session.timeout.ms": 30000,
		"heartbeat.interval.ms": 3000,
	})
	if err != nil {
		return fmt.Errorf("kafka consumer: %w", err)
	}
	c.consumer = consumer
	if err := consumer.SubscribeTopics(topics, nil); err != nil {
		return fmt.Errorf("subscribe: %w", err)
	}
	go func() {
		log.Printf("[kafka] consumer started for topics: %v", topics)
		for {
			msg, err := consumer.ReadMessage(-1)
			if err != nil {
				log.Printf("[kafka] consume error: %v", err)
				time.Sleep(time.Second)
				continue
			}
			handler(string(*msg.TopicPartition.Topic), string(msg.Key), msg.Value)
		}
	}()
	return nil
}

func (c *Client) Publish(topic string, key string, value []byte) error {
	delivery := make(chan kafka.Event, 1)
	if err := c.producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Key:            []byte(key),
		Value:          value,
	}, delivery); err != nil {
		return fmt.Errorf("produce: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	select {
	case <-delivery:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (c *Client) Close() {
	if c.producer != nil {
		c.producer.Close()
	}
	if c.consumer != nil {
		c.consumer.Close()
	}
}
