package comment

import (
	"errors"
	"strings"
)

// ErrForbiddenNickname 表示评论昵称命中了管理员配置的违禁词。
var ErrForbiddenNickname = errors.New("昵称包含违禁词，请修改后重新提交")

func containsForbiddenNicknameWord(nickname, words string) bool {
	if words == "" {
		return false
	}
	nickname = strings.ToLower(nickname)
	for _, word := range strings.FieldsFunc(words, func(r rune) bool {
		return r == '\n' || r == '\r' || r == ',' || r == '，'
	}) {
		word = strings.ToLower(strings.TrimSpace(word))
		if word != "" && strings.Contains(nickname, word) {
			return true
		}
	}
	return false
}
