import { data } from "react-router";
import { ClientResponseError } from "pocketbase";

export type UploadFieldName = "comprovante" | "boleto";

/** Resposta da action com erros por campo (upload / formulário). */
export type FormActionWithUploadErrors = {
	errors?: {
		form?: string;
		comprovante?: string;
		boleto?: string;
	};
	error?: string;
	success?: boolean;
};

function extractPocketBaseMessage(err: ClientResponseError): string | null {
	const r = err.response as {
		message?: string;
		data?: Record<string, { message?: string } | unknown>;
	};
	if (typeof r?.message === "string" && r.message.trim()) {
		return r.message.trim();
	}
	const d = r?.data;
	if (d && typeof d === "object") {
		for (const v of Object.values(d)) {
			if (
				v &&
				typeof v === "object" &&
				"message" in v &&
				typeof (v as { message?: string }).message === "string"
			) {
				const m = (v as { message: string }).message;
				if (m.trim()) return m.trim();
			}
		}
	}
	return null;
}

/** Mensagem em português a partir de ClientResponseError ou outros erros. */
export function formatUploadError(err: unknown): string {
	if (err instanceof ClientResponseError) {
		if (err.isAbort) {
			return "Envio cancelado. Tente novamente.";
		}
		if (err.status === 0) {
			return "Sem conexão com o servidor de arquivos. Verifique a rede e tente novamente.";
		}
		if (err.status >= 500) {
			return "O servidor de arquivos está indisponível no momento. Tente novamente em instantes.";
		}
		if (err.status === 401 || err.status === 403) {
			return "Credenciais inválidas para o armazenamento de arquivos. Verifique POCKETBASE_* no .env.";
		}
		if (err.status === 404) {
			return "Recurso não encontrado no PocketBase. Verifique POCKETBASE_URL e POCKETBASE_COLLECTION.";
		}
		const pbMsg = extractPocketBaseMessage(err);
		if (pbMsg) {
			return pbMsg;
		}
		if (err.message?.trim()) {
			return err.message;
		}
		return "Não foi possível enviar o arquivo. Tente novamente.";
	}
	if (err instanceof Error && err.message.trim()) {
		return err.message;
	}
	return "Não foi possível enviar o arquivo. Tente novamente.";
}

/** Resposta 502 com `errors.comprovante` ou `errors.boleto` para o formulário. */
export function jsonFieldUploadError(field: UploadFieldName, err: unknown) {
	return data(
		{ errors: { [field]: formatUploadError(err) } },
		{ status: 502 },
	);
}

/** Erro ao persistir no banco — `errors.form`. */
export function jsonFormError(message: string, status = 500) {
	return data({ errors: { form: message } }, { status });
}
