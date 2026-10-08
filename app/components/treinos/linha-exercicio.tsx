import { MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import { CampoSugestoes } from "~/components/treinos/campo-sugestoes";
import {
	isVideoPlaceholder,
	normalizarNome,
	sugerirVideo,
	videoSrc,
	type CatalogoExercicio,
	type VideoItem,
} from "~/lib/treinos-sugestoes";
import { cn } from "~/lib/utils";

export type ExercicioForm = {
	exercicio: string;
	repeticoes: string;
	observacao: string;
	video: string;
	/** o usuário escolheu o vídeo na mão: não trocar mais pelo sugerido */
	videoManual?: boolean;
};

export type SugestoesTreino = {
	catalogo: CatalogoExercicio[];
	videoItems: VideoItem[];
	defaultVideo: string;
	repeticoes: string[];
};

export function LinhaExercicio({
	numero,
	exercicio,
	sugestoes,
	onChange,
	onRemove,
	onEnter,
	autoFocus,
	disabled,
}: {
	numero: number;
	exercicio: ExercicioForm;
	sugestoes: SugestoesTreino;
	onChange: (ex: ExercicioForm) => void;
	onRemove: () => void;
	/** Enter no campo de repetições: ir para o próximo exercício */
	onEnter?: () => void;
	autoFocus?: boolean;
	disabled: boolean;
}) {
	const { catalogo, videoItems, defaultVideo, repeticoes } = sugestoes;
	const anchorVideoRef = useComboboxAnchor();
	const [mostrarObs, setMostrarObs] = useState(!!exercicio.observacao);

	const temVideo = !isVideoPlaceholder(exercicio.video);
	const videoLabel =
		videoItems.find((item) => item.value === exercicio.video)?.label ?? "";
	const videoAutomatico = temVideo && !exercicio.videoManual;

	function mudarNome(nome: string) {
		const next = { ...exercicio, exercicio: nome };
		if (!exercicio.videoManual) {
			next.video = sugerirVideo(nome, catalogo, videoItems) ?? defaultVideo;
		}
		onChange(next);
	}

	function sugestoesReps(texto: string) {
		const t = normalizarNome(texto);
		return repeticoes.filter(
			(r) => r !== texto && (!t || normalizarNome(r).includes(t)),
		);
	}

	return (
		<div className='group rounded-lg border bg-card p-3 transition-colors focus-within:border-orange-300 focus-within:bg-orange-50/30'>
			<div className='flex flex-col gap-3 md:flex-row md:items-center'>
				<div className='flex items-center gap-3 md:contents'>
					<span className='flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground'>
						{numero}
					</span>
					<Input
						className='md:flex-[2]'
						placeholder='Nome do exercício'
						aria-label={`Exercício ${numero}`}
						value={exercicio.exercicio}
						onChange={(e) => mudarNome(e.target.value)}
						disabled={disabled}
						autoFocus={autoFocus}
					/>
				</div>

				<CampoSugestoes
					className='md:flex-[1.3]'
					aria-label={`Repetições do exercício ${numero}`}
					placeholder='Repetições (ex: 4 x 8)'
					value={exercicio.repeticoes}
					onChange={(r) => onChange({ ...exercicio, repeticoes: r })}
					onEscolher={(r) => onChange({ ...exercicio, repeticoes: r })}
					sugestoes={sugestoesReps}
					chave={(r) => r}
					renderItem={(r) => <span className='truncate'>{r}</span>}
					onEnter={onEnter}
					disabled={disabled}
				/>

				<div className='flex items-center gap-2 md:flex-[1.6]'>
					{temVideo ? (
						<img
							src={videoSrc(exercicio.video)}
							alt=''
							loading='lazy'
							className='size-10 shrink-0 rounded-md border bg-white object-cover'
						/>
					) : (
						<span className='flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed text-[10px] text-muted-foreground'>
							sem
						</span>
					)}
					<div ref={anchorVideoRef} className='relative min-w-0 flex-1'>
						<Combobox
							value={
								exercicio.video
									? { value: exercicio.video, label: videoLabel }
									: null
							}
							onValueChange={(v) =>
								v &&
								onChange({ ...exercicio, video: v.value, videoManual: true })
							}
							items={videoItems}>
							<ComboboxInput
								placeholder='Buscar vídeo...'
								disabled={disabled}
								aria-label={`Vídeo do exercício ${numero}`}
							/>
							<ComboboxContent anchor={anchorVideoRef}>
								<ComboboxList>
									{(item: VideoItem) => (
										<ComboboxItem key={item.value} value={item}>
											{item.label}
										</ComboboxItem>
									)}
								</ComboboxList>
								<ComboboxEmpty>Nenhum vídeo encontrado</ComboboxEmpty>
							</ComboboxContent>
						</Combobox>
						{videoAutomatico && (
							<span className='pointer-events-none absolute -top-2 right-2 flex items-center gap-0.5 rounded bg-orange-100 px-1 text-[10px] font-medium text-orange-700'>
								<Sparkles className='size-2.5' />
								automático
							</span>
						)}
					</div>
				</div>

				<div className='flex shrink-0 items-center justify-end gap-1'>
					<Button
						type='button'
						variant='ghost'
						size='icon'
						onClick={() => setMostrarObs((v) => !v)}
						disabled={disabled}
						title='Observação'
						className={cn(
							"size-8 text-muted-foreground",
							(mostrarObs || exercicio.observacao) && "text-orange-600",
						)}>
						<MessageSquarePlus className='size-4' />
					</Button>
					<Button
						type='button'
						variant='ghost'
						size='icon'
						onClick={onRemove}
						disabled={disabled}
						title='Remover exercício'
						className='size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive'>
						<Trash2 className='size-4' />
					</Button>
				</div>
			</div>

			{mostrarObs && (
				<Input
					className='mt-2 md:ml-10 md:w-[calc(100%-2.5rem)]'
					placeholder='Observação (opcional)'
					value={exercicio.observacao}
					onChange={(e) => onChange({ ...exercicio, observacao: e.target.value })}
					disabled={disabled}
				/>
			)}
		</div>
	);
}
