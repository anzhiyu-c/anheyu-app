package article

import "github.com/anzhiyu-c/anheyu-app/pkg/domain/model"

// publicArticleResponse keeps management metadata inside authenticated endpoints.
func publicArticleResponse(article *model.ArticleResponse) *model.ArticleResponse {
	if article == nil {
		return nil
	}
	result := *article
	result.OwnerID = 0
	result.OwnerEmail = ""
	result.ReviewStatus = ""
	result.ScheduledAt = nil
	result.IsTakedown = false
	result.TakedownReason = ""
	result.TakedownAt = nil
	result.TakedownBy = nil
	return &result
}

func publicArticleList(articles []model.ArticleResponse) []model.ArticleResponse {
	result := make([]model.ArticleResponse, len(articles))
	for i := range articles {
		result[i] = *publicArticleResponse(&articles[i])
	}
	return result
}
