package article

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	articleSvc "github.com/anzhiyu-c/anheyu-app/pkg/service/article"
	"github.com/gin-gonic/gin"
)

type publicArticleService struct {
	articleSvc.Service
	article model.ArticleResponse
}

func (s publicArticleService) GetPublicBySlugOrID(context.Context, string) (*model.ArticleDetailResponse, error) {
	return &model.ArticleDetailResponse{ArticleResponse: s.article}, nil
}
func (s publicArticleService) GetRandom(context.Context) (*model.ArticleResponse, error) {
	result := s.article
	return &result, nil
}
func (s publicArticleService) ListHome(context.Context) ([]model.ArticleResponse, error) {
	return []model.ArticleResponse{s.article}, nil
}
func (s publicArticleService) ListPublic(context.Context, *model.ListPublicArticlesOptions) (*model.ArticleListResponse, error) {
	return &model.ArticleListResponse{List: []model.ArticleResponse{s.article}}, nil
}

func TestPublicArticleEndpointsDoNotExposeManagementMetadata(t *testing.T) {
	now, moderator := time.Now(), uint(1)
	article := model.ArticleResponse{OwnerID: 1, OwnerEmail: "private@example.com", ReviewStatus: "APPROVED", OwnerNickname: "author", OwnerAvatar: "/avatar.png", ScheduledAt: &now, IsTakedown: true, TakedownReason: "private moderation note", TakedownAt: &now, TakedownBy: &moderator}
	h := NewHandler(publicArticleService{article: article})
	for name, handler := range map[string]gin.HandlerFunc{"detail": h.GetPublic, "by-url": h.GetByURL, "random": h.GetRandom, "home": h.ListHome, "list": h.ListPublic} {
		t.Run(name, func(t *testing.T) {
			ctx, recorder := newArticleHandlerTestContext(t, http.MethodGet, "/api/public/articles/test?url=/posts/test", "")
			delete(ctx.Keys, "user_claims")
			ctx.Params = gin.Params{{Key: "id", Value: "test"}}
			handler(ctx)
			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d; %s", recorder.Code, recorder.Body.String())
			}
			var response struct {
				Data any `json:"data"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			var data map[string]any
			switch name {
			case "home":
				data = response.Data.([]any)[0].(map[string]any)
			case "list":
				data = response.Data.(map[string]any)["list"].([]any)[0].(map[string]any)
			default:
				data = response.Data.(map[string]any)
			}
			for _, key := range []string{"owner_id", "owner_email", "review_status", "scheduled_at", "is_takedown", "takedown_reason", "takedown_at", "takedown_by"} {
				if _, exists := data[key]; exists {
					t.Errorf("private field exposed: %s", key)
				}
			}
			if data["owner_nickname"] != "author" || data["owner_avatar"] != "/avatar.png" {
				t.Fatalf("public author identity lost: %s", recorder.Body.String())
			}
		})
	}
}
