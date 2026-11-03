/** Remove the API-key settings the retired browser-side AI integration stored. */
export function removeLegacyAiSettings(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem("ai-settings");
  } catch {
    // Storage can be blocked; there is nothing to clean up then.
  }
}
