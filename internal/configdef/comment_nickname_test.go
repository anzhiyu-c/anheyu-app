package configdef

import (
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

func TestCommentNicknameForbiddenWordsDefaultIsEmptyAndPrivate(t *testing.T) {
	for _, definition := range AllSettings {
		if definition.Key != constant.KeyCommentNicknameForbiddenWords {
			continue
		}
		if definition.Value != "" || definition.IsPublic {
			t.Fatalf("nickname forbidden words must default to empty and private: %+v", definition)
		}
		return
	}
	t.Fatal("nickname forbidden words setting is not registered")
}
