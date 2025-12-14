/*
 * @Description: 文件上传相关的领域模型
 * @Author: 安知鱼
 * @Date: 2025-06-28 00:21:55
 * @LastEditTime: 2025-07-16 11:58:36
 * @LastEditors: 安知鱼
 */
package model

import "time"

// --- API 请求模型 ---

// CreateUploadRequest 对应“创建上传会话”API的请求体。
type CreateUploadRequest struct {
	URI       string `json:"uri" binding:"required"`
	Size      int64  `json:"size" binding:"required,min=0"`
	PolicyID  string `json:"policy_id" binding:"required"`
	Overwrite bool   `json:"overwrite,omitempty"`
}

// FinalizeUploadRequest 定义了客户端直传完成后，通知服务器时需要携带的数据
type FinalizeUploadRequest struct {
	URI      string `json:"uri" binding:"required"`       // 文件的完整目标URI (与 CreateUploadRequest 相同)
	PolicyID string `json:"policy_id" binding:"required"` // 存储策略ID
	Size     int64  `json:"size" binding:"gte=0"`         // 文件大小
}

type DeleteUploadRequest struct {
	ID string `json:"id" binding:"required"`
}

// UploadSessionData 定义了创建上传会话后返回给前端的、统一的响应数据
type UploadSessionData struct {
	// --- 通用字段 ---
	Expires      int64  `json:"expires"`
	UploadMethod string `json:"upload_method"` // "server" 或 "client"

	// --- 仅客户端直传时使用 ---
	UploadURL   string `json:"upload_url,omitempty"`
	ContentType string `json:"content_type,omitempty"` // 期望的 Content-Type（仅阿里云OSS需要）

	// --- 仅服务端上传时使用 ---
	SessionID string `json:"session_id,omitempty"`
	ChunkSize int    `json:"chunk_size,omitempty"`

	// 可选的策略信息，方便前端展示
	StoragePolicy *StoragePolicyInfo `json:"storage_policy,omitempty"`
}

// StoragePolicyInfo 提供了存储策略的基本信息，用于 API 响应。
type StoragePolicyInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	MaxSize int64  `json:"max_size"`
}

// UploadSessionStatusResponse 定义了获取上传会话状态接口的成功响应体
type UploadSessionStatusResponse struct {
	SessionID      string    `json:"session_id"`
	IsValid        bool      `json:"is_valid"`
	ChunkSize      int64     `json:"chunk_size"`
	TotalChunks    int       `json:"total_chunks"`
	UploadedChunks []int     `json:"uploaded_chunks"`
	ExpiresAt      time.Time `json:"expires_at"`
}

// UploadSessionInvalidResponse 定义了会话无效时的响应体
type UploadSessionInvalidResponse struct {
	IsValid bool `json:"is_valid"`
}

// --- 内部领域模型 ---

// UploadSession 定义了文件分块上传会话的模型 (存储在Redis中)。
// 这个会话现在与一个临时的物理实体（Entity）绑定，而不是一个逻辑文件（File）。
type UploadSession struct {
	SessionID      string       `json:"session_id"`
	OwnerID        uint         `json:"owner_id"`
	PolicyID       string       `json:"policy_id"`
	URI            string       `json:"uri"` // 文件的完整目标URI
	ChunkSize      int          `json:"chunk_size"`
	FileSize       int64        `json:"file_size"`
	TempEntityID   uint         `json:"temp_entity_id"`
	UploadedChunks map[int]bool `json:"uploaded_chunks"`
	ExpireAt       time.Time    `json:"expire_at"`
}
