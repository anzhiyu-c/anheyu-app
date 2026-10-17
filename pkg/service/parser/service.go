// internal/app/service/parser/service.go
package parser

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/html"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"

	"github.com/google/uuid"
	"github.com/microcosm-cc/bluemonday"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	gmhtml "github.com/yuin/goldmark/renderer/html"
)

// EmojiDef 用于解析JSON中每个表情的定义
type EmojiDef struct {
	Icon string `json:"icon"`
	Text string `json:"text"`
}

// EmojiPack 用于解析整个表情包的JSON结构
type EmojiPack struct {
	Container []EmojiDef `json:"container"`
}

// 缓存配置常量
const (
	// 缓存容量：最多缓存 500 条解析结果
	cacheCapacity = 500
	// 缓存 TTL：30 分钟
	cacheTTL = 30 * time.Minute
)

// Service 是一个支持动态加载表情包和HTML安全过滤的解析服务
type Service struct {
	settingSvc      setting.SettingService
	mdParser        goldmark.Markdown
	policy          *bluemonday.Policy
	httpClient      *http.Client
	mu              sync.RWMutex
	emojiReplacer   *strings.Replacer
	currentEmojiURL string
	mermaidRegex    *regexp.Regexp

	// 缓存：避免重复解析相同内容
	htmlCache     *LRUCache // Markdown -> HTML 缓存
	sanitizeCache *LRUCache // HTML -> SafeHTML 缓存
}

// htmlPolicy 初始化后只读，在文章、历史与评论输出边界复用同一安全策略。
var htmlPolicy = newHTMLPolicy()

func newHTMLPolicy() *bluemonday.Policy {
	policy := bluemonday.UGCPolicy()

	policy.AllowURLSchemes("anzhiyu")

	policy.AllowElements("div", "ul", "i", "table", "thead", "tbody", "tr", "th", "td", "button", "a", "img", "span", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "font", "p", "details", "summary", "svg", "path", "circle", "input", "math", "semantics", "mrow", "mi", "mo", "msup", "mn", "annotation", "style", "g", "marker", "rect", "foreignObject", "li", "ol", "strong", "u", "em", "s", "sup", "sub", "blockquote", "figure", "video", "audio", "source", "iframe", "defs", "symbol", "line", "text", "tspan", "ellipse", "polygon")

	policy.AllowAttrs("class").Matching(bluemonday.SpaceSeparatedTokens).OnElements("ul", "i", "code", "span", "img", "a", "button", "pre", "div", "table", "thead", "tbody", "tr", "th", "td", "h1", "h2", "h3", "h4", "h5", "h6", "font", "p", "details", "summary", "svg", "path", "circle", "input", "g", "rect", "li", "line", "text", "tspan", "blockquote", "video", "audio", "marker", "ellipse", "polygon", "foreignObject")
	policy.AllowAttrs("style").OnElements(
		"div", "span", "p", "font", "th", "td", "rect", "blockquote", "img", "h1", "h2", "h3", "h4", "h5", "h6", "a", "strong", "b", "em", "i", "u", "s", "strike", "del", "pre", "code", "sub", "sup", "mark", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "section", "article", "header", "footer", "nav", "aside", "main", "hr", "figure", "figcaption", "svg", "path", "circle", "line", "g", "text", "summary", "details", "button", "video", "iframe", "ellipse", "polygon", "foreignObject", "marker", "i",
	)
	// 图片相关属性
	policy.AllowAttrs("src", "alt", "title", "width", "height").OnElements("img")
	policy.AllowAttrs("color").OnElements("font")
	policy.AllowAttrs("align").OnElements("div")
	policy.AllowAttrs("xmlns").OnElements("annotation", "div")
	policy.AllowAttrs("encoding").OnElements("input", "annotation")
	policy.AllowAttrs("type").OnElements("input")
	policy.AllowAttrs("checked").OnElements("input")
	policy.AllowAttrs("size").OnElements("font")
	policy.AllowAttrs("target").OnElements("a")
	policy.AllowAttrs("rel").OnElements("a")
	policy.AllowAttrs("rn-wrapper").OnElements("span")
	policy.AllowAttrs("aria-hidden").OnElements("span")
	policy.AllowAttrs("transform").OnElements("g", "rect", "path")
	policy.AllowAttrs("x1", "y1", "x2", "y2", "stroke", "stroke-width", "name", "id", "style", "fill", "stroke-dasharray", "marker-end").OnElements("line")
	policy.AllowAttrs("rx", "ry", "name", "stroke", "fill").OnElements("rect")
	policy.AllowAttrs("x", "y", "text-anchor", "alignment-baseline", "dominant-baseline", "font-size", "font-weight").OnElements("text")
	policy.AllowAttrs("x", "dy", "xml:space").OnElements("tspan")
	// Mermaid SVG defs 和 symbol 元素
	policy.AllowAttrs("height", "width", "id", "clip-rule", "fill-rule").OnElements("symbol")
	policy.AllowNoAttrs().OnElements("defs", "g", "svg", "foreignObject")

	policy.AllowAttrs("orient", "markerHeight", "markerWidth", "markerUnits", "refY", "refX", "viewBox", "class", "id").OnElements("marker")
	policy.AllowAttrs("language").OnElements("code")
	policy.AllowAttrs("open", "data-collapsed").OnElements("details")
	policy.AllowAttrs("data-line").OnElements("details", "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ol", "ul", "li", "figure", "table", "thead", "tbody", "tr", "th", "td", "div")
	policy.AllowAttrs("data-mermaid-theme", "data-closed", "data-processed").OnElements("p", "div")
	policy.AllowAttrs("data-mermaid-code").OnElements("p", "div")
	policy.AllowAttrs("data-tips").OnElements("span")
	policy.AllowAttrs("data-href").OnElements("button")
	policy.AllowAttrs("type").OnElements("button")
	policy.AllowAttrs("aria-label").OnElements("button")

	policy.AllowAttrs("data-tip-id").OnElements("span")
	policy.AllowAttrs("data-content", "data-position", "data-theme", "data-trigger", "data-delay", "data-visible").OnElements("div", "span")
	policy.AllowAttrs("role").OnElements("div", "span")
	policy.AllowAttrs("aria-hidden").OnElements("div", "span")

	// PRO 版内容保护相关属性
	// 密码保护内容
	policy.AllowAttrs("data-content-id", "data-title", "data-hint", "data-placeholder", "data-password", "data-content-length").OnElements("div", "input", "button")
	// 付费内容
	policy.AllowAttrs("data-price", "data-original-price", "data-currency", "data-section-id").OnElements("div", "span", "button")
	// 登录后可见内容
	policy.AllowAttrs("data-login-action").OnElements("button")
	// 全文隐藏
	policy.AllowAttrs("data-enabled", "data-button-text", "data-initial-height").OnElements("div")
	// 通用
	policy.AllowAttrs("placeholder").OnElements("input")
	policy.AllowAttrs("xmlns", "width", "height", "viewBox", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "preserveAspectRatio", "aria-roledescription", "role", "style", "xmlns:xlink", "id", "t").OnElements("svg")
	policy.AllowAttrs("cx", "cy", "r", "stroke", "fill", "stroke-width").OnElements("circle")
	policy.AllowAttrs("d", "style", "class", "marker-end", "fill", "p-id", "t", "stroke", "stroke-width", "stroke-dasharray").OnElements("path")
	policy.AllowAttrs("id").OnElements("g", "line", "defs")
	policy.AllowAttrs("height", "width", "x", "y", "style", "class", "opacity").OnElements("rect")
	policy.AllowAttrs("height", "width", "x", "y", "style", "xmlns").OnElements("foreignObject")
	// Mermaid flowchart 椭圆和多边形元素
	policy.AllowAttrs("cx", "cy", "rx", "ry", "stroke", "fill", "stroke-width").OnElements("ellipse")
	policy.AllowAttrs("points", "stroke", "fill", "stroke-width").OnElements("polygon")
	policy.AllowAttrs("data-processed").OnElements("span")

	// TipTap 数学公式（KaTeX）：保留 LaTeX 源与节点类型，供编辑器解析与 Turndown 还原
	policy.AllowAttrs("data-latex").OnElements("div", "span")
	policy.AllowAttrs("data-type").Matching(regexp.MustCompile(`^(math-block|math-inline)$`)).OnElements("div", "span")

	// 视频画廊相关属性
	policy.AllowAttrs("src", "poster", "controls", "preload", "playsinline", "webkit-playsinline", "x5-playsinline", "x5-video-player-type", "type").OnElements("video")
	policy.AllowAttrs("src", "type").OnElements("source")

	// 图片画廊相关属性
	policy.AllowAttrs("data-ratio").OnElements("div")

	// 音乐播放器相关属性
	policy.AllowAttrs("data-music-id", "data-music-data", "data-music-name", "data-music-artist", "data-music-pic", "data-music-url", "data-initialized", "data-audio-loaded", "data-events-attached").OnElements("div", "audio")
	policy.AllowAttrs("preload").OnElements("audio")

	// iframe 相关属性
	policy.AllowAttrs("src", "width", "height", "scrolling", "seamless", "class", "id", "title", "frameborder", "allowfullscreen", "sandbox").OnElements("iframe")

	policy.AllowAttrs("id").OnElements("div", "h1", "h2", "h3", "h4", "h5", "h6", "button", "a", "img", "span", "code", "pre", "table", "thead", "tbody", "tr", "th", "td", "font", "details", "summary", "svg", "blockquote", "video", "iframe")
	return policy
}

// SanitizeHTML 净化存储或外部传入的 HTML，调用方无需初始化表情包与事件订阅。
func SanitizeHTML(content string) string {
	return htmlPolicy.Sanitize(content)
}

// NewService 创建一个新的解析服务实例
func NewService(settingSvc setting.SettingService, bus *event.EventBus) *Service {
	mdParser := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM, extension.Footnote, extension.Typographer,
			extension.Linkify, extension.Strikethrough, extension.Table, extension.TaskList,
		),
		goldmark.WithParserOptions(parser.WithAutoHeadingID()),
		goldmark.WithRendererOptions(gmhtml.WithHardWraps(), gmhtml.WithXHTML(), gmhtml.WithUnsafe()),
	)

	svc := &Service{
		settingSvc:    settingSvc,
		mdParser:      mdParser,
		policy:        htmlPolicy,
		httpClient:    &http.Client{Timeout: 10 * time.Second},
		mermaidRegex:  regexp.MustCompile(`(?s)<(?:p|div)[^>]*class="[^"]*md-editor-mermaid[^"]*"[^>]*>.*?</(?:p|div)>`),
		htmlCache:     NewLRUCache(cacheCapacity, cacheTTL),
		sanitizeCache: NewLRUCache(cacheCapacity, cacheTTL),
	}

	bus.Subscribe(event.Topic(setting.TopicSettingUpdated), svc.handleSettingUpdate)
	initialEmojiURL := settingSvc.Get(constant.KeyCommentEmojiCDN.String())
	if initialEmojiURL != "" {
		log.Printf("解析服务初始化，正在加载初始表情包: %s", initialEmojiURL)
		svc.updateEmojiData(context.Background(), initialEmojiURL)
	}

	return svc
}

// handleSettingUpdate 是配置更新事件的处理函数
func (s *Service) handleSettingUpdate(eventData interface{}) {
	evt, ok := eventData.(setting.SettingUpdatedEvent)
	if !ok {
		return
	}

	if evt.Key == constant.KeyCommentEmojiCDN.String() {
		s.mu.RLock()
		currentURL := s.currentEmojiURL
		s.mu.RUnlock()
		if evt.Value != currentURL {
			log.Printf("检测到表情包CDN链接变更。旧: '%s', 新: '%s'。正在更新...", currentURL, evt.Value)
			s.updateEmojiData(context.Background(), evt.Value)

			// 清空缓存，因为表情包变化会影响解析结果
			s.clearCaches()
			log.Println("已清空解析缓存以应用新的表情包配置")
		} else {
			log.Printf("接收到表情包配置更新事件，但URL '%s' 未发生变化，无需重新加载。", evt.Value)
		}
	}
}

// clearCaches 清空所有解析缓存
func (s *Service) clearCaches() {
	if s.htmlCache != nil {
		s.htmlCache.Clear()
	}
	if s.sanitizeCache != nil {
		s.sanitizeCache.Clear()
	}
}

// updateEmojiData 负责从指定的URL获取、解析并更新表情包替换器
func (s *Service) updateEmojiData(ctx context.Context, emojiURL string) {
	if emojiURL == "" {
		s.mu.Lock()
		s.emojiReplacer = nil
		s.currentEmojiURL = ""
		s.mu.Unlock()
		log.Println("表情包CDN链接已清空，已卸载表情包解析器。")
		return
	}
	req, err := http.NewRequestWithContext(ctx, "GET", emojiURL, nil)
	if err != nil {
		log.Printf("错误：创建表情包HTTP请求失败: %v", err)
		return
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("错误：从URL '%s' 获取表情包JSON失败: %v", emojiURL, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("错误：从URL '%s' 获取表情包JSON状态码异常: %d", emojiURL, resp.StatusCode)
		return
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("错误：读取表情包响应体失败: %v", err)
		return
	}
	var emojiMap map[string]EmojiPack
	if err := json.Unmarshal(body, &emojiMap); err != nil {
		log.Printf("错误：解析表情包JSON数据失败: %v", err)
		return
	}
	var replacements []string
	for _, pack := range emojiMap {
		for _, emoji := range pack.Container {
			key := ":" + emoji.Text + ":"
			modifiedIcon, err := modifyEmojiImgTag(emoji.Icon, "anzhiyu-owo-emotion", emoji.Text)
			if err != nil {
				log.Printf("警告：为表情 '%s' 修改img标签失败，将使用原始图标: %v", emoji.Text, err)
				modifiedIcon = emoji.Icon
			}
			replacements = append(replacements, key, modifiedIcon)
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(replacements) > 0 {
		s.emojiReplacer = strings.NewReplacer(replacements...)
		s.currentEmojiURL = emojiURL
		log.Printf("表情包数据已从 '%s' 成功更新并加载！", emojiURL)
	} else {
		s.emojiReplacer = nil
		s.currentEmojiURL = emojiURL
		log.Printf("警告：从 '%s' 加载的表情包数据为空。", emojiURL)
	}
}

// ToHTML 将包含表情包和Markdown的文本转换为安全的HTML。
// 使用缓存机制避免重复解析相同内容，显著提升性能。
func (s *Service) ToHTML(ctx context.Context, content string) (string, error) {
	// 计算内容的缓存键
	cacheKey := computeCacheKey(content)

	// 尝试从缓存获取
	if cached, hit := s.htmlCache.Get(cacheKey); hit {
		return cached, nil
	}

	// 缓存未命中，执行解析
	placeholders := make(map[string]string)
	replacedContent := s.mermaidRegex.ReplaceAllStringFunc(content, func(match string) string {
		placeholder := "MERMAID_PLACEHOLDER_" + uuid.New().String()
		placeholders[placeholder] = match
		return placeholder
	})

	s.mu.RLock()
	replacer := s.emojiReplacer
	s.mu.RUnlock()
	if replacer != nil {
		replacedContent = replacer.Replace(replacedContent)
	}

	var buf strings.Builder
	if err := s.mdParser.Convert([]byte(replacedContent), &buf); err != nil {
		return "", err
	}

	safeHTML := s.policy.Sanitize(buf.String())

	// 使用 strings.NewReplacer 进行批量替换，性能更优
	finalHTML := safeHTML
	if len(placeholders) > 0 {
		replacerPairs := make([]string, 0, len(placeholders)*2)
		for placeholder, originalMermaid := range placeholders {
			// Mermaid 仅跳过 Markdown 转换，不能跳过安全过滤。
			replacerPairs = append(replacerPairs, placeholder, s.policy.Sanitize(originalMermaid))
		}
		batchReplacer := strings.NewReplacer(replacerPairs...)
		finalHTML = batchReplacer.Replace(safeHTML)
	}

	// 存入缓存
	s.htmlCache.Set(cacheKey, finalHTML)

	return finalHTML, nil
}

// mermaidNodeInfo 保存 mermaid 节点的信息
type mermaidNodeInfo struct {
	node    *html.Node
	tagName string
}

// extractMermaidBlocks 使用 HTML 解析器提取完整的 Mermaid 块（包括 action div）
func extractMermaidBlocks(htmlContent string) (map[string]string, string) {
	placeholders := make(map[string]string)
	doc, err := html.Parse(strings.NewReader("<body>" + htmlContent + "</body>"))
	if err != nil {
		log.Printf("[extractMermaidBlocks] HTML 解析失败: %v", err)
		return placeholders, htmlContent
	}

	var findMermaidNodes func(*html.Node) []mermaidNodeInfo
	findMermaidNodes = func(n *html.Node) []mermaidNodeInfo {
		var mermaidNodes []mermaidNodeInfo
		// 支持 p 和 div 元素
		if n.Type == html.ElementNode && (n.Data == "p" || n.Data == "div") {
			// 检查是否有 md-editor-mermaid class
			for _, attr := range n.Attr {
				if attr.Key == "class" && strings.Contains(attr.Val, "md-editor-mermaid") {
					mermaidNodes = append(mermaidNodes, mermaidNodeInfo{node: n, tagName: n.Data})
					break
				}
			}
		}
		// 递归查找子节点
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			mermaidNodes = append(mermaidNodes, findMermaidNodes(c)...)
		}
		return mermaidNodes
	}

	body := doc.FirstChild.LastChild // 获取 body 节点
	mermaidNodes := findMermaidNodes(body)
	if len(mermaidNodes) == 0 {
		return placeholders, htmlContent
	}

	// 为每个 Mermaid 节点渲染完整 HTML 并创建占位符
	result := htmlContent
	for i := len(mermaidNodes) - 1; i >= 0; i-- {
		nodeInfo := mermaidNodes[i]
		var buf bytes.Buffer
		if err := html.Render(&buf, nodeInfo.node); err != nil {
			log.Printf("[extractMermaidBlocks] 渲染节点失败: %v", err)
			continue
		}
		mermaidHTML := buf.String()
		placeholder := "MERMAID_PLACEHOLDER_" + uuid.New().String()
		placeholders[placeholder] = mermaidHTML

		// 在原始 HTML 中查找并替换（从后往前替换，避免位置偏移）
		// 使用正则表达式找到开始标签（支持 p 和 div）
		startTagPattern := regexp.MustCompile(`<(?:p|div)[^>]*class="[^"]*md-editor-mermaid[^"]*"[^>]*>`)
		matches := startTagPattern.FindAllStringIndex(result, -1)
		if len(matches) > i {
			startPos := matches[i][0]
			tagName := nodeInfo.tagName
			openTag := "<" + tagName
			closeTag := "</" + tagName
			closeTagLen := len(closeTag) + 1 // 包含 >

			// 从开始位置查找匹配的结束标签（计算嵌套深度）
			depth := 0
			endPos := -1
			for j := startPos; j < len(result); j++ {
				// 检查开始标签
				if j+len(openTag) <= len(result) && result[j:j+len(openTag)] == openTag {
					// 检查是否是开始标签（后面跟着空格或>）
					nextIdx := j + len(openTag)
					if nextIdx < len(result) && (result[nextIdx] == ' ' || result[nextIdx] == '>') {
						depth++
					}
				}
				// 检查结束标签
				if j+len(closeTag) <= len(result) && result[j:j+len(closeTag)] == closeTag {
					// 检查是否是结束标签（后面跟着>）
					nextIdx := j + len(closeTag)
					if nextIdx < len(result) && result[nextIdx] == '>' {
						depth--
						if depth == 0 {
							endPos = j + closeTagLen
							break
						}
					}
				}
			}
			if endPos > startPos {
				// 替换为占位符
				result = result[:startPos] + placeholder + result[endPos:]
			}
		}
	}

	return placeholders, result
}

// SanitizeHTML 仅对传入的HTML字符串进行XSS安全过滤。
// Mermaid 图表的 action 按钮会由前端动态添加，后端只需保留 SVG 内容。
// 使用缓存机制避免重复净化相同内容。
func (s *Service) SanitizeHTML(htmlContent string) string {
	// 计算内容的缓存键
	cacheKey := computeCacheKey(htmlContent)

	// 尝试从缓存获取
	if cached, hit := s.sanitizeCache.Get(cacheKey); hit {
		return cached
	}

	placeholders := make(map[string]string)

	// 检测 Mermaid 内容并提取保护
	contentToSanitize := htmlContent
	if strings.Contains(htmlContent, "md-editor-mermaid") {
		var replacedContent string
		placeholders, replacedContent = extractMermaidBlocks(htmlContent)
		contentToSanitize = replacedContent
	} else {
		// 使用正则表达式方法（向后兼容）
		contentToSanitize = s.mermaidRegex.ReplaceAllStringFunc(htmlContent, func(match string) string {
			placeholder := "MERMAID_PLACEHOLDER_" + uuid.New().String()
			placeholders[placeholder] = match
			return placeholder
		})
	}

	// 执行 XSS 过滤
	safeHTML := s.policy.Sanitize(contentToSanitize)

	// 使用 strings.NewReplacer 进行批量替换，性能更优
	finalHTML := safeHTML
	if len(placeholders) > 0 {
		replacerPairs := make([]string, 0, len(placeholders)*2)
		for placeholder, originalMermaid := range placeholders {
			replacerPairs = append(replacerPairs, placeholder, s.policy.Sanitize(originalMermaid))
		}
		batchReplacer := strings.NewReplacer(replacerPairs...)
		finalHTML = batchReplacer.Replace(safeHTML)
	}

	// 存入缓存
	s.sanitizeCache.Set(cacheKey, finalHTML)

	return finalHTML
}

// modifyEmojiImgTag 解析一个HTML片段，为找到的第一个<img>标签添加CSS类并设置alt属性。
func modifyEmojiImgTag(htmlSnippet string, classToAdd string, altText string) (string, error) {
	doc, err := html.Parse(strings.NewReader(htmlSnippet))
	if err != nil {
		return "", err
	}
	var modified bool
	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if modified {
			return
		}
		if n.Type == html.ElementNode && n.Data == "img" {
			classExists := false
			altExists := false
			for i, attr := range n.Attr {
				switch attr.Key {
				case "class":
					classExists = true
					if !strings.Contains(" "+attr.Val+" ", " "+classToAdd+" ") {
						n.Attr[i].Val = strings.TrimSpace(attr.Val + " " + classToAdd)
					}
				case "alt":
					altExists = true
					n.Attr[i].Val = altText
				}
			}
			if !classExists {
				n.Attr = append(n.Attr, html.Attribute{Key: "class", Val: classToAdd})
			}
			if !altExists {
				n.Attr = append(n.Attr, html.Attribute{Key: "alt", Val: altText})
			}
			modified = true
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}
	traverse(doc)
	var buf bytes.Buffer
	body := doc.FirstChild.LastChild
	for c := body.FirstChild; c != nil; c = c.NextSibling {
		if err := html.Render(&buf, c); err != nil {
			return "", err
		}
	}
	return buf.String(), nil
}
