package article

import (
	"context"
	"net/http"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	articleSvc "github.com/anzhiyu-c/anheyu-app/pkg/service/article"
	"github.com/gin-gonic/gin"
)

type authorizationArticleService struct {
	articleSvc.Service
	ownerID             uint
	reviewStatus        string
	enabled, needReview bool
	writes              int
	created             *model.CreateArticleRequest
	updated             *model.UpdateArticleRequest
}

func (s *authorizationArticleService) AuthorPolicy() (bool, bool) { return s.enabled, s.needReview }
func (s *authorizationArticleService) GetArticleOwnerID(context.Context, string) (uint, error) {
	return s.ownerID, nil
}
func (s *authorizationArticleService) Get(context.Context, string) (*model.ArticleResponse, error) {
	return &model.ArticleResponse{OwnerID: s.ownerID, ContentHTML: "private content", ReviewStatus: s.reviewStatus}, nil
}
func (s *authorizationArticleService) CreateWithOptions(_ context.Context, req *model.CreateArticleRequest, _, _ string, _ articleSvc.CreateOptions) (*model.ArticleResponse, error) {
	s.writes++
	s.created = req
	return &model.ArticleResponse{OwnerID: req.OwnerID, Status: req.Status, ReviewStatus: req.ReviewStatus}, nil
}
func (s *authorizationArticleService) Update(_ context.Context, _ string, req *model.UpdateArticleRequest, _, _ string) (*model.ArticleResponse, error) {
	s.writes++
	s.updated = req
	return &model.ArticleResponse{OwnerID: s.ownerID}, nil
}
func (s *authorizationArticleService) Delete(context.Context, string) error { s.writes++; return nil }

func articleTestClaims(t *testing.T, userID uint, admin bool) *auth.CustomClaims {
	t.Helper()
	if err := idgen.InitSqidsEncoder(); err != nil {
		t.Fatal(err)
	}
	user, err := idgen.GeneratePublicID(userID, idgen.EntityTypeUser)
	if err != nil {
		t.Fatal(err)
	}
	groupID := uint(2)
	if admin {
		groupID = 1
	}
	group, err := idgen.GeneratePublicID(groupID, idgen.EntityTypeUserGroup)
	if err != nil {
		t.Fatal(err)
	}
	return &auth.CustomClaims{UserID: user, UserGroupID: group}
}

func TestArticleManagementRequiresOwnerOrAdmin(t *testing.T) {
	for _, operation := range []string{"get", "update", "delete", "autosave"} {
		for _, actor := range []struct {
			name   string
			id     uint
			admin  bool
			status int
		}{
			{"other user", 2, false, http.StatusForbidden},
			{"owner", 1, false, http.StatusOK},
			{"administrator", 2, true, http.StatusOK},
		} {
			t.Run(operation+"/"+actor.name, func(t *testing.T) {
				svc := &authorizationArticleService{ownerID: 1, enabled: true}
				ctx, recorder := newArticleHandlerTestContext(t, http.MethodPut, "/api/articles/test", `{"title":"changed","status":"DRAFT"}`)
				ctx.Set(auth.ClaimsKey, articleTestClaims(t, actor.id, actor.admin))
				ctx.Params = gin.Params{{Key: "id", Value: "test"}}
				h := NewHandler(svc)
				switch operation {
				case "get":
					h.Get(ctx)
				case "delete":
					h.Delete(ctx)
				default:
					h.Update(ctx)
				}
				if recorder.Code != actor.status {
					t.Fatalf("status = %d, want %d; %s", recorder.Code, actor.status, recorder.Body.String())
				}
				if actor.status == http.StatusForbidden && svc.writes != 0 {
					t.Fatal("unauthorized article was modified")
				}
			})
		}
	}
}

func TestCreateAssignsAuthenticatedOwnerAndAppliesReview(t *testing.T) {
	svc := &authorizationArticleService{enabled: true, needReview: true}
	ctx, recorder := newArticleHandlerTestContext(t, http.MethodPost, "/api/articles", `{"owner_id":99,"status":"PUBLISHED","review_status":"APPROVED","scheduled_at":"2099-01-01T00:00:00Z"}`)
	ctx.Set(auth.ClaimsKey, articleTestClaims(t, 2, false))
	NewHandler(svc).Create(ctx)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; %s", recorder.Code, recorder.Body.String())
	}
	if svc.created.OwnerID != 2 || svc.created.Status != "DRAFT" || svc.created.ReviewStatus != "PENDING" {
		t.Fatalf("unsafe create request: %+v", svc.created)
	}
	if svc.created.ScheduledAt != nil && *svc.created.ScheduledAt != "" {
		t.Fatal("review can be bypassed through scheduled publishing")
	}
}

func TestUpdateCannotBypassReviewOrMultiAuthorPolicy(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		svc := &authorizationArticleService{ownerID: 2, enabled: enabled, needReview: true}
		ctx, recorder := newArticleHandlerTestContext(t, http.MethodPut, "/api/articles/test", `{"status":"PUBLISHED","review_status":"NONE","scheduled_at":"2099-01-01T00:00:00Z"}`)
		ctx.Set(auth.ClaimsKey, articleTestClaims(t, 2, false))
		ctx.Params = gin.Params{{Key: "id", Value: "test"}}
		NewHandler(svc).Update(ctx)
		if !enabled {
			if recorder.Code != http.StatusForbidden || svc.writes != 0 {
				t.Fatalf("disabled author wrote article: %d %s", recorder.Code, recorder.Body.String())
			}
			continue
		}
		if recorder.Code != http.StatusOK {
			t.Fatalf("status = %d; %s", recorder.Code, recorder.Body.String())
		}
		if svc.updated.Status == nil || *svc.updated.Status != "DRAFT" || svc.updated.ReviewStatus == nil || *svc.updated.ReviewStatus != "PENDING" {
			t.Fatalf("unsafe update request: %+v", svc.updated)
		}
		if svc.updated.ScheduledAt == nil || *svc.updated.ScheduledAt != "" {
			t.Fatal("scheduled publishing was not cleared")
		}
	}
}

func TestCreateRequiresMultiAuthorPolicy(t *testing.T) {
	svc := &authorizationArticleService{}
	ctx, recorder := newArticleHandlerTestContext(t, http.MethodPost, "/api/articles", `{"status":"DRAFT"}`)
	ctx.Set(auth.ClaimsKey, articleTestClaims(t, 2, false))
	NewHandler(svc).Create(ctx)
	if recorder.Code != http.StatusForbidden || svc.writes != 0 {
		t.Fatalf("disabled author created article: %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestUpdatePreservesUnreviewedAuthorsScheduledDrafts(t *testing.T) {
	svc := &authorizationArticleService{ownerID: 2, enabled: true, reviewStatus: "NONE"}
	ctx, recorder := newArticleHandlerTestContext(t, http.MethodPut, "/api/articles/test", `{"status":"SCHEDULED","scheduled_at":"2099-01-01T00:00:00Z","review_status":"APPROVED","owner_id":99}`)
	ctx.Set(auth.ClaimsKey, articleTestClaims(t, 2, false))
	ctx.Params = gin.Params{{Key: "id", Value: "test"}}
	NewHandler(svc).Update(ctx)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; %s", recorder.Code, recorder.Body.String())
	}
	if svc.updated.Status == nil || *svc.updated.Status != "SCHEDULED" || svc.updated.ScheduledAt == nil || *svc.updated.ScheduledAt != "2099-01-01T00:00:00Z" {
		t.Fatalf("legitimate schedule changed: %+v", svc.updated)
	}
	if svc.updated.ReviewStatus != nil {
		t.Fatal("client review status accepted")
	}
}

func TestExistingReviewCannotBeBypassedAfterReviewSettingIsDisabled(t *testing.T) {
	for _, status := range []string{"APPROVED", "PENDING", "REJECTED"} {
		svc := &authorizationArticleService{ownerID: 2, enabled: true, reviewStatus: status}
		ctx, recorder := newArticleHandlerTestContext(t, http.MethodPut, "/api/articles/test", `{"status":"PUBLISHED","review_status":"NONE"}`)
		ctx.Set(auth.ClaimsKey, articleTestClaims(t, 2, false))
		ctx.Params = gin.Params{{Key: "id", Value: "test"}}
		NewHandler(svc).Update(ctx)
		if recorder.Code != http.StatusOK {
			t.Fatalf("status = %d; %s", recorder.Code, recorder.Body.String())
		}
		if svc.updated.Status == nil || *svc.updated.Status != "DRAFT" || svc.updated.ReviewStatus == nil || *svc.updated.ReviewStatus != "PENDING" {
			t.Fatalf("%s review bypassed: %+v", status, svc.updated)
		}
	}
}

func TestManagementRejectsMissingOrWrongEntityIdentity(t *testing.T) {
	claims := articleTestClaims(t, 2, false)
	fileID, err := idgen.GeneratePublicID(1, idgen.EntityTypeFile)
	if err != nil {
		t.Fatal(err)
	}
	for _, identity := range []struct {
		name   string
		claims *auth.CustomClaims
		status int
	}{
		{"missing", nil, http.StatusUnauthorized},
		{"wrong user entity", &auth.CustomClaims{UserID: fileID}, http.StatusUnauthorized},
		{"wrong admin group entity", &auth.CustomClaims{UserID: claims.UserID, UserGroupID: fileID}, http.StatusForbidden},
	} {
		t.Run(identity.name, func(t *testing.T) {
			ctx, recorder := newArticleHandlerTestContext(t, http.MethodGet, "/api/articles/test", "")
			ctx.Set(auth.ClaimsKey, identity.claims)
			ctx.Params = gin.Params{{Key: "id", Value: "test"}}
			NewHandler(&authorizationArticleService{ownerID: 1}).Get(ctx)
			if recorder.Code != identity.status {
				t.Fatalf("status = %d, want %d", recorder.Code, identity.status)
			}
		})
	}
}
