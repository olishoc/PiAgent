const generatedSessionNamePattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sessionDisplayName(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed || generatedSessionNamePattern.test(trimmed)) return "Untitled chat";
  return trimmed;
}
