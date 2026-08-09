package auth

import (
	"context"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

type passwordResetUserRepository struct {
	repository.UserRepository
	queriedEmail string
}

func (r *passwordResetUserRepository) FindByEmail(_ context.Context, email string) (*model.User, error) {
	r.queriedEmail = email
	return nil, nil
}

func TestRequestPasswordResetNormalizesEmailBeforeLookup(t *testing.T) {
	repo := &passwordResetUserRepository{}
	service := &authService{userRepo: repo}

	if err := service.RequestPasswordReset(context.Background(), " User@Example.COM "); err != nil {
		t.Fatalf("RequestPasswordReset() error = %v", err)
	}
	if repo.queriedEmail != "user@example.com" {
		t.Fatalf("queried email = %q, want %q", repo.queriedEmail, "user@example.com")
	}
}
