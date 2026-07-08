package auth

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/linuxer41/vibe/backend-go/internal/db"
	Vibe "github.com/linuxer41/vibe/backend-go/fb/Vibe"
	flatbuffers "github.com/google/flatbuffers/go"
)

type Handler struct {
	DB *db.Pool
}

type SendCodeRequest struct {
	Phone string `json:"phone"`
}

type SendCodeResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

type VerifyCodeRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

type VerifyCodeResponse struct {
	Success bool   `json:"success"`
	Token   string `json:"token,omitempty"`
	UserID  int64  `json:"user_id,omitempty"`
	Message string `json:"message,omitempty"`
}

type RestoreRequest struct {
	Token string `json:"token"`
}

type RestoreResponse struct {
	Success bool  `json:"success"`
	UserID  int64 `json:"user_id,omitempty"`
	Session *db.Session
}

func NewHandler(database *db.Pool) *Handler {
	return &Handler{DB: database}
}

func (h *Handler) SendCode(w http.ResponseWriter, r *http.Request) {
	var req SendCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success":false,"message":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if req.Phone == "" {
		http.Error(w, `{"success":false,"message":"phone required"}`, http.StatusBadRequest)
		return
	}
	if err := h.DB.SendCode(r.Context(), req.Phone); err != nil {
		http.Error(w, `{"success":false,"message":"failed to send code"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SendCodeResponse{Success: true})
}

func (h *Handler) VerifyCode(w http.ResponseWriter, r *http.Request) {
	var req VerifyCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success":false,"message":"invalid request"}`, http.StatusBadRequest)
		return
	}
	ok, err := h.DB.VerifyCode(r.Context(), req.Phone, req.Code)
	if err != nil || !ok {
		http.Error(w, `{"success":false,"message":"invalid or expired code"}`, http.StatusUnauthorized)
		return
	}
	user, err := h.DB.FindOrCreateUser(r.Context(), req.Phone)
	if err != nil {
		http.Error(w, `{"success":false,"message":"user error"}`, http.StatusInternalServerError)
		return
	}
	session, err := h.DB.CreateSession(r.Context(), user.ID)
	if err != nil {
		http.Error(w, `{"success":false,"message":"session error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(VerifyCodeResponse{
		Success: true,
		Token:   session.Token,
		UserID:  user.ID,
	})
}

func (h *Handler) Restore(w http.ResponseWriter, r *http.Request) {
	var req RestoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success":false,"message":"invalid request"}`, http.StatusBadRequest)
		return
	}
	session, err := h.DB.GetSession(r.Context(), req.Token)
	if err != nil {
		http.Error(w, `{"success":false,"message":"invalid session"}`, http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(RestoreResponse{
		Success: true,
		UserID:  session.UserID,
	})
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":     true,
		"server": "http-auth",
	})
}

func AuthenticateToken(ctx context.Context, database *db.Pool, token string) (*db.Session, error) {
	return database.GetSession(ctx, token)
}

func DecodeSendCodeRequest(data []byte) (*SendCodeRequest, error) {
	req := Vibe.GetRootAsSendCodeRequest(data, 0)
	return &SendCodeRequest{
		Phone: string(req.Phone()),
	}, nil
}

func BuildSendCodeResponse(success bool, message string) []byte {
	b := flatbuffers.NewBuilder(64)
	phone := b.CreateString(message)
	Vibe.SendCodeResponseStart(b)
	Vibe.SendCodeResponseAddSuccess(b, success)
	Vibe.SendCodeResponseAddMessage(b, phone)
	resp := Vibe.SendCodeResponseEnd(b)
	b.Finish(resp)
	return b.FinishedBytes()
}

func DecodeVerifyCodeRequest(data []byte) (*VerifyCodeRequest, error) {
	req := Vibe.GetRootAsVerifyCodeRequest(data, 0)
	return &VerifyCodeRequest{
		Phone: string(req.Phone()),
		Code:  string(req.Code()),
	}, nil
}

func BuildVerifyCodeResponse(success bool, token string, userID int64) []byte {
	b := flatbuffers.NewBuilder(128)
	tok := b.CreateString(token)
	Vibe.VerifyCodeResponseStart(b)
	Vibe.VerifyCodeResponseAddSuccess(b, success)
	Vibe.VerifyCodeResponseAddToken(b, tok)
	Vibe.VerifyCodeResponseAddUserId(b, userID)
	resp := Vibe.VerifyCodeResponseEnd(b)
	b.Finish(resp)
	return b.FinishedBytes()
}

func DecodeRestoreRequest(data []byte) (*RestoreRequest, error) {
	req := Vibe.GetRootAsRestoreSessionRequest(data, 0)
	return &RestoreRequest{
		Token: string(req.Token()),
	}, nil
}

func BuildRestoreResponse(success bool, userID int64) []byte {
	b := flatbuffers.NewBuilder(64)
	Vibe.RestoreSessionResponseStart(b)
	Vibe.RestoreSessionResponseAddSuccess(b, success)
	Vibe.RestoreSessionResponseAddUserId(b, userID)
	resp := Vibe.RestoreSessionResponseEnd(b)
	b.Finish(resp)
	return b.FinishedBytes()
}
