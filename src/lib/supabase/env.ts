const SUPABASE_URL_NAME = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_NAME = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

function requireEnvironmentVariable(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }

  return value;
}

export function getSupabaseEnvironment() {
  const url = requireEnvironmentVariable(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL_NAME,
  );
  const publishableKey = requireEnvironmentVariable(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_PUBLISHABLE_KEY_NAME,
  );

  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error(
      `Formato inválido para a variável: ${SUPABASE_PUBLISHABLE_KEY_NAME}`,
    );
  }

  return { publishableKey, url };
}
