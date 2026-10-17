package article_history

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	historySvc "github.com/anzhiyu-c/anheyu-app/pkg/service/article_history"
	"github.com/gin-gonic/gin"
)

type historyAuthorizationService struct{ historySvc.Service }

func (historyAuthorizationService) GetArticleOwnerID(context.Context, string) (uint, error) {
	return 1, nil
}
func (historyAuthorizationService) ListHistory(context.Context, string, int, int) (*model.ArticleHistoryListResponse, error) {
	return &model.ArticleHistoryListResponse{}, nil
}
func (historyAuthorizationService) GetHistoryVersion(context.Context, string, int) (*model.ArticleHistory, error) {
	return &model.ArticleHistory{ContentHTML: "secret snapshot"}, nil
}
func (historyAuthorizationService) CompareVersions(context.Context, string, int, int) (*model.ArticleHistoryCompareResponse, error) {
	return &model.ArticleHistoryCompareResponse{}, nil
}
func (historyAuthorizationService) RestoreVersion(context.Context, string, int) (*model.ArticleHistory, error) {
	return &model.ArticleHistory{ContentHTML: "secret snapshot"}, nil
}
func (historyAuthorizationService) GetHistoryCount(context.Context, string) (int, error) {
	return 2, nil
}

func TestEveryHistoryEndpointRequiresOwnerOrAdmin(t *testing.T) {
	if err := idgen.InitSqidsEncoder(); err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	h := NewHandler(historyAuthorizationService{})
	for name, handler := range map[string]gin.HandlerFunc{"list": h.ListHistory, "version": h.GetVersion, "compare": h.CompareVersions, "restore": h.RestoreVersion, "count": h.GetHistoryCount} {
		for _, actor := range []struct {
			name  string
			user  uint
			admin bool
			want  int
		}{
			{"anonymous", 0, false, http.StatusUnauthorized},
			{"other user", 2, false, http.StatusForbidden},
			{"owner", 1, false, http.StatusOK},
			{"admin", 2, true, http.StatusOK},
		} {
			t.Run(name+"/"+actor.name, func(t *testing.T) {
				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Request = httptest.NewRequest(http.MethodGet, "/api/articles/test/history?v1=1&v2=2", strings.NewReader("{}"))
				ctx.Request.Header.Set("Content-Type", "application/json")
				ctx.Params = gin.Params{{Key: "id", Value: "test"}, {Key: "version", Value: "1"}}
				if actor.user > 0 {
					user, err := idgen.GeneratePublicID(actor.user, idgen.EntityTypeUser)
					if err != nil {
						t.Fatal(err)
					}
					groupID := uint(2)
					if actor.admin {
						groupID = 1
					}
					group, err := idgen.GeneratePublicID(groupID, idgen.EntityTypeUserGroup)
					if err != nil {
						t.Fatal(err)
					}
					ctx.Set(auth.ClaimsKey, &auth.CustomClaims{UserID: user, UserGroupID: group})
				}
				handler(ctx)
				if recorder.Code != actor.want {
					t.Fatalf("status = %d, want %d; %s", recorder.Code, actor.want, recorder.Body.String())
				}
			})
		}
	}
}
