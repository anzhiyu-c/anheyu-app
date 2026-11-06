package file

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	file_service "github.com/anzhiyu-c/anheyu-app/pkg/service/file"
	"github.com/gin-gonic/gin"
)

type rejectedUploadService struct {
	file_service.IUploadService
	err error
}

func (s rejectedUploadService) CreateUploadSession(context.Context, uint, *model.CreateUploadRequest) (*model.UploadSessionData, error) {
	return nil, s.err
}

func (s rejectedUploadService) FinalizeClientUpload(context.Context, uint, *model.FinalizeUploadRequest) (*model.File, error) {
	return nil, s.err
}

func TestUploadHandlerReturnsSecurityErrorStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	if err := idgen.InitSqidsEncoder(); err != nil {
		t.Fatal(err)
	}
	owner, err := idgen.GeneratePublicID(9, idgen.EntityTypeUser)
	if err != nil {
		t.Fatal(err)
	}
	for _, route := range []string{"create", "finalize"} {
		for _, tc := range []struct {
			name string
			err  error
			code int
		}{
			{"invalid URI", constant.ErrBadRequest, http.StatusBadRequest},
			{"unauthorized policy", constant.ErrForbidden, http.StatusForbidden},
			{"file exists", constant.ErrConflict, http.StatusConflict},
		} {
			t.Run(route+"/"+tc.name, func(t *testing.T) {
				recorder := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(recorder)
				c.Request = httptest.NewRequest(http.MethodPost, "/api/file/upload/"+route, strings.NewReader(`{"uri":"anzhiyu://my/cloud/file.txt","policy_id":"policy","size":3}`))
				c.Request.Header.Set("Content-Type", "application/json")
				c.Set(auth.ClaimsKey, &auth.CustomClaims{UserID: owner})
				h := &FileHandler{uploadSvc: rejectedUploadService{err: tc.err}}
				if route == "create" {
					h.CreateUploadSession(c)
				} else {
					h.FinalizeClientUpload(c)
				}
				var body struct {
					Code int `json:"code"`
				}
				if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				if body.Code != tc.code || recorder.Code != tc.code {
					t.Errorf("response=%s; want code %d", recorder.Body.String(), tc.code)
				}
			})
		}
	}
}
