package connection

import (
	"log"
	"sync"
)

type Transport string

const (
	TransportWS  Transport = "ws"
	TransportTCP Transport = "tcp"
)

type SendFunc func(data []byte) error

type Session struct {
	UserID    int64
	SessionID string
	Transport Transport
	Send      SendFunc
}

type Manager struct {
	mu       sync.RWMutex
	sessions map[int64]map[string]*Session // userID -> sessionID -> Session
}

var global *Manager
var once sync.Once

func Global() *Manager {
	once.Do(func() {
		global = &Manager{
			sessions: make(map[int64]map[string]*Session),
		}
	})
	return global
}

func (m *Manager) Add(s *Session) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.sessions[s.UserID]; !ok {
		m.sessions[s.UserID] = make(map[string]*Session)
	}
	m.sessions[s.UserID][s.SessionID] = s
	log.Printf("[cm] user %d connected via %s (session %s)", s.UserID, s.Transport, s.SessionID)
}

func (m *Manager) Remove(userID int64, sessionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if sessions, ok := m.sessions[userID]; ok {
		delete(sessions, sessionID)
		if len(sessions) == 0 {
			delete(m.sessions, userID)
		}
	}
}

func (m *Manager) Get(userID int64, sessionID string) *Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if sessions, ok := m.sessions[userID]; ok {
		return sessions[sessionID]
	}
	return nil
}

func (m *Manager) SendToUser(userID int64, data []byte) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if sessions, ok := m.sessions[userID]; ok {
		for _, s := range sessions {
			if err := s.Send(data); err != nil {
				log.Printf("[cm] send error to user %d: %v", userID, err)
			}
		}
	}
}

func (m *Manager) Broadcast(data []byte) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, sessions := range m.sessions {
		for _, s := range sessions {
			if err := s.Send(data); err != nil {
				log.Printf("[cm] broadcast error: %v", err)
			}
		}
	}
}

func (m *Manager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	count := 0
	for _, sessions := range m.sessions {
		count += len(sessions)
	}
	return count
}

func (m *Manager) IsOnline(userID int64) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	sessions, ok := m.sessions[userID]
	return ok && len(sessions) > 0
}
