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

	policy := bluemonday.UGCPolicy()

	policy.AllowURLSchemes("anzhiyu")

	policy.AllowElements("div", "ul", "i", "table", "thead", "tbody", "tr", "th", "td", "button", "a", "img", "span", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "font", "p", "details", "summary", "svg", "path", "circle", "input", "math", "semantics", "mrow", "mi", "mo", "msup", "mn", "annotation", "style", "g", "marker", "rect", "foreignObject", "li", "ol", "strong", "u", "em", "s", "sup", "sub", "blockquote", "figure", "video", "audio", "iframe", "defs", "symbol", "line", "text", "tspan", "ellipse", "polygon")

	policy.AllowAttrs("class").Matching(bluemonday.SpaceSeparatedTokens).OnElements("ul", "i", "code", "span", "img", "a", "button", "pre", "div", "table", "thead", "tbody", "tr", "th", "td", "h1", "h2", "h3", "h4", "h5", "h6", "font", "p", "details", "summary", "svg", "path", "circle", "input", "g", "rect", "li", "line", "text", "tspan", "blockquote", "video", "audio", "marker", "ellipse", "polygon", "foreignObject")
	policy.AllowAttrs("style").OnElements(
		"div", "span", "p", "font", "th", "td", "rect", "blockquote", "img", "h1", "h2", "h3", "h4", "h5", "h6", "a", "strong", "b", "em", "i", "u", "s", "strike", "del", "pre", "code", "sub", "sup", "mark", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "section", "article", "header", "footer", "nav", "aside", "main", "hr", "figure", "figcaption", "svg", "path", "circle", "line", "g", "text", "summary", "details", "button", "video", "iframe", "ellipse", "polygon", "foreignObject", "marker",
	)
	// 图片相关属性
	policy.AllowAttrs("src", "alt", "title", "width", "height").OnElements("img")
	policy.AllowAttrs("ontoggle").OnElements("details")
	policy.AllowAttrs("onmouseover", "onmouseout").OnElements("summary")
	policy.AllowAttrs("onclick").OnElements("button", "div", "i", "span")
	policy.AllowAttrs("onmouseenter", "onmouseleave").OnElements("span")
	policy.AllowAttrs("color").OnElements("font")
	policy.AllowAttrs("align").OnElements("div")
	policy.AllowAttrs("xmlns").OnElements("annotation", "div")
	policy.AllowAttrs("encoding").OnElements("input")
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

	policy.AllowAttrs("orient", "markerHeight", "markerWidth", "markerUnits", "refY", "refX", "viewBox", "class", "id").OnElements("marker")
	policy.AllowAttrs("language").OnElements("code")
	policy.AllowAttrs("open").OnElements("details")
	policy.AllowAttrs("data-line").OnElements("details", "p", "h2", "h3", "blockquote", "ol", "li", "figure", "table", "div")
	policy.AllowAttrs("data-mermaid-theme", "data-closed", "data-processed").OnElements("p")
	policy.AllowAttrs("data-tips").OnElements("span")
	policy.AllowAttrs("data-href").OnElements("button")
	policy.AllowAttrs("type").OnElements("button")
	policy.AllowAttrs("aria-label").OnElements("button")

	policy.AllowAttrs("data-tip-id").OnElements("span")
	policy.AllowAttrs("data-content", "data-position", "data-theme", "data-trigger", "data-delay").OnElements("div")
	policy.AllowAttrs("role").OnElements("div")
	policy.AllowAttrs("aria-hidden").OnElements("div")

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

	// 视频画廊相关属性
	policy.AllowAttrs("src", "poster", "controls", "preload", "playsinline", "type").OnElements("video")

	// 图片画廊相关属性
	policy.AllowAttrs("data-ratio").OnElements("div")

	// 音乐播放器相关属性
	policy.AllowAttrs("data-music-id", "data-music-data", "data-music-name", "data-music-artist", "data-music-pic", "data-music-url", "data-initialized", "data-audio-loaded", "data-events-attached").OnElements("div", "audio")
	policy.AllowAttrs("preload").OnElements("audio")

	// iframe 相关属性
	policy.AllowAttrs("src", "width", "height", "scrolling", "seamless", "class", "id", "title", "frameborder", "allowfullscreen", "sandbox").OnElements("iframe")

	policy.AllowAttrs("id").OnElements("div", "h1", "h2", "h3", "h4", "h5", "h6", "button", "a", "img", "span", "code", "pre", "table", "thead", "tbody", "tr", "th", "td", "font", "details", "summary", "svg", "blockquote", "video", "iframe")

	svc := &Service{
		settingSvc:   settingSvc,
		mdParser:     mdParser,
		policy:       policy,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		mermaidRegex: regexp.MustCompile(`(?s)<p[^>]*class="md-editor-mermaid"[^>]*>.*?</p>`),
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
		} else {
			log.Printf("接收到表情包配置更新事件，但URL '%s' 未发生变化，无需重新加载。", evt.Value)
		}
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
func (s *Service) ToHTML(ctx context.Context, content string) (string, error) {
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

	finalHTML := safeHTML
	for placeholder, originalMermaid := range placeholders {
		finalHTML = strings.Replace(finalHTML, placeholder, originalMermaid, 1)
	}

	return finalHTML, nil
}

// extractMermaidBlocks 使用 HTML 解析器提取完整的 Mermaid 块（包括 action div）
func extractMermaidBlocks(htmlContent string) (map[string]string, string) {
	placeholders := make(map[string]string)
	doc, err := html.Parse(strings.NewReader("<body>" + htmlContent + "</body>"))
	if err != nil {
		log.Printf("[extractMermaidBlocks] HTML 解析失败: %v", err)
		return placeholders, htmlContent
	}

	var findMermaidNodes func(*html.Node) []*html.Node
	findMermaidNodes = func(n *html.Node) []*html.Node {
		var mermaidNodes []*html.Node
		if n.Type == html.ElementNode && n.Data == "p" {
			// 检查是否有 md-editor-mermaid class
			for _, attr := range n.Attr {
				if attr.Key == "class" && strings.Contains(attr.Val, "md-editor-mermaid") {
					mermaidNodes = append(mermaidNodes, n)
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
		node := mermaidNodes[i]
		var buf bytes.Buffer
		if err := html.Render(&buf, node); err != nil {
			log.Printf("[extractMermaidBlocks] 渲染节点失败: %v", err)
			continue
		}
		mermaidHTML := buf.String()
		placeholder := "MERMAID_PLACEHOLDER_" + uuid.New().String()
		placeholders[placeholder] = mermaidHTML

		// 在原始 HTML 中查找并替换（从后往前替换，避免位置偏移）
		// 使用正则表达式找到开始标签
		startTagPattern := regexp.MustCompile(`<p[^>]*class="[^"]*md-editor-mermaid[^"]*"[^>]*>`)
		matches := startTagPattern.FindAllStringIndex(result, -1)
		if len(matches) > i {
			startPos := matches[i][0]
			// 从开始位置查找匹配的 </p>（计算嵌套深度）
			depth := 0
			endPos := -1
			for j := startPos; j < len(result); j++ {
				if j+1 < len(result) && result[j:j+2] == "<p" {
					// 检查是否是开始标签（后面跟着空格或>）
					if j+2 < len(result) && (result[j+2] == ' ' || result[j+2] == '>') {
						depth++
					}
				} else if j+3 < len(result) && result[j:j+3] == "</p" {
					// 检查是否是结束标签（后面跟着>）
					if j+3 < len(result) && result[j+3] == '>' {
						depth--
						if depth == 0 {
							endPos = j + 4
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
func (s *Service) SanitizeHTML(htmlContent string) string {
	placeholders := make(map[string]string)

	// 检测 Mermaid 内容并提取保护
	if strings.Contains(htmlContent, "md-editor-mermaid") {
		var replacedContent string
		placeholders, replacedContent = extractMermaidBlocks(htmlContent)
		htmlContent = replacedContent
	} else {
		// 使用正则表达式方法（向后兼容）
		htmlContent = s.mermaidRegex.ReplaceAllStringFunc(htmlContent, func(match string) string {
			placeholder := "MERMAID_PLACEHOLDER_" + uuid.New().String()
			placeholders[placeholder] = match
			return placeholder
		})
	}

	// 执行 XSS 过滤
	safeHTML := s.policy.Sanitize(htmlContent)

	// 将 Mermaid 块替换回来
	finalHTML := safeHTML
	for placeholder, originalMermaid := range placeholders {
		finalHTML = strings.Replace(finalHTML, placeholder, originalMermaid, 1)
	}

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
