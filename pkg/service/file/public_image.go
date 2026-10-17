package file

import (
	"path/filepath"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// IsPublicImage 仅允许业务明确公开的图片目录，存储策略本身不代表其所有文件公开。
func IsPublicImage(file *model.File, policy *model.StoragePolicy) bool {
	if file == nil || policy == nil || policy.NodeID == nil || file.Type != model.FileTypeFile ||
		!file.ParentID.Valid || file.ParentID.Int64 != int64(*policy.NodeID) ||
		file.PrimaryEntity == nil || file.PrimaryEntity.PolicyID != policy.ID {
		return false
	}
	switch policy.Flag {
	case constant.PolicyFlagArticleImage, constant.PolicyFlagCommentImage, constant.PolicyFlagUserAvatar:
	default:
		return false
	}
	if file.PrimaryEntity.MimeType.Valid && file.PrimaryEntity.MimeType.String != "" &&
		!strings.HasPrefix(strings.ToLower(file.PrimaryEntity.MimeType.String), "image/") {
		return false
	}
	extension := strings.ToLower(filepath.Ext(file.Name))
	if policy.Flag == constant.PolicyFlagCommentImage {
		switch extension {
		case ".png", ".jpg", ".jpeg", ".gif", ".webp":
			return true
		default:
			return false
		}
	}
	switch extension {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico", ".tif", ".tiff", ".heic", ".heif", ".svg":
		return true
	default:
		return false
	}
}
