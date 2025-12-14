// in internal/domain/model/user.go
package model

import (
	"database/sql/driver"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"
)

// ========= 业务常量 (与数据库实现无关) =========

// 权限常量定义了用户操作的权限位
const (
	PermissionAdmin       uint = 0
	PermissionCreateShare uint = 1
	PermissionAccessShare uint = 2
	PermissionUploadFile  uint = 3
	PermissionDeleteFile  uint = 4
)

// 用户状态常量定义了用户的几种不同状态
const (
	UserStatusActive   = 1
	UserStatusInactive = 2
	UserStatusBanned   = 3
)

// ========= 领域模型定义 =========

type User struct {
	ID           uint       `json:"id"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	Username     string     `json:"username"`
	PasswordHash string     `json:"-"`
	Nickname     string     `json:"nickname"`
	Avatar       string     `json:"avatar"`
	Email        string     `json:"email"`
	Website      string     `json:"website"`
	LastLoginAt  *time.Time `json:"lastLoginAt"`
	UserGroupID  uint       `json:"userGroupID"`
	UserGroup    UserGroup  `json:"userGroup"`
	Status       int        `json:"status"`
}

type GroupSettings struct {
	SourceBatch      int    `json:"source_batch"`
	PolicyOrdering   []uint `json:"policy_ordering"`
	RedirectedSource bool   `json:"redirected_source"`
}

func (s GroupSettings) Value() (driver.Value, error) {
	return json.Marshal(s)
}

func (s *GroupSettings) Scan(value interface{}) error {
	b, ok := value.([]byte)
	if !ok {
		if value == nil {
			*s = GroupSettings{}
			return nil
		}
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(b, s)
}

type Boolset []byte

func (bs Boolset) Value() (driver.Value, error) {
	if len(bs) == 0 {
		return "", nil
	}
	return base64.StdEncoding.EncodeToString(bs), nil
}

func (bs *Boolset) Scan(value interface{}) error {
	if value == nil {
		*bs = nil
		return nil
	}
	var encoded string
	switch v := value.(type) {
	case []byte:
		encoded = string(v)
	case string:
		encoded = v
	default:
		return errors.New("unsupported type for Boolset scan")
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return err
	}
	*bs = decoded
	return nil
}

func (bs Boolset) Enabled(n uint) bool {
	byteIndex := n / 8
	bitIndex := n % 8
	if byteIndex >= uint(len(bs)) {
		return false
	}
	return (bs[byteIndex] & (1 << bitIndex)) != 0
}

func (bs *Boolset) Set(n uint, value bool) {
	byteIndex := n / 8
	bitIndex := n % 8
	requiredLen := int(byteIndex + 1)
	if requiredLen > len(*bs) {
		newSlice := make([]byte, requiredLen)
		copy(newSlice, *bs)
		*bs = newSlice
	}
	if value {
		(*bs)[byteIndex] |= (1 << bitIndex)
	} else {
		(*bs)[byteIndex] &^= (1 << bitIndex)
	}
}

// NewBoolset 创建一个新的 Boolset，初始化指定的索引为 true
func NewBoolset(indices ...uint) Boolset {
	bs := Boolset{}
	for _, index := range indices {
		bs.Set(index, true)
	}
	return bs
}

func (bs Boolset) MarshalJSON() ([]byte, error) {
	var permissions []uint
	for i := uint(0); i < 32; i++ {
		if bs.Enabled(i) {
			permissions = append(permissions, i)
		}
	}
	return json.Marshal(permissions)
}

func (bs *Boolset) UnmarshalJSON(data []byte) error {
	var permissions []uint
	if err := json.Unmarshal(data, &permissions); err != nil {
		return err
	}
	*bs = Boolset{}
	for _, p := range permissions {
		bs.Set(p, true)
	}
	return nil
}

type UserGroup struct {
	ID               uint          `json:"id"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
	Name             string        `json:"name"`
	Description      string        `json:"description"`
	Permissions      Boolset       `json:"permissions"`
	MaxStorage       int64         `json:"max_storage"`
	SpeedLimit       int64         `json:"speed_limit"`
	Settings         GroupSettings `json:"settings"`
	StoragePolicyIDs []uint        `json:"storage_policy_ids"` // 该用户组可使用的存储策略ID列表
}
