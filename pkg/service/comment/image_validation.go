package comment

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	_ "image/gif" // 注册允许的图片解码器。
	_ "image/jpeg"
	_ "image/png"
	"io"

	_ "golang.org/x/image/webp"
)

// MaxCommentImageSize 限制匿名评论图片读取和解码的资源消耗。
const MaxCommentImageSize int64 = 10 << 20
const maxCommentImagePixels = 40_000_000

var ErrInvalidCommentImage = errors.New("评论仅支持 10MB 以内的有效 PNG、JPEG、GIF 或 WebP 图片")

func readCommentImage(reader io.Reader) ([]byte, string, error) {
	content, err := io.ReadAll(io.LimitReader(reader, MaxCommentImageSize+1))
	if err != nil {
		return nil, "", fmt.Errorf("读取评论图片失败: %w", err)
	}
	if len(content) == 0 || int64(len(content)) > MaxCommentImageSize {
		return nil, "", ErrInvalidCommentImage
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(content))
	extension := map[string]string{"png": ".png", "jpeg": ".jpg", "gif": ".gif", "webp": ".webp"}[format]
	if err != nil || extension == "" || config.Width <= 0 || config.Height <= 0 ||
		int64(config.Width) > maxCommentImagePixels/int64(config.Height) {
		return nil, "", ErrInvalidCommentImage
	}
	// DecodeConfig 只能验证头部，还需解码正文，拒绝截断或仅伪造图片头的内容。
	if _, decodedFormat, err := image.Decode(bytes.NewReader(content)); err != nil || decodedFormat != format {
		return nil, "", ErrInvalidCommentImage
	}
	return content, extension, nil
}
