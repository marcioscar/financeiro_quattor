/**
 * Sugestões do cadastro de treinos (roda no cliente e no servidor).
 *
 * O catálogo de exercícios vem do histórico do banco de treinos: para cada
 * nome já usado guardamos o vídeo mais frequente. Exercício novo, sem
 * histórico, tenta casar o nome com o nome do arquivo .gif.
 */

export type VideoItem = { value: string; label: string };

export type CatalogoExercicio = {
	nome: string;
	video: string | null;
	usos: number;
};

/** vídeos "em produção" (placeholder) não contam como vídeo de verdade */
export function isVideoPlaceholder(video: string | null | undefined) {
	const v = (video ?? "").trim().toLowerCase();
	return !v || v === "_producao.gif" || v === "producao.gif";
}

/** minúsculas, sem acento e sem pontuação — para comparar nomes */
export function normalizarNome(texto: string) {
	return texto
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function tokens(texto: string) {
	return new Set(normalizarNome(texto).split(" ").filter(Boolean));
}

/** vídeo cujo nome de arquivo mais se parece com o nome do exercício */
function videoPorNome(nome: string, videoItems: VideoItem[]) {
	const alvo = tokens(nome);
	if (alvo.size === 0) return null;
	let melhor: { value: string; score: number } | null = null;
	for (const item of videoItems) {
		if (isVideoPlaceholder(item.value)) continue;
		const t = tokens(item.value.replace(/\.gif$/i, ""));
		let comuns = 0;
		for (const x of alvo) if (t.has(x)) comuns++;
		const score = comuns / (alvo.size + t.size - comuns);
		if (!melhor || score > melhor.score) melhor = { value: item.value, score };
	}
	// exige boa sobreposição para não sugerir vídeo errado
	return melhor && melhor.score >= 0.6 ? melhor.value : null;
}

export function sugerirVideo(
	nome: string,
	catalogo: CatalogoExercicio[],
	videoItems: VideoItem[],
): string | null {
	const chave = normalizarNome(nome);
	if (!chave) return null;
	const doHistorico = catalogo.find((c) => normalizarNome(c.nome) === chave);
	if (doHistorico?.video) return doHistorico.video;
	return videoPorNome(nome, videoItems);
}

/** busca sem acento; todas as palavras digitadas precisam aparecer */
export function filtrarCatalogo(
	busca: string,
	catalogo: CatalogoExercicio[],
	limite = 8,
) {
	const termos = normalizarNome(busca).split(" ").filter(Boolean);
	if (termos.length === 0) return [];
	return catalogo
		.filter((c) => {
			const n = normalizarNome(c.nome);
			return termos.every((t) => n.includes(t));
		})
		.slice(0, limite);
}

export function videoSrc(video: string) {
	return `/videos/${encodeURIComponent(video)}`;
}
