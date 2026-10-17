package article

import (
	"context"
	"errors"
	"net/http"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/gin-gonic/gin"
)

// RequireArticleAccess protects management content, including historical snapshots.
func RequireArticleAccess(c *gin.Context, publicID string, getOwnerID func(context.Context, string) (uint, error)) (*auth.CustomClaims, bool) {
	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return nil, false
	}
	if isAdminByUserGroup(claims.UserGroupID) {
		return claims, true
	}
	userID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return nil, false
	}
	ownerID, err := getOwnerID(c.Request.Context(), publicID)
	if err != nil {
		if ent.IsNotFound(err) || errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "文章未找到")
		} else {
			response.Fail(c, http.StatusInternalServerError, "验证文章权限失败")
		}
		return nil, false
	}
	if ownerID == 0 || ownerID != userID {
		response.Fail(c, http.StatusForbidden, "您只能管理自己的文章")
		return nil, false
	}
	return claims, true
}
