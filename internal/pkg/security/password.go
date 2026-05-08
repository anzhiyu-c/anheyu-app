/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-15 13:06:01
 * @LastEditors: 安知鱼
 */
package security

import "golang.org/x/crypto/bcrypt"

// PasswordHashCost 密码哈希成本。
// bcrypt.DefaultCost(10) 在现代硬件上偏弱，提升到 12 以增加暴力破解成本，
// 单次哈希耗时约 ~250ms，登录/注册接口可接受。
const PasswordHashCost = 12

// HashPassword 对密码进行哈希处理。
// 调用方必须妥善处理错误并在错误时中止业务流程，
// 切勿用 `_, _ = HashPassword(...)` 丢弃 error，否则会向 DB 写入空字符串
// 导致登录校验直接通过空哈希。
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), PasswordHashCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// CheckPasswordHash 验证密码哈希
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
