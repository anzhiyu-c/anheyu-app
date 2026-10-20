package comment

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	commentsvc "github.com/anzhiyu-c/anheyu-app/pkg/service/comment"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/gin-gonic/gin"
)

type nicknameHandlerSettings struct {
	setting.SettingService
}

func (nicknameHandlerSettings) Get(key string) string {
	if key == constant.KeyCommentNicknameForbiddenWords.String() {
		return "广告"
	}
	return ""
}

type nicknameHandlerComments struct {
	repository.CommentRepository
	writes int
}

func (r *nicknameHandlerComments) Create(context.Context, *repository.CreateCommentParams) (*model.Comment, error) {
	r.writes++
	return nil, nil
}

func TestCreateReturnsBadRequestForForbiddenNickname(t *testing.T) {
	settings := nicknameHandlerSettings{}
	comments := &nicknameHandlerComments{}
	svc := commentsvc.NewService(comments, nil, nil, nil, settings, nil, nil, nil, nil, nil, nil)
	handler := NewHandler(svc, settings)
	router := gin.New()
	router.POST("/public/comments", handler.Create)
	request := httptest.NewRequest(http.MethodPost, "/public/comments", strings.NewReader(
		`{"target_path":"/posts/test","nickname":"广告推广员","content":"正常评论"}`,
	))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s, want HTTP 400", recorder.Code, recorder.Body.String())
	}
	var body response.Response
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Code != http.StatusBadRequest || body.Message != "昵称包含违禁词，请修改后重新提交" || body.Data != nil {
		t.Fatalf("unexpected rejection response: %+v", body)
	}
	if comments.writes != 0 {
		t.Fatalf("rejected request wrote %d comments", comments.writes)
	}
}
