package public_handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/album"
	"github.com/gin-gonic/gin"
)

type failingAlbumService struct{ album.AlbumService }

func (failingAlbumService) FindAlbums(context.Context, album.FindAlbumsParams) (*repository.PageResult[model.Album], error) {
	return nil, errors.New("pq: syntax error at column 78; internal database detail")
}

func TestPublicAlbumsDoesNotExposeDatabaseErrors(t *testing.T) {
	r := gin.New()
	r.GET("/albums", NewPublicHandler(failingAlbumService{}, nil).GetPublicAlbums)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/albums?tag=normal", nil))
	if w.Code != http.StatusInternalServerError || strings.Contains(w.Body.String(), "pq:") || strings.Contains(w.Body.String(), "database") {
		t.Fatalf("unexpected public error: %d %s", w.Code, w.Body.String())
	}
}
