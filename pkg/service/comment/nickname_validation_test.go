package comment

import (
	"context"
	"errors"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/handler/comment/dto"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/parser"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

type nicknameSettings struct {
	setting.SettingService
	values map[string]string
}

func (s nicknameSettings) Get(key string) string { return s.values[key] }
func (s nicknameSettings) GetBool(key string) bool {
	return s.values[key] == "true"
}

type nicknameComments struct {
	repository.CommentRepository
	created []*repository.CreateCommentParams
}

func (r *nicknameComments) Create(_ context.Context, params *repository.CreateCommentParams) (*model.Comment, error) {
	saved := *params
	r.created = append(r.created, &saved)
	return &model.Comment{
		ID:            uint(len(r.created)),
		TargetPath:    params.TargetPath,
		ParentID:      params.ParentID,
		ReplyToID:     params.ReplyToID,
		Author:        model.Author{Nickname: params.Nickname},
		Content:       params.Content,
		ContentHTML:   params.ContentHTML,
		Status:        model.Status(params.Status),
		IsAnonymous:   params.IsAnonymous,
		IsAdminAuthor: params.IsAdminComment,
	}, nil
}

func (r *nicknameComments) FindByID(_ context.Context, id uint) (*model.Comment, error) {
	return &model.Comment{ID: id, TargetPath: "/posts/test"}, nil
}

type nicknameUsers struct {
	repository.UserRepository
	user *model.User
}

func (r nicknameUsers) FindByID(context.Context, uint) (*model.User, error) {
	return r.user, nil
}

func newNicknameService(t *testing.T, values map[string]string) (*Service, *nicknameComments) {
	t.Helper()
	if err := idgen.InitSqidsEncoder(); err != nil {
		t.Fatal(err)
	}
	settings := nicknameSettings{values: values}
	bus := event.NewEventBus()
	t.Cleanup(bus.Shutdown)
	comments := &nicknameComments{}
	return &Service{
		repo:       comments,
		settingSvc: settings,
		parserSvc:  parser.NewService(settings, bus),
	}, comments
}

func TestCreateChecksNicknameForbiddenWords(t *testing.T) {
	for _, tc := range []struct {
		name     string
		words    string
		nickname string
		content  string
		rejected bool
	}{
		{name: "Chinese substring", words: "广告", nickname: "广告推广员", rejected: true},
		{name: "English case insensitive", words: "sPaM", nickname: "UserSPAM123", rejected: true},
		{name: "newline separated", words: "其他\n广告", nickname: "广告推广员", rejected: true},
		{name: "English comma separated", words: "其他,广告", nickname: "广告推广员", rejected: true},
		{name: "Chinese comma separated", words: "其他，广告", nickname: "广告推广员", rejected: true},
		{name: "spaces and CRLF", words: " \r\n, ，\t其他 \r\n 广告 \t，", nickname: "广告推广员", rejected: true},
		{name: "literal punctuation", words: "a.*b", nickname: "用户a.*b", rejected: true},
		{name: "not regular expression", words: "a.*b", nickname: "aXXb"},
		{name: "unmatched", words: "广告,spam", nickname: "普通访客"},
		{name: "empty list", nickname: "广告推广员"},
		{name: "only separators", words: " \r\n, ，\t", nickname: "广告推广员"},
		{name: "nickname words only in body", words: "广告", nickname: "普通访客", content: "这段正文提到了广告"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, comments := newNicknameService(t, map[string]string{
				constant.KeyCommentNicknameForbiddenWords.String(): tc.words,
			})
			content := tc.content
			if content == "" {
				content = "正常评论"
			}
			result, err := svc.Create(context.Background(), &dto.CreateRequest{
				TargetPath: "/posts/test",
				Nickname:   tc.nickname,
				Content:    content,
			}, "", "", "", nil)
			if tc.rejected {
				if !errors.Is(err, ErrForbiddenNickname) || result != nil {
					t.Fatalf("result=%+v error=%v, want nickname rejection", result, err)
				}
				if len(comments.created) != 0 {
					t.Fatalf("rejected nickname reached persistence: %+v", comments.created)
				}
				return
			}
			if err != nil || result == nil || len(comments.created) != 1 {
				t.Fatalf("allowed comment failed: result=%+v error=%v created=%d", result, err, len(comments.created))
			}
			if result.Nickname != tc.nickname || comments.created[0].Status != int(model.StatusPublished) {
				t.Fatalf("allowed comment was changed: result=%+v saved=%+v", result, comments.created[0])
			}
		})
	}
}

func TestCreateRejectsForbiddenNicknameForAllIdentitiesAndReplies(t *testing.T) {
	for _, identity := range []struct {
		name      string
		user      *model.User
		anonymous bool
	}{
		{name: "guest"},
		{name: "anonymous", anonymous: true},
		{name: "logged in", user: &model.User{ID: 2, Email: "user@example.com", UserGroup: model.UserGroup{ID: 2}}},
		{name: "admin", user: &model.User{ID: 1, Email: "admin@example.com", UserGroup: model.UserGroup{ID: 1}}},
	} {
		for _, reply := range []bool{false, true} {
			name := identity.name + "/root"
			if reply {
				name = identity.name + "/reply"
			}
			t.Run(name, func(t *testing.T) {
				svc, comments := newNicknameService(t, map[string]string{
					constant.KeyCommentNicknameForbiddenWords.String(): "广告",
					constant.KeyCommentForbiddenWords.String():         "正文",
					constant.KeyCommentAIDetectEnable.String():         "true",
				})
				req := &dto.CreateRequest{
					TargetPath:  "/posts/test",
					Nickname:    "广告推广员",
					Content:     "正文",
					IsAnonymous: identity.anonymous,
				}
				var claims *auth.CustomClaims
				if identity.user != nil {
					userID, err := idgen.GeneratePublicID(identity.user.ID, idgen.EntityTypeUser)
					if err != nil {
						t.Fatal(err)
					}
					claims = &auth.CustomClaims{UserID: userID}
					req.Email = &identity.user.Email
					svc.userRepo = nicknameUsers{user: identity.user}
				}
				if reply {
					parentID, err := idgen.GeneratePublicID(1, idgen.EntityTypeComment)
					if err != nil {
						t.Fatal(err)
					}
					req.ParentID = &parentID
					req.ReplyToID = &parentID
				}
				result, err := svc.Create(context.Background(), req, "", "", "", claims)
				if !errors.Is(err, ErrForbiddenNickname) || result != nil || len(comments.created) != 0 {
					t.Fatalf("nickname bypassed rejection: result=%+v error=%v created=%d", result, err, len(comments.created))
				}
				req.Nickname = "普通访客"
				result, err = svc.Create(context.Background(), req, "", "", "", claims)
				if err != nil || result == nil || len(comments.created) != 1 {
					t.Fatalf("valid nickname failed: result=%+v error=%v created=%d", result, err, len(comments.created))
				}
				saved := comments.created[0]
				wantAdmin := identity.user != nil && identity.user.UserGroup.ID == 1
				if (saved.ParentID != nil) != reply || saved.IsAnonymous != identity.anonymous || saved.IsAdminComment != wantAdmin {
					t.Fatalf("comment identity or reply changed: %+v", saved)
				}
			})
		}
	}
}

func TestCreateUsesUpdatedNicknameRulesAndKeepsContentModeration(t *testing.T) {
	values := map[string]string{
		constant.KeyCommentNicknameForbiddenWords.String(): "广告",
		constant.KeyCommentForbiddenWords.String():         "正文违禁词",
	}
	svc, comments := newNicknameService(t, values)
	req := &dto.CreateRequest{
		TargetPath: "/posts/test",
		Nickname:   "广告推广员",
		Content:    "包含正文违禁词",
	}
	if _, err := svc.Create(context.Background(), req, "", "", "", nil); !errors.Is(err, ErrForbiddenNickname) {
		t.Fatalf("configured nickname rule was ignored: %v", err)
	}
	values[constant.KeyCommentNicknameForbiddenWords.String()] = ""
	result, err := svc.Create(context.Background(), req, "", "", "", nil)
	if err != nil || result == nil || len(comments.created) != 1 {
		t.Fatalf("clearing nickname rules did not allow submission: result=%+v error=%v", result, err)
	}
	if comments.created[0].Status != int(model.StatusPending) {
		t.Fatalf("content moderation changed: status=%d", comments.created[0].Status)
	}
}
