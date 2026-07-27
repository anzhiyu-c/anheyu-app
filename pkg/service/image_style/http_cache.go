package image_style

import "strings"

// MatchesIfNoneMatch 对 GET/HEAD 使用弱比较匹配 If-None-Match。
// 支持单标签、逗号列表、弱标签 W/ 与通配符 *。
func MatchesIfNoneMatch(headerValue, currentETag string) bool {
	current := weakETagValue(currentETag)
	if current == "" {
		return false
	}
	for _, candidate := range splitETagList(headerValue) {
		candidate = strings.TrimSpace(candidate)
		if candidate == "*" || weakETagValue(candidate) == current {
			return true
		}
	}
	return false
}

func weakETagValue(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "W/") {
		value = strings.TrimSpace(value[2:])
	}
	if len(value) < 2 || value[0] != '"' || value[len(value)-1] != '"' {
		return ""
	}
	return value
}

func splitETagList(value string) []string {
	var (
		parts    []string
		start    int
		inQuotes bool
	)
	for i := 0; i < len(value); i++ {
		switch value[i] {
		case '"':
			inQuotes = !inQuotes
		case ',':
			if !inQuotes {
				parts = append(parts, value[start:i])
				start = i + 1
			}
		}
	}
	parts = append(parts, value[start:])
	return parts
}
