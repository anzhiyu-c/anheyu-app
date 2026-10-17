/*
 * @Description: 代理处理器，用于处理外部资源下载
 * @Author: 安知鱼
 * @Date: 2025-01-20 10:00:00
 * @LastEditTime: 2025-10-16 11:39:50
 * @LastEditors: 安知鱼
 */
package proxy

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/util"
	"github.com/gin-gonic/gin"
)

const maxProxyResponseBytes = 100 << 20 // 100MB

// ProxyHandler 代理处理器
type ProxyHandler struct{}

// NewHandler 创建代理处理器
func NewHandler() *ProxyHandler {
	return &ProxyHandler{}
}

var proxyDownloadClient = util.NewPublicHTTPClient(60*time.Second, false)

func proxyImageContentType(data []byte) string {
	contentType := http.DetectContentType(data)
	if strings.HasPrefix(contentType, "image/") {
		return contentType
	}
	// 标准库尚不识别 ISO-BMFF 图片；仅接受有完整 ftyp 头的图片品牌。
	if len(data) < 16 || string(data[4:8]) != "ftyp" {
		return ""
	}
	size := int64(binary.BigEndian.Uint32(data[:4]))
	if size < 16 || size > int64(len(data)) || size%4 != 0 {
		return ""
	}
	brands := append([]byte{}, data[8:12]...)
	brands = append(brands, data[16:size]...)
	for i := 0; i+4 <= len(brands); i += 4 {
		switch string(brands[i : i+4]) {
		case "avif", "avis":
			return "image/avif"
		case "heic", "heix", "hevc", "hevx":
			return "image/heic"
		}
	}
	return ""
}

func sanitizeFilenameForHeader(filename string) string {
	replacer := strings.NewReplacer(
		`"`, "",
		`\`, "",
		"\r", "",
		"\n", "",
	)
	return replacer.Replace(filename)
}

// HandleDownload 处理外部文件下载代理
// @Summary      代理下载
// @Description  代理下载外部资源（主要用于图片）
// @Tags         代理服务
// @Produce      octet-stream
// @Param        url  query  string  true  "目标URL"
// @Success      200  {file}    file  "文件内容"
// @Failure      400  {object}  object{error=string}  "参数错误"
// @Failure      502  {object}  object{error=string}  "目标服务器错误"
// @Failure      500  {object}  object{error=string}  "代理失败"
// @Router       /proxy/download [get]
func (h *ProxyHandler) HandleDownload(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少url参数"})
		return
	}

	if err := util.ValidatePublicHTTPURL(targetURL, false); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不允许的下载地址"})
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), "GET", targetURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建请求失败"})
		return
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "image/webp,image/apng,image/*,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Pragma", "no-cache")

	resp, err := proxyDownloadClient.Do(req)
	if err != nil {
		log.Printf("代理请求失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "请求目标资源失败"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "目标服务器返回错误"})
		return
	}

	if resp.ContentLength > maxProxyResponseBytes {
		c.JSON(http.StatusBadGateway, gin.H{"error": "图片超过大小限制"})
		return
	}
	reader := bufio.NewReader(resp.Body)
	peek, peekErr := reader.Peek(512)
	if peekErr != nil && peekErr != io.EOF {
		c.JSON(http.StatusBadGateway, gin.H{"error": "读取图片失败"})
		return
	}
	contentType := proxyImageContentType(peek)
	if contentType == "" {
		c.JSON(http.StatusBadGateway, gin.H{"error": "目标不是图片文件"})
		return
	}
	// 先限制完整响应再发送，避免将超限的分块响应以成功状态截断返回。
	temp, err := os.CreateTemp("", "anheyu-proxy-*")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "暂时无法下载图片"})
		return
	}
	defer func() {
		if err := temp.Close(); err != nil {
			log.Printf("关闭代理临时文件失败: %v", err)
		}
		if err := os.Remove(temp.Name()); err != nil {
			log.Printf("清理代理临时文件失败: %v", err)
		}
	}()
	size, err := io.Copy(temp, io.LimitReader(reader, maxProxyResponseBytes+1))
	if err != nil || size > maxProxyResponseBytes {
		c.JSON(http.StatusBadGateway, gin.H{"error": "图片下载失败或超过大小限制"})
		return
	}
	if _, err := temp.Seek(0, io.SeekStart); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取图片失败"})
		return
	}

	c.Header("Content-Type", contentType)
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
	c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept")
	c.Header("Cross-Origin-Resource-Policy", "cross-origin")
	c.Header("Timing-Allow-Origin", "*")

	filename := sanitizeFilenameForHeader(getFileName(targetURL))
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("Cache-Control", "no-cache")

	c.Header("Content-Encoding", "identity")
	c.Header("X-Content-Type-Options", "nosniff")

	c.DataFromReader(http.StatusOK, size, contentType, temp, nil)
}

// HandleTest 测试代理下载功能
// @Summary      测试代理服务
// @Description  测试代理下载服务是否正常运行
// @Tags         代理服务
// @Produce      json
// @Success      200  {object}  object{message=string,timestamp=int,status=string}  "服务正常"
// @Router       /proxy/test [get]
func (h *ProxyHandler) HandleTest(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message":   "代理下载服务正常运行",
		"timestamp": time.Now().Unix(),
		"status":    "ok",
	})
}

// getFileName 从URL中提取文件名
func getFileName(urlStr string) string {
	// 优化：使用标准库 path.Base 来获取文件名，更健壮
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return "download"
	}

	filename := path.Base(parsedURL.Path)
	if filename == "." || filename == "/" {
		return "download"
	}

	return filename
}
