import { readdir } from "node:fs/promises";
import path from "node:path";

type VideoItem = {
	value: string;
	label: string;
};

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
