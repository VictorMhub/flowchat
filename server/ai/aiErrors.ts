
export function isGeminiQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const details = error as {
    status?: number | string;
    code?: number;
    message?: string;
  };

  return (
    details.status === 429 ||
    details.code === 429 ||
    details.status === "RESOURCE_EXHAUSTED" ||
    /429|RESOURCE_EXHAUSTED|quota exceeded/i.test(
      details.message ?? "",
    )
  );
}

export function getAIErrorMessage(error: unknown): string {
  if (isGeminiQuotaError(error)) {
    return "O serviço de IA atingiu seu limite temporário de uso. Tente novamente mais tarde.";
  }

  return "Não foi possível gerar a resposta. Tente novamente.";
}
