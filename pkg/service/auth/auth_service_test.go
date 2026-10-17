package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/security"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

type passwordResetUserRepository struct {
	repository.UserRepository
	queriedEmail string
}

type loginUserRepository struct {
	repository.UserRepository
	user *model.User
}

func (r loginUserRepository) FindByEmail(context.Context, string) (*model.User, error) {
	return r.user, nil
}
func (r loginUserRepository) Update(context.Context, *model.User) error { return nil }

func TestLoginDoesNotDiscloseAccountStateForWrongPassword(t *testing.T) {
	hash, err := security.HashPassword("correct-password")
	if err != nil {
		t.Fatal(err)
	}
	for _, account := range []*model.User{nil,
		{Status: model.UserStatusActive, PasswordHash: hash},
		{Status: model.UserStatusInactive, PasswordHash: hash},
		{Status: model.UserStatusBanned, PasswordHash: hash},
	} {
		svc := &authService{userRepo: loginUserRepository{user: account}}
		if _, err := svc.Login(context.Background(), "user@example.com", "wrong-password"); !errors.Is(err, ErrInvalidCredentials) {
			t.Fatalf("invalid password disclosed account status: user=%v err=%v", account, err)
		}
	}
}

func TestLoginStillWorksWhenRegistrationDisabled(t *testing.T) {
	hash, err := security.HashPassword("correct-password")
	if err != nil {
		t.Fatal(err)
	}
	account := &model.User{Status: model.UserStatusActive, PasswordHash: hash}
	svc := &authService{userRepo: loginUserRepository{user: account}, settingSvc: registrationSettings{enabled: "false"}}
	if user, err := svc.Login(context.Background(), "user@example.com", "correct-password"); err != nil || user != account {
		t.Fatalf("existing account login blocked: user=%v err=%v", user, err)
	}
}

type registrationSettings struct {
	setting.SettingService
	enabled string
}

func (s registrationSettings) Get(key string) string {
	if key == constant.KeyEnableRegistration.String() {
		return s.enabled
	}
	return "false"
}

type registrationUserRepository struct {
	repository.UserRepository
	queries  int
	countErr error
}

func (r *registrationUserRepository) FindByEmail(context.Context, string) (*model.User, error) {
	r.queries++
	return nil, nil
}

func (r *registrationUserRepository) Count(context.Context) (int64, error) {
	return 1, r.countErr
}

func TestRegisterRejectsDisabledRegistrationBeforeDatabaseAccess(t *testing.T) {
	for _, enabled := range []string{"false", "", "invalid"} {
		t.Run(enabled, func(t *testing.T) {
			repo := &registrationUserRepository{countErr: errors.New("database should not be queried")}
			svc := &authService{userRepo: repo, settingSvc: registrationSettings{enabled: enabled}}
			activationRequired, err := svc.Register(context.Background(), "user@example.com", "User", "password")
			if err == nil || err.Error() != "站点已关闭注册" || activationRequired || repo.queries != 0 {
				t.Fatalf("disabled registration: activation=%v err=%v queries=%d", activationRequired, err, repo.queries)
			}
		})
	}
}

func TestRegisterContinuesWhenRegistrationEnabled(t *testing.T) {
	stop := errors.New("registration reached user repository")
	repo := &registrationUserRepository{countErr: stop}
	svc := &authService{userRepo: repo, settingSvc: registrationSettings{enabled: "true"}}
	if _, err := svc.Register(context.Background(), "user@example.com", "User", "password"); !errors.Is(err, stop) {
		t.Fatalf("enabled registration did not continue: %v", err)
	}
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
