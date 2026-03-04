/**
 * Módulo para upload de arquivos no PocketBase.
 * Usa a API do PocketBase para upload e geração de links públicos.
 */

import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL?.replace(/\/$/, "") ?? "";
const POCKETBASE_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL ?? "";
const POCKETBASE_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD ?? "";
const POCKETBASE_COLLECTION =
	process.env.POCKETBASE_COLLECTION ?? "arquivos_compartilhados";
const POCKETBASE_FIELD = process.env.POCKETBASE_FIELD ?? "documento";

function getClient(): PocketBase {
	if (!POCKETBASE_URL || !POCKETBASE_ADMIN_EMAIL || !POCKETBASE_ADMIN_PASSWORD) {
		throw new Error(
			"POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL e POCKETBASE_ADMIN_PASSWORD devem estar definidos no .env",
		);
	}
	return new PocketBase(POCKETBASE_URL);
}

/** Remove caracteres inválidos do nome do arquivo */
function sanitizeFilename(filename: string): string {
	return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "arquivo";
}

const SYSTEM_FIELDS = new Set(["id", "collectionId", "collectionName", "created", "updated", "expand"]);

/** Obtém o nome do arquivo do record; fallback para safeName se o campo estiver vazio */
function resolveFileName(
	record: Record<string, unknown>,
	fieldName: string,
	fallback: string,
): string {
	const value = record[fieldName];
	if (typeof value === "string" && value.length > 0) {
		return value;
	}
	// Fallback: procura campo File (string com extensão tipo .pdf, .png, etc.)
	for (const [key, v] of Object.entries(record)) {
		if (SYSTEM_FIELDS.has(key)) continue;
		if (typeof v === "string" && /\.(pdf|jpg|jpeg|png|webp|gif)$/i.test(v)) {
			return v;
		}
	}
	return fallback;
}

/**
 * Faz upload de um recibo para o PocketBase e retorna a URL pública.
 *
 * @param fileBuffer - Conteúdo do arquivo em Buffer
 * @param filename - Nome do arquivo (ex: recibo-123.pdf)
 * @returns URL pública para acesso ao arquivo
 */
export async function uploadReciboAndGetUrl(
	fileBuffer: Buffer,
	filename: string,
): Promise<string> {
	const pb = getClient();

	await pb.admins.authWithPassword(
		POCKETBASE_ADMIN_EMAIL,
		POCKETBASE_ADMIN_PASSWORD,
	);

	const safeName = sanitizeFilename(filename);
	const file = new File([new Uint8Array(fileBuffer)], safeName, {
		type: "application/octet-stream",
	});

	const formData = new FormData();
	formData.append(POCKETBASE_FIELD, file);

	try {
		const record = await pb.collection(POCKETBASE_COLLECTION).create(formData);
		const fileName = resolveFileName(record, POCKETBASE_FIELD, safeName);
		if (!fileName || fileName === "undefined") {
			throw new Error(
				`Campo "${POCKETBASE_FIELD}" não retornou nome do arquivo. Verifique POCKETBASE_FIELD no .env (deve ser o nome exato do campo File na collection). Record: ${JSON.stringify(record)}`,
			);
		}
		const shareLink = `${pb.baseUrl}/api/files/${record.collectionId}/${record.id}/${encodeURIComponent(fileName)}`;

		pb.authStore.clear();
		return shareLink;
	} catch (error) {
		pb.authStore.clear();
		console.error("Erro no PocketBase:", error);

		const msg = error instanceof Error ? error.message : "Erro desconhecido";
		const resp = error as { response?: { message?: string } };
		const detalhe = resp?.response?.message ?? msg;

		throw new Error(
			`Upload falhou: ${detalhe}. Verifique POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL e POCKETBASE_ADMIN_PASSWORD no .env.`,
		);
	}
}
