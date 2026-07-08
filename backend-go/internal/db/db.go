package db

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Pool struct {
	*pgxpool.Pool
}

type Session struct {
	UserID    int64
	Token     string
	CreatedAt time.Time
}

type User struct {
	ID        int64
	Phone     string
	Name      string
	CreatedAt time.Time
}

func Connect(ctx context.Context, databaseURL string) (*Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	cfg.MaxConns = 20
	cfg.MinConns = 2
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}
	return &Pool{Pool: pool}, nil
}

func (p *Pool) GetSession(ctx context.Context, token string) (*Session, error) {
	var s Session
	err := p.QueryRow(ctx,
		`SELECT user_id, token, created_at FROM sessions WHERE token = $1 AND expires_at > NOW()`,
		token,
	).Scan(&s.UserID, &s.Token, &s.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (p *Pool) FindOrCreateUser(ctx context.Context, phone string) (*User, error) {
	var u User
	err := p.QueryRow(ctx,
		`INSERT INTO users (phone, name) VALUES ($1, $2)
		 ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
		 RETURNING id, phone, name, created_at`,
		phone, phone,
	).Scan(&u.ID, &u.Phone, &u.Name, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("find or create user: %w", err)
	}
	return &u, nil
}

func (p *Pool) CreateSession(ctx context.Context, userID int64) (*Session, error) {
	var s Session
	err := p.QueryRow(ctx,
		`INSERT INTO sessions (user_id, token, expires_at)
		 VALUES ($1, gen_random_uuid()::text, NOW() + INTERVAL '30 days')
		 RETURNING user_id, token, created_at`,
		userID,
	).Scan(&s.UserID, &s.Token, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}
	return &s, nil
}

func (p *Pool) SendCode(ctx context.Context, phone string) error {
	_, err := p.Exec(ctx,
		`INSERT INTO verification_codes (phone, code, expires_at)
		 VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
		 ON CONFLICT (phone) DO UPDATE SET code = $2, expires_at = NOW() + INTERVAL '5 minutes'`,
		phone, fmt.Sprintf("%06d", time.Now().UnixNano()%1000000),
	)
	return err
}

func (p *Pool) VerifyCode(ctx context.Context, phone, code string) (bool, error) {
	var id int64
	err := p.QueryRow(ctx,
		`DELETE FROM verification_codes
		 WHERE phone = $1 AND code = $2 AND expires_at > NOW()
		 RETURNING id`,
		phone, code,
	).Scan(&id)
	if err != nil {
		return false, nil
	}
	return true, nil
}

func (p *Pool) SetUserOnline(ctx context.Context, userID int64, online bool) error {
	_, err := p.Exec(ctx,
		`UPDATE users SET last_seen = NOW(), is_online = $1 WHERE id = $2`,
		online, userID,
	)
	return err
}

func (p *Pool) GetUser(ctx context.Context, userID int64) (*User, error) {
	var u User
	err := p.QueryRow(ctx,
		`SELECT id, phone, name, created_at FROM users WHERE id = $1`,
		userID,
	).Scan(&u.ID, &u.Phone, &u.Name, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (p *Pool) CleanTempFiles(ctx context.Context, olderThan time.Duration) error {
	cutoff := time.Now().Add(-olderThan)
	_, err := p.Exec(ctx,
		`DELETE FROM temp_uploads WHERE created_at < $1`, cutoff,
	)
	return err
}

func (p *Pool) Close() {
	p.Pool.Close()
}

func SanitizeText(s string) string {
	if len(s) > 10000 {
		s = s[:10000]
	}
	return strings.Map(func(r rune) rune {
		if r < 32 && r != '\n' && r != '\t' {
			return -1
		}
		return r
	}, s)
}
