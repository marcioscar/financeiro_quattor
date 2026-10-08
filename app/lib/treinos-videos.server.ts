import { readdir } from "node:fs/promises";
import path from "node:path";
import { toTitleCase } from "~/lib/utils";
import {
	isVideoPlaceholder,
	normalizarNome,
	type CatalogoExercicio,
	type VideoItem,
} from "~/lib/treinos-sugestoes";

const VIDEOS_DIR = path.join(process.cwd(), "public", "videos");
const DEFAULT_VIDEO = "_producao.gif";
const DEFAULT_VIDEO_LABEL = "_Producao";

function isGifFile(fileName: string): boolean {
	return fileName.toLowerCase().endsWith(".gif");
}

function removeGifExtension(fileName: string): string {
	return fileName.replace(/\.gif$/i, "");
}

function toVideoLabel(fileName: string): string {
	return removeGifExtension(fileName)
		.replace(/[_-]+/g, " ")
		.trim()
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function sortAlphabetically(items: string[]): string[] {
	return [...items].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function getTreinosVideoFiles(): Promise<string[]> {
	try {
		const files = await readdir(VIDEOS_DIR);
		return sortAlphabetically(files.filter(isGifFile));
	} catch {
		return [];
	}
}

export async function getTreinosVideoItems(): Promise<VideoItem[]> {
	const files = await getTreinosVideoFiles();
	const fileItems = files.map((fileName) => ({
		value: fileName,
		label: toVideoLabel(fileName),
	}));

	if (fileItems.some((item) => item.value === DEFAULT_VIDEO)) return fileItems;

	return [{ value: DEFAULT_VIDEO, label: DEFAULT_VIDEO_LABEL }, ...fileItems];
}

export async function getTreinosDefaultVideo(): Promise<string> {
	return DEFAULT_VIDEO;
}

type ExercicioHistorico = {
	exercicio?: string | null;
	repeticoes?: string | null;
	video?: string | null;
};

/**
 * Catálogo de exercícios já cadastrados, do mais usado para o menos usado,
 * com o vídeo real (não placeholder) mais frequente de cada um.
 */
export function montarCatalogoExercicios(
	bancoTreinos: Array<{ exercicios?: ExercicioHistorico[] | null }>,
	videoItems: VideoItem[],
): CatalogoExercicio[] {
	const existentes = new Set(videoItems.map((v) => v.value));
	const porNome = new Map<
		string,
		{ nomes: Map<string, number>; videos: Map<string, number>; usos: number }
	>();

	for (const bt of bancoTreinos) {
		for (const ex of bt.exercicios ?? []) {
			const nome = toTitleCase(String(ex.exercicio ?? "").trim());
			const chave = normalizarNome(nome);
			if (!chave) continue;
			let item = porNome.get(chave);
			if (!item) {
				item = { nomes: new Map(), videos: new Map(), usos: 0 };
				porNome.set(chave, item);
			}
			item.usos++;
			item.nomes.set(nome, (item.nomes.get(nome) ?? 0) + 1);
			const video = String(ex.video ?? "").trim();
			if (!isVideoPlaceholder(video) && existentes.has(video)) {
				item.videos.set(video, (item.videos.get(video) ?? 0) + 1);
			}
		}
	}

	const maisFrequente = (m: Map<string, number>) =>
		[...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

	return [...porNome.values()]
		.map((i) => ({
			nome: maisFrequente(i.nomes) ?? "",
			video: maisFrequente(i.videos),
			usos: i.usos,
		}))
		.sort((a, b) => b.usos - a.usos || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** séries mais usadas, para sugerir no campo de repetições */
export function repeticoesFrequentes(
	bancoTreinos: Array<{ exercicios?: ExercicioHistorico[] | null }>,
	limite = 8,
) {
	const cont = new Map<string, number>();
	for (const bt of bancoTreinos) {
		for (const ex of bt.exercicios ?? []) {
			const r = String(ex.repeticoes ?? "").trim();
			if (r) cont.set(r, (cont.get(r) ?? 0) + 1);
		}
	}
	return [...cont.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limite)
		.map(([r]) => r);
}
