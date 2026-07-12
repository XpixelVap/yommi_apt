export async function runOptionalUpload(task: () => Promise<void>): Promise<boolean> {
  try {
    await task();
    return true;
  } catch {
    return false;
  }
}