/**
 * 校验暂存对象路径属于当前用户且符合 staging 命名（防跨用户引用）。
 */
export function isValidStagingPathForUser(stagingPath: string, userId: string): boolean {
  const prefix = `${userId}/`;
  if (!stagingPath.startsWith(prefix)) {
    return false;
  }
  const rest = stagingPath.slice(prefix.length);
  return /^staging_[0-9a-f-]{36}\.docx$/i.test(rest);
}

export function assertStagingPathForUser(stagingPath: string, userId: string): void {
  if (!isValidStagingPathForUser(stagingPath, userId)) {
    throw new Error("STAGING_INVALID");
  }
}
